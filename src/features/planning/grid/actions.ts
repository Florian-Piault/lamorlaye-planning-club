/**
 * Traduction des gestes et du panneau de l'écran Planning en commandes du
 * moteur (docs/SPECS.md §5.2–5.5). La portée dépend du mode :
 * - « Semaine type » : la modification s'applique au cours, pour toute la saison ;
 * - « Semaine du JJ/MM » : elle crée ou modifie une **exception** de la séance
 *   (modification, remplacement, annulation) ou un cours ponctuel ; la semaine
 *   type et les autres semaines ne changent pas.
 *
 * Les fonctions renvoient `null` quand il n'y a rien à faire (valeurs
 * inchangées) et lèvent une `PlanningError` (message en français) sinon.
 */
import type { CancellationReason, LessonException } from "@/db/schema";
import {
  applyCommand,
  applyFromWeek,
  type CancellationInput,
  type Command,
  cancelOccurrence,
  changeLessonInstructor,
  composeCommands,
  createLesson,
  createOneOff,
  deleteException,
  deleteLesson,
  deleteOneOff,
  duplicateLesson,
  duplicateOneOffOnFollowingDays,
  type LessonPatch,
  modifyOccurrence,
  moveLesson,
  type OccurrenceRef,
  PlanningError,
  type PlanningState,
  replaceInstructor,
  resizeLesson,
  restoreOccurrence,
  updateLesson,
  updateOneOff,
} from "@/domain/commands";
import { isDateInRange } from "@/domain/dates";
import { closureOn, occurrenceKey, oneOffKey, type SeasonBounds } from "@/domain/occurrences";
import { formatDate, minutesToTime } from "@/domain/time";
import { dateOfMode, type GridItem, type PlanningMode } from "./items";

/** Valeurs du panneau de création / modification d'un cours. */
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

export interface ActionContext {
  mode: PlanningMode;
  seasonId: string;
  season: SeasonBounds;
}

export const CANCELLATION_REASONS: readonly { value: CancellationReason; label: string }[] = [
  { value: "rain", label: "Pluie" },
  { value: "instructor_absent", label: "Moniteur absent" },
  { value: "other", label: "Autre" },
];

export function cancellationLabel(reason: CancellationReason | null, note: string | null): string {
  const label = CANCELLATION_REASONS.find((r) => r.value === reason)?.label ?? "Annulée";
  if (reason === "other" && note) return note;
  return note ? `${label} — ${note}` : label;
}

// ---------------------------------------------------------------------------
// Aides
// ---------------------------------------------------------------------------

/** Date d'un jour de la semaine affichée, qui doit appartenir à la saison. */
function dateOf(ctx: ActionContext, weekday: number): string {
  const date = dateOfMode(ctx.mode)(weekday);
  if (!date) throw new PlanningError("Aucune semaine précise affichée.");
  checkInSeason(ctx, date);
  return date;
}

function checkInSeason(ctx: ActionContext, date: string): void {
  if (!isDateInRange(date, ctx.season.startDate, ctx.season.endDate)) {
    throw new PlanningError(
      `Le ${formatDate(date)} est hors de la saison (${formatDate(ctx.season.startDate)} – ${formatDate(ctx.season.endDate)}).`,
    );
  }
}

function mondayOf(ctx: ActionContext): string {
  if (ctx.mode.kind !== "dated") throw new PlanningError("Aucune semaine précise affichée.");
  return ctx.mode.monday;
}

function lessonOf(state: PlanningState, item: GridItem) {
  const lesson = state.lessons.find((l) => l.id === item.lessonId);
  if (!lesson) throw new PlanningError("Cours introuvable.");
  return lesson;
}

function refOf(ctx: ActionContext, item: GridItem): OccurrenceRef {
  const occurrenceDate = item.occurrence?.occurrenceDate;
  if (!item.lessonId || !occurrenceDate) throw new PlanningError("Séance introuvable.");
  return { lessonId: item.lessonId, occurrenceDate, season: ctx.season };
}

function exceptionOf(
  state: PlanningState,
  ref: OccurrenceRef,
  kind: LessonException["kind"],
): LessonException | undefined {
  return state.exceptions.find(
    (e) =>
      e.lessonId === ref.lessonId && e.occurrenceDate === ref.occurrenceDate && e.kind === kind,
  );
}

