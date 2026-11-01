/**
 * Données affichées par l'écran Planning en mode « Semaine type » (docs/SPECS.md
 * §4.1, §4.3, §5.1, §7) : cours en vigueur, colonnes, totaux d'heures,
 * filtres et avertissements. Fonctions pures.
 */
import type { Lesson } from "@/db/schema";
import { intervalsOfDay, unavailableStudents, type WeeklySlot } from "@/domain/availability";
import {
  type Conflict,
  type ConflictIndex,
  detectConflicts,
  detectSlotConflicts,
  type PlanningSlot,
  slotFromLesson,
} from "@/domain/conflicts";
import {
  type BusySlot,
  groupByAvailability,
  type InstructorAvailabilityData,
  type InstructorStatus,
  type TimeSlot,
} from "@/domain/instructorAvailability";
import { lessonsInEffect } from "@/domain/occurrences";
import { formatDate, minutesToTime, timeToMinutes } from "@/domain/time";

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

type ChainLesson = Pick<Lesson, "id" | "previousLessonId" | "effectiveFrom" | "effectiveTo">;

const count = (n: number, singular: string, plural: string) =>
  `${n} cours ${n > 1 ? plural : singular}`;

/**
 * Cours du planning habituel dont l'horaire évolue dans la saison, en mots
 * simples (pastille de la barre de mode). Un cours est une chaîne de versions
 * reliées par `previousLessonId` (« Appliquer à partir de cette semaine ») ;
 * on compte des cours, pas des versions. Par rapport à la date de référence :
 * - « change plus tard » : une version suivante commence après cette date ;
 * - « commence plus tard » : cours nouveau (sans prédécesseur) pas encore commencé ;
 * - « s'arrête plus tard » : fin saisie, sans version suivante ;
 * - « a changé » : la version affichée a remplacé une version terminée ;
 * - « s'est arrêté » : dernière version terminée avant cette date.
 * La pastille garde un libellé court ; le détail va dans la bulle. `null` si
 * rien n'évolue.
 */
