/**
 * Calendrier embarqué pour l'assistant des périodes de fermeture (docs/SPECS.md
 * §3.8) : vacances scolaires de la zone B (fichier de données versionné
 * `src/data/school-calendar.json`, mis à jour à chaque version) et jours
 * fériés français (calculés, y compris Pâques, l'Ascension et la Pentecôte).
 *
 * Aucun accès réseau : les propositions restent modifiables avant leur ajout.
 */
import data from "@/data/school-calendar.json";
import { isDateInRange, maxDate, minDate } from "./dates";
import { addDays, formatDate } from "./time";

// ---------------------------------------------------------------------------
// Vacances scolaires
// ---------------------------------------------------------------------------

export interface SchoolHolidayPeriod {
  key: string;
  label: string;
  /** Libellé officiel (arrêté), affiché dans l'assistant. */
  official: string;
  /** Premier jour sans classe. */
  start: string;
  /** Dernier jour de vacances (veille de la reprise) ; nul si non publié. */
  end: string | null;
}

export interface SchoolYearCalendar {
  schoolYear: string;
  source: string;
  periods: readonly SchoolHolidayPeriod[];
}

export interface SchoolCalendar {
  updatedOn: string;
  zone: string;
  years: readonly SchoolYearCalendar[];
}

export const SCHOOL_CALENDAR: SchoolCalendar = data;

// ---------------------------------------------------------------------------
// Jours fériés
// ---------------------------------------------------------------------------

/** Dimanche de Pâques (calendrier grégorien, algorithme de Meeus / Jones / Butcher). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export interface PublicHoliday {
  date: string;
  label: string;
}

/** Les 11 jours fériés de France métropolitaine (hors Alsace-Moselle) d'une année civile. */
export function publicHolidays(year: number): PublicHoliday[] {
  const easter = easterSunday(year);
  const fixed = (monthDay: string, label: string) => ({ date: `${year}-${monthDay}`, label });
  return [
    fixed("01-01", "Jour de l'an"),
    { date: addDays(easter, 1), label: "Lundi de Pâques" },
    fixed("05-01", "Fête du Travail"),
    fixed("05-08", "Victoire 1945"),
    { date: addDays(easter, 39), label: "Ascension" },
    { date: addDays(easter, 50), label: "Lundi de Pentecôte" },
    fixed("07-14", "Fête nationale"),
    fixed("08-15", "Assomption"),
    fixed("11-01", "Toussaint"),
    fixed("11-11", "Armistice 1918"),
    fixed("12-25", "Noël"),
  ].sort((x, y) => x.date.localeCompare(y.date));
}