function oneOffIdOf(item: GridItem): string {
  if (!item.oneOffId) throw new PlanningError("Cours ponctuel introuvable.");
  return item.oneOffId;
}

/** Valeurs datées d'une séance régulière (moniteur prévu, hors remplacement). */
interface RegularValues {
  date: string;
  startTime: string;
  durationMinutes: number;
  courtId: string | null;
  instructorId: string | null;
  note: string | null;
}

const REGULAR_KEYS = [
  "date",
  "startTime",
  "durationMinutes",
  "courtId",
  "instructorId",
  "note",
] as const;

function regularValues(item: GridItem): RegularValues {
  const occurrence = item.occurrence;
  return {
    date: item.date as string,
    startTime: item.startTime,
    durationMinutes: item.durationMinutes,
    courtId: item.courtId,
    instructorId: occurrence?.originalInstructorId ?? item.instructorId,
    note: item.note,
  };
}

/**
 * Modification d'une séance pour cette seule semaine. Revenir exactement aux
 * valeurs du cours supprime l'exception « modification » existante.
 */
function modifyRegular(
  state: PlanningState,
  ctx: ActionContext,
  item: GridItem,
  patch: Partial<RegularValues>,
): Command | null {
  const ref = refOf(ctx, item);
  const lesson = lessonOf(state, item);
  const current = regularValues(item);
  const next = { ...current, ...patch };
  if (REGULAR_KEYS.every((key) => next[key] === current[key])) return null;
  const closure = next.date !== current.date ? closureOn(state.closures, next.date) : null;
  if (closure) {
    // La séance y serait suspendue (et masquée) : un stage se saisit en cours ponctuel.
    throw new PlanningError(
      `Le ${formatDate(next.date)} est fermé (${closure.label}) : créez plutôt un cours ponctuel.`,
    );
  }
  const original: RegularValues = {
    date: ref.occurrenceDate,
    startTime: lesson.startTime,
    durationMinutes: lesson.durationMinutes,
    courtId: lesson.courtId,
    instructorId: lesson.instructorId,
    note: lesson.note,
  };
  const modification = exceptionOf(state, ref, "modification");
  if (REGULAR_KEYS.every((key) => next[key] === original[key])) {
    if (!modification) return null;
    const command = deleteException(state, modification.id);
    return { ...command, label: `Retour à l'horaire d'origine du ${formatShort(ref)}` };
  }
  return modifyOccurrence(state, ref, {
    date: next.date,
    startTime: next.startTime,
    durationMinutes: next.durationMinutes,
    courtId: next.courtId,
    instructorId: next.instructorId,
    note: next.note,
  });
}

function formatShort(ref: OccurrenceRef): string {
  const [y, m, d] = ref.occurrenceDate.split("-");
  return `${d}/${m}/${y}`;
}

function formNote(values: LessonFormValues): string | null {
  return values.note.trim() || null;
}

function oneOffInput(ctx: ActionContext, values: LessonFormValues) {
  if (!values.courtId || !values.instructorId) {
    throw new PlanningError("Choisissez un moniteur et un court.");
  }
  return {
    date: dateOf(ctx, values.weekday),
    startTime: minutesToTime(values.start),
    durationMinutes: values.durationMinutes,
    courtId: values.courtId,
    instructorId: values.instructorId,
    groupId: values.groupId || null,
    note: formNote(values),
  };
}

function updateOneOffIfChanged(
  state: PlanningState,
  item: GridItem,
  patch: Partial<ReturnType<typeof oneOffInput>>,
): Command | null {
  const id = oneOffIdOf(item);
  const current = state.exceptions.find((e) => e.id === id);
  const changed = Object.entries(patch).some(
    ([key, value]) => current?.[key as keyof LessonException] !== value,
  );
  return changed ? updateOneOff(state, id, patch) : null;
}

function lessonPatch(
  values: LessonFormValues,
): Required<
  Pick<
    LessonPatch,
    "weekday" | "startTime" | "durationMinutes" | "courtId" | "groupId" | "instructorId" | "note"
  >
> {
  return {
    weekday: values.weekday,
    startTime: minutesToTime(values.start),
    durationMinutes: values.durationMinutes,
    courtId: values.courtId,
    groupId: values.groupId,
    instructorId: values.instructorId,
    note: formNote(values),
  };
}

// ---------------------------------------------------------------------------
// Gestes (§5.2)
// ---------------------------------------------------------------------------