export function laterChangesSummary(
  lessons: readonly ChainLesson[],
  referenceDate: string,
): { label: string; detail: string } | null {
  const ids = new Set(lessons.map((l) => l.id));
  const next = new Map<string, ChainLesson>();
  for (const l of lessons) if (l.previousLessonId) next.set(l.previousLessonId, l);
  const roots = lessons.filter((l) => !l.previousLessonId || !ids.has(l.previousLessonId));
  const tally = { changesLater: 0, startsLater: 0, stopsLater: 0, changed: 0, stopped: 0 };
  for (const root of roots) {
    const chain: ChainLesson[] = [];
    const seen = new Set<string>();
    for (let v: ChainLesson | undefined = root; v && !seen.has(v.id); v = next.get(v.id)) {
      seen.add(v.id);
      chain.push(v);
    }
    const last = chain[chain.length - 1] as ChainLesson;
    const currentIndex = chain.findIndex(
      (v) => v.effectiveFrom <= referenceDate && (v.effectiveTo ?? "9999") >= referenceDate,
    );
    if (currentIndex === -1) {
      if (root.effectiveFrom > referenceDate) tally.startsLater++;
      else if (chain.some((v) => v.effectiveFrom > referenceDate)) tally.changesLater++;
      else tally.stopped++;
      continue;
    }
    if (currentIndex > 0) tally.changed++;
    if (currentIndex < chain.length - 1) tally.changesLater++;
    else if (last.effectiveTo !== null) tally.stopsLater++;
  }
  const future = tally.changesLater + tally.startsLater + tally.stopsLater;
  const past = tally.changed + tally.stopped;
  if (future === 0 && past === 0) return null;
  const label =
    future > 0
      ? `${count(future, "change", "changent")} plus tard`
      : count(past, "a changé", "ont changé");
  const details = [
    `Le planning habituel montre les cours tels qu'ils sont le ${formatDate(referenceDate)}.`,
  ];
  if (tally.changesLater > 0)
    details.push(`${count(tally.changesLater, "change", "changent")} d'horaire plus tard.`);
  if (tally.startsLater > 0)
    details.push(`${count(tally.startsLater, "commence", "commencent")} plus tard.`);
  if (tally.stopsLater > 0)
    details.push(`${count(tally.stopsLater, "s'arrête", "s'arrêtent")} avant la fin de la saison.`);
  if (future > 0) details.push("Choisissez une semaine précise pour voir ces semaines-là.");
  if (tally.changed > 0)
    details.push(`${count(tally.changed, "a changé", "ont changé")} plus tôt.`);
  if (tally.stopped > 0)
    details.push(`${count(tally.stopped, "s'est arrêté", "se sont arrêtés")} plus tôt.`);
  return { label, detail: details.join(" ") };
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

/**
 * Texte affiché d'un avertissement : le message, suivi des élèves en cause
 * s'il y en a (« 2 élèves hors disponibilités : Léa Martin, Tom Petit »).
 */
function warningText(conflict: Conflict): string {
  return conflict.students?.length
    ? `${conflict.message} : ${conflict.students.join(", ")}`
    : conflict.message;
}

/** Messages distincts (deux cours du même moniteur à la même heure donnent le même message). */
export function warningMessages(conflicts: readonly Conflict[]): string[] {
  return [...new Set(conflicts.map(warningText))];
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
// Ombrage des élèves pendant le glisser (§4.4)
// ---------------------------------------------------------------------------

/** Bande d'un jour où `count` élèves du groupe sont indisponibles. */
export interface StudentShadeBand {
  weekday: number;
  start: number;
  end: number;
  count: number;
}

/**
 * Bandes d'ombrage des élèves d'un groupe sur les jours `weekdays`, entre
 * `dayStart` et `dayEnd` (minutes), avec la même règle que le contrôle 7 : un
 * élève sans plage est disponible partout. Les bandes voisines de même nombre
 * sont fusionnées ; celles où tout le monde est disponible sont omises.
 *
 * - Durée connue (`durationMinutes`, déplacement d'un cours) : pour chaque
 *   heure de début possible, au pas `step` et dans les bornes du déplacement
 *   (`moveTarget`), le nombre d'élèves indisponibles pour un cours de cette
 *   durée commençant là. La bande d'une heure de début va jusqu'à la suivante,
 *   la dernière jusqu'à la fin de l'amplitude (le fantôme ne descend pas plus
 *   bas) : l'ombrage se lit au haut du fantôme.
 * - Durée inconnue (création, `null`) : par morceau de journée, découpé aux
 *   bornes des plages des élèves ; un morceau indique combien d'élèves sont
 *   indisponibles à ce moment, pas pour un cours entier qui le déborde.
 *
 * Ne dépend pas du pointeur : calculé une fois par geste.
 */
export function studentShadeBands(
  students: readonly { availabilities: readonly WeeklySlot[] }[],
  weekdays: readonly number[],
  dayStart: number,
  dayEnd: number,
  durationMinutes: number | null = null,
  step = 15,
): StudentShadeBand[] {
  const constrained = students.filter((s) => s.availabilities.length > 0);
  if (constrained.length === 0 || dayEnd <= dayStart) return [];
  if (durationMinutes !== null) {
    return lessonStartBands(constrained, weekdays, dayStart, dayEnd, durationMinutes, step);
  }
  return weekdays.flatMap((weekday) => {
    const cuts = new Set([dayStart, dayEnd]);
    for (const student of constrained) {
      for (const interval of intervalsOfDay(student.availabilities, weekday)) {
        for (const minute of [interval.start, interval.end]) {
          if (minute > dayStart && minute < dayEnd) cuts.add(minute);
        }
      }
    }
    const points = [...cuts].sort((a, b) => a - b);
    const bands: StudentShadeBand[] = [];
    for (let i = 0; i + 1 < points.length; i++) {
      const start = points[i] as number;
      const end = points[i + 1] as number;
      const count = unavailableStudents(constrained, { weekday, start, end }).length;
      if (count === 0) continue;
      const last = bands.at(-1);
      if (last && last.end === start && last.count === count) last.end = end;
      else bands.push({ weekday, start, end, count });
    }
    return bands;
  });
}

/** Ombrage d'un déplacement : une bande par heure de début possible du cours. */
function lessonStartBands(
  students: readonly { availabilities: readonly WeeklySlot[] }[],
  weekdays: readonly number[],
  dayStart: number,
  dayEnd: number,
  durationMinutes: number,
  step: number,
): StudentShadeBand[] {
  // Mêmes heures de début que `moveTarget` : au pas, bornées à l'amplitude.
  const latest = Math.max(dayStart, dayEnd - durationMinutes);
  const starts = new Set([dayStart, latest]);
  for (let minute = Math.ceil(dayStart / step) * step; minute < latest; minute += step) {
    starts.add(minute);
  }
  const points = [...starts].sort((a, b) => a - b);
  return weekdays.flatMap((weekday) => {
    const bands: StudentShadeBand[] = [];
    points.forEach((start, i) => {
      const end = points[i + 1] ?? dayEnd;
      const slot = { weekday, start, end: start + durationMinutes };
      const count = unavailableStudents(students, slot).length;
      if (count === 0 || end <= start) return;
      const last = bands.at(-1);
      if (last && last.end === start && last.count === count) last.end = end;
      else bands.push({ weekday, start, end, count });
    });
    return bands;
  });
}

/**
 * Palier d'intensité de l'ombrage, de 1 à 4 : 1 élève, 2 élèves, 3 ou 4
 * élèves, 5 élèves et plus.
 */
export function shadeTier(count: number): 1 | 2 | 3 | 4 {
  if (count >= 5) return 4;
  if (count >= 3) return 3;
  return count >= 2 ? 2 : 1;
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

/** Nombre de filtres actifs, affiché sur le bouton « Filtres » : moniteurs, courts, groupe. */
export function activeFilterCount(filters: PlanningFilters): number {
  return filters.instructorIds.length + filters.courtIds.length + (filters.groupId ? 1 : 0);
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
  /** Disponible, occupé par un autre cours sur le créneau, ou hors de ses disponibilités. */
  status: InstructorStatus;
  available: boolean;
  /** Mention affichée après le nom des moniteurs occupés ou indisponibles. */
  note: string | null;
}

/** Désignation d'un cours sur la ligne d'un moniteur occupé : « Galaxie vert 17:00–18:00 ». */
export function busyLabel(groupName: string | null, start: number, end: number): string {
  return `${groupName ?? "Cours sans groupe"} ${minutesToTime(start)}–${minutesToTime(end)}`;
}

/**
 * Choix du moniteur d'un cours (§5.1), en trois groupes : disponibles,
 * occupés sur ce créneau (avec le cours), indisponibles (avec la raison, et le
 * cours s'ils en ont aussi un). Les cours du créneau (`lessons`) sont comptés
 * sauf le cours en cours d'édition (`excludedId`).
 */
export function instructorChoices<T extends InstructorAvailabilityData & { id: string }>(
  instructors: readonly T[],
  slot: TimeSlot,
  lessons: readonly BusySlot[] = [],
  excludedId: string | null = null,
): InstructorChoice<T>[] {
  return groupByAvailability(instructors, slot, lessons, excludedId).map(
    ({ instructor, status, busyWith }) => {
      const busy = busyWith.map((lesson) => lesson.label);
      const reason =
        status !== "unavailable"
          ? null
          : instructor.availabilities.length === 0
            ? "aucune disponibilité saisie"
            : "indisponible";
      const note = [reason, ...busy].filter((part) => part !== null).join(", ");
      return { instructor, status, available: status === "available", note: note || null };
    },
  );
}
