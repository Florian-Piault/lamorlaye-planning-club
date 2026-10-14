import { Plus, Trash2, X } from "lucide-react";
import { type FormEvent, useEffect, useId, useMemo, useState } from "react";
import { ErrorAlert } from "@/components/form/Field";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import type { Court, Level } from "@/db/schema";
import { matchesSearch } from "@/domain/search";
import { formatDuration, minutesToTime, weekdayLabel } from "@/domain/time";
import type { GroupInput } from "@/domain/validation";
import { emptyGroupValues, GroupForm } from "@/features/referentiels/groupes/GroupForm";
import { SNAP_MINUTES } from "../grid/geometry";
import { instructorChoices } from "../grid/view";
import type { PlanningInstructor } from "../references";

export interface LessonFormValues {
  groupId: string;
  instructorId: string;
  weekday: number;
  /** Début, en minutes depuis minuit. */
  start: number;
  durationMinutes: number;
  courtId: string;
  note: string;
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
  /** Création rapide d'un groupe ; renvoie son identifiant. */
  onCreateGroup: (input: GroupInput) => Promise<string>;
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
  onCreateGroup,
}: LessonPanelProps) {
  const [values, setValues] = useState(initialValues);
  const [groupQuery, setGroupQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const id = useId();
  const set = (patch: Partial<LessonFormValues>) => {
    setError(null);
    setValues((v) => ({ ...v, ...patch }));
  };

  useEffect(() => {
    onDraftChange?.(values);
  }, [values, onDraftChange]);

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
          date: null,
          weekday: values.weekday,
          start: values.start,
          end: values.start + values.durationMinutes,
        },
      ),
    [instructors, values.instructorId, values.weekday, values.start, values.durationMinutes],
  );
  const available = choices.filter((c) => c.available);
  const unavailable = choices.filter((c) => !c.available);

  const startOptions = steps(dayStart, dayEnd - SNAP_MINUTES, values.start);
  const durationOptions = steps(
    SNAP_MINUTES,
    Math.max(SNAP_MINUTES, Math.min(6 * 60, 24 * 60 - values.start)),
    values.durationMinutes,
  );
  const dayOptions = weekdays.includes(values.weekday) ? weekdays : [...weekdays, values.weekday];
  const warnings = warningsOf(values);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!values.groupId || !values.instructorId || !values.courtId) {
      setError("Choisissez un groupe, un moniteur et un court.");
      return;
    }
    onSubmit(values);
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
        onSubmit={submit}
        aria-label={mode === "create" ? "Nouveau cours" : "Modifier le cours"}
        className="flex flex-col gap-3"
        noValidate
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">
            {mode === "create" ? "Nouveau cours" : "Modifier le cours"}
          </h2>
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

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-group`}>Groupe</Label>
          <Input
            type="search"
            placeholder="Rechercher un groupe…"
            aria-label="Rechercher un groupe"
            className="h-8"
            value={groupQuery}
            onChange={(e) => setGroupQuery(e.target.value)}
          />
          <div className="flex gap-1.5">
            <Select
              id={`${id}-group`}
              value={values.groupId}
              onChange={(e) => set({ groupId: e.target.value })}
            >
              <option value="">— choisir —</option>
              {groupOptions.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.memberCount}/{g.maxSize})
                </option>
              ))}
            </Select>
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
                  {weekdayLabel(d)}
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

        {warnings.length > 0 && (
          <ul aria-label="Avertissements du créneau" className="flex flex-col gap-1">
            {warnings.map((w) => (
              <li
                key={w}
                className="rounded-md bg-destructive/10 px-2 py-1 text-destructive text-xs"
              >
                ⚠ {w}
              </li>
            ))}
          </ul>
        )}
        <ErrorAlert>{error}</ErrorAlert>

        <div className="flex flex-wrap gap-2">
          <Button type="submit">{mode === "create" ? "Créer le cours" : "Enregistrer"}</Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Fermer
          </Button>
          {onDelete && (
            <Button type="button" variant="ghost" className="text-destructive" onClick={onDelete}>
              <Trash2 aria-hidden />
              Supprimer
            </Button>
          )}
        </div>
      </form>
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

/** Valeurs de `from` à `to` au pas de 15 min, en incluant `current`. */
function steps(from: number, to: number, current: number): number[] {
  const values: number[] = [];
  for (let m = from; m <= to; m += SNAP_MINUTES) values.push(m);
  if (!values.includes(current)) values.push(current);
  return values.sort((a, b) => a - b);
}