export interface MoveTarget {
  weekday: number;
  start: number;
  courtId: string;
}

/** Déplacer (ou dupliquer avec Alt) un élément de la grille. */
export function moveItem(
  state: PlanningState,
  ctx: ActionContext,
  item: GridItem,
  target: MoveTarget,
  duplicate: boolean,
): Command | null {
  const startTime = minutesToTime(target.start);
  if (item.kind === "lesson") {
    const values = { weekday: target.weekday, startTime, courtId: target.courtId };
    return duplicate ? duplicateLesson(state, item.id, values) : moveLesson(state, item.id, values);
  }
  const date = dateOf(ctx, target.weekday);
  if (duplicate) {
    if (!item.instructorId) throw new PlanningError("Choisissez d'abord un moniteur.");
    return createOneOff(state, {
      seasonId: ctx.seasonId,
      date,
      startTime,
      durationMinutes: item.durationMinutes,
      courtId: target.courtId,
      instructorId: item.instructorId,
      groupId: item.groupId,
      note: item.note,
    });
  }
  if (item.kind === "one_off") {
    return updateOneOffIfChanged(state, item, { date, startTime, courtId: target.courtId });
  }
  return modifyRegular(state, ctx, item, { date, startTime, courtId: target.courtId });
}

/** Redimensionner un élément par son bord inférieur. */
export function resizeItem(
  state: PlanningState,
  ctx: ActionContext,
  item: GridItem,
  durationMinutes: number,
): Command | null {
  if (item.kind === "lesson") return resizeLesson(state, item.id, durationMinutes);
  if (item.kind === "one_off") return updateOneOffIfChanged(state, item, { durationMinutes });
  return modifyRegular(state, ctx, item, { durationMinutes });
}

/**
 * Déposer la pastille d'un moniteur sur un élément : en semaine type, change
 * le moniteur du cours ; en semaine datée, le désigne comme remplaçant.
 */
export function assignInstructor(
  state: PlanningState,
  ctx: ActionContext,
  item: GridItem,
  instructorId: string,
): Command | null {
  if (item.kind === "lesson") return changeLessonInstructor(state, item.id, instructorId);
  if (item.kind === "one_off") return updateOneOffIfChanged(state, item, { instructorId });
  return replaceItem(state, ctx, item, instructorId);
}

/** Suppr : supprime un cours (semaine type) ou un cours ponctuel. */
export function removeItem(state: PlanningState, item: GridItem): Command {
  if (item.kind === "lesson") return deleteLesson(state, item.id);
  if (item.kind === "one_off") return deleteOneOff(state, oneOffIdOf(item));
  throw new PlanningError(
    "Un cours du planning habituel ne se supprime pas ici : annulez-le pour cette semaine.",
  );
}

// ---------------------------------------------------------------------------
// Panneau (§5.1, §5.4, §5.5)
// ---------------------------------------------------------------------------

/**
 * Enregistrer le panneau : création (cours de la semaine type, ou cours
 * ponctuel en semaine datée) ou modification (cours, séance pour cette seule
 * semaine, cours ponctuel).
 */
export function saveItem(
  state: PlanningState,
  ctx: ActionContext,
  item: GridItem | null,
  values: LessonFormValues,
): Command | null {
  if (!item) {
    if (ctx.mode.kind === "type") {
      return createLesson(state, {
        ...lessonPatch(values),
        seasonId: ctx.seasonId,
        effectiveFrom: ctx.season.startDate,
      });
    }
    return createOneOff(state, { ...oneOffInput(ctx, values), seasonId: ctx.seasonId });
  }
  if (item.kind === "lesson") {
    const lesson = lessonOf(state, item);
    const patch = lessonPatch(values);
    const changed = (Object.keys(patch) as (keyof typeof patch)[]).some(
      (key) => patch[key] !== lesson[key],
    );
    return changed ? updateLesson(state, lesson.id, patch) : null;
  }
  if (item.kind === "one_off") return updateOneOffIfChanged(state, item, oneOffInput(ctx, values));
  const lesson = lessonOf(state, item);
  if (values.groupId && values.groupId !== lesson.groupId) {
    throw new PlanningError(
      "Le groupe d'une séance ne change pas pour une seule semaine : utilisez « Appliquer à partir de cette semaine ».",
    );
  }
  return modifyRegular(state, ctx, item, {
    date: dateOf(ctx, values.weekday),
    startTime: minutesToTime(values.start),
    durationMinutes: values.durationMinutes,
    courtId: values.courtId || null,
    instructorId: values.instructorId || null,
    note: formNote(values),
  });
}

