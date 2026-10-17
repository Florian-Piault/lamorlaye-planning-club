/**
 * Calendrier du club : semaines ISO, fuseau Europe/Paris et changements d'heure
 * (docs/SPECS.md §3.6–3.8, §10).
 *
 * Les dates du planning sont des dates civiles `AAAA-MM-JJ` et les heures des
 * heures locales du club `HH:MM` (heure murale de Paris, sans fuseau). Les
 * calculs de dates se font donc en UTC « neutre », sans dépendre du fuseau du
 * poste. Les conversions vers un instant réel (export, « aujourd'hui »)
 * appliquent la règle européenne de l'heure d'été, en vigueur depuis 1996 :
 * passage à l'heure d'été le dernier dimanche de mars à 01:00 UTC, retour à
 * l'heure d'hiver le dernier dimanche d'octobre à 01:00 UTC.
 *
 * Aucune bibliothèque de dates n'est nécessaire : la règle est fixe, ce qui
 * évite toute dépendance aux données de fuseaux du moteur web (WebKitGTK,
 * WebView2, WebKit) et garde le calcul identique sur les trois OS.
 */
import { addDays, formatDate } from "./time";

export const CLUB_TIME_ZONE = "Europe/Paris";

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/** Décalage de l'heure d'hiver (CET) et de l'heure d'été (CEST), en minutes. */
export const WINTER_OFFSET = 60;
export const SUMMER_OFFSET = 120;

// ---------------------------------------------------------------------------
// Dates civiles
// ---------------------------------------------------------------------------

function toUtcDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function fromUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Jour ISO de la semaine : 1 = lundi … 7 = dimanche. */
export function isoWeekday(date: string): number {
  const day = toUtcDate(date).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Nombre de jours de `from` à `to` (négatif si `to` précède `from`). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / DAY_MS);
}

/** Jours de `from` à `to` inclus (vide si `to` précède `from`). */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

/** `date` est-elle comprise entre `from` et `to` (bornes incluses, `to` nul = sans fin) ? */
export function isDateInRange(date: string, from: string, to: string | null): boolean {
  return date >= from && (to === null || date <= to);
}

export function maxDate(a: string, b: string): string {
  return a > b ? a : b;
}

export function minDate(a: string, b: string): string {
  return a < b ? a : b;
}

// ---------------------------------------------------------------------------
// Semaines ISO 8601 (lundi → dimanche, semaine 1 = celle du premier jeudi)
// ---------------------------------------------------------------------------

export interface IsoWeek {
  year: number;
  week: number;
}

/** Lundi de la semaine contenant `date`. */
export function startOfIsoWeek(date: string): string {
  return addDays(date, 1 - isoWeekday(date));
}

/** Dimanche de la semaine contenant `date`. */
export function endOfIsoWeek(date: string): string {
  return addDays(date, 7 - isoWeekday(date));
}

