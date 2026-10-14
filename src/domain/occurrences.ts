/**
 * Occurrences datées des cours (SPECS.md §3.6–3.8, §4.2).
 *
 * Une occurrence est l'instance d'un cours de la semaine type à une date
 * précise, ou un cours ponctuel. Elle est calculée à partir :
 * - des cours de la semaine type, selon leurs dates d'effet (fin incluse) ;
 * - des périodes de fermeture (bornes incluses), qui suspendent les
 *   occurrences régulières (statut `closed`) mais pas les cours ponctuels ;
 * - des exceptions, qui se cumulent sur une même occurrence :
 *   modification (valeurs non nulles), puis remplacement (moniteur), puis
 *   annulation. Si une occurrence porte plusieurs exceptions du même type,
 *   la plus récente (`updatedAt`, puis ordre de la liste) l'emporte.
 *
 * Une exception qui ne désigne pas une occurrence réelle (cours clôturé à
 * cette date, jour de la semaine différent, hors saison) est ignorée : voir
 * `orphanExceptions`.
 */
import type { CancellationReason, Closure, Lesson, LessonException } from "@/db/schema";
import { eachDay, isDateInRange, isoWeekday, maxDate, minDate, weekDates } from "./dates";
import { minutesToTime, timeToMinutes } from "./time";

// ---------------------------------------------------------------------------
// Données d'entrée (alignées sur le schéma Drizzle)
// ---------------------------------------------------------------------------

export type LessonRecord = Pick<
  Lesson,
  | "id"
  | "weekday"
  | "startTime"
  | "durationMinutes"
  | "courtId"
  | "groupId"
  | "instructorId"
  | "effectiveFrom"
  | "effectiveTo"
  | "note"
>;

export type ExceptionRecord = Pick<
  LessonException,
  | "id"
  | "kind"
  | "lessonId"
  | "occurrenceDate"
  | "date"
  | "startTime"
  | "durationMinutes"
  | "courtId"
  | "instructorId"
  | "groupId"
  | "cancellationReason"
  | "cancellationNote"
  | "note"
> &
  Partial<Pick<LessonException, "updatedAt">>;

export type ClosureRecord = Pick<Closure, "id" | "label" | "startDate" | "endDate">;

export interface SeasonBounds {
  startDate: string;
  endDate: string;
}

export interface PlanningSource {
  lessons: readonly LessonRecord[];
  exceptions: readonly ExceptionRecord[];
  closures: readonly ClosureRecord[];
  /** Limites de la saison : aucune occurrence régulière en dehors. */
  season?: SeasonBounds | null;
}

// ---------------------------------------------------------------------------
// Occurrences
// ---------------------------------------------------------------------------

export type OccurrenceStatus = "active" | "cancelled" | "closed";

export interface Occurrence {
  /** Identifiant stable : `id-du-cours@AAAA-MM-JJ` ou `ponctuel:id-de-l-exception`. */
  key: string;
  kind: "regular" | "one_off";
  /** Cours de la semaine type (nul pour un cours ponctuel). */
  lessonId: string | null;
  /** Exception « cours ponctuel » (nulle pour une occurrence régulière). */
  oneOffId: string | null;
  /** Date d'origine de l'occurrence (nulle pour un cours ponctuel). */
  occurrenceDate: string | null;
  date: string;
  weekday: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  /** Début et fin en minutes depuis minuit. */
  start: number;
  end: number;
  courtId: string | null;
  groupId: string | null;
  /** Moniteur qui assure la séance (le remplaçant le cas échéant). */
  instructorId: string | null;
  /** Moniteur prévu, si la séance est assurée par un remplaçant. */
  originalInstructorId: string | null;
  status: OccurrenceStatus;
  closure: ClosureRecord | null;
  cancellation: { reason: CancellationReason | null; note: string | null } | null;
  modified: boolean;
  replaced: boolean;
  /** Exceptions appliquées (pour « Rétablir l'occurrence d'origine »). */
  exceptionIds: string[];
  note: string | null;
}

export function occurrenceKey(lessonId: string, occurrenceDate: string): string {
  return `${lessonId}@${occurrenceDate}`;
}

export function oneOffKey(exceptionId: string): string {
  return `ponctuel:${exceptionId}`;
}

/** Le cours est-il en vigueur à cette date (dates d'effet, bornes incluses) ? */
export function isLessonEffectiveOn(lesson: LessonRecord, date: string): boolean {
  return isDateInRange(date, lesson.effectiveFrom, lesson.effectiveTo);
}

/** Le cours a-t-il une occurrence à cette date (jour, dates d'effet, saison) ? */
export function hasOccurrenceOn(
  lesson: LessonRecord,
  date: string,
  season?: SeasonBounds | null,
): boolean {
  return (
    isoWeekday(date) === lesson.weekday &&
    isLessonEffectiveOn(lesson, date) &&
    (!season || isDateInRange(date, season.startDate, season.endDate))
  );
}

