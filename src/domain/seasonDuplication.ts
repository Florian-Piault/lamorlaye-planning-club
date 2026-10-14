/**
 * Nouvelle saison par duplication (SPECS.md §8.1).
 *
 * Sont copiés : courts, moniteurs (avec leurs disponibilités récurrentes),
 * groupes (avec leur composition), élèves et semaine type. Ne sont **pas**
 * copiés : exceptions, cours ponctuels, indisponibilités datées et fermetures.
 *
 * Chaque ligne copiée reçoit un nouvel UUID et toutes les références sont
 * réécrites vers les copies : la nouvelle saison est totalement indépendante
 * de l'origine. Les niveaux, communs à toutes les saisons, sont conservés.
 *
 * Semaine type : seules les versions de cours **en vigueur à la fin de la
 * saison d'origine** sont reprises (les versions clôturées par « Appliquer à
 * partir de », ou les cours arrêtés en cours de saison, ne le sont pas), avec
 * des dates d'effet couvrant toute la nouvelle saison.
 */
import type {
  Court,
  Group,
  GroupStudent,
  Instructor,
  InstructorAvailability,
  Lesson,
  Student,
} from "@/db/schema";
import { isLessonEffectiveOn } from "./occurrences";
import type { SeasonFormValues } from "./validation";

/** Données de la saison d'origine utiles à la duplication. */
export interface SeasonSnapshot {
  courts: readonly Court[];
  instructors: readonly Instructor[];
  availabilities: readonly InstructorAvailability[];
  groups: readonly Group[];
  students: readonly Student[];
  memberships: readonly Pick<GroupStudent, "groupId" | "studentId">[];
  lessons: readonly Lesson[];
}

/** Lignes à insérer pour la nouvelle saison, dans l'ordre des clés étrangères. */
export interface DuplicationPlan {
  courts: Court[];
  instructors: Instructor[];
  availabilities: InstructorAvailability[];
  groups: Group[];
  students: Student[];
  memberships: GroupStudent[];
  lessons: Lesson[];
}

export interface DuplicationSummary {
  courts: number;
  instructors: number;
  groups: number;
  students: number;
  lessons: number;
  /** Versions de cours non reprises (clôturées avant la fin de la saison d'origine). */
  skippedLessons: number;
}

export interface DuplicationTarget {
  seasonId: string;
  /** Début de la nouvelle saison : date d'effet des cours repris. */
  startDate: string;
}

export interface DuplicationContext {
  newId: () => string;
  now: () => string;
}

export const defaultDuplicationContext: DuplicationContext = {
  newId: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
};

/** Versions des cours en vigueur le dernier jour de la saison d'origine. */
export function lessonsToCarryOver<T extends Lesson>(
  lessons: readonly T[],
  sourceEndDate: string,
): T[] {
  return lessons.filter((lesson) => isLessonEffectiveOn(lesson, sourceEndDate));
}

/**
 * Calcule les lignes de la nouvelle saison. Les cours et inscriptions dont
 * une référence n'appartient pas à la saison d'origine sont ignorés.
 */
export function planSeasonDuplication(
  source: SeasonSnapshot,
  sourceEndDate: string,
  target: DuplicationTarget,
  ctx: DuplicationContext = defaultDuplicationContext,
): DuplicationPlan {
  const now = ctx.now();
  const stamps = { createdAt: now, updatedAt: now };
  const remap = <T extends { id: string }>(rows: readonly T[]) => {
    const ids = new Map<string, string>();
    for (const row of rows) ids.set(row.id, ctx.newId());
    return ids;
  };
  const courtIds = remap(source.courts);
  const instructorIds = remap(source.instructors);
  const groupIds = remap(source.groups);
  const studentIds = remap(source.students);
  const newIdOf = (ids: Map<string, string>, id: string) => ids.get(id) as string;

  const courts = source.courts.map((c) => ({
    ...c,
    ...stamps,
    id: newIdOf(courtIds, c.id),
    seasonId: target.seasonId,
  }));
  const instructors = source.instructors.map((i) => ({
    ...i,
    ...stamps,
    id: newIdOf(instructorIds, i.id),
    seasonId: target.seasonId,
  }));
  const availabilities = source.availabilities.flatMap((a) => {
    const instructorId = instructorIds.get(a.instructorId);
    return instructorId ? [{ ...a, ...stamps, id: ctx.newId(), instructorId }] : [];
  });
  const groups = source.groups.map((g) => ({
    ...g,
    ...stamps,
    id: newIdOf(groupIds, g.id),
    seasonId: target.seasonId,
  }));
  const students = source.students.map((s) => ({
    ...s,
    ...stamps,
    id: newIdOf(studentIds, s.id),
    seasonId: target.seasonId,
  }));
  const memberships = source.memberships.flatMap((m) => {
    const groupId = groupIds.get(m.groupId);
    const studentId = studentIds.get(m.studentId);
    return groupId && studentId ? [{ ...stamps, id: ctx.newId(), groupId, studentId }] : [];
  });
  const lessons = lessonsToCarryOver(source.lessons, sourceEndDate).flatMap((l) => {
    const courtId = courtIds.get(l.courtId);
    const groupId = groupIds.get(l.groupId);
    const instructorId = instructorIds.get(l.instructorId);
    if (!courtId || !groupId || !instructorId) return [];
    return [
      {
        ...l,
        ...stamps,
        id: ctx.newId(),
        seasonId: target.seasonId,
        courtId,
        groupId,
        instructorId,
        effectiveFrom: target.startDate,
        effectiveTo: null,
        previousLessonId: null,
      },
    ];
  });
  return { courts, instructors, availabilities, groups, students, memberships, lessons };
}

export function summarizeDuplication(
  source: SeasonSnapshot,
  plan: DuplicationPlan,
): DuplicationSummary {
  return {
    courts: plan.courts.length,
    instructors: plan.instructors.length,
    groups: plan.groups.length,
    students: plan.students.length,
    lessons: plan.lessons.length,
    skippedLessons: source.lessons.length - plan.lessons.length,
  };
}

/** Même jour l'année suivante (le 29 février devient le 28). */
export function nextYearDate(date: string): string {
  const [year, month, day] = date.split("-");
  const monthDay = `${month}-${day}` === "02-29" ? "02-28" : `${month}-${day}`;
  return `${Number(year) + 1}-${monthDay}`;
}

/** Nom proposé pour la saison suivante : « 2026-2027 » → « 2027-2028 ». */
export function nextSeasonName(name: string): string {
  const match = /^(\d{4})([-/])(\d{4})$/.exec(name.trim());
  if (match) {
    const [, first, separator, second] = match;
    return `${Number(first) + 1}${separator}${Number(second) + 1}`;
  }
  return `${name.trim()} (suite)`;
}

/** Valeurs proposées pour la saison qui suit `source` : un an plus tard, mêmes réglages. */
export function nextSeasonValues(source: {
  name: string;
  startDate: string;
  endDate: string;
  displayStartTime: string;
  displayEndTime: string;
  displayedDays: number[];
}): SeasonFormValues {
  return {
    name: nextSeasonName(source.name),
    startDate: nextYearDate(source.startDate),
    endDate: nextYearDate(source.endDate),
    displayStartTime: source.displayStartTime,
    displayEndTime: source.displayEndTime,
    displayedDays: [...source.displayedDays],
  };
}
