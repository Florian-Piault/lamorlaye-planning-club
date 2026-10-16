import { Plus, Trash2, X } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { MessageZone } from "@/components/feedback/MessageZone";
import { errorMessages, warnings as warningMessages } from "@/components/feedback/messages";
import { sameValues } from "@/components/form/formState";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import type { Court, Level } from "@/db/schema";
import type { BusySlot } from "@/domain/instructorAvailability";
import { matchesSearch } from "@/domain/search";
import { formatDuration, minutesToTime, weekdayLabel } from "@/domain/time";
import type { GroupInput } from "@/domain/validation";
import { emptyGroupValues, GroupForm } from "@/features/referentiels/groupes/GroupForm";
import type { LessonFormValues } from "../grid/actions";
import { SNAP_MINUTES } from "../grid/geometry";
import { type DateOfWeekday, instructorChoices, noDate } from "../grid/view";
import type { PlanningInstructor } from "../references";

export type { LessonFormValues };

/** Action supplémentaire du panneau (« Appliquer à partir de cette semaine »). */
export interface PanelAction {
  label: string;
  onClick: (values: LessonFormValues) => void;
}

export interface PanelGroup {
  id: string;
  name: string;
  memberCount: number;
  maxSize: number;
  active: boolean;
}

interface LessonPanelProps {
  mode: "create" | "edit";
  initialValues: LessonFormValues;
  weekdays: readonly number[];
  dayStart: number;
  dayEnd: number;
  courts: readonly Court[];
  groups: readonly PanelGroup[];
  instructors: readonly PlanningInstructor[];
  levels: readonly Level[];
  /** Avertissements du créneau saisi, en temps réel. */
  warningsOf: (values: LessonFormValues) => string[];
  onSubmit: (values: LessonFormValues) => void;
  onClose: () => void;
  onDelete?: () => void;
  /** Brouillon du nouveau cours, dessiné sur la grille. */
  onDraftChange?: (values: LessonFormValues) => void;
  /**
   * Moniteur choisi dans le panneau (nul à la fermeture) : ses indisponibilités
   * sont hachurées, avant celles du moniteur survolé (B8).
   */
  onInstructorChange?: (instructorId: string | null) => void;
  /** Cours placés, pour ranger à part les moniteurs déjà occupés sur le créneau (§5.1). */
  busySlots?: readonly BusySlot[];
  /** Cours en cours d'édition, exclu de ce calcul. */
  excludedId?: string | null;
  /**
   * Saisie modifiée (différente des valeurs à l'ouverture) : l'écran demande
   * alors confirmation avant de fermer le panneau ou d'en ouvrir un autre.
   */
  onDirtyChange?: (dirty: boolean) => void;
  /** Création rapide d'un groupe ; renvoie son identifiant. */
  onCreateGroup: (input: GroupInput) => Promise<string>;
  /** Titre (et nom accessible) du formulaire. */
  title?: string;
  submitLabel?: string;
  deleteLabel?: string;
  /** Groupe facultatif (cours ponctuel). */
  groupOptional?: boolean;
  /** Groupe non modifiable (séance d'un cours, pour une seule semaine). */
  groupLocked?: boolean;
  /** Libellé d'un jour (« Mercredi 04/11 » en semaine datée). */
  dayHeading?: (weekday: number) => string;
  /** Date de chaque jour (semaine datée) : indisponibilités datées des moniteurs. */
  dateOf?: DateOfWeekday;
  /** Mention sous le titre (portée de la modification). */
  notice?: ReactNode;
  actions?: readonly PanelAction[];
  /** Contenu affiché sous le formulaire (actions sur la séance). */
  children?: ReactNode;
  /** Saison archivée : détail du cours, sans aucune action de modification. */
  readOnly?: boolean;
}

/**
 * Panneau latéral de création et de modification d'un cours (§5.1) : groupe
 * (avec recherche et création rapide), moniteur (disponibles en tête), jour,
 * début, durée, court et note, avec les avertissements du créneau.
 */
