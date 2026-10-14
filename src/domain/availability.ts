/**
 * Plages hebdomadaires récurrentes de disponibilité des moniteurs (SPECS.md §3.3).
 *
 * Les plages sont manipulées comme des intervalles semi-ouverts
 * `[début, fin[` en minutes depuis minuit. Après chaque modification, les
 * plages d'un même jour sont fusionnées (chevauchantes ou contiguës).
 */
import { minutesToTime, timeToMinutes } from "./time";

export interface WeeklySlot {
  weekday: number;
  startTime: string;
  endTime: string;
}

export interface Interval {
  start: number;
  end: number;
}

/** Trie et fusionne des intervalles chevauchants ou contigus ; ignore les intervalles vides. */
export function mergeIntervals(intervals: readonly Interval[]): Interval[] {
  const sorted = intervals.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged.at(-1);
    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}

/** Retire `cut` d'une liste d'intervalles. */
export function subtractInterval(intervals: readonly Interval[], cut: Interval): Interval[] {
  const result: Interval[] = [];
  for (const interval of intervals) {
    if (cut.end <= interval.start || cut.start >= interval.end) {
      result.push({ ...interval });
      continue;
    }
    if (cut.start > interval.start) result.push({ start: interval.start, end: cut.start });
    if (cut.end < interval.end) result.push({ start: cut.end, end: interval.end });
  }
  return result;
}

function toInterval(slot: WeeklySlot): Interval {
  return { start: timeToMinutes(slot.startTime), end: timeToMinutes(slot.endTime) };
}

function toSlot(weekday: number, interval: Interval): WeeklySlot {
  return {
    weekday,
    startTime: minutesToTime(interval.start),
    endTime: minutesToTime(interval.end),
  };
}

function byDay(slots: readonly WeeklySlot[]): Map<number, Interval[]> {
  const days = new Map<number, Interval[]>();
  for (const slot of slots) {
    const list = days.get(slot.weekday) ?? [];
    list.push(toInterval(slot));
    days.set(slot.weekday, list);
  }
  return days;
}

function fromDays(days: Map<number, Interval[]>): WeeklySlot[] {
  return [...days.entries()]
    .sort(([a], [b]) => a - b)
    .flatMap(([weekday, intervals]) =>
      mergeIntervals(intervals).map((interval) => toSlot(weekday, interval)),
    );
}

/** Fusionne les plages de chaque jour et les trie (jour, puis heure de début). */
export function normalizeSlots(slots: readonly WeeklySlot[]): WeeklySlot[] {
  return fromDays(byDay(slots));
}

/**
 * Rend le moniteur disponible (`available = true`) ou indisponible sur
 * `[start, end[` (minutes) le jour donné, et renvoie les plages normalisées.
 */
export function setAvailability(
  slots: readonly WeeklySlot[],
  weekday: number,
  start: number,
  end: number,
  available: boolean,
): WeeklySlot[] {
  const days = byDay(slots);
  const current = days.get(weekday) ?? [];
  const range = { start: Math.min(start, end), end: Math.max(start, end) };
  days.set(
    weekday,
    available ? mergeIntervals([...current, range]) : subtractInterval(current, range),
  );
  return fromDays(days);
}

/** Plages d'un jour, triées. */
export function slotsOfDay(slots: readonly WeeklySlot[], weekday: number): WeeklySlot[] {
  return normalizeSlots(slots.filter((slot) => slot.weekday === weekday));
}

/** Le moniteur est-il disponible à la minute donnée (`[début, fin[`) ? */
export function isAvailableAt(
  slots: readonly WeeklySlot[],
  weekday: number,
  minute: number,
): boolean {
  return slots.some(
    (slot) =>
      slot.weekday === weekday &&
      timeToMinutes(slot.startTime) <= minute &&
      minute < timeToMinutes(slot.endTime),
  );
}

/** Total hebdomadaire des disponibilités, en minutes. */
export function totalWeeklyMinutes(slots: readonly WeeklySlot[]): number {
  return normalizeSlots(slots).reduce(
    (total, slot) => total + timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime),
    0,
  );
}

/** Intervalles fusionnés d'un jour, en minutes. */
export function intervalsOfDay(slots: readonly WeeklySlot[], weekday: number): Interval[] {
  return mergeIntervals(slots.filter((slot) => slot.weekday === weekday).map(toInterval));
}

/** Le créneau `[start, end[` (minutes) est-il entièrement couvert par les plages du jour ? */
export function isAvailableDuring(
  slots: readonly WeeklySlot[],
  weekday: number,
  start: number,
  end: number,
): boolean {
  return intervalsOfDay(slots, weekday).some((i) => i.start <= start && end <= i.end);
}

/**
 * Créneaux du jour où le moniteur n'a pas de plage de disponibilité, entre
 * `dayStart` et `dayEnd` (minutes) : complément des plages, pour les hachures (§4.4).
 */
export function uncoveredIntervals(
  slots: readonly WeeklySlot[],
  weekday: number,
  dayStart: number,
  dayEnd: number,
): Interval[] {
  return intervalsOfDay(slots, weekday).reduce(
    (rest, interval) => subtractInterval(rest, interval),
    dayEnd > dayStart ? [{ start: dayStart, end: dayEnd }] : [],
  );
}