/**
 * « Appliquer à partir de cette semaine » (§5.4) : nouvelle version du cours
 * en vigueur à partir du lundi affiché. Une modification de la séance de
 * cette semaine est absorbée par la nouvelle version (elle est supprimée).
 */
export function applyItemFromWeek(
  state: PlanningState,
  ctx: ActionContext,
  item: GridItem,
  values: LessonFormValues,
): Command {
  const monday = mondayOf(ctx);
  if (item.kind !== "regular") {
    throw new PlanningError(
      "Seul un cours du planning habituel peut s'appliquer aux semaines suivantes.",
    );
  }
  if (!values.groupId || !values.instructorId || !values.courtId) {
    throw new PlanningError("Choisissez un groupe, un moniteur et un court.");
  }
  const ref = refOf(ctx, item);
  const lesson = lessonOf(state, item);
  const patch = lessonPatch(values);
  const modification = exceptionOf(state, ref, "modification");
  const unchanged = (Object.keys(patch) as (keyof typeof patch)[]).every(
    (key) => patch[key] === lesson[key],
  );
  if (!modification) {
    if (unchanged) throw new PlanningError("Aucune modification à appliquer.");
    return applyFromWeek(state, lesson.id, monday, patch);
  }
  const removal = deleteException(state, modification.id);
  if (unchanged)
    return { ...removal, label: `Retour à l'horaire d'origine du ${formatShort(ref)}` };
  const next = applyFromWeek(applyCommand(state, removal), lesson.id, monday, patch);
  return composeCommands(next.label, [removal, next]);
}

/** Annuler cette séance, avec son motif (§5.5). */
export function cancelItem(
  state: PlanningState,
  ctx: ActionContext,
  item: GridItem,
  input: CancellationInput,
): Command {
  return cancelOccurrence(state, refOf(ctx, item), input);
}

/** Désigner un remplaçant ; choisir le moniteur prévu retire le remplacement (§5.5). */
export function replaceItem(
  state: PlanningState,
  ctx: ActionContext,
  item: GridItem,
  instructorId: string,
): Command | null {
  const ref = refOf(ctx, item);
  const planned = regularValues(item).instructorId;
  const replacement = exceptionOf(state, ref, "replacement");
  if (instructorId === planned) {
    if (!replacement) return null;
    const command = deleteException(state, replacement.id);
    return { ...command, label: `Fin du remplacement du ${formatShort(ref)}` };
  }
  if (replacement?.instructorId === instructorId) return null;
  return replaceInstructor(state, ref, instructorId);
}

/** Rétablir l'occurrence d'origine : supprime toutes ses exceptions (§5.5). */
export function restoreItem(state: PlanningState, ctx: ActionContext, item: GridItem): Command {
  return restoreOccurrence(state, refOf(ctx, item));
}

/**
 * « Dupliquer sur les jours suivants » d'un cours ponctuel (stage, §5.5),
 * y compris pendant une fermeture et au-delà de la semaine affichée, mais pas
 * au-delà de la fin de la saison.
 */
export function duplicateItemOnFollowingDays(
  state: PlanningState,
  ctx: ActionContext,
  item: GridItem,
  count: number,
  displayedDays: readonly number[],
): Command {
  const command = duplicateOneOffOnFollowingDays(state, oneOffIdOf(item), count, displayedDays);
  for (const mutation of command.forward) {
    if (mutation.op === "insert" && mutation.table === "exceptions" && mutation.row.date) {
      checkInSeason(ctx, mutation.row.date);
    }
  }
  return command;
}

/** Identifiant (sur la grille) de l'élément créé par une commande, le cas échéant. */
export function createdItemId(mode: PlanningMode, command: Command): string | null {
  for (const mutation of command.forward) {
    if (mutation.op !== "insert") continue;
    if (mutation.table === "lessons") {
      const date = dateOfMode(mode)(mutation.row.weekday);
      return date ? occurrenceKey(mutation.row.id, date) : mutation.row.id;
    }
    if (mutation.table === "exceptions" && mutation.row.kind === "one_off") {
      return oneOffKey(mutation.row.id);
    }
  }
  return null;
}
