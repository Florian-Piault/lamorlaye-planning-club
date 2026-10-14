/**
 * Indisponibilités datées des moniteurs (SPECS.md §3.3) : congé, maladie, tournoi…
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
