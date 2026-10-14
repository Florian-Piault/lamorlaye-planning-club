/**
 * Disponibilité d'un moniteur sur un créneau (SPECS.md §3.3, §4.4, §5.1, §7) :
 * combinaison des plages hebdomadaires récurrentes (`availability.ts`) et des
 * indisponibilités datées (`unavailability.ts`).
 *
 * Les plages récurrentes sont « peintes » comme disponibles dans l'éditeur :
 * un moniteur sans aucune plage n'est donc disponible nulle part. Les
 * indisponibilités datées ne s'appliquent qu'à un créneau daté (semaine datée) ;
 * en semaine type (`date` nulle), seules les plages récurrentes comptent.
 */
import {
  type Interval,
  isAvailableDuring,
  mergeIntervals,
  uncoveredIntervals,
  type WeeklySlot,
} from "./availability";
import {
  localDateTime,
  overlappingUnavailabilities,
  type UnavailabilityRange,
  unavailableMinutesOn,
} from "./unavailability";

export interface InstructorAvailabilityData {
  availabilities: readonly WeeklySlot[];
  unavailabilities: readonly UnavailabilityRange[];
}

/** Créneau à vérifier : jour, minutes de début et de fin (`[start, end[`), date éventuelle. */
export interface TimeSlot {
  date: string | null;
  weekday: number;
  start: number;
  end: number;
}

export interface AvailabilityCheck {
  available: boolean;
  /** Le créneau dépasse des plages hebdomadaires. */
  outsideWeeklySlots: boolean;
  /** Indisponibilités datées chevauchant le créneau. */
  unavailabilities: UnavailabilityRange[];
}

export function checkInstructorAvailability(
  data: InstructorAvailabilityData,
  slot: TimeSlot,
): AvailabilityCheck {
  const outsideWeeklySlots = !isAvailableDuring(
    data.availabilities,
    slot.weekday,
    slot.start,
    slot.end,
  );
  const unavailabilities =
    slot.date === null
      ? []
      : overlappingUnavailabilities(
          data.unavailabilities,
          localDateTime(slot.date, slot.start),
          localDateTime(slot.date, slot.end),
        );
  return {
    available: !outsideWeeklySlots && unavailabilities.length === 0,
    outsideWeeklySlots,
    unavailabilities,
  };
}

export function isInstructorAvailable(data: InstructorAvailabilityData, slot: TimeSlot): boolean {
  return checkInstructorAvailability(data, slot).available;
}

/**
 * Créneaux d'indisponibilité d'un jour entre `dayStart` et `dayEnd` (minutes),
 * pour les hachures de la grille (§4.4) : hors plages récurrentes, plus les
 * indisponibilités datées si `date` est fournie.
 */
export function unavailableIntervals(
  data: InstructorAvailabilityData,
  day: { date: string | null; weekday: number },
  dayStart: number,
  dayEnd: number,
): Interval[] {
  const intervals = uncoveredIntervals(data.availabilities, day.weekday, dayStart, dayEnd);
  if (day.date !== null) {
    for (const range of unavailableMinutesOn(data.unavailabilities, day.date)) {
      intervals.push({ start: Math.max(range.start, dayStart), end: Math.min(range.end, dayEnd) });
    }
  }
  return mergeIntervals(intervals);
}

/**
 * Trie des moniteurs : disponibles sur le créneau d'abord (§5.1), en gardant
 * l'ordre d'origine dans chaque catégorie.
 */
export function sortByAvailability<T extends InstructorAvailabilityData>(
  instructors: readonly T[],
  slot: TimeSlot,
): { instructor: T; available: boolean }[] {
  const entries = instructors.map((instructor) => ({
    instructor,
    available: isInstructorAvailable(instructor, slot),
  }));
  return [...entries.filter((e) => e.available), ...entries.filter((e) => !e.available)];
}
