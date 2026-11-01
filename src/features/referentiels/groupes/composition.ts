/**
 * Aide à la composition d'un groupe (docs/SPECS.md §8) : compatibilité des
 * élèves avec les cours du groupe dans le planning habituel, à sa date de
 * référence. La règle (`incompatibleLessons`) est celle du domaine ; ce module
 * n'en fait que la présentation (ordre des candidats, bulle, alerte).
 */
import { incompatibleLessons, type WeeklyRange, type WeeklySlot } from "@/domain/availability";
import { type LessonRecord, lessonsInEffect } from "@/domain/occurrences";
import { minutesToTime, timeToMinutes, weekdayLabel } from "@/domain/time";
import { semaineTypeDate } from "@/features/planning/grid/view";

/** Créneau d'un cours du groupe, avec son libellé (« mercredi 14:00–15:00 »). */
export interface LessonRange extends WeeklyRange {
  label: string;
}

/**
 * Cours du groupe tels que les montre le planning habituel : versions en
 * vigueur aujourd'hui, date ramenée dans la saison (comme la grille). Après
 * « Appliquer à partir de cette semaine », seule la version en vigueur compte.
 */
export function groupLessonRanges(
  lessons: readonly LessonRecord[],
  season: { startDate: string; endDate: string },
  today: string,
): LessonRange[] {
  return lessonsInEffect(lessons, semaineTypeDate(season, today)).map((lesson) => {
    const start = timeToMinutes(lesson.startTime);
    const end = start + lesson.durationMinutes;
    return {
      weekday: lesson.weekday,
      start,
      end,
      label: `${weekdayLabel(lesson.weekday).toLowerCase()} ${minutesToTime(start)}–${minutesToTime(end)}`,
    };
  });
}

/**
 * Cours qui coincent pour l'élève, en mots (« mercredi 14:00–15:00 ») : vide
 * s'il est compatible (élève sans plage, groupe sans cours compris).
 */
export function blockingLessons(
  slots: readonly WeeklySlot[],
  lessons: readonly LessonRange[],
): string[] {
  return incompatibleLessons(slots, lessons).map((lesson) => lesson.label);
}

/** Cours qui coincent, joints : « mercredi 14:00–15:00, samedi 10:00–11:00 ». */
export function blockingSummary(blocking: readonly string[]): string {
  return blocking.join(", ");
}

/** Texte de la bulle du badge et du nom accessible de l'option. */
export function blockingText(blocking: readonly string[]): string {
  return `Hors disponibilités : ${blockingSummary(blocking)}`;
}

/**
 * Élèves proposés par la recherche : les compatibles en tête, l'ordre reçu
 * (alphabétique) gardé dans chaque catégorie, puis coupés à `max`. Le tri
 * précède la coupe : un compatible loin dans l'alphabet reste proposé.
 */
export function rankCandidates<T>(
  found: readonly T[],
  isCompatible: (item: T) => boolean,
  max: number,
): T[] {
  return [...found.filter(isCompatible), ...found.filter((item) => !isCompatible(item))].slice(
    0,
    max,
  );
}

interface MemberName {
  firstName: string;
  lastName: string;
}

/** Tri du planning (§7) : nom puis prénom, à la française (accents compris). */
const byName = (a: MemberName, b: MemberName) =>
  a.lastName.localeCompare(b.lastName, "fr") || a.firstName.localeCompare(b.firstName, "fr");

/**
 * Alerte de la composition : « 2 élèves hors disponibilités : Léa Martin,
 * Tom Petit », ou rien. Même texte que l'avertissement du planning (§7) :
 * `domain/conflicts.ts` n'en exporte ni le message ni le tri, d'où cette copie.
 */
export function unavailableMembersMessage(members: readonly MemberName[]): string | null {
  if (members.length === 0) return null;
  const names = [...members]
    .sort(byName)
    .map((m) => `${m.firstName} ${m.lastName}`)
    .join(", ");
  const count = members.length === 1 ? "1 élève" : `${members.length} élèves`;
  return `${count} hors disponibilités : ${names}`;
}
