/**
 * Plages hebdomadaires récurrentes de disponibilité des moniteurs et des
 * élèves (docs/SPECS.md §3.3, §3.5).
 *
 * Les plages sont manipulées comme des intervalles semi-ouverts
 * `[début, fin[` en minutes depuis minuit. Après chaque modification, les
 * plages d'un même jour sont fusionnées (chevauchantes ou contiguës).
 *
 * Une seule règle de couverture pour tous : un créneau est couvert s'il tient
 * entièrement dans une plage du même jour (`isAvailableDuring`). Seul le cas
 * « aucune plage » diffère : un moniteur est alors indisponible partout, un
 * élève disponible partout (`isStudentAvailableDuring`).
 */
import { minutesToTime, timeToMinutes, weekdayLabel } from "./time";

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

/** Le créneau `[start, end[` recoupe-t-il au moins une plage du jour ? */
export function overlapsAvailability(
  slots: readonly WeeklySlot[],
  weekday: number,
  start: number,
  end: number,
): boolean {
  return intervalsOfDay(slots, weekday).some((i) => i.start < end && start < i.end);
}

// ---------------------------------------------------------------------------
// Disponibilités des élèves (§3.5, §7)
// ---------------------------------------------------------------------------

/**
 * L'élève est-il disponible sur `[start, end[` ? Même règle que pour les
 * moniteurs, sauf qu'un élève sans aucune plage est disponible partout.
 */
export function isStudentAvailableDuring(
  slots: readonly WeeklySlot[],
  weekday: number,
  start: number,
  end: number,
): boolean {
  return slots.length === 0 || isAvailableDuring(slots, weekday, start, end);
}

/** Créneau hebdomadaire d'un cours : jour et minutes `[start, end[`. */
export interface WeeklyRange {
  weekday: number;
  start: number;
  end: number;
}

/**
 * Cours d'un groupe qui ne tiennent pas dans les plages de l'élève : vide si
 * l'élève est compatible avec le groupe. Un groupe sans cours, ou un élève
 * sans plage, ne donne jamais de cours fautif.
 */
export function incompatibleLessons<T extends WeeklyRange>(
  slots: readonly WeeklySlot[],
  lessons: readonly T[],
): T[] {
  return lessons.filter((l) => !isStudentAvailableDuring(slots, l.weekday, l.start, l.end));
}

/** Élèves indisponibles sur un créneau (leur nombre sert à l'avertissement et à l'ombrage). */
export function unavailableStudents<T extends { availabilities: readonly WeeklySlot[] }>(
  students: readonly T[],
  range: WeeklyRange,
): T[] {
  return students.filter(
    (s) => !isStudentAvailableDuring(s.availabilities, range.weekday, range.start, range.end),
  );
}

// ---------------------------------------------------------------------------
// Frise de saisie (§3.3)
// ---------------------------------------------------------------------------

/** Pas de la frise : celui des cours (§3.6). */
export const AVAILABILITY_STEP = 15;

/**
 * Seuil de glisser (pixels) : en deçà, l'appui-relâche est un clic simple, qui
 * bascule le seul quart d'heure cliqué.
 */
export const DRAG_THRESHOLD_PX = 4;

/** Le pointeur s'est-il assez déplacé depuis l'appui pour que le geste soit un glisser ? */
export function isDragGesture(dx: number, dy: number, threshold = DRAG_THRESHOLD_PX): boolean {
  return Math.hypot(dx, dy) >= threshold;
}

/**
 * Minute (non arrondie) sous le pointeur, dans une rangée de la frise de
 * largeur `width` qui couvre `[dayStart, dayEnd]` ; bornée à la rangée.
 */
export function minuteAtOffset(
  offset: number,
  width: number,
  dayStart: number,
  dayEnd: number,
): number {
  if (width <= 0) return dayStart;
  const ratio = Math.min(1, Math.max(0, offset / width));
  return dayStart + ratio * (dayEnd - dayStart);
}

/** Début de la case contenant la minute `minute`. */
export function cellStart(
  minute: number,
  dayStart: number,
  dayEnd: number,
  step = AVAILABILITY_STEP,
): number {
  const cell = dayStart + Math.floor((minute - dayStart) / step) * step;
  return Math.min(Math.max(cell, dayStart), Math.max(dayStart, dayEnd - step));
}

/** Limite de case la plus proche de la minute `minute`. */
export function nearestBoundary(
  minute: number,
  dayStart: number,
  dayEnd: number,
  step = AVAILABILITY_STEP,
): number {
  const boundary = dayStart + Math.round((minute - dayStart) / step) * step;
  return Math.min(Math.max(boundary, dayStart), dayEnd);
}

/**
 * Bornes d'une plage tracée au cliquer-glisser (B6), dans les deux sens :
 * chaque extrémité (appui et relâchement) est la limite de case la plus
 * proche du pointeur (du repère « 14h » au repère « 18h », ou l'inverse,
 * donne 14:00–18:00). La plage fait au moins une case, du côté du glisser.
 * La case entière n'est retenue que pour le clic simple.
 */
export function draggedRange(
  anchor: number,
  pointer: number,
  dayStart: number,
  dayEnd: number,
  step = AVAILABILITY_STEP,
): Interval {
  const from = nearestBoundary(anchor, dayStart, dayEnd, step);
  const to = nearestBoundary(pointer, dayStart, dayEnd, step);
  if (Math.abs(to - from) >= step) return { start: Math.min(from, to), end: Math.max(from, to) };
  // Moins d'une case : une case, du côté où va le pointeur, dans l'amplitude.
  const start =
    pointer >= anchor
      ? Math.min(from, Math.max(dayStart, dayEnd - step))
      : Math.max(dayStart, from - step);
  return { start, end: Math.min(dayEnd, start + step) };
}

export interface SlotDraft {
  weekday: number;
  start: number;
  end: number;
}

/** Le créneau `[start, end[` est-il déjà entièrement disponible (« Ajouter » sans effet) ? */
export function isFullyAvailable(
  slots: readonly WeeklySlot[],
  weekday: number,
  start: number,
  end: number,
): boolean {
  return end > start && isAvailableDuring(slots, weekday, start, end);
}

export interface AvailabilityChange {
  slots: WeeklySlot[];
  /** Annonce de ce qui a réellement changé : « Lundi 14:00–18:00 ajouté ». */
  message: string;
}

/**
 * Rend le moniteur disponible ou indisponible sur `[start, end[` le jour
 * donné, et décrit ce qui a réellement changé (plages avant / après), pas la
 * plage demandée : retirer 10:00–20:00 d'une plage 14:00–18:00 annonce
 * « 14:00–18:00 retiré ». Renvoie `null` si rien ne change.
 */
export function availabilityChange(
  slots: readonly WeeklySlot[],
  weekday: number,
  start: number,
  end: number,
  available: boolean,
): AvailabilityChange | null {
  const next = setAvailability(slots, weekday, start, end, available);
  const before = intervalsOfDay(slots, weekday);
  const after = intervalsOfDay(next, weekday);
  const [larger, smaller] = available ? [after, before] : [before, after];
  const changed = smaller.reduce((rest, interval) => subtractInterval(rest, interval), larger);
  if (changed.length === 0) return null;
  const ranges = changed.map((i) => `${minutesToTime(i.start)}–${minutesToTime(i.end)}`).join(", ");
  return {
    slots: next,
    message: `${weekdayLabel(weekday)} ${ranges} ${available ? "ajouté" : "retiré"}`,
  };
}
