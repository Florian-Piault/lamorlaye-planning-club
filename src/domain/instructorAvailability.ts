/**
 * Disponibilité d'un moniteur sur un créneau (docs/SPECS.md §3.3, §4.4, §5.1, §7) :
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

// ---------------------------------------------------------------------------
// Choix du moniteur d'un cours (§5.1)
// ---------------------------------------------------------------------------

/** Cours déjà placé, pour savoir si un moniteur est occupé sur un créneau. */
export interface BusySlot extends TimeSlot {
  id: string;
  instructorId: string | null;
  /** Désignation affichée sur la ligne du moniteur : « Galaxie vert 17:00–18:00 ». */
  label: string;
}

/** Disponible ; occupé par un autre cours ; hors de ses disponibilités. */
export type InstructorStatus = "available" | "busy" | "unavailable";

/**
 * Cours du moniteur qui chevauchent le créneau, même partiellement, en
 * excluant le cours en cours d'édition (`excludedId`).
 */
export function busySlotsOf(
  instructorId: string,
  slot: TimeSlot,
  lessons: readonly BusySlot[],
  excludedId: string | null = null,
): BusySlot[] {
  return lessons.filter(
    (lesson) =>
      lesson.id !== excludedId &&
      lesson.instructorId === instructorId &&
      lesson.weekday === slot.weekday &&
      (lesson.date === null || slot.date === null || lesson.date === slot.date) &&
      lesson.start < slot.end &&
      slot.start < lesson.end,
  );
}

/**
 * Range les moniteurs en trois groupes, dans cet ordre : disponibles, occupés
 * sur ce créneau (un autre cours leur est affecté), indisponibles (hors de
 * leurs disponibilités, qu'ils aient ou non un cours : ce groupe l'emporte).
 * Chaque moniteur n'apparaît qu'une fois ; l'ordre d'origine est gardé dans
 * chaque groupe.
 */
export function groupByAvailability<T extends InstructorAvailabilityData & { id: string }>(
  instructors: readonly T[],
  slot: TimeSlot,
  lessons: readonly BusySlot[] = [],
  excludedId: string | null = null,
): { instructor: T; status: InstructorStatus; busyWith: BusySlot[] }[] {
  const entries = instructors.map((instructor) => {
    const busyWith = busySlotsOf(instructor.id, slot, lessons, excludedId);
    const status: InstructorStatus = !isInstructorAvailable(instructor, slot)
      ? "unavailable"
      : busyWith.length > 0
        ? "busy"
        : "available";
    return { instructor, status, busyWith };
  });
  const order: InstructorStatus[] = ["available", "busy", "unavailable"];
  return order.flatMap((status) => entries.filter((e) => e.status === status));
}
