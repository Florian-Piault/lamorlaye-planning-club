import { type FormEvent, useId, useMemo, useState } from "react";
import { MessageZone } from "@/components/feedback/MessageZone";
import { errorMessages, type Message } from "@/components/feedback/messages";
import { Field } from "@/components/form/Field";
import { sameValues } from "@/components/form/formState";
import { useFormErrors } from "@/components/form/useFormErrors";
import { Button } from "@/components/ui/button";
import { useDirtyGuard, useGuardedCancel } from "@/components/ui/dialog";
import { Checkbox, Input, Select } from "@/components/ui/input";
import type { GroupListItem } from "@/db/repositories/groups";
import type { StudentIdentity } from "@/db/repositories/students";
import type { Level, Student } from "@/db/schema";
import type { WeeklySlot } from "@/domain/availability";
import {
  ageRangeLabel,
  ageRangeWarning,
  findStudentDuplicates,
  inSeasonDuplicateMessage,
  isOutOfAgeRange,
  pastSeasonDuplicateMessage,
  reuseDetails,
} from "@/domain/duplicates";
import { isMinor } from "@/domain/groups";
import { matchesSearch } from "@/domain/search";
import { suggestLevel } from "@/domain/students";
import { isValidDate, todayIso } from "@/domain/time";
import {
  type StudentFormValues,
  type StudentInput,
  studentSchema,
  validate,
} from "@/domain/validation";
import { errorMessage } from "@/hooks/useLoader";
import { StudentAvailabilitySection } from "./StudentAvailabilitySection";

export const emptyStudentValues: StudentFormValues = {
  lastName: "",
  firstName: "",
  phone: "",
  birthDate: "",
  levelId: "",
  fftRanking: "",
  email: "",
  guardianName: "",
  guardianPhone: "",
};

export function studentValues(student: Student): StudentFormValues {
  return {
    lastName: student.lastName,
    firstName: student.firstName,
    phone: student.phone ?? "",
    birthDate: student.birthDate ?? "",
    levelId: student.levelId ?? "",
    fftRanking: student.fftRanking ?? "",
    email: student.email ?? "",
    guardianName: student.guardianName ?? "",
    guardianPhone: student.guardianPhone ?? "",
  };
}

/**
 * Niveau proposé pour ces groupes : celui du premier groupe coché, s'il est
 * encore proposé (actif) ; "" sinon.
 */
export function proposedLevel(
  groupIds: readonly string[],
  groups: readonly GroupListItem[],
  levels: readonly Level[],
): string {
  const id = suggestLevel(groupIds, groups);
  return id && levels.some((l) => l.id === id && l.active) ? id : "";
}

/**
 * Valeurs d'une nouvelle fiche : vide, ou pré-remplie (`values`) ; sans
 * niveau saisi, celui des groupes cochés est proposé.
 */
export function newStudentValues(
  groupIds: readonly string[],
  groups: readonly GroupListItem[],
  levels: readonly Level[],
  values: Partial<StudentFormValues> = {},
): StudentFormValues {
  const next = { ...emptyStudentValues, ...values };
  if (next.levelId === "") next.levelId = proposedLevel(groupIds, groups, levels);
  return next;
}

