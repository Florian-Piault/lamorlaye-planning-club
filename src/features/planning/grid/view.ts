/**
 * Données affichées par l'écran Planning en mode « Semaine type » (SPECS.md
 * §4.1, §4.3, §5.1, §7) : cours en vigueur, colonnes, totaux d'heures,
 * filtres et avertissements. Fonctions pures.
 */
import type { Lesson } from "@/db/schema";
import {
  type Conflict,
  type ConflictIndex,
  detectConflicts,
  detectSlotConflicts,
  type PlanningSlot,
  slotFromLesson,
} from "@/domain/conflicts";
import {
  type InstructorAvailabilityData,
  sortByAvailability,
  type TimeSlot,
} from "@/domain/instructorAvailability";
import { lessonsInEffect } from "@/domain/occurrences";
import { timeToMinutes } from "@/domain/time";

/**
 * Date de référence de la semaine type : aujourd'hui, ramené dans la saison.
 * Seule la version des cours en vigueur à cette date est affichée (après
 * « Appliquer à partir de », deux versions d'un même cours coexistent).
 */
export function semaineTypeDate(
  season: { startDate: string; endDate: string },
  today: string,
): string {
  if (today < season.startDate) return season.startDate;
  if (today > season.endDate) return season.endDate;
  return today;
}

/** Cours de la semaine type en vigueur à la date de référence. */
export function weekLessons(lessons: readonly Lesson[], referenceDate: string): Lesson[] {
  return lessonsInEffect(lessons, referenceDate);
}

/** Jours affichés : ceux de la saison, plus ceux où un cours existe malgré tout. */
export function displayedWeekdays(
  seasonDays: readonly number[],
  lessons: readonly Pick<Lesson, "weekday">[],
): number[] {
  return [...new Set([...seasonDays, ...lessons.map((l) => l.weekday)])].sort((a, b) => a - b);
}

/**
 * Amplitude affichée (minutes) : celle de la saison, élargie à l'heure pleine
 * pour qu'un cours qui en déborde (amplitude réduite après coup, durée longue)
 * reste entièrement visible et manipulable.
 */
export function displayedRange(
  season: { start: number; end: number },
  lessons: readonly Pick<Lesson, "startTime" | "durationMinutes">[],
): { start: number; end: number } {
  let { start, end } = season;
  for (const lesson of lessons) {
    const lessonStart = timeToMinutes(lesson.startTime);
    start = Math.min(start, Math.floor(lessonStart / 60) * 60);
    end = Math.max(end, Math.ceil((lessonStart + lesson.durationMinutes) / 60) * 60);
  }
  return { start, end: Math.min(end, 24 * 60) };
}

/** Courts affichés : actifs, plus les courts archivés qui portent encore un cours. */
export function displayedCourts<T extends { id: string; active: boolean }>(
  courts: readonly T[],
  lessons: readonly { courtId: string | null }[],
): T[] {
  const used = new Set(lessons.map((l) => l.courtId));
  return courts.filter((c) => c.active || used.has(c.id));
}

/** Minutes de cours par moniteur sur la semaine type. */
export function minutesByInstructor(
  lessons: readonly { instructorId: string | null; durationMinutes: number }[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const lesson of lessons) {
    if (!lesson.instructorId) continue;
    totals.set(
      lesson.instructorId,
      (totals.get(lesson.instructorId) ?? 0) + lesson.durationMinutes,
    );
  }
  return totals;
}

export function totalMinutes(lessons: readonly Pick<Lesson, "durationMinutes">[]): number {
  return lessons.reduce((sum, l) => sum + l.durationMinutes, 0);
}

// ---------------------------------------------------------------------------
// Avertissements
// ---------------------------------------------------------------------------

export interface InstructorLabel {
  id: string;
  firstName: string;
  /** Le moniteur n'a saisi aucune plage de disponibilité. */
  noAvailability: boolean;
}

/**
 * Un moniteur sans aucune plage est indisponible partout (les plages sont
 * « peintes » comme disponibles) : on le dit explicitement plutôt que
 * « Hors disponibilités », pour que l'avertissement soit compréhensible.
 */
export function explainConflicts(
  slot: Pick<PlanningSlot, "instructorId">,
  conflicts: readonly Conflict[],
  instructors: ReadonlyMap<string, InstructorLabel>,
): Conflict[] {
  const instructor = slot.instructorId ? instructors.get(slot.instructorId) : undefined;
  if (!instructor?.noAvailability) return [...conflicts];
  return conflicts.map((c) =>
    c.kind === "instructor_unavailable"
      ? { ...c, message: noAvailabilityMessage(instructor.firstName) }
      : c,
  );
}

