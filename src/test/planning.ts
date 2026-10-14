import type { Closure, Lesson, LessonException } from "@/db/schema";
import type { CommandContext } from "@/domain/commands";

/** Saison de référence des tests (le 01/09/2026 est un mardi). */
export const SEASON = { startDate: "2026-09-01", endDate: "2027-06-30" };
export const SEASON_ID = "saison";

const STAMP = "2026-08-01T00:00:00.000Z";

/** Cours de semaine type : mercredi 14h00, 1 h, court C1, groupe G1, moniteur M1. */
export function lesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: "cours",
    seasonId: SEASON_ID,
    weekday: 3,
    startTime: "14:00",
    durationMinutes: 60,
    courtId: "c1",
    groupId: "g1",
    instructorId: "m1",
    effectiveFrom: SEASON.startDate,
    effectiveTo: null,
    previousLessonId: null,
    note: null,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...overrides,
  };
}

export function exception(
  overrides: Partial<LessonException> & Pick<LessonException, "id" | "kind">,
): LessonException {
  return {
    seasonId: SEASON_ID,
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
    createdAt: STAMP,
    updatedAt: STAMP,
    ...overrides,
  };
}

export function closure(
  overrides: Partial<Closure> & Pick<Closure, "id" | "startDate" | "endDate">,
): Closure {
  return {
    seasonId: SEASON_ID,
    label: "Fermeture",
    createdAt: STAMP,
    updatedAt: STAMP,
    ...overrides,
  };
}

/** Contexte déterministe : identifiants `id-1`, `id-2`… et horloge qui avance d'une seconde. */
export function testContext(prefix = "id"): CommandContext {
  let ids = 0;
  let ticks = 0;
  return {
    newId: () => `${prefix}-${++ids}`,
    now: () => new Date(Date.UTC(2026, 9, 1, 12, 0, ticks++)).toISOString(),
  };
}