interface StudentFormProps {
  initialValues: StudentFormValues;
  initialGroupIds: readonly string[];
  levels: readonly Level[];
  groups: readonly GroupListItem[];
  /** Plages hebdomadaires à l'ouverture (aucune en création). */
  initialSlots?: readonly WeeklySlot[];
  submitLabel: string;
  /** Enregistre la fiche, ses groupes et ses plages. */
  onSubmit: (input: StudentInput, groupIds: string[], slots: WeeklySlot[]) => Promise<void>;
  onCancel: () => void;
  /** Consultation seule (saison archivée) : champs désactivés, bouton « Fermer » seul. */
  readOnly?: boolean;
  /** Saison de la fiche : doublons de la saison et âge au début de saison. */
  season: { id: string; startDate: string };
  /** Fiche modifiée (exclue des doublons) ; absente en création. */
  studentId?: string | null;
  /** Élèves de toutes les saisons, pour signaler les doublons (jamais bloquant). */
  identities?: readonly StudentIdentity[];
  /** Ouvre la fiche d'un élève de la saison à la place de la saisie (« Ouvrir sa fiche »). */
  onOpenStudent?: (id: string) => void;
  /**
   * Création en série : bouton « Enregistrer et ajouter un autre ». L'appelant
   * enregistre puis rouvre une fiche vide qui garde les groupes et le niveau.
   */
  onSubmitAndAddAnother?: (
    input: StudentInput,
    groupIds: string[],
    levelChosen: boolean,
    slots: WeeklySlot[],
  ) => Promise<void>;
  /**
   * Le niveau initial a-t-il été choisi par l'utilisatrice ? Sinon il suit le
   * premier groupe coché. Par défaut : choisi en modification, ou dès qu'un
   * niveau est saisi ; une fiche pré-remplie avec le niveau proposé passe `false`.
   */
  initialLevelChosen?: boolean;
}

const NO_SLOTS: readonly WeeklySlot[] = [];

/** Plages comparables (jour, début, fin), qu'elles viennent de la base ou de la frise. */
export function slotKeys(slots: readonly WeeklySlot[]): string[] {
  return slots.map((s) => `${s.weekday} ${s.startTime} ${s.endTime}`).sort();
}

