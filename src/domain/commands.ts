/**
 * Commandes inversibles du planning (docs/SPECS.md §5.3–5.5, §12.1).
 *
 * Une commande décrit une modification sous forme de **mutations** (insertion,
 * mise à jour, suppression de lignes des tables `lessons`, `lesson_exceptions`
 * et `closures`) : `forward` pour l'appliquer, `backward` pour l'annuler.
 * Elle reste une simple donnée, sans effet de bord :
 * - `applyCommand` / `revertCommand` l'appliquent à l'état en mémoire ;
 * - l'adaptateur `db/repositories/planning.ts` écrit les mêmes mutations en
 *   base, dans une transaction.
 *
 * Les fabriques de commandes (`createLesson`, `cancelOccurrence`…) lisent
 * l'état courant pour calculer les deux sens et vérifient la cohérence ; elles
 * lèvent une `PlanningError` (message en français) en cas d'incohérence.
 */
import type { CancellationReason, Closure, Lesson, LessonException } from "@/db/schema";
import { isoWeekday, isSameIsoWeek, startOfIsoWeek } from "./dates";
import { hasOccurrenceOn, type SeasonBounds } from "./occurrences";
import { addDays, formatDate, isValidDate, isValidTime, timeToMinutes } from "./time";

// ---------------------------------------------------------------------------
// État et mutations
// ---------------------------------------------------------------------------

export interface PlanningState {
  lessons: readonly Lesson[];
  exceptions: readonly LessonException[];
  closures: readonly Closure[];
}

interface TableRows {
  lessons: Lesson;
  exceptions: LessonException;
  closures: Closure;
}

export type PlanningTable = keyof TableRows;

export type Mutation = {
  [T in PlanningTable]:
    | { op: "insert"; table: T; row: TableRows[T] }
    | { op: "update"; table: T; id: string; values: Partial<TableRows[T]> }
    | { op: "delete"; table: T; id: string };
}[PlanningTable];

/**
 * Commande inversible. Le type des mutations est paramétrable : le planning
 * utilise `Mutation`, l'import d'élèves ses propres mutations
 * (`domain/studentImport.ts`).
 */
export interface Command<M = Mutation> {
  /** Libellé affiché dans les menus « Annuler … » / « Rétablir … ». */
  label: string;
  forward: readonly M[];
  backward: readonly M[];
}

export class PlanningError extends Error {
  override name = "PlanningError";
}

export const emptyPlanningState: PlanningState = { lessons: [], exceptions: [], closures: [] };

function applyMutation(state: PlanningState, mutation: Mutation): PlanningState {
  const rows = state[mutation.table] as readonly { id: string }[];
  const exists = (id: string) => rows.some((row) => row.id === id);
  switch (mutation.op) {
    case "insert":
      if (exists(mutation.row.id)) {
        throw new PlanningError(`Enregistrement déjà présent : ${mutation.row.id}`);
      }
      return { ...state, [mutation.table]: [...rows, mutation.row] };
    case "update":
      if (!exists(mutation.id))
        throw new PlanningError(`Enregistrement introuvable : ${mutation.id}`);
      return {
        ...state,
        [mutation.table]: rows.map((row) =>
          row.id === mutation.id ? { ...row, ...mutation.values } : row,
        ),
      };
    case "delete":
      if (!exists(mutation.id))
        throw new PlanningError(`Enregistrement introuvable : ${mutation.id}`);
      return { ...state, [mutation.table]: rows.filter((row) => row.id !== mutation.id) };
  }
}

export function applyMutations(
  state: PlanningState,
  mutations: readonly Mutation[],
): PlanningState {
  return mutations.reduce(applyMutation, state);
}

export function applyCommand(state: PlanningState, command: Command): PlanningState {
  return applyMutations(state, command.forward);
}

export function revertCommand(state: PlanningState, command: Command): PlanningState {
  return applyMutations(state, command.backward);
}

/** Commande inverse (pour rejouer une annulation). */
export function invertCommand<M>(command: Command<M>): Command<M> {
  return { label: command.label, forward: command.backward, backward: command.forward };
}

