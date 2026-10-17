/**
 * Indisponibilités datées des moniteurs (docs/SPECS.md §3.3) : congé, maladie, tournoi…
 *
 * Stockage : date-heures locales du club (`AAAA-MM-JJTHH:MM`, sans fuseau),
 * fin exclue. Une indisponibilité « journées entières » va de `J1T00:00` au
 * lendemain du dernier jour à `00:00`.
 */
import { addDays, formatDate, isValidDate, isValidTime } from "./time";

export interface UnavailabilityRange {
  startsAt: string;
  endsAt: string;
}

export interface UnavailabilityForm {
  allDay: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  reason: string;
}

export type UnavailabilityErrors = Partial<Record<keyof UnavailabilityForm, string>>;

export type UnavailabilityResult =
  | { ok: true; value: UnavailabilityRange & { reason: string | null } }
  | { ok: false; errors: UnavailabilityErrors };

const MIDNIGHT = "00:00";

/** Valide un formulaire d'indisponibilité et le convertit en plage à enregistrer. */
export function parseUnavailabilityForm(form: UnavailabilityForm): UnavailabilityResult {
  const errors: UnavailabilityErrors = {};
  if (!isValidDate(form.startDate)) errors.startDate = "Date de début invalide.";
  const endDate = form.endDate || form.startDate;
  if (!isValidDate(endDate)) errors.endDate = "Date de fin invalide.";
  if (!form.allDay) {
    if (!isValidTime(form.startTime)) errors.startTime = "Heure de début invalide.";
    if (!isValidTime(form.endTime)) errors.endTime = "Heure de fin invalide.";
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const range: UnavailabilityRange = form.allDay
    ? { startsAt: `${form.startDate}T${MIDNIGHT}`, endsAt: `${addDays(endDate, 1)}T${MIDNIGHT}` }
    : { startsAt: `${form.startDate}T${form.startTime}`, endsAt: `${endDate}T${form.endTime}` };

  if (range.startsAt >= range.endsAt) {
    return { ok: false, errors: { endDate: "La fin doit être postérieure au début." } };
  }
  const reason = form.reason.trim();
  return { ok: true, value: { ...range, reason: reason === "" ? null : reason } };
}

function split(value: string): [string, string] {
  const [date = "", time = MIDNIGHT] = value.split("T");
  return [date, time.slice(0, 5)];
}

export function isAllDay(range: UnavailabilityRange): boolean {
  return split(range.startsAt)[1] === MIDNIGHT && split(range.endsAt)[1] === MIDNIGHT;
}

/** Valeurs du formulaire correspondant à une plage enregistrée. */
export function toUnavailabilityForm(
  range: UnavailabilityRange & { reason?: string | null },
): UnavailabilityForm {
  const [startDate, startTime] = split(range.startsAt);
  const [endDate, endTime] = split(range.endsAt);
  const allDay = isAllDay(range);
  return {
    allDay,
    startDate,
    startTime: allDay ? "" : startTime,
    endDate: allDay ? addDays(endDate, -1) : endDate,
    endTime: allDay ? "" : endTime,
    reason: range.reason ?? "",
  };
}

/**
 * Description lisible :
 * « le 02/11/2026 », « du 02/11/2026 au 05/11/2026 »,
 * « le 02/11/2026 de 08:00 à 12:00 », « du 02/11/2026 à 18:00 au 03/11/2026 à 12:00 ».
 */
export function describeUnavailability(range: UnavailabilityRange): string {
  const [startDate, startTime] = split(range.startsAt);
  const [endDate, endTime] = split(range.endsAt);
  if (isAllDay(range)) {
    const lastDay = addDays(endDate, -1);
    return lastDay === startDate
      ? `le ${formatDate(startDate)}`
      : `du ${formatDate(startDate)} au ${formatDate(lastDay)}`;
  }
  if (startDate === endDate) {
    return `le ${formatDate(startDate)} de ${startTime} à ${endTime}`;
  }
  return `du ${formatDate(startDate)} à ${startTime} au ${formatDate(endDate)} à ${endTime}`;
}

const MINUTES_PER_DAY = 24 * 60;

/**
 * Date-heure locale `AAAA-MM-JJTHH:MM` à `minutes` après minuit du jour
 * `date` (au-delà de 24 h, on passe aux jours suivants).
 */
export function localDateTime(date: string, minutes: number): string {
  const days = Math.floor(minutes / MINUTES_PER_DAY);
  const rest = minutes - days * MINUTES_PER_DAY;
  const h = String(Math.floor(rest / 60)).padStart(2, "0");
  const m = String(rest % 60).padStart(2, "0");
  return `${addDays(date, days)}T${h}:${m}`;
}

/** Plages qui chevauchent `[startsAt, endsAt[` (date-heures locales, fin exclue). */
export function overlappingUnavailabilities<T extends UnavailabilityRange>(
  ranges: readonly T[],
  startsAt: string,
  endsAt: string,
): T[] {
  return ranges.filter((r) => r.startsAt < endsAt && startsAt < r.endsAt);
}

/** Partie de chaque plage qui tombe le jour `date`, en minutes depuis minuit (`[0, 1440]`). */
export function unavailableMinutesOn(
  ranges: readonly UnavailabilityRange[],
  date: string,
): { start: number; end: number }[] {
  const dayStart = localDateTime(date, 0);
  const dayEnd = localDateTime(date, MINUTES_PER_DAY);
  const toMinutes = (value: string) => {
    if (value <= dayStart) return 0;
    if (value >= dayEnd) return MINUTES_PER_DAY;
    const [h = 0, m = 0] = split(value)[1].split(":").map(Number);
    return h * 60 + m;
  };
  return overlappingUnavailabilities(ranges, dayStart, dayEnd).map((r) => ({
    start: toMinutes(r.startsAt),
    end: toMinutes(r.endsAt),
  }));
}
