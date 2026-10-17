/**
 * Écran « Récapitulatif des heures » (docs/SPECS.md §10) : heures par moniteur sur
 * une période choisie, avec le détail des séances. Le calcul lui-même est
 * celui du moteur (`hours.ts`) : séances suspendues par une fermeture et
 * séances annulées exclues, remplaçant crédité, cours ponctuels inclus.
 */
import { instructorHours } from "./hours";
import type { Occurrence, PlanningSource } from "./occurrences";
import { addDays, formatDuration, isValidDate } from "./time";

export interface Period {
  /** Bornes incluses, `AAAA-MM-JJ`. */
  from: string;
  to: string;
}

/** Mois civil contenant `date`. */
export function monthPeriod(date: string): Period {
  const [year, month] = date.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return { from: `${date.slice(0, 7)}-01`, to: last };
}

/** Mois civil précédant celui de `date`. */
export function previousMonthPeriod(date: string): Period {
  return monthPeriod(addDays(`${date.slice(0, 7)}-01`, -1));
}

export function seasonPeriod(season: { startDate: string; endDate: string }): Period {
  return { from: season.startDate, to: season.endDate };
}

/** Message d'erreur de la période saisie, ou `null` si elle est valide. */
export function periodProblem(period: Period): string | null {
  if (!isValidDate(period.from) || !isValidDate(period.to)) {
    return "Saisissez une date de début et une date de fin.";
  }
  if (period.to < period.from) return "La date de fin précède la date de début.";
  return null;
}

export interface HoursInstructor {
  id: string;
  firstName: string;
  lastName: string;
  initials: string;
  color: string;
  active: boolean;
}

export interface HoursReferences {
  instructors: readonly HoursInstructor[];
  groups: readonly { id: string; name: string }[];
  courts: readonly { id: string; name: string }[];
}

export interface HoursSession {
  key: string;
  date: string;
  weekday: number;
  startTime: string;
  endTime: string;
  minutes: number;
  groupName: string;
  courtName: string;
  /** Remplacement, cours ponctuel, séance modifiée. */
  remark: string;
}

export interface HoursLine {
  instructorId: string;
  name: string;
  initials: string;
  color: string;
  sessions: number;
  minutes: number;
  details: HoursSession[];
}

export interface HoursReport {
  period: Period;
  lines: HoursLine[];
  totalMinutes: number;
  totalSessions: number;
}

function remarkOf(occurrence: Occurrence, initialsOf: (id: string | null) => string): string {
  const remarks: string[] = [];
  if (occurrence.replaced) remarks.push(`Remplace ${initialsOf(occurrence.originalInstructorId)}`);
  if (occurrence.kind === "one_off") remarks.push("Cours ponctuel");
  if (occurrence.modified) remarks.push("Séance modifiée");
  return remarks.join(" · ");
}

/**
 * Récapitulatif de la période : une ligne par moniteur ayant assuré des
 * séances, plus les moniteurs actifs sans séance (à 0 h), dans l'ordre des
 * référentiels.
 */
export function buildHoursReport(
  source: PlanningSource,
  refs: HoursReferences,
  period: Period,
): HoursReport {
  const hours = instructorHours(source, period.from, period.to);
  const byInstructor = new Map(hours.map((h) => [h.instructorId, h]));
  const groups = new Map(refs.groups.map((g) => [g.id, g.name]));
  const courts = new Map(refs.courts.map((c) => [c.id, c.name]));
  const instructors = new Map(refs.instructors.map((i) => [i.id, i]));
  const initialsOf = (id: string | null) => (id && instructors.get(id)?.initials) || "?";

  const lines: HoursLine[] = refs.instructors
    .filter((i) => i.active || byInstructor.has(i.id))
    .map((instructor) => {
      const entry = byInstructor.get(instructor.id);
      return {
        instructorId: instructor.id,
        name: `${instructor.firstName} ${instructor.lastName}`,
        initials: instructor.initials,
        color: instructor.color,
        sessions: entry?.sessions ?? 0,
        minutes: entry?.minutes ?? 0,
        details: (entry?.occurrences ?? []).map((o) => ({
          key: o.key,
          date: o.date,
          weekday: o.weekday,
          startTime: o.startTime,
          endTime: o.endTime,
          minutes: o.durationMinutes,
          groupName:
            (o.groupId && groups.get(o.groupId)) || (o.kind === "one_off" ? "Cours ponctuel" : "—"),
          courtName: (o.courtId && courts.get(o.courtId)) || "—",
          remark: remarkOf(o, initialsOf),
        })),
      };
    });
  return {
    period,
    lines,
    totalMinutes: lines.reduce((sum, l) => sum + l.minutes, 0),
    totalSessions: lines.reduce((sum, l) => sum + l.sessions, 0),
  };
}

/** Durée affichée : « 12 h 30 » (« 0 h » si aucune séance). */
export function hoursLabel(minutes: number): string {
  return minutes === 0 ? "0 h" : formatDuration(minutes);
}
