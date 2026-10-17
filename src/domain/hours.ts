/**
 * Récapitulatif des heures par moniteur (docs/SPECS.md §10).
 *
 * Le calcul repose sur les occurrences réelles : les séances suspendues par
 * une fermeture et les séances annulées sont exclues, une séance remplacée
 * est créditée au remplaçant, les cours ponctuels sont inclus. La durée
 * retenue est la durée prévue du cours (heure murale) : les cours n'ont pas
 * lieu pendant le changement d'heure (02:00–03:00), qui ne modifie donc pas
 * les totaux.
 */
import { weekDates } from "./dates";
import {
  activeOccurrences,
  type Occurrence,
  occurrencesBetween,
  type PlanningSource,
} from "./occurrences";

export interface InstructorHours {
  instructorId: string;
  /** Total en minutes. */
  minutes: number;
  /** Nombre de séances assurées. */
  sessions: number;
  /** Détail des séances, par date et heure. */
  occurrences: Occurrence[];
}

/** Heures par moniteur à partir d'une liste d'occurrences (seules les actives comptent). */
export function hoursByInstructor(occurrences: readonly Occurrence[]): InstructorHours[] {
  const byInstructor = new Map<string, InstructorHours>();
  for (const occurrence of activeOccurrences(occurrences)) {
    if (!occurrence.instructorId) continue;
    const entry = byInstructor.get(occurrence.instructorId) ?? {
      instructorId: occurrence.instructorId,
      minutes: 0,
      sessions: 0,
      occurrences: [],
    };
    entry.minutes += occurrence.durationMinutes;
    entry.sessions += 1;
    entry.occurrences.push(occurrence);
    byInstructor.set(occurrence.instructorId, entry);
  }
  return [...byInstructor.values()];
}

/** Heures par moniteur sur une période (bornes incluses). */
export function instructorHours(
  source: PlanningSource,
  from: string,
  to: string,
): InstructorHours[] {
  return hoursByInstructor(occurrencesBetween(source, from, to));
}

/** Heures par moniteur de la semaine ISO contenant `date` (légende, §4.3). */
export function weekInstructorHours(source: PlanningSource, date: string): InstructorHours[] {
  const days = weekDates(date);
  return instructorHours(source, days[0] as string, days[6] as string);
}

/** Minutes d'un moniteur dans un récapitulatif (0 s'il n'y figure pas). */
export function minutesOf(hours: readonly InstructorHours[], instructorId: string): number {
  return hours.find((h) => h.instructorId === instructorId)?.minutes ?? 0;
}

/** Heures décimales, pour les exports (90 → 1,5). */
export function toDecimalHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}