/** Messages distincts (deux cours du même moniteur à la même heure donnent le même message). */
export function warningMessages(conflicts: readonly Conflict[]): string[] {
  return [...new Set(conflicts.map((c) => c.message))];
}

export function noAvailabilityMessage(firstName: string): string {
  return `Aucune disponibilité saisie pour ${firstName}`;
}

/** Avertissements de tous les cours affichés, par identifiant de cours. */
export function weekWarnings(
  lessons: readonly Lesson[],
  index: ConflictIndex,
  instructors: ReadonlyMap<string, InstructorLabel>,
): Map<string, Conflict[]> {
  return slotWarnings(lessons.map(slotFromLesson), index, instructors);
}

/** Avertissements de créneaux (semaine type ou séances actives d'une semaine datée). */
export function slotWarnings(
  slots: readonly PlanningSlot[],
  index: ConflictIndex,
  instructors: ReadonlyMap<string, InstructorLabel>,
): Map<string, Conflict[]> {
  const conflicts = detectConflicts(slots, index);
  const result = new Map<string, Conflict[]>();
  for (const slot of slots) {
    const list = conflicts.get(slot.id);
    if (list) result.set(slot.id, explainConflicts(slot, list, instructors));
  }
  return result;
}

/** Créneau d'un cours candidat (aperçu pendant un glisser, panneau). */
export interface CandidateLesson {
  /** Identifiant du cours modifié, ou d'un nouveau cours. */
  id: string;
  weekday: number;
  start: number;
  durationMinutes: number;
  courtId: string | null;
  groupId: string | null;
  instructorId: string | null;
}

export const NEW_LESSON_ID = "__nouveau__";

/** Date d'un jour de la semaine affichée (nulle en semaine type). */
export type DateOfWeekday = (weekday: number) => string | null;

export const noDate: DateOfWeekday = () => null;

export function candidateSlot(
  candidate: CandidateLesson,
  dateOf: DateOfWeekday = noDate,
): PlanningSlot {
  return {
    id: candidate.id,
    date: dateOf(candidate.weekday),
    weekday: candidate.weekday,
    start: candidate.start,
    end: candidate.start + candidate.durationMinutes,
    courtId: candidate.courtId,
    groupId: candidate.groupId,
    instructorId: candidate.instructorId,
  };
}

/** Avertissements en temps réel d'un cours candidat face aux cours de la semaine. */
export function candidateWarnings(
  candidate: CandidateLesson,
  slots: readonly PlanningSlot[],
  index: ConflictIndex,
  instructors: ReadonlyMap<string, InstructorLabel>,
  dateOf: DateOfWeekday = noDate,
): Conflict[] {
  const slot = candidateSlot(candidate, dateOf);
  return explainConflicts(slot, detectSlotConflicts(slot, slots, index), instructors);
}

// ---------------------------------------------------------------------------
// Filtres (§4.3)
// ---------------------------------------------------------------------------

export interface PlanningFilters {
  instructorIds: readonly string[];
  courtIds: readonly string[];
  groupId: string | null;
}

export const noFilters: PlanningFilters = { instructorIds: [], courtIds: [], groupId: null };

export function hasFilters(filters: PlanningFilters): boolean {
  return (
    filters.instructorIds.length > 0 || filters.courtIds.length > 0 || filters.groupId !== null
  );
}

/** Le cours est-il concerné par les filtres ? (les autres sont estompés) */
export function matchesFilters(
  lesson: { instructorId: string | null; courtId: string | null; groupId: string | null },
  filters: PlanningFilters,
): boolean {
  return (
    (filters.instructorIds.length === 0 ||
      filters.instructorIds.includes(lesson.instructorId ?? "")) &&
    (filters.courtIds.length === 0 || filters.courtIds.includes(lesson.courtId ?? "")) &&
    (filters.groupId === null || filters.groupId === lesson.groupId)
  );
}

export function toggleId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id];
}

// ---------------------------------------------------------------------------
// Choix du moniteur (§5.1)
// ---------------------------------------------------------------------------

export interface InstructorChoice<T> {
  instructor: T;
  available: boolean;
  /** Mention affichée après le nom des moniteurs indisponibles. */
  note: string | null;
}

/** Moniteurs disponibles sur le créneau en tête, puis les autres avec leur mention. */
export function instructorChoices<T extends InstructorAvailabilityData>(
  instructors: readonly T[],
  slot: TimeSlot,
): InstructorChoice<T>[] {
  return sortByAvailability(instructors, slot).map(({ instructor, available }) => ({
    instructor,
    available,
    note: available
      ? null
      : instructor.availabilities.length === 0
        ? "aucune disponibilité saisie"
        : "indisponible",
  }));
}