/** Version des cours en vigueur à une date (affichage de la semaine type). */
export function lessonsInEffect<T extends LessonRecord>(lessons: readonly T[], date: string): T[] {
  return lessons.filter((lesson) => isLessonEffectiveOn(lesson, date));
}

/** Fermeture couvrant la date, le cas échéant. */
export function closureOn(closures: readonly ClosureRecord[], date: string): ClosureRecord | null {
  return closures.find((c) => isDateInRange(date, c.startDate, c.endDate)) ?? null;
}

/** Fermetures chevauchant la période (pour les bandes « Fermé »). */
export function closuresBetween(
  closures: readonly ClosureRecord[],
  from: string,
  to: string,
): ClosureRecord[] {
  return closures
    .filter((c) => c.startDate <= to && from <= c.endDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

interface OccurrenceExceptions {
  modification?: ExceptionRecord;
  replacement?: ExceptionRecord;
  cancellation?: ExceptionRecord;
}

function isMoreRecent(candidate: ExceptionRecord, current: ExceptionRecord | undefined): boolean {
  return !current || (candidate.updatedAt ?? "") >= (current.updatedAt ?? "");
}

/** Exceptions regroupées par occurrence (`cours@date`). */
function indexExceptions(
  exceptions: readonly ExceptionRecord[],
): Map<string, OccurrenceExceptions> {
  const index = new Map<string, OccurrenceExceptions>();
  for (const exception of exceptions) {
    if (exception.kind === "one_off" || !exception.lessonId || !exception.occurrenceDate) continue;
    const key = occurrenceKey(exception.lessonId, exception.occurrenceDate);
    const entry = index.get(key) ?? {};
    if (isMoreRecent(exception, entry[exception.kind])) entry[exception.kind] = exception;
    index.set(key, entry);
  }
  return index;
}

function regularOccurrence(
  lesson: LessonRecord,
  occurrenceDate: string,
  exceptions: OccurrenceExceptions | undefined,
  closures: readonly ClosureRecord[],
): Occurrence {
  const { modification, replacement, cancellation } = exceptions ?? {};
  const date = modification?.date ?? occurrenceDate;
  const startTime = modification?.startTime ?? lesson.startTime;
  const durationMinutes = modification?.durationMinutes ?? lesson.durationMinutes;
  const plannedInstructor = modification?.instructorId ?? lesson.instructorId;
  const substitute = replacement?.instructorId ?? null;
  const replaced = substitute !== null && substitute !== plannedInstructor;
  const start = timeToMinutes(startTime);
  const closure = closureOn(closures, date);
  const applied = [modification, replacement, cancellation].filter(
    (e): e is ExceptionRecord => e !== undefined,
  );
  return {
    key: occurrenceKey(lesson.id, occurrenceDate),
    kind: "regular",
    lessonId: lesson.id,
    oneOffId: null,
    occurrenceDate,
    date,
    weekday: isoWeekday(date),
    startTime,
    endTime: minutesToTime(start + durationMinutes),
    durationMinutes,
    start,
    end: start + durationMinutes,
    courtId: modification?.courtId ?? lesson.courtId,
    groupId: modification?.groupId ?? lesson.groupId,
    instructorId: replaced ? substitute : plannedInstructor,
    originalInstructorId: replaced ? plannedInstructor : null,
    status: cancellation ? "cancelled" : closure ? "closed" : "active",
    closure,
    cancellation: cancellation
      ? { reason: cancellation.cancellationReason, note: cancellation.cancellationNote }
      : null,
    modified: modification !== undefined,
    replaced,
    exceptionIds: applied.map((e) => e.id),
    note: modification?.note ?? lesson.note,
  };
}

/** Occurrence d'un cours ponctuel (`null` si l'exception est incomplète). */
export function oneOffOccurrence(
  exception: ExceptionRecord,
  closures: readonly ClosureRecord[] = [],
): Occurrence | null {
  if (exception.kind !== "one_off" || !exception.date || !exception.startTime) return null;
  const durationMinutes = exception.durationMinutes ?? 0;
  if (durationMinutes <= 0) return null;
  const start = timeToMinutes(exception.startTime);
  return {
    key: oneOffKey(exception.id),
    kind: "one_off",
    lessonId: null,
    oneOffId: exception.id,
    occurrenceDate: null,
    date: exception.date,
    weekday: isoWeekday(exception.date),
    startTime: exception.startTime,
    endTime: minutesToTime(start + durationMinutes),
    durationMinutes,
    start,
    end: start + durationMinutes,
    courtId: exception.courtId,
    groupId: exception.groupId,
    instructorId: exception.instructorId,
    originalInstructorId: null,
    // Un cours ponctuel (stage) reste actif pendant une fermeture (§5.5).
    status: "active",
    closure: closureOn(closures, exception.date),
    cancellation: null,
    modified: false,
    replaced: false,
    exceptionIds: [exception.id],
    note: exception.note,
  };
}

function compareOccurrences(a: Occurrence, b: Occurrence): number {
  return (
    a.date.localeCompare(b.date) ||
    a.start - b.start ||
    (a.courtId ?? "").localeCompare(b.courtId ?? "") ||
    a.key.localeCompare(b.key)
  );
}

/**
 * Occurrences dont la date (après modification éventuelle) est comprise entre
 * `from` et `to` inclus, triées par date, heure puis court.
 */
export function occurrencesBetween(source: PlanningSource, from: string, to: string): Occurrence[] {
  if (to < from) return [];
  const { lessons, exceptions, closures, season } = source;
  const index = indexExceptions(exceptions);
  const lessonsById = new Map(lessons.map((l) => [l.id, l]));
  const origins = new Map<string, { lesson: LessonRecord; date: string }>();

  // Occurrences régulières de la période (limitée à la saison).
  const first = season ? maxDate(from, season.startDate) : from;
  const last = season ? minDate(to, season.endDate) : to;
  const daysByWeekday = new Map<number, string[]>();
  for (const date of eachDay(first, last)) {
    const weekday = isoWeekday(date);
    daysByWeekday.set(weekday, [...(daysByWeekday.get(weekday) ?? []), date]);
  }
  for (const lesson of lessons) {
    for (const date of daysByWeekday.get(lesson.weekday) ?? []) {
      if (isLessonEffectiveOn(lesson, date)) {
        origins.set(occurrenceKey(lesson.id, date), { lesson, date });
      }
    }
  }
  // Occurrences d'une autre période déplacées dans celle-ci.
  for (const exception of exceptions) {
    if (exception.kind !== "modification" || !exception.date) continue;
    if (!isDateInRange(exception.date, from, to)) continue;
    const lesson = lessonsById.get(exception.lessonId ?? "");
    const date = exception.occurrenceDate;
    if (lesson && date && hasOccurrenceOn(lesson, date, season)) {
      origins.set(occurrenceKey(lesson.id, date), { lesson, date });
    }
  }

  const result: Occurrence[] = [];
  for (const [key, { lesson, date }] of origins) {
    const occurrence = regularOccurrence(lesson, date, index.get(key), closures);
    if (isDateInRange(occurrence.date, from, to)) result.push(occurrence);
  }
  for (const exception of exceptions) {
    if (exception.kind !== "one_off" || !exception.date) continue;
    if (!isDateInRange(exception.date, from, to)) continue;
    const occurrence = oneOffOccurrence(exception, closures);
    if (occurrence) result.push(occurrence);
  }
  return result.sort(compareOccurrences);
}

/** Occurrences de la semaine ISO contenant `date`. */
export function weekOccurrences(source: PlanningSource, date: string): Occurrence[] {
  const days = weekDates(date);
  return occurrencesBetween(source, days[0] as string, days[6] as string);
}

/** Occurrence d'un cours à une date d'origine donnée (`null` si le cours n'a pas lieu ce jour-là). */
export function findOccurrence(
  source: PlanningSource,
  lessonId: string,
  occurrenceDate: string,
): Occurrence | null {
  const lesson = source.lessons.find((l) => l.id === lessonId);
  if (!lesson || !hasOccurrenceOn(lesson, occurrenceDate, source.season)) return null;
  const index = indexExceptions(source.exceptions);
  const key = occurrenceKey(lessonId, occurrenceDate);
  return regularOccurrence(lesson, occurrenceDate, index.get(key), source.closures);
}

/** Occurrences qui comptent (ni annulées, ni suspendues par une fermeture). */
export function activeOccurrences(occurrences: readonly Occurrence[]): Occurrence[] {
  return occurrences.filter((o) => o.status === "active");
}

/**
 * Exceptions sans effet : rattachées à un cours inexistant ou à une date où
 * le cours n'a pas lieu (par exemple après sa clôture par « Appliquer à partir de »).
 */
export function orphanExceptions<T extends ExceptionRecord>(
  source: Omit<PlanningSource, "exceptions"> & { exceptions: readonly T[] },
): T[] {
  const lessonsById = new Map(source.lessons.map((l) => [l.id, l]));
  return source.exceptions.filter((exception) => {
    if (exception.kind === "one_off") return false;
    const lesson = lessonsById.get(exception.lessonId ?? "");
    return (
      !lesson ||
      !exception.occurrenceDate ||
      !hasOccurrenceOn(lesson, exception.occurrenceDate, source.season)
    );
  });
}
