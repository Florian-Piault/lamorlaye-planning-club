/**
 * Utilitaires simples sur les heures (`HH:MM`), les dates (`AAAA-MM-JJ`) et
 * les jours de la semaine (numérotation ISO : 1 = lundi … 7 = dimanche).
 */

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface Weekday {
  value: number;
  label: string;
  short: string;
}

export const WEEKDAYS: readonly Weekday[] = [
  { value: 1, label: "Lundi", short: "Lun" },
  { value: 2, label: "Mardi", short: "Mar" },
  { value: 3, label: "Mercredi", short: "Mer" },
  { value: 4, label: "Jeudi", short: "Jeu" },
  { value: 5, label: "Vendredi", short: "Ven" },
  { value: 6, label: "Samedi", short: "Sam" },
  { value: 7, label: "Dimanche", short: "Dim" },
];

export function weekdayLabel(weekday: number): string {
  return WEEKDAYS.find((d) => d.value === weekday)?.label ?? `Jour ${weekday}`;
}

/** Abréviation d'un jour : 1 → « Lun ». */
export function weekdayShort(weekday: number): string {
  return WEEKDAYS.find((d) => d.value === weekday)?.short ?? "";
}

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

/** `"09:30"` → 570. */
export function timeToMinutes(value: string): number {
  if (!isValidTime(value)) throw new Error(`Heure invalide : ${value}`);
  const [h, m] = value.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** 570 → `"09:30"`. */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Durée lisible : 90 → « 1 h 30 », 120 → « 2 h », 45 → « 45 min ». */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/** Vérifie qu'une chaîne `AAAA-MM-JJ` désigne une date réelle. */
export function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Ajoute (ou retire) des jours à une date `AAAA-MM-JJ`. */
export function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** `"2026-09-01"` → `"01/09/2026"`. */
export function formatDate(value: string | null | undefined): string {
  if (!value || !DATE_PATTERN.test(value)) return value ?? "";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

/** Date du jour `AAAA-MM-JJ` (heure locale). */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