/** Les 7 dates (lundi → dimanche) de la semaine contenant `date`. */
export function weekDates(date: string): string[] {
  const monday = startOfIsoWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Date du jour `weekday` (1–7) dans la semaine contenant `date`. */
export function dateOfWeekday(date: string, weekday: number): string {
  return addDays(startOfIsoWeek(date), weekday - 1);
}

export function isSameIsoWeek(a: string, b: string): boolean {
  return startOfIsoWeek(a) === startOfIsoWeek(b);
}

/** Numéro de semaine ISO et année ISO (qui peut différer de l'année civile). */
export function isoWeek(date: string): IsoWeek {
  const thursday = addDays(date, 4 - isoWeekday(date));
  const year = Number(thursday.slice(0, 4));
  const week = Math.floor(daysBetween(`${year}-01-01`, thursday) / 7) + 1;
  return { year, week };
}

/** `"2026-W44"`. */
export function isoWeekKey(date: string): string {
  const { year, week } = isoWeek(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Lundi de la semaine ISO `week` de l'année ISO `year`. */
export function mondayOfIsoWeek(year: number, week: number): string {
  // Le 4 janvier est toujours en semaine 1.
  return addDays(startOfIsoWeek(`${year}-01-04`), (week - 1) * 7);
}

/** Nombre de semaines ISO de l'année (52 ou 53). */
export function isoWeeksInYear(year: number): number {
  return isoWeek(`${year}-12-28`).week;
}

/** Semaine précédente (`delta = -1`) ou suivante (`delta = 1`) : lundi correspondant. */
export function shiftWeek(date: string, delta: number): string {
  return addDays(startOfIsoWeek(date), delta * 7);
}

/** « Semaine du 02/11/2026 ». */
export function weekLabel(date: string): string {
  return `Semaine du ${formatDate(startOfIsoWeek(date))}`;
}

// ---------------------------------------------------------------------------
// Fuseau Europe/Paris
// ---------------------------------------------------------------------------

/** Dernier dimanche du mois (`month` de 1 à 12). */
function lastSunday(year: number, month: number): string {
  const lastDay = fromUtcDate(new Date(Date.UTC(year, month, 0)));
  return addDays(lastDay, -(isoWeekday(lastDay) % 7));
}

export interface DstPeriod {
  /** Passage à l'heure d'été (instant UTC). */
  start: Date;
  /** Retour à l'heure d'hiver (instant UTC). */
  end: Date;
  /** Dates civiles des deux changements d'heure. */
  startDate: string;
  endDate: string;
}

/** Période d'heure d'été de l'année à Paris. */
export function dstPeriod(year: number): DstPeriod {
  const startDate = lastSunday(year, 3);
  const endDate = lastSunday(year, 10);
  return {
    start: new Date(`${startDate}T01:00:00Z`),
    end: new Date(`${endDate}T01:00:00Z`),
    startDate,
    endDate,
  };
}

/** Décalage de Paris par rapport à UTC à un instant donné, en minutes (60 ou 120). */
export function parisOffset(instant: Date): number {
  const { start, end } = dstPeriod(instant.getUTCFullYear());
  const t = instant.getTime();
  return t >= start.getTime() && t < end.getTime() ? SUMMER_OFFSET : WINTER_OFFSET;
}

export interface LocalDateTime {
  date: string;
  time: string;
}

/** Date et heure murale de Paris pour un instant donné. */
export function toParisTime(instant: Date): LocalDateTime {
  const local = new Date(instant.getTime() + parisOffset(instant) * MINUTE_MS);
  const iso = local.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/**
 * Instant correspondant à une heure murale de Paris.
 *
 * - Heure inexistante (passage à l'heure d'été, 02:00–02:59) : décalée d'une
 *   heure vers l'avant (02:30 → 03:30 CEST).
 * - Heure ambiguë (retour à l'heure d'hiver, 02:00–02:59) : première
 *   occurrence, encore en heure d'été.
 */
export function fromParisTime(date: string, time: string): Date {
  const wall = new Date(`${date}T${time}:00Z`).getTime();
  const summer = new Date(wall - SUMMER_OFFSET * MINUTE_MS);
  if (parisOffset(summer) === SUMMER_OFFSET) return summer;
  return new Date(wall - WINTER_OFFSET * MINUTE_MS);
}

/** Date du jour à Paris, quel que soit le fuseau du poste. */
export function todayInParis(now: Date = new Date()): string {
  return toParisTime(now).date;
}

/**
 * Durée réellement écoulée entre deux heures murales de Paris, en minutes :
 * tient compte du changement d'heure s'il a lieu entre les deux.
 */
export function elapsedMinutes(start: LocalDateTime, end: LocalDateTime): number {
  return (
    (fromParisTime(end.date, end.time).getTime() -
      fromParisTime(start.date, start.time).getTime()) /
    MINUTE_MS
  );
}

/** Durée réelle d'une journée à Paris : 1380 (passage à l'été), 1500 (retour à l'hiver) ou 1440. */
export function dayLengthMinutes(date: string): number {
  return elapsedMinutes({ date, time: "00:00" }, { date: addDays(date, 1), time: "00:00" });
}

export type DstChange = "summer" | "winter";

/** Changement d'heure ayant lieu ce jour-là, le cas échéant. */
export function dstChangeOn(date: string): DstChange | null {
  const { startDate, endDate } = dstPeriod(Number(date.slice(0, 4)));
  if (date === startDate) return "summer";
  if (date === endDate) return "winter";
  return null;
}

/** Changement d'heure dans la semaine contenant `date` (toujours le dimanche). */
export function dstChangeInWeek(date: string): DstChange | null {
  return dstChangeOn(endOfIsoWeek(date));
}