/** Jours fériés compris entre deux dates (bornes incluses). */
export function publicHolidaysBetween(from: string, to: string): PublicHoliday[] {
  const result: PublicHoliday[] = [];
  for (let year = Number(from.slice(0, 4)); year <= Number(to.slice(0, 4)); year++) {
    result.push(...publicHolidays(year).filter((h) => isDateInRange(h.date, from, to)));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Propositions de l'assistant
// ---------------------------------------------------------------------------

export interface ClosureProposal {
  /** Identifiant stable dans la liste (`2026-2027:toussaint`, `ferie:2026-11-11`). */
  id: string;
  kind: "school" | "public_holiday";
  label: string;
  startDate: string;
  endDate: string;
  /** Dates officielles (vacances) ou nature du jour férié. */
  detail: string;
  /** La période chevauche la saison (sinon : informative, non ajoutable). */
  inSeason: boolean;
  /** Une fermeture existante couvre déjà ces dates. */
  existing: boolean;
  /**
   * Jour férié : libellé de la période proposée et cochée qui le couvre
   * (« Pont de l'Ascension ») ; nul sinon.
   */
  coveredBy: string | null;
  /** Cochée par défaut. */
  selected: boolean;
}

interface Range {
  startDate: string;
  endDate: string;
}

function covers(range: Range, other: Range): boolean {
  return range.startDate <= other.startDate && other.endDate <= range.endDate;
}

/**
 * Propositions de fermetures pour une saison : vacances scolaires de la zone B
 * (bornées à la saison, ponts compris) et jours fériés de la saison. Les
 * vacances des années scolaires concernées qui tombent hors saison (vacances
 * d'été) sont listées à titre indicatif. Sont décochés par défaut : ce qui est
 * déjà couvert par une fermeture existante et les jours fériés couverts par
 * une période cochée (voir `followSelection`).
 */
export function closureProposals(
  season: Range,
  existing: readonly Range[],
  calendar: SchoolCalendar = SCHOOL_CALENDAR,
): ClosureProposal[] {
  const school: ClosureProposal[] = [];
  for (const year of calendar.years) {
    const periods = year.periods.map((period) => {
      const end = period.end ?? maxDate(period.start, season.endDate);
      const inSeason = period.start <= season.endDate && season.startDate <= end;
      return {
        id: `${year.schoolYear}:${period.key}`,
        kind: "school" as const,
        label: period.label,
        startDate: inSeason ? maxDate(period.start, season.startDate) : period.start,
        endDate: inSeason ? minDate(end, season.endDate) : end,
        detail: `${period.official} — année scolaire ${year.schoolYear}`,
        inSeason,
        existing: false,
        coveredBy: null,
        selected: false,
      };
    });
    if (periods.some((p) => p.inSeason)) school.push(...periods);
  }
  const holidays: ClosureProposal[] = publicHolidaysBetween(season.startDate, season.endDate).map(
    (holiday) => ({
      id: `ferie:${holiday.date}`,
      kind: "public_holiday",
      label: holiday.label,
      startDate: holiday.date,
      endDate: holiday.date,
      detail: `Jour férié — ${formatDate(holiday.date)}`,
      inSeason: true,
      existing: false,
      coveredBy: null,
      selected: false,
    }),
  );
  const proposals = [...school, ...holidays]
    .map((proposal) => {
      const already = existing.some((c) => covers(c, proposal));
      return { ...proposal, existing: already, selected: proposal.inSeason && !already };
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.kind.localeCompare(b.kind));
  return followSelection(proposals.map((p) => ({ ...p, checked: p.selected, auto: true }))).map(
    ({ checked, auto: _auto, ...proposal }) => ({ ...proposal, selected: checked }),
  );
}

/** Ligne de l'assistant : proposition et état de sa case. */
export interface ProposalRow extends ClosureProposal {
  checked: boolean;
  /** Jour férié dont la case suit les périodes cochées (pas encore modifiée à la main). */
  auto: boolean;
}

/**
 * Période cochée de la saison qui couvre le jour férié (dates éventuellement
 * modifiées dans l'assistant) ; nulle sinon.
 */
export function coveringPeriod(
  holiday: Pick<ClosureProposal, "startDate">,
  rows: readonly Pick<
    ProposalRow,
    "kind" | "inSeason" | "checked" | "startDate" | "endDate" | "label"
  >[],
): string | null {
  const period = rows.find(
    (row) =>
      row.kind === "school" &&
      row.inSeason &&
      row.checked &&
      isDateInRange(holiday.startDate, row.startDate, row.endDate || row.startDate),
  );
  return period?.label ?? null;
}

/**
 * Suit la sélection en direct (B9) : un jour férié est « compris dans » une
 * période seulement si elle est cochée ; tant que sa case n'a pas été modifiée
 * à la main, il est décoché quand une période cochée le couvre et recoché
 * sinon (sauf s'il est déjà saisi).
 */
export function followSelection<T extends ProposalRow>(rows: readonly T[]): T[] {
  return rows.map((row) => {
    if (row.kind !== "public_holiday") return row;
    const coveredBy = coveringPeriod(row, rows);
    const checked = row.auto ? row.inSeason && !row.existing && coveredBy === null : row.checked;
    return { ...row, coveredBy, checked };
  });
}

/** Libellé de la fermeture créée à partir d'une proposition. */
export function proposalClosureLabel(proposal: Pick<ClosureProposal, "kind" | "label">): string {
  return proposal.kind === "public_holiday" ? `${proposal.label} (férié)` : proposal.label;
}
