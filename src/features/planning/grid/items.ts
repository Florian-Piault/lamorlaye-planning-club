/**
 * Modes de l'écran Planning et éléments affichés sur la grille (SPECS.md
 * §4.2, §5.4, §5.5) : en semaine type (« Planning habituel » à l'écran), les
 * cours en vigueur ; en semaine datée (« Une semaine précise », nommée
 * « Semaine du 2 novembre »), les séances de la semaine (occurrences avec
 * leurs exceptions, cours ponctuels). Fonctions pures.
 */
import type { Lesson } from "@/db/schema";
import type { PlanningSlot } from "@/domain/conflicts";
import { startOfIsoWeek } from "@/domain/dates";
import { type ClosureRecord, closureOn, type Occurrence } from "@/domain/occurrences";
import { addDays, formatDate, timeToMinutes, weekdayLabel } from "@/domain/time";
import type { CandidateLesson, DateOfWeekday } from "./view";

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

export type PlanningMode = { kind: "type" } | { kind: "dated"; monday: string };

export const TYPE_MODE: PlanningMode = { kind: "type" };

/** Mode « semaine datée » de la semaine contenant `date`. */
export function datedMode(date: string): PlanningMode {
  return { kind: "dated", monday: startOfIsoWeek(date) };
}

/** Date d'un jour de la semaine affichée (nulle en semaine type). */
export function dateOfMode(mode: PlanningMode): DateOfWeekday {
  if (mode.kind === "type") return () => null;
  return (weekday) => addDays(mode.monday, weekday - 1);
}

/** « 02/11 ». */
export function shortDate(date: string): string {
  return formatDate(date).slice(0, 5);
}

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
] as const;

/** Nom d'une semaine précise, d'après son lundi : « Semaine du 2 novembre », « du 1er mars ». */
export function weekName(monday: string): string {
  const [, month = 1, day = 1] = monday.split("-").map(Number);
  return `Semaine du ${day === 1 ? "1er" : day} ${MONTHS[month - 1]}`;
}

/** En-tête d'un jour : « Lundi » ou « Lundi 02/11 ». */
export function dayHeading(mode: PlanningMode, weekday: number): string {
  const date = dateOfMode(mode)(weekday);
  return date ? `${weekdayLabel(weekday)} ${shortDate(date)}` : weekdayLabel(weekday);
}

export interface SeasonRange {
  startDate: string;
  endDate: string;
}

/** Lundi de la semaine de `date`, ramenée dans la saison. */
export function clampWeek(season: SeasonRange, date: string): string {
  const first = startOfIsoWeek(season.startDate);
  const last = startOfIsoWeek(season.endDate);
  const monday = startOfIsoWeek(date);
  if (monday < first) return first;
  if (monday > last) return last;
  return monday;
}

/** Semaines précédente et suivante dans la saison (`null` en bout de saison). */
export function weekNeighbours(
  season: SeasonRange,
  monday: string,
): { previous: string | null; next: string | null } {
  const previous = addDays(monday, -7);
  const next = addDays(monday, 7);
  return {
    previous: clampWeek(season, previous) === previous ? previous : null,
    next: clampWeek(season, next) === next ? next : null,
  };
}

// ---------------------------------------------------------------------------
// Éléments de la grille
// ---------------------------------------------------------------------------

export interface GridItem extends CandidateLesson {
  /** `lesson` : cours de la semaine type ; `regular` / `one_off` : séance datée. */
  kind: "lesson" | "regular" | "one_off";
  /** Cours de la semaine type concerné (nul pour un cours ponctuel). */
  lessonId: string | null;
  /** Exception « cours ponctuel » (nulle sinon). */
  oneOffId: string | null;
  occurrence: Occurrence | null;
  date: string | null;
  startTime: string;
  cancelled: boolean;
  note: string | null;
}

export function lessonItem(lesson: Lesson): GridItem {
  return {
    id: lesson.id,
    kind: "lesson",
    lessonId: lesson.id,
    oneOffId: null,
    occurrence: null,
    date: null,
    weekday: lesson.weekday,
    startTime: lesson.startTime,
    start: timeToMinutes(lesson.startTime),
    durationMinutes: lesson.durationMinutes,
    courtId: lesson.courtId,
    groupId: lesson.groupId,
    instructorId: lesson.instructorId,
    cancelled: false,
    note: lesson.note,
  };
}

export function occurrenceItem(occurrence: Occurrence): GridItem {
  return {
    id: occurrence.key,
    kind: occurrence.kind,
    lessonId: occurrence.lessonId,
    oneOffId: occurrence.oneOffId,
    occurrence,
    date: occurrence.date,
    weekday: occurrence.weekday,
    startTime: occurrence.startTime,
    start: occurrence.start,
    durationMinutes: occurrence.durationMinutes,
    courtId: occurrence.courtId,
    groupId: occurrence.groupId,
    instructorId: occurrence.instructorId,
    cancelled: occurrence.status === "cancelled",
    note: occurrence.note,
  };
}

/**
 * Séances affichées d'une semaine datée : celles suspendues par une fermeture
 * sont masquées (la bande « Fermé » les remplace) ; les séances annulées
 * (grisées) et les cours ponctuels, y compris pendant une fermeture, restent.
 */
export function datedItems(occurrences: readonly Occurrence[]): GridItem[] {
  return occurrences.filter((o) => o.status !== "closed").map(occurrenceItem);
}

/** Créneau minimal d'un élément (aperçu, gestes). */
export function toCandidate(item: CandidateLesson): CandidateLesson {
  return {
    id: item.id,
    weekday: item.weekday,
    start: item.start,
    durationMinutes: item.durationMinutes,
    courtId: item.courtId,
    groupId: item.groupId,
    instructorId: item.instructorId,
  };
}

export function itemSlot(item: GridItem): PlanningSlot {
  return {
    id: item.id,
    date: item.date,
    weekday: item.weekday,
    start: item.start,
    end: item.start + item.durationMinutes,
    courtId: item.courtId,
    groupId: item.groupId,
    instructorId: item.instructorId,
  };
}

/** Éléments qui comptent (contrôles, heures) : les séances annulées sont exclues. */
export function activeItems(items: readonly GridItem[]): GridItem[] {
  return items.filter((item) => !item.cancelled);
}

// ---------------------------------------------------------------------------
// Fermetures
// ---------------------------------------------------------------------------

export interface ClosedDay {
  weekday: number;
  date: string;
  label: string;
}

/** Jours affichés couverts par une fermeture (bandes « Fermé — … »). */
export function closedDays(
  mode: PlanningMode,
  weekdays: readonly number[],
  closures: readonly ClosureRecord[],
): ClosedDay[] {
  const dateOf = dateOfMode(mode);
  return weekdays.flatMap((weekday) => {
    const date = dateOf(weekday);
    const closure = date ? closureOn(closures, date) : null;
    return date && closure ? [{ weekday, date, label: `Fermé — ${closure.label}` }] : [];
  });
}