/** Fiche élève complète (§3.5), avec ses groupes et ses disponibilités. */
export function StudentForm({
  initialValues,
  initialGroupIds,
  initialSlots = NO_SLOTS,
  levels,
  groups,
  submitLabel,
  onSubmit,
  onCancel,
  readOnly = false,
  season,
  studentId = null,
  identities = [],
  onOpenStudent,
  onSubmitAndAddAnother,
  initialLevelChosen,
}: StudentFormProps) {
  const [values, setValues] = useState(initialValues);
  const [busy, setBusy] = useState(false);
  // Niveau proposé depuis les groupes tant qu'il n'a pas été choisi (comme les initiales suggérées).
  const [levelChosen, setLevelChosen] = useState(
    initialLevelChosen ?? (studentId !== null || initialValues.levelId !== ""),
  );
  /** Fiche d'une saison passée dont les coordonnées ont été reprises. */
  const [reusedFrom, setReusedFrom] = useState<StudentIdentity | null>(null);
  const [groupIds, setGroupIds] = useState<string[]>([...initialGroupIds]);
  const [groupQuery, setGroupQuery] = useState("");
  const [slots, setSlots] = useState<WeeklySlot[]>(() =>
    initialSlots.map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime })),
  );
  const formId = useId();
  const { errors, setErrors, error, setError, changed } = useFormErrors<StudentFormValues>();
  const set = (patch: Partial<StudentFormValues>) => {
    // Le téléphone du responsable suffit : il efface aussi l'erreur du téléphone de l'élève.
    changed("guardianPhone" in patch ? { ...patch, phone: values.phone } : patch);
    setValues((v) => ({ ...v, ...patch }));
  };
  const toggleGroup = (id: string, checked: boolean) => {
    setError(null);
    const next = checked ? [...groupIds, id] : groupIds.filter((i) => i !== id);
    setGroupIds(next);
    if (!levelChosen) set({ levelId: proposedLevel(next, groups, levels) });
  };
  useDirtyGuard(
    !sameValues(
      { values, groupIds: [...groupIds].sort(), slots: slotKeys(slots) },
      {
        values: initialValues,
        groupIds: [...initialGroupIds].sort(),
        slots: slotKeys(initialSlots),
      },
    ),
  );
  const cancel = useGuardedCancel(onCancel);

  const levelOptions = levels.filter((l) => l.active || l.id === initialValues.levelId);
  const groupOptions = useMemo(
    () =>
      groups.filter(
        (g) =>
          (g.active || initialGroupIds.includes(g.id)) &&
          matchesSearch([g.name, g.levelLabel], groupQuery),
      ),
    [groups, initialGroupIds, groupQuery],
  );
  const minor = isValidDate(values.birthDate) && isMinor(values.birthDate, todayIso());
  const birthDate = isValidDate(values.birthDate) ? values.birthDate : null;
  const duplicates = useMemo(
    () =>
      findStudentDuplicates(
        { lastName: values.lastName, firstName: values.firstName, birthDate },
        readOnly ? [] : identities,
        { seasonId: season.id, seasonStartDate: season.startDate, excludeId: studentId },
      ),
    [
      readOnly,
      values.lastName,
      values.firstName,
      birthDate,
      identities,
      season.id,
      season.startDate,
      studentId,
    ],
  );
  const sameInSeason = duplicates.inSeason[0];
  // « Ouvrir sa fiche » passe par la garde de la fenêtre (confirmation si la saisie a changé).
  const openExisting = useGuardedCancel(
    onOpenStudent && sameInSeason ? () => onOpenStudent(sameInSeason.id) : undefined,
  );
  // Reprise des coordonnées : en création, seulement si l'élève n'est pas déjà dans la saison.
  const fromPast = !studentId && !sameInSeason ? duplicates.pastSeasons[0] : undefined;
  const reuse = (source: StudentIdentity) => {
    // Un niveau archivé n'est plus proposé : il n'est pas repris.
    const level = levels.find((l) => l.id === source.levelId);
    const next = reuseDetails(values, {
      ...source,
      levelId: level?.active ? source.levelId : null,
    });
    // Seules les erreurs des champs réellement repris s'effacent.
    changed(
      Object.fromEntries(
        (Object.keys(next) as (keyof StudentFormValues)[])
          .filter((key) => next[key] !== values[key])
          .map((key) => [key, next[key]]),
      ),
    );
    setValues(next);
    if (next.levelId !== values.levelId) setLevelChosen(true);
    setReusedFrom(source);
  };
  // La confirmation de reprise ne vaut que tant que la saisie désigne la même fiche.
  const reused = reusedFrom && fromPast?.id === reusedFrom.id ? reusedFrom : null;
  const ageWarnings = readOnly
    ? []
    : groups
        .filter((g) => groupIds.includes(g.id))
        .map((g) => ageRangeWarning({ ...values, birthDate }, g, season.startDate))
        .filter((w): w is string => w !== null);
  const messages: Message[] = [
    ...errorMessages(error),
    ...(sameInSeason
      ? [
          {
            kind: "warning" as const,
            text: inSeasonDuplicateMessage(sameInSeason),
            action: openExisting && { label: "Ouvrir sa fiche", onClick: openExisting },
          },
        ]
      : []),
    ...(fromPast && !reused
      ? [
          {
            kind: "info" as const,
            text: pastSeasonDuplicateMessage(fromPast),
            action: { label: "Reprendre ses coordonnées", onClick: () => reuse(fromPast) },
          },
        ]
      : []),
    ...(reused
      ? [{ kind: "info" as const, text: `Coordonnées reprises de ${reused.seasonName}.` }]
      : []),
    ...ageWarnings.map((text) => ({ kind: "warning" as const, text })),
    ...(minor && !readOnly
      ? [
          {
            kind: "info" as const,
            text: "Élève mineur : renseignez le nom et le téléphone du responsable légal.",
          },
        ]
      : []),
  ];

  const save = async (then: (input: StudentInput) => Promise<void>) => {
    const result = validate(studentSchema, values);
    if (!result.ok) return setErrors(result.errors);
    setErrors({});
    setError(null);
    setBusy(true);
    try {
      await then(result.data);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    // Entrée enregistre comme le bouton principal ; « ajouter un autre » est un bouton à part.
    if (!busy) void save((input) => onSubmit(input, groupIds, slots));
  };

  const text = (
    key: keyof StudentFormValues,
    label: string,
    required = false,
    type = "text",
    hint?: string,
  ) => (
    <Field label={label} required={required} error={errors[key]} hint={hint}>
      {(props) => (
        <Input
          {...props}
          type={type}
          value={values[key]}
          onChange={(e) => set({ [key]: e.target.value })}
        />
      )}
    </Field>
  );

  return (
    // La section des disponibilités et les boutons sont hors du formulaire : la
    // frise a son propre formulaire (« Saisir un horaire »), qui ne peut pas y
    // être imbriqué. Le bouton principal le rejoint par l'attribut `form`.
    <div className="grid gap-4">
      <form
        id={formId}
        onSubmit={submit}
        noValidate
        className="grid gap-4"
        aria-label="Fiche élève"
      >
        <fieldset disabled={readOnly} className="contents">
          <div className="grid grid-cols-2 gap-4">
            {text("firstName", "Prénom", true)}
            {text("lastName", "Nom", true)}
            {text("phone", "Téléphone", false, "tel", "Ou celui du responsable légal, ci-dessous.")}
            {text("email", "E-mail", false, "email")}
            {text("birthDate", "Date de naissance", false, "date")}
            <Field label="Niveau" error={errors.levelId}>
              {(props) => (
                <Select
                  {...props}
                  value={values.levelId}
                  onChange={(e) => {
                    setLevelChosen(true);
                    set({ levelId: e.target.value });
                  }}
                >
                  <option value="">— Aucun —</option>
                  {levelOptions.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {text("fftRanking", "Classement FFT")}
          </div>
          <fieldset className="grid gap-3 rounded-lg border p-3">
            <legend className="px-1 font-medium text-sm">Responsable légal</legend>
            <div className="grid grid-cols-2 gap-4">
              {text("guardianName", "Nom du responsable")}
              {text("guardianPhone", "Téléphone du responsable", false, "tel")}
            </div>
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="mb-2 font-medium text-sm">
              Groupes{groupIds.length > 0 && ` (${groupIds.length})`}
            </legend>
            {groups.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucun groupe dans la saison.</p>
            ) : (
              <>
                {groups.length > 6 && (
                  <Input
                    type="search"
                    aria-label="Filtrer les groupes"
                    placeholder="Filtrer les groupes"
                    value={groupQuery}
                    onChange={(e) => setGroupQuery(e.target.value)}
                    className="max-w-xs"
                  />
                )}
                <div className="grid max-h-40 grid-cols-2 gap-x-4 gap-y-1.5 overflow-y-auto">
                  {groupOptions.map((group) => (
                    <Checkbox
                      key={group.id}
                      label={
                        <GroupChoiceLabel
                          group={group}
                          outOfRange={isOutOfAgeRange(group, birthDate, season.startDate)}
                        />
                      }
                      checked={groupIds.includes(group.id)}
                      onChange={(e) => toggleGroup(group.id, e.target.checked)}
                    />
                  ))}
                </div>
              </>
            )}
          </fieldset>
        </fieldset>
      </form>
      {/* Messages au plus près des champs qui les provoquent (doublon, âge), avant la frise. */}
      <MessageZone label="Messages" messages={messages} />
      <StudentAvailabilitySection slots={slots} onChange={setSlots} readOnly={readOnly} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={cancel}>
          {readOnly ? "Fermer" : "Annuler"}
        </Button>
        {!readOnly && onSubmitAndAddAnother && (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void save((input) => onSubmitAndAddAnother(input, groupIds, levelChosen, slots))
            }
          >
            Enregistrer et ajouter un autre
          </Button>
        )}
        {!readOnly && (
          <Button type="submit" form={formId} disabled={busy}>
            {submitLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Libellé d'un groupe dans la liste à cocher : nom, tranche d'âge, effectif
 * et mention discrète « hors tranche » pour l'élève saisi (ordre inchangé,
 * groupe toujours cochable).
 */
function GroupChoiceLabel({ group, outOfRange }: { group: GroupListItem; outOfRange: boolean }) {
  const range = ageRangeLabel(group);
  return (
    <>
      <span className="truncate">{group.name}</span>
      {range && <span className="whitespace-nowrap text-muted-foreground text-xs">· {range}</span>}
      <span className="text-muted-foreground text-xs">
        {group.memberCount}/{group.maxSize}
      </span>
      {outOfRange && (
        <span className="whitespace-nowrap text-amber-800 text-xs dark:text-amber-300">
          hors tranche
        </span>
      )}
    </>
  );
}