/** Regroupe plusieurs commandes en une seule (une seule entrée dans la pile d'annulation). */
export function composeCommands<M = Mutation>(
  label: string,
  commands: readonly Command<M>[],
): Command<M> {
  return {
    label,
    forward: commands.flatMap((c) => c.forward),
    backward: [...commands].reverse().flatMap((c) => c.backward),
  };
}

// ---------------------------------------------------------------------------
// Contexte : identifiants et horodatages
// ---------------------------------------------------------------------------

export interface CommandContext {
  newId: () => string;
  now: () => string;
}

export const defaultCommandContext: CommandContext = {
  newId: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Aides internes
// ---------------------------------------------------------------------------

function insert<T extends PlanningTable>(table: T, row: TableRows[T]): Command {
  const forward = { op: "insert", table, row } as Mutation;
  const backward = { op: "delete", table, id: row.id } as Mutation;
  return { label: "", forward: [forward], backward: [backward] };
}

function remove<T extends PlanningTable>(table: T, row: TableRows[T]): Command {
  const forward = { op: "delete", table, id: row.id } as Mutation;
  const backward = { op: "insert", table, row } as Mutation;
  return { label: "", forward: [forward], backward: [backward] };
}

/** Mise à jour des seules valeurs qui changent (`null` si rien ne change). */
function update<T extends PlanningTable>(
  table: T,
  row: TableRows[T],
  values: Partial<TableRows[T]>,
  ctx: CommandContext,
): Command | null {
  const changed = Object.entries(values).filter(
    ([key, value]) => value !== undefined && row[key as keyof TableRows[T]] !== value,
  );
  if (changed.length === 0) return null;
  const forwardValues = { ...Object.fromEntries(changed), updatedAt: ctx.now() };
  const backwardValues = Object.fromEntries(
    Object.keys(forwardValues).map((key) => [key, row[key as keyof TableRows[T]]]),
  );
  return {
    label: "",
    forward: [{ op: "update", table, id: row.id, values: forwardValues } as Mutation],
    backward: [{ op: "update", table, id: row.id, values: backwardValues } as Mutation],
  };
}

function labelled(label: string, parts: readonly (Command | null)[]): Command {
  const commands = parts.filter((c): c is Command => c !== null);
  if (commands.length === 0) throw new PlanningError("Aucune modification à enregistrer.");
  return composeCommands(label, commands);
}

function findLesson(state: PlanningState, id: string): Lesson {
  const lesson = state.lessons.find((l) => l.id === id);
  if (!lesson) throw new PlanningError("Cours introuvable.");
  return lesson;
}

function findException(state: PlanningState, id: string): LessonException {
  const exception = state.exceptions.find((e) => e.id === id);
  if (!exception) throw new PlanningError("Changement de la semaine introuvable.");
  return exception;
}

function findClosure(state: PlanningState, id: string): Closure {
  const closure = state.closures.find((c) => c.id === id);
  if (!closure) throw new PlanningError("Période de fermeture introuvable.");
  return closure;
}

function checkSchedule(values: {
  weekday?: number;
  startTime?: string | null;
  durationMinutes?: number | null;
}): void {
  const { weekday, startTime, durationMinutes } = values;
  if (weekday !== undefined && !(Number.isInteger(weekday) && weekday >= 1 && weekday <= 7)) {
    throw new PlanningError("Jour de la semaine invalide.");
  }
  if (startTime != null && !isValidTime(startTime)) {
    throw new PlanningError("Heure de début invalide.");
  }
  if (durationMinutes != null && !(durationMinutes > 0 && durationMinutes % 15 === 0)) {
    throw new PlanningError("La durée doit être un multiple de 15 minutes.");
  }
  if (startTime != null && durationMinutes != null) {
    if (timeToMinutes(startTime) + durationMinutes > 24 * 60) {
      throw new PlanningError("Le cours doit se terminer avant minuit.");
    }
  }
}

function checkDate(value: string, message: string): void {
  if (!isValidDate(value)) throw new PlanningError(message);
}

// ---------------------------------------------------------------------------
// Cours de la semaine type (§5.1–5.4)
// ---------------------------------------------------------------------------

export type LessonInput = Pick<
  Lesson,
  | "seasonId"
  | "weekday"
  | "startTime"
  | "durationMinutes"
  | "courtId"
  | "groupId"
  | "instructorId"
  | "effectiveFrom"
> &
  Partial<Pick<Lesson, "effectiveTo" | "note">>;

export type LessonPatch = Partial<
  Pick<
    Lesson,
    | "weekday"
    | "startTime"
    | "durationMinutes"
    | "courtId"
    | "groupId"
    | "instructorId"
    | "note"
    | "effectiveFrom"
    | "effectiveTo"
  >
>;

function checkLesson(
  lesson: Pick<
    Lesson,
    "weekday" | "startTime" | "durationMinutes" | "effectiveFrom" | "effectiveTo"
  >,
) {
  checkSchedule(lesson);
  checkDate(lesson.effectiveFrom, "Date d'effet invalide.");
  if (lesson.effectiveTo !== null) {
    checkDate(lesson.effectiveTo, "Date de fin d'effet invalide.");
    if (lesson.effectiveTo < lesson.effectiveFrom) {
      throw new PlanningError("La fin d'effet doit suivre le début d'effet.");
    }
  }
}

function newLessonRow(
  input: LessonInput,
  ctx: CommandContext,
  extra: Partial<Lesson> = {},
): Lesson {
  const now = ctx.now();
  const row: Lesson = {
    id: ctx.newId(),
    seasonId: input.seasonId,
    weekday: input.weekday,
    startTime: input.startTime,
    durationMinutes: input.durationMinutes,
    courtId: input.courtId,
    groupId: input.groupId,
    instructorId: input.instructorId,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo ?? null,
    previousLessonId: null,
    note: input.note ?? null,
    createdAt: now,
    updatedAt: now,
    ...extra,
  };
  checkLesson(row);
  return row;
}

export function createLesson(
  _state: PlanningState,
  input: LessonInput,
  ctx: CommandContext = defaultCommandContext,
): Command {
  return labelled("Création du cours", [insert("lessons", newLessonRow(input, ctx))]);
}

/**
 * Rattache les exceptions du cours `lesson` dont la séance d'origine est au
 * plus tôt `from` au cours `target` (même semaine, jour `target.weekday`), pour
 * qu'elles suivent un changement de jour ou une nouvelle version du cours.
 */
function reanchorExceptions(
  state: PlanningState,
  lesson: Lesson,
  target: Pick<Lesson, "id" | "weekday">,
  from: string,
  ctx: CommandContext,
): (Command | null)[] {
  return state.exceptions
    .filter(
      (e) => e.lessonId === lesson.id && e.occurrenceDate !== null && e.occurrenceDate >= from,
    )
    .map((e) =>
      update(
        "exceptions",
        e,
        {
          lessonId: target.id,
          occurrenceDate: addDays(startOfIsoWeek(e.occurrenceDate as string), target.weekday - 1),
        },
        ctx,
      ),
    );
}

/**
 * Modification d'un cours de la semaine type (s'applique à toute la saison, §5.4).
 * Si le jour change, les exceptions du cours suivent (même semaine, nouveau jour).
 */
export function updateLesson(
  state: PlanningState,
  id: string,
  patch: LessonPatch,
  ctx: CommandContext = defaultCommandContext,
  label = "Modification du cours",
): Command {
  const lesson = findLesson(state, id);
  const next = { ...lesson, ...patch };
  checkLesson(next);
  return labelled(label, [
    update("lessons", lesson, patch, ctx),
    ...(next.weekday === lesson.weekday ? [] : reanchorExceptions(state, lesson, next, "", ctx)),
  ]);
}

/** Déplacement par glisser-déposer : jour, heure et court (§5.2). */
export function moveLesson(
  state: PlanningState,
  id: string,
  target: Pick<Lesson, "weekday" | "startTime" | "courtId">,
  ctx: CommandContext = defaultCommandContext,
): Command {
  return updateLesson(state, id, target, ctx, "Déplacement du cours");
}

/** Redimensionnement par le bord inférieur : durée (§5.2). */
export function resizeLesson(
  state: PlanningState,
  id: string,
  durationMinutes: number,
  ctx: CommandContext = defaultCommandContext,
): Command {
  return updateLesson(state, id, { durationMinutes }, ctx, "Changement de durée");
}

/** Dépôt d'une pastille de moniteur sur un cours (§5.2). */
export function changeLessonInstructor(
  state: PlanningState,
  id: string,
  instructorId: string,
  ctx: CommandContext = defaultCommandContext,
): Command {
  return updateLesson(state, id, { instructorId }, ctx, "Changement de moniteur");
}

/** Duplication (glisser avec Alt) : copie du cours avec les valeurs modifiées (§5.2). */
export function duplicateLesson(
  state: PlanningState,
  id: string,
  patch: LessonPatch,
  ctx: CommandContext = defaultCommandContext,
): Command {
  const {
    id: _id,
    createdAt: _c,
    updatedAt: _u,
    previousLessonId: _p,
    ...source
  } = findLesson(state, id);
  return labelled("Duplication du cours", [
    insert("lessons", newLessonRow({ ...source, ...patch }, ctx)),
  ]);
}

/**
 * Suppression d'un cours, avec ses exceptions. Les versions suivantes qui le
 * désignaient comme version précédente perdent ce lien (comme en base).
 */
export function deleteLesson(
  state: PlanningState,
  id: string,
  ctx: CommandContext = defaultCommandContext,
): Command {
  const lesson = findLesson(state, id);
  return labelled("Suppression du cours", [
    ...state.lessons
      .filter((l) => l.previousLessonId === id)
      .map((l) => update("lessons", l, { previousLessonId: null }, ctx)),
    ...state.exceptions.filter((e) => e.lessonId === id).map((e) => remove("exceptions", e)),
    remove("lessons", lesson),
  ]);
}

/**
 * « Appliquer à partir de cette semaine » (§5.4) : clôt le cours à la veille
 * du lundi de la semaine de `date` et crée une nouvelle version, avec les
 * valeurs modifiées, en vigueur à partir de ce lundi (jusqu'à l'ancienne fin
 * d'effet). Les exceptions des semaines suivantes sont rattachées à la
 * nouvelle version (même semaine, nouveau jour).
 *
 * Si le cours ne commence pas avant cette semaine, il est simplement modifié.
 */
export function applyFromWeek(
  state: PlanningState,
  lessonId: string,
  date: string,
  patch: Omit<LessonPatch, "effectiveFrom" | "effectiveTo">,
  ctx: CommandContext = defaultCommandContext,
): Command {
  checkDate(date, "Date invalide.");
  const lesson = findLesson(state, lessonId);
  const monday = startOfIsoWeek(date);
  const label = `Modification à partir de la semaine du ${formatDate(monday)}`;
  if (lesson.effectiveTo !== null && lesson.effectiveTo < monday) {
    throw new PlanningError("Ce cours n'a plus lieu cette semaine-là.");
  }
  if (lesson.effectiveFrom >= monday) return updateLesson(state, lessonId, patch, ctx, label);

  const { id: _id, createdAt: _c, updatedAt: _u, previousLessonId: _p, ...source } = lesson;
  const next = newLessonRow({ ...source, ...patch, effectiveFrom: monday }, ctx, {
    previousLessonId: lesson.id,
  });
  return labelled(label, [
    update("lessons", lesson, { effectiveTo: addDays(monday, -1) }, ctx),
    insert("lessons", next),
    ...reanchorExceptions(state, lesson, next, monday, ctx),
  ]);
}

// ---------------------------------------------------------------------------
// Exceptions sur une occurrence datée (§3.7, §5.5)
// ---------------------------------------------------------------------------

type ExceptionValues = Partial<
  Pick<
    LessonException,
    | "date"
    | "startTime"
    | "durationMinutes"
    | "courtId"
    | "instructorId"
    | "groupId"
    | "cancellationReason"
    | "cancellationNote"
    | "note"
  >
>;

function emptyException(ctx: CommandContext): Omit<LessonException, "seasonId" | "kind"> {
  const now = ctx.now();
  return {
    id: ctx.newId(),
    lessonId: null,
    occurrenceDate: null,
    date: null,
    startTime: null,
    durationMinutes: null,
    courtId: null,
    instructorId: null,
    groupId: null,
    cancellationReason: null,
    cancellationNote: null,
    note: null,
    createdAt: now,
    updatedAt: now,
  };
}

function occurrenceLesson(
  state: PlanningState,
  lessonId: string,
  occurrenceDate: string,
  season?: SeasonBounds | null,
): Lesson {
  checkDate(occurrenceDate, "Date de séance invalide.");
  const lesson = findLesson(state, lessonId);
  if (!hasOccurrenceOn(lesson, occurrenceDate, season)) {
    throw new PlanningError(`Ce cours n'a pas lieu le ${formatDate(occurrenceDate)}.`);
  }
  return lesson;
}

/** Crée l'exception de ce type pour l'occurrence, ou met à jour l'existante. */
function upsertException(
  state: PlanningState,
  lesson: Lesson,
  occurrenceDate: string,
  kind: Exclude<LessonException["kind"], "one_off">,
  values: ExceptionValues,
  ctx: CommandContext,
  label: string,
): Command {
  const existing = state.exceptions.filter(
    (e) => e.lessonId === lesson.id && e.occurrenceDate === occurrenceDate && e.kind === kind,
  );
  const [current, ...duplicates] = existing;
  if (!current) {
    const row: LessonException = {
      ...emptyException(ctx),
      ...values,
      seasonId: lesson.seasonId,
      kind,
      lessonId: lesson.id,
      occurrenceDate,
    };
    return labelled(label, [insert("exceptions", row)]);
  }
  return labelled(label, [
    update("exceptions", current, values, ctx),
    ...duplicates.map((e) => remove("exceptions", e)),
  ]);
}

export interface OccurrenceRef {
  lessonId: string;
  occurrenceDate: string;
  season?: SeasonBounds | null;
}

/**
 * Modifier une séance pour cette seule semaine (§5.5) : nouveaux jour (dans la
 * même semaine), heure, durée, court ou moniteur. Les valeurs identiques à
 * celles du cours sont enregistrées comme « inchangées » (nulles).
 */
export function modifyOccurrence(
  state: PlanningState,
  ref: OccurrenceRef,
  values: Partial<
    Pick<
      LessonException,
      "date" | "startTime" | "durationMinutes" | "courtId" | "instructorId" | "note"
    >
  >,
  ctx: CommandContext = defaultCommandContext,
): Command {
  const lesson = occurrenceLesson(state, ref.lessonId, ref.occurrenceDate, ref.season);
  if (values.date != null) {
    checkDate(values.date, "Date invalide.");
    if (!isSameIsoWeek(values.date, ref.occurrenceDate)) {
      throw new PlanningError("Une séance ne peut être déplacée que dans la même semaine.");
    }
  }
  // Valeurs résultantes : celles saisies, sinon celles d'une modification existante, sinon le cours.
  const current = state.exceptions.find(
    (e) =>
      e.lessonId === lesson.id &&
      e.occurrenceDate === ref.occurrenceDate &&
      e.kind === "modification",
  );
  const resulting = <K extends "startTime" | "durationMinutes">(key: K) =>
    (values[key] !== undefined ? values[key] : current?.[key]) ?? lesson[key];
  checkSchedule({
    startTime: resulting("startTime"),
    durationMinutes: resulting("durationMinutes"),
  });
  const keep = <K extends keyof typeof values>(key: K, base: unknown) =>
    values[key] === undefined ? undefined : values[key] === base ? null : values[key];
  const normalized: ExceptionValues = {
    date: keep("date", ref.occurrenceDate),
    startTime: keep("startTime", lesson.startTime),
    durationMinutes: keep("durationMinutes", lesson.durationMinutes),
    courtId: keep("courtId", lesson.courtId),
    instructorId: keep("instructorId", lesson.instructorId),
    note: keep("note", lesson.note),
  };
  return upsertException(
    state,
    lesson,
    ref.occurrenceDate,
    "modification",
    normalized,
    ctx,
    `Modification de la séance du ${formatDate(ref.occurrenceDate)}`,
  );
}

export interface CancellationInput {
  reason: CancellationReason;
  note?: string | null;
}

/** Annuler une séance, avec un motif obligatoire (§5.5). */
export function cancelOccurrence(
  state: PlanningState,
  ref: OccurrenceRef,
  input: CancellationInput,
  ctx: CommandContext = defaultCommandContext,
): Command {
  const lesson = occurrenceLesson(state, ref.lessonId, ref.occurrenceDate, ref.season);
  const note = input.note?.trim() || null;
  if (input.reason === "other" && note === null) {
    throw new PlanningError("Précisez le motif de l'annulation.");
  }
  return upsertException(
    state,
    lesson,
    ref.occurrenceDate,
    "cancellation",
    { cancellationReason: input.reason, cancellationNote: note },
    ctx,
    `Annulation de la séance du ${formatDate(ref.occurrenceDate)}`,
  );
}

/** Désigner un moniteur remplaçant pour une séance (§5.5). */
export function replaceInstructor(
  state: PlanningState,
  ref: OccurrenceRef,
  instructorId: string,
  ctx: CommandContext = defaultCommandContext,
): Command {
  const lesson = occurrenceLesson(state, ref.lessonId, ref.occurrenceDate, ref.season);
  return upsertException(
    state,
    lesson,
    ref.occurrenceDate,
    "replacement",
    { instructorId },
    ctx,
    `Remplacement pour la séance du ${formatDate(ref.occurrenceDate)}`,
  );
}

/** Rétablir l'occurrence d'origine : supprime toutes ses exceptions (§5.5). */
export function restoreOccurrence(
  state: PlanningState,
  ref: Pick<OccurrenceRef, "lessonId" | "occurrenceDate">,
): Command {
  const exceptions = state.exceptions.filter(
    (e) => e.lessonId === ref.lessonId && e.occurrenceDate === ref.occurrenceDate,
  );
  if (exceptions.length === 0)
    throw new PlanningError("Cette séance n'a pas été changée cette semaine.");
  return labelled(
    `Retour au cours habituel du ${formatDate(ref.occurrenceDate)}`,
    exceptions.map((e) => remove("exceptions", e)),
  );
}

/** Supprimer une seule exception (par exemple le remplacement, en gardant l'annulation). */
export function deleteException(state: PlanningState, id: string): Command {
  const exception = findException(state, id);
  if (exception.kind === "one_off") return deleteOneOff(state, id);
  return labelled("Suppression du changement de la semaine", [remove("exceptions", exception)]);
}

// ---------------------------------------------------------------------------
// Cours ponctuels (§3.7, §5.5)
// ---------------------------------------------------------------------------

export interface OneOffInput {
  seasonId: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  courtId: string;
  instructorId: string;
  groupId?: string | null;
  note?: string | null;
}

function oneOffRow(input: OneOffInput, ctx: CommandContext): LessonException {
  checkDate(input.date, "Date invalide.");
  checkSchedule(input);
  return {
    ...emptyException(ctx),
    seasonId: input.seasonId,
    kind: "one_off",
    date: input.date,
    startTime: input.startTime,
    durationMinutes: input.durationMinutes,
    courtId: input.courtId,
    instructorId: input.instructorId,
    groupId: input.groupId ?? null,
    note: input.note ?? null,
  };
}

function findOneOff(state: PlanningState, id: string): LessonException {
  const exception = findException(state, id);
  if (exception.kind !== "one_off") throw new PlanningError("Ce n'est pas un cours ponctuel.");
  return exception;
}

export function createOneOff(
  _state: PlanningState,
  input: OneOffInput,
  ctx: CommandContext = defaultCommandContext,
): Command {
  return labelled("Création d'un cours ponctuel", [insert("exceptions", oneOffRow(input, ctx))]);
}

export function updateOneOff(
  state: PlanningState,
  id: string,
  patch: Partial<Omit<OneOffInput, "seasonId">>,
  ctx: CommandContext = defaultCommandContext,
): Command {
  const current = findOneOff(state, id);
  if (patch.date !== undefined) checkDate(patch.date, "Date invalide.");
  checkSchedule({
    startTime: patch.startTime ?? current.startTime,
    durationMinutes: patch.durationMinutes ?? current.durationMinutes,
  });
  return labelled("Modification du cours ponctuel", [update("exceptions", current, patch, ctx)]);
}

export function deleteOneOff(state: PlanningState, id: string): Command {
  return labelled("Suppression du cours ponctuel", [remove("exceptions", findOneOff(state, id))]);
}

/**
 * « Dupliquer sur les jours suivants » (§5.5) : copie le cours ponctuel aux
 * mêmes heure, court et moniteur sur les `count` jours suivants, en sautant
 * les jours non affichés de la saison.
 */
export function duplicateOneOffOnFollowingDays(
  state: PlanningState,
  id: string,
  count: number,
  displayedDays: readonly number[],
  ctx: CommandContext = defaultCommandContext,
): Command {
  const source = findOneOff(state, id);
  if (!Number.isInteger(count) || count < 1) {
    throw new PlanningError("Indiquez un nombre de jours positif.");
  }
  if (!displayedDays.some((day) => Number.isInteger(day) && day >= 1 && day <= 7)) {
    throw new PlanningError("Aucun jour affiché.");
  }
  const copies: Command[] = [];
  let date = source.date as string;
  while (copies.length < count) {
    date = addDays(date, 1);
    if (!displayedDays.includes(isoWeekday(date))) continue;
    const { id: _id, createdAt: _c, updatedAt: _u, ...values } = source;
    const now = ctx.now();
    copies.push(
      insert("exceptions", { ...values, id: ctx.newId(), date, createdAt: now, updatedAt: now }),
    );
  }
  return labelled(
    count === 1 ? "Duplication sur le jour suivant" : `Duplication sur les ${count} jours suivants`,
    copies,
  );
}

// ---------------------------------------------------------------------------
// Périodes de fermeture (§3.8)
// ---------------------------------------------------------------------------

export type ClosureInput = Pick<Closure, "seasonId" | "label" | "startDate" | "endDate">;

function checkClosure(values: Pick<Closure, "label" | "startDate" | "endDate">): void {
  if (values.label.trim() === "") throw new PlanningError("Le libellé est obligatoire.");
  checkDate(values.startDate, "Date de début invalide.");
  checkDate(values.endDate, "Date de fin invalide.");
  if (values.endDate < values.startDate) {
    throw new PlanningError("La date de fin doit suivre la date de début.");
  }
}

export function createClosure(
  _state: PlanningState,
  input: ClosureInput,
  ctx: CommandContext = defaultCommandContext,
): Command {
  const values = { ...input, label: input.label.trim() };
  checkClosure(values);
  const now = ctx.now();
  return labelled("Ajout d'une fermeture", [
    insert("closures", { ...values, id: ctx.newId(), createdAt: now, updatedAt: now }),
  ]);
}

/** Ajout de plusieurs fermetures en une seule commande (assistant de pré-remplissage, §3.8). */
export function createClosures(
  state: PlanningState,
  inputs: readonly ClosureInput[],
  ctx: CommandContext = defaultCommandContext,
): Command {
  if (inputs.length === 0) throw new PlanningError("Aucune fermeture à ajouter.");
  const commands = inputs.map((input) => createClosure(state, input, ctx));
  return inputs.length === 1
    ? (commands[0] as Command)
    : composeCommands(`Ajout de ${inputs.length} fermetures`, commands);
}

export function updateClosure(
  state: PlanningState,
  id: string,
  patch: Partial<Pick<Closure, "label" | "startDate" | "endDate">>,
  ctx: CommandContext = defaultCommandContext,
): Command {
  const closure = findClosure(state, id);
  const values = patch.label === undefined ? patch : { ...patch, label: patch.label.trim() };
  checkClosure({ ...closure, ...values });
  return labelled("Modification de la fermeture", [update("closures", closure, values, ctx)]);
}

export function deleteClosure(state: PlanningState, id: string): Command {
  return labelled("Suppression de la fermeture", [remove("closures", findClosure(state, id))]);
}