export function LessonPanel({
  mode,
  initialValues,
  weekdays,
  dayStart,
  dayEnd,
  courts,
  groups,
  instructors,
  levels,
  warningsOf,
  onSubmit,
  onClose,
  onDelete,
  onDraftChange,
  onInstructorChange,
  busySlots = noBusySlots,
  excludedId = null,
  onDirtyChange,
  onCreateGroup,
  title: titleProp,
  submitLabel = mode === "create" ? "Créer le cours" : "Enregistrer",
  deleteLabel = "Supprimer",
  groupOptional = false,
  groupLocked: groupLockedProp = false,
  dayHeading = weekdayLabel,
  dateOf = noDate,
  notice: noticeProp,
  actions = [],
  children,
  readOnly = false,
}: LessonPanelProps) {
  const title = readOnly
    ? "Détail du cours"
    : (titleProp ?? (mode === "create" ? "Nouveau cours" : "Modifier le cours"));
  const groupLocked = groupLockedProp || readOnly;
  const notice = readOnly ? "Saison archivée : consultation seule." : noticeProp;
  const [values, setValues] = useState(initialValues);
  const [groupQuery, setGroupQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const set = (patch: Partial<LessonFormValues>) => {
    setError(null);
    setValues((v) => ({ ...v, ...patch }));
  };

  useEffect(() => {
    onDraftChange?.(values);
  }, [values, onDraftChange]);
  useEffect(() => {
    onInstructorChange?.(values.instructorId || null);
  }, [values.instructorId, onInstructorChange]);
  useEffect(() => () => onInstructorChange?.(null), [onInstructorChange]);

  const dirty = !readOnly && !sameValues(values, initialValues);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  // Garde de modale (B3) : à la création, le curseur est dans le premier champ.
  // biome-ignore lint/correctness/useExhaustiveDependencies: seulement à l'ouverture du panneau.
  useEffect(() => {
    if (mode !== "create" || readOnly) return;
    formRef.current?.querySelector<HTMLElement>("input:enabled, select:enabled")?.focus();
  }, []);

  const groupOptions = useMemo(
    () =>
      groups.filter(
        (g) => g.id === values.groupId || (g.active && matchesSearch([g.name], groupQuery)),
      ),
    [groups, groupQuery, values.groupId],
  );

  const choices = useMemo(
    () =>
      instructorChoices(
        instructors.filter((i) => i.active || i.id === values.instructorId),
        {
          date: dateOf(values.weekday),
          weekday: values.weekday,
          start: values.start,
          end: values.start + values.durationMinutes,
        },
        busySlots,
        excludedId,
      ),
    [
      instructors,
      values.instructorId,
      values.weekday,
      values.start,
      values.durationMinutes,
      dateOf,
      busySlots,
      excludedId,
    ],
  );
  const available = choices.filter((c) => c.status === "available");
  const busy = choices.filter((c) => c.status === "busy");
  const unavailable = choices.filter((c) => c.status === "unavailable");

  const startOptions = steps(dayStart, dayEnd - SNAP_MINUTES, values.start);
  const durationOptions = steps(
    SNAP_MINUTES,
    Math.max(SNAP_MINUTES, Math.min(6 * 60, 24 * 60 - values.start)),
    values.durationMinutes,
  );
  const dayOptions = weekdays.includes(values.weekday) ? weekdays : [...weekdays, values.weekday];
  const warnings = warningsOf(values);

  const check = (): boolean => {
    if (!values.instructorId || !values.courtId || (!groupOptional && !values.groupId)) {
      setError(
        groupOptional
          ? "Choisissez un moniteur et un court."
          : "Choisissez un groupe, un moniteur et un court.",
      );
      return false;
    }
    return true;
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!readOnly && check()) onSubmit(values);
  };

  const createGroup = async (input: GroupInput) => {
    const groupId = await onCreateGroup(input);
    setGroupQuery("");
    set({ groupId });
    setCreatingGroup(false);
  };

  return (
    <>
      <form
        ref={formRef}
        onSubmit={submit}
        aria-label={title}
        className="flex flex-col gap-3"
        noValidate
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">{title}</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Fermer le panneau"
            onClick={onClose}
          >
            <X aria-hidden />
          </Button>
        </div>
        {notice && <div className="text-muted-foreground text-xs">{notice}</div>}

        <fieldset disabled={readOnly} className="contents">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-group`}>Groupe{groupOptional && " (facultatif)"}</Label>
            {!groupLocked && (
              <Input
                type="search"
                placeholder="Rechercher un groupe…"
                aria-label="Rechercher un groupe"
                className="h-8"
                value={groupQuery}
                onChange={(e) => setGroupQuery(e.target.value)}
              />
            )}
            <div className="flex gap-1.5">
              <Select
                id={`${id}-group`}
                value={values.groupId}
                disabled={groupLocked}
                onChange={(e) => set({ groupId: e.target.value })}
              >
                <option value="">{groupOptional ? "— aucun groupe —" : "— choisir —"}</option>
                {groupOptions.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.memberCount}/{g.maxSize})
                  </option>
                ))}
              </Select>
              {!groupLocked && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Nouveau groupe"
                  title="Créer un groupe"
                  onClick={() => setCreatingGroup(true)}
                >
                  <Plus aria-hidden />
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-instructor`}>Moniteur</Label>
            <Select
              id={`${id}-instructor`}
              value={values.instructorId}
              onChange={(e) => set({ instructorId: e.target.value })}
            >
              <option value="">— choisir —</option>
              {available.length > 0 && (
                <optgroup label="Disponibles">
                  {available.map(({ instructor }) => (
                    <option key={instructor.id} value={instructor.id}>
                      ● {instructor.firstName} {instructor.lastName}
                    </option>
                  ))}
                </optgroup>
              )}
              {busy.length > 0 && (
                <optgroup label="Occupés sur ce créneau">
                  {busy.map(({ instructor, note }) => (
                    <option key={instructor.id} value={instructor.id}>
                      ◐ {instructor.firstName} {instructor.lastName} ({note})
                    </option>
                  ))}
                </optgroup>
              )}
              {unavailable.length > 0 && (
                <optgroup label="Indisponibles sur ce créneau">
                  {unavailable.map(({ instructor, note }) => (
                    <option key={instructor.id} value={instructor.id}>
                      ○ {instructor.firstName} {instructor.lastName} ({note})
                    </option>
                  ))}
                </optgroup>
              )}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-day`}>Jour</Label>
              <Select
                id={`${id}-day`}
                value={values.weekday}
                onChange={(e) => set({ weekday: Number(e.target.value) })}
              >
                {dayOptions.map((d) => (
                  <option key={d} value={d}>
                    {dayHeading(d)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-court`}>Court</Label>
              <Select
                id={`${id}-court`}
                value={values.courtId}
                onChange={(e) => set({ courtId: e.target.value })}
              >
                <option value="">— choisir —</option>
                {courts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-start`}>Début</Label>
              <Select
                id={`${id}-start`}
                value={values.start}
                onChange={(e) => {
                  const start = Number(e.target.value);
                  set({
                    start,
                    durationMinutes: Math.min(values.durationMinutes, 24 * 60 - start),
                  });
                }}
              >
                {startOptions.map((m) => (
                  <option key={m} value={m}>
                    {minutesToTime(m)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-duration`}>Durée</Label>
              <Select
                id={`${id}-duration`}
                value={values.durationMinutes}
                onChange={(e) => set({ durationMinutes: Number(e.target.value) })}
              >
                {durationOptions.map((m) => (
                  <option key={m} value={m}>
                    {formatDuration(m)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-note`}>Note</Label>
            <textarea
              id={`${id}-note`}
              rows={2}
              value={values.note}
              onChange={(e) => set({ note: e.target.value })}
              className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
        </fieldset>

        <MessageZone
          label="Avertissements du créneau"
          messages={[...errorMessages(error), ...warningMessages(warnings)]}
        />

        <div className="flex flex-wrap gap-2">
          {!readOnly && <Button type="submit">{submitLabel}</Button>}
          {!readOnly &&
            actions.map((action) => (
              <Button
                key={action.label}
                type="button"
                variant="secondary"
                onClick={() => check() && action.onClick(values)}
              >
                {action.label}
              </Button>
            ))}
          <Button type="button" variant="outline" onClick={onClose}>
            Fermer
          </Button>
          {onDelete && !readOnly && (
            <Button type="button" variant="ghost" className="text-destructive" onClick={onDelete}>
              <Trash2 aria-hidden />
              {deleteLabel}
            </Button>
          )}
        </div>
      </form>
      {children}
      <Dialog open={creatingGroup} onOpenChange={setCreatingGroup} title="Nouveau groupe">
        <GroupForm
          initialValues={emptyGroupValues}
          levels={levels}
          submitLabel="Créer le groupe"
          onSubmit={createGroup}
          onCancel={() => setCreatingGroup(false)}
        />
      </Dialog>
    </>
  );
}

const noBusySlots: readonly BusySlot[] = [];

/** Valeurs de `from` à `to` au pas de 15 min, en incluant `current`. */
function steps(from: number, to: number, current: number): number[] {
  const values: number[] = [];
  for (let m = from; m <= to; m += SNAP_MINUTES) values.push(m);
  if (!values.includes(current)) values.push(current);
  return values.sort((a, b) => a - b);
}
