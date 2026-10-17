/**
 * Mise en forme des documents PDF (SPECS.md §9.2) : planning de la semaine
 * (type ou datée), planning par moniteur et feuilles d'appel par groupe.
 *
 * Fonctions pures : elles préparent tout ce qui est affiché (libellés,
 * positions relatives des cours, totaux) ; les composants @react-pdf
 * (`documents.tsx`) ne font que dessiner. Les documents doivent rester
 * lisibles imprimés en noir et blanc : aucune information n'est portée par
 * la seule couleur (initiales du moniteur toujours écrites, statuts en toutes
 * lettres).
 */
import type { Court, Lesson } from "@/db/schema";
import type { PlanningState } from "@/domain/commands";
import { hoursLabel } from "@/domain/hoursReport";
import { type ClosureRecord, closureOn, weekOccurrences } from "@/domain/occurrences";
import {
  formatDate,
  formatDuration,
  minutesToTime,
  timeToMinutes,
  weekdayLabel,
} from "@/domain/time";
import { cancellationLabel } from "@/features/planning/grid/actions";
import { assignLanes } from "@/features/planning/grid/geometry";
import {
  activeItems,
  datedItems,
  dateOfMode,
  type GridItem,
  lessonItem,
  type PlanningMode,
} from "@/features/planning/grid/items";
import {
  displayedCourts,
  displayedRange,
  displayedWeekdays,
  semaineTypeDate,
  weekLessons,
} from "@/features/planning/grid/view";

// ---------------------------------------------------------------------------
// Données d'entrée
// ---------------------------------------------------------------------------

export interface OutputSeason {
  name: string;
  startDate: string;
  endDate: string;
  displayStartTime: string;
  displayEndTime: string;
  displayedDays: readonly number[];
}

export interface OutputInstructor {
  id: string;
  firstName: string;
  lastName: string;
  initials: string;
  color: string;
  active: boolean;
}

export interface OutputGroup {
  id: string;
  name: string;
  levelLabel: string | null;
  minAge: number | null;
  maxAge: number | null;
  maxSize: number;
  memberCount: number;
  active: boolean;
}

export interface OutputStudent {
  id: string;
  lastName: string;
  firstName: string;
  /** Facultatif si le responsable légal a un téléphone (§3.5). */
  phone: string | null;
  birthDate: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  groups: readonly { id: string }[];
}

/** Référentiels de la saison nécessaires aux documents. */
export interface OutputReferences {
  courts: readonly Pick<Court, "id" | "name" | "kind" | "active">[];
  instructors: readonly OutputInstructor[];
  groups: readonly OutputGroup[];
}

export interface WeekContext {
  season: OutputSeason;
  state: PlanningState;
  refs: OutputReferences;
  /** Semaine type ou semaine datée. */
  mode: PlanningMode;
  /** Date du jour (`AAAA-MM-JJ`) : version des cours en vigueur pour la semaine type. */
  today: string;
}

export type PaperSize = "A4" | "A3";

export const PAPER_SIZES: readonly { value: PaperSize; label: string }[] = [
  { value: "A4", label: "A4 paysage" },
  { value: "A3", label: "A3 paysage" },
];

// ---------------------------------------------------------------------------
// Libellés communs
// ---------------------------------------------------------------------------

/** « Julie Martin ». */
export function fullName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName}`.trim();
}

/** « Planning habituel — saison 2026-2027 » ou « Semaine du 02/11/2026 au 08/11/2026 ». */
export function weekTitle(mode: PlanningMode, season: Pick<OutputSeason, "name">): string {
  if (mode.kind === "type") return `Planning habituel — saison ${season.name}`;
  const sunday = dateOfMode(mode)(7) as string;
  return `Semaine du ${formatDate(mode.monday)} au ${formatDate(sunday)}`;
}

/** Nom de fichier sans extension, sans caractère gênant : « planning-semaine-2026-11-02 ». */
export function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Suffixe des noms de fichiers d'une semaine : « semaine-type-2026-2027 » ou « semaine-2026-11-02 ». */
export function weekFileSuffix(mode: PlanningMode, season: Pick<OutputSeason, "name">): string {
  return mode.kind === "type" ? `semaine-type-${slug(season.name)}` : `semaine-${mode.monday}`;
}

/** Noms de fichiers proposés à l'enregistrement. */
export const pdfFileNames = {
  week: (mode: PlanningMode, season: Pick<OutputSeason, "name">, paper: PaperSize) =>
    `planning-${weekFileSuffix(mode, season)}-${paper.toLowerCase()}.pdf`,
  instructors: (
    mode: PlanningMode,
    season: Pick<OutputSeason, "name">,
    instructor?: { firstName: string; lastName: string },
  ) =>
    instructor
      ? `planning-${slug(fullName(instructor))}-${weekFileSuffix(mode, season)}.pdf`
      : `planning-moniteurs-${weekFileSuffix(mode, season)}.pdf`,
  attendance: (season: Pick<OutputSeason, "name">, group?: { name: string }) =>
    group ? `feuille-appel-${slug(group.name)}.pdf` : `feuilles-appel-${slug(season.name)}.pdf`,
};

/** Libellé court d'un court dans l'en-tête : son nom s'il est court, sinon « C1 », « C2 »… */
export function courtHeading(name: string, index: number): string {
  return name.length <= 8 ? name : `C${index + 1}`;
}

/**
 * Teinte claire d'une couleur `#RRGGBB` (mélange avec du blanc) : fond des
 * cours, qui reste clair à l'impression en noir et blanc.
 */
export function tint(color: string, whiteRatio = 0.78): string {
  const match = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return "#F1F5F9";
  const value = Number.parseInt(match[1] as string, 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  return `#${channels
    .map((c) =>
      Math.round(c + (255 - c) * whiteRatio)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")
    .toUpperCase()}`;
}

const NEUTRAL_COLOR = "#64748B";

function lookup<T extends { id: string }>(
  list: readonly T[],
): (id: string | null) => T | undefined {
  const byId = new Map(list.map((item) => [item.id, item]));
  return (id) => (id ? byId.get(id) : undefined);
}

function timeRange(start: number, durationMinutes: number): string {
  return `${minutesToTime(start)}–${minutesToTime(start + durationMinutes)}`;
}

/** Éléments de la semaine : cours en vigueur (semaine type) ou séances datées. */
export function weekItems(ctx: Omit<WeekContext, "refs">): GridItem[] {
  const { mode, state, season, today } = ctx;
  if (mode.kind === "type") {
    return weekLessons(state.lessons, semaineTypeDate(season, today)).map(lessonItem);
  }
  return datedItems(
    weekOccurrences(
      {
        lessons: state.lessons,
        exceptions: state.exceptions,
        closures: state.closures,
        season: { startDate: season.startDate, endDate: season.endDate },
      },
      mode.monday,
    ),
  );
}

/** Mentions d'une séance (statut en toutes lettres, jamais par la seule couleur). */
function itemMentions(
  item: GridItem,
  instructorOf: (id: string | null) => OutputInstructor | undefined,
): string[] {
  const occurrence = item.occurrence;
  const mentions: string[] = [];
  if (occurrence?.cancellation) {
    mentions.push(
      `Annulé : ${cancellationLabel(occurrence.cancellation.reason, occurrence.cancellation.note)}`,
    );
  }
  if (occurrence?.replaced) {
    const original = instructorOf(occurrence.originalInstructorId);
    mentions.push(`Remplace ${original ? original.initials : "?"}`);
  }
  if (occurrence?.modified) mentions.push("Modifié cette semaine");
  if (item.kind === "one_off") mentions.push("Cours ponctuel");
  return mentions;
}

// ---------------------------------------------------------------------------
// Planning de la semaine (§9.2)
// ---------------------------------------------------------------------------

export interface SheetBlock {
  id: string;
  dayIndex: number;
  courtIndex: number;
  /** Position verticale et hauteur, en fraction de la hauteur de la grille. */
  top: number;
  height: number;
  /** Position dans la sous-colonne quand deux cours se chevauchent (fractions). */
  left: number;
  width: number;
  initials: string;
  groupName: string;
  time: string;
  size: string;
  color: string;
  background: string;
  cancelled: boolean;
  /** Mention courte affichée sur le bloc : « ANNULÉ », « Rempl. JM », « Ponctuel ». */
  tag: string | null;
}

export interface SheetDay {
  weekday: number;
  label: string;
  /** Fermeture couvrant le jour (semaine datée) : « Fermé — Vacances de la Toussaint ». */
  closure: string | null;
}

export interface LegendEntry {
  initials: string;
  name: string;
  color: string;
  minutes: number;
  hours: string;
}

export interface WeekSheet {
  title: string;
  subtitle: string;
  days: SheetDay[];
  courts: { id: string; label: string }[];
  dayStart: number;
  dayEnd: number;
  /** Graduations (minutes depuis minuit) : heures pleines. */
  ticks: number[];
  blocks: SheetBlock[];
  legend: LegendEntry[];
  totalHours: string;
  /** Explication des mentions, imprimée en pied de page. */
  notes: string[];
}

function dayLabel(mode: PlanningMode, weekday: number): string {
  const date = dateOfMode(mode)(weekday);
  return date ? `${weekdayLabel(weekday)} ${formatDate(date).slice(0, 5)}` : weekdayLabel(weekday);
}

function blockTag(
  item: GridItem,
  instructorOf: (id: string | null) => OutputInstructor | undefined,
): string | null {
  const occurrence = item.occurrence;
  if (item.cancelled) return "ANNULÉ";
  if (occurrence?.replaced) {
    return `Rempl. ${instructorOf(occurrence.originalInstructorId)?.initials ?? "?"}`;
  }
  if (item.kind === "one_off") return "Ponctuel";
  if (occurrence?.modified) return "Modifié";
  return null;
}

/** Heures par moniteur des séances actives (les séances annulées ne comptent pas). */
export function legendOf(
  items: readonly GridItem[],
  instructors: readonly OutputInstructor[],
): LegendEntry[] {
  const minutes = new Map<string, number>();
  for (const item of activeItems(items)) {
    if (!item.instructorId) continue;
    minutes.set(item.instructorId, (minutes.get(item.instructorId) ?? 0) + item.durationMinutes);
  }
  return instructors
    .filter((i) => minutes.has(i.id))
    .map((i) => {
      const total = minutes.get(i.id) ?? 0;
      return {
        initials: i.initials,
        name: fullName(i),
        color: i.color,
        minutes: total,
        hours: hoursLabel(total),
      };
    });
}

/** Planning de la semaine affichée, prêt à dessiner. */
export function buildWeekSheet(ctx: WeekContext): WeekSheet {
  const { season, refs, mode } = ctx;
  const items = weekItems(ctx);
  const instructorOf = lookup(refs.instructors);
  const groupOf = lookup(refs.groups);
  const weekdays = displayedWeekdays(season.displayedDays, items);
  const courts = displayedCourts(refs.courts, items);
  const { start: dayStart, end: dayEnd } = displayedRange(
    { start: timeToMinutes(season.displayStartTime), end: timeToMinutes(season.displayEndTime) },
    items,
  );
  const span = Math.max(dayEnd - dayStart, 60);
  const courtIndex = new Map(courts.map((c, i) => [c.id, i]));
  const placed = items.filter(
    (i) => i.courtId !== null && courtIndex.has(i.courtId) && weekdays.includes(i.weekday),
  );
  const lanes = assignLanes(
    placed.map((i) => ({
      id: i.id,
      weekday: i.weekday,
      courtId: i.courtId as string,
      start: i.start,
      end: i.start + i.durationMinutes,
    })),
  );
  const blocks: SheetBlock[] = placed.map((item) => {
    const instructor = instructorOf(item.instructorId);
    const group = groupOf(item.groupId);
    const lane = lanes.get(item.id) ?? { lane: 0, lanes: 1 };
    const color = instructor?.color ?? NEUTRAL_COLOR;
    return {
      id: item.id,
      dayIndex: weekdays.indexOf(item.weekday),
      courtIndex: courtIndex.get(item.courtId as string) as number,
      top: (item.start - dayStart) / span,
      height: item.durationMinutes / span,
      left: lane.lane / lane.lanes,
      width: 1 / lane.lanes,
      initials: instructor?.initials ?? "?",
      groupName: group?.name ?? (item.kind === "one_off" ? "Cours ponctuel" : "Groupe inconnu"),
      time: timeRange(item.start, item.durationMinutes),
      size: group ? `${group.memberCount}/${group.maxSize}` : "",
      color,
      background: item.cancelled ? "#FFFFFF" : tint(color),
      cancelled: item.cancelled,
      tag: blockTag(item, instructorOf),
    };
  });
  const dateOf = dateOfMode(mode);
  const days: SheetDay[] = weekdays.map((weekday) => {
    const date = dateOf(weekday);
    const closure: ClosureRecord | null = date ? closureOn(ctx.state.closures, date) : null;
    return {
      weekday,
      label: dayLabel(mode, weekday),
      closure: closure ? `Fermé — ${closure.label}` : null,
    };
  });
  const ticks: number[] = [];
  for (let minute = Math.ceil(dayStart / 60) * 60; minute <= dayEnd; minute += 60) {
    ticks.push(minute);
  }
  const legend = legendOf(items, refs.instructors);
  const total = legend.reduce((sum, e) => sum + e.minutes, 0);
  const notes = [
    "Chaque cours indique les initiales du moniteur, le groupe, l'horaire et le nombre d'élèves (inscrits / max).",
  ];
  if (mode.kind === "dated") {
    notes.push(
      "ANNULÉ : séance annulée (non comptée) · Rempl. XX : remplacement du moniteur XX · Ponctuel : cours de cette semaine uniquement · Modifié : séance déplacée ou modifiée cette semaine.",
    );
  }
  return {
    title: mode.kind === "type" ? "Planning habituel" : "Planning de la semaine",
    subtitle: weekTitle(mode, season),
    days,
    courts: courts.map((c, i) => ({ id: c.id, label: courtHeading(c.name, i) })),
    dayStart,
    dayEnd,
    ticks,
    blocks,
    legend,
    totalHours: hoursLabel(total),
    notes,
  };
}

// ---------------------------------------------------------------------------
// Planning par moniteur (§9.2)
// ---------------------------------------------------------------------------

export interface InstructorSession {
  key: string;
  day: string;
  time: string;
  duration: string;
  court: string;
  group: string;
  size: string;
  /** Mentions (annulation, remplacement, cours ponctuel…), en toutes lettres. */
  remarks: string;
  /** La séance ne compte pas dans les heures (annulée, ou assurée par un remplaçant). */
  struck: boolean;
}

export interface InstructorSheet {
  instructorId: string;
  title: string;
  initials: string;
  color: string;
  subtitle: string;
  sessions: InstructorSession[];
  totalHours: string;
  sessionCount: number;
}

function dayOf(item: GridItem): string {
  return item.date
    ? `${weekdayLabel(item.weekday)} ${formatDate(item.date)}`
    : weekdayLabel(item.weekday);
}

/**
 * Planning personnel de chaque moniteur pour la semaine : les séances qu'il
 * assure, ainsi que celles qui lui étaient attribuées mais sont assurées par un
 * remplaçant (barrées, non comptées). `instructorIds` limite aux moniteurs
 * demandés ; sinon, tous les moniteurs ayant au moins une séance.
 */
export function buildInstructorSheets(
  ctx: WeekContext,
  instructorIds?: readonly string[],
): InstructorSheet[] {
  const { refs, mode, season } = ctx;
  const items = weekItems(ctx);
  const instructorOf = lookup(refs.instructors);
  const groupOf = lookup(refs.groups);
  const courtOf = lookup(refs.courts);
  const wanted = instructorIds
    ? refs.instructors.filter((i) => instructorIds.includes(i.id))
    : refs.instructors.filter((i) =>
        items.some(
          (item) => item.instructorId === i.id || item.occurrence?.originalInstructorId === i.id,
        ),
      );
  const subtitle = weekTitle(mode, season);
  return wanted.map((instructor) => {
    const own = items.filter(
      (item) =>
        item.instructorId === instructor.id ||
        item.occurrence?.originalInstructorId === instructor.id,
    );
    const sessions = own
      .sort((a, b) => a.weekday - b.weekday || a.start - b.start)
      .map((item): InstructorSession => {
        const group = groupOf(item.groupId);
        const court = courtOf(item.courtId);
        const replacedAway =
          item.occurrence?.replaced === true && item.instructorId !== instructor.id;
        const remarks = replacedAway
          ? [
              `Remplacé(e) par ${fullName(instructorOf(item.instructorId) ?? { firstName: "?", lastName: "" })}`,
              ...(item.cancelled ? ["Annulé"] : []),
            ]
          : itemMentions(item, instructorOf);
        return {
          key: item.id,
          day: dayOf(item),
          time: timeRange(item.start, item.durationMinutes),
          duration: formatDuration(item.durationMinutes),
          court: court?.name ?? "—",
          group: group?.name ?? (item.kind === "one_off" ? "Cours ponctuel" : "—"),
          size: group ? `${group.memberCount}/${group.maxSize}` : "",
          remarks: [...remarks, ...(item.note ? [item.note] : [])].join(" · "),
          struck: item.cancelled || replacedAway,
        };
      });
    const counted = own.filter((item) => !item.cancelled && item.instructorId === instructor.id);
    return {
      instructorId: instructor.id,
      title: `${fullName(instructor)} (${instructor.initials})`,
      initials: instructor.initials,
      color: instructor.color,
      subtitle,
      sessions,
      totalHours: hoursLabel(counted.reduce((sum, item) => sum + item.durationMinutes, 0)),
      sessionCount: counted.length,
    };
  });
}

// ---------------------------------------------------------------------------
// Feuilles d'appel (§9.2)
// ---------------------------------------------------------------------------

/** Nombre de colonnes de présence, laissées vierges. */
export const ATTENDANCE_COLUMNS = 10;

export interface AttendanceRow {
  index: number;
  name: string;
  phone: string;
  birthDate: string;
  guardian: string;
}

export interface AttendanceSheet {
  groupId: string;
  title: string;
  details: string;
  /** Créneaux du groupe dans la semaine type : « Lundi 10:00–11:00 · Court 1 · KB (Karim Benali) ». */
  slots: string[];
  rows: AttendanceRow[];
  /** Lignes vierges ajoutées en fin de tableau (élèves à l'essai…). */
  blankRows: number;
  columns: number;
}

function ageRange(group: Pick<OutputGroup, "minAge" | "maxAge">): string | null {
  const { minAge, maxAge } = group;
  if (minAge !== null && maxAge !== null) return `${minAge} à ${maxAge} ans`;
  if (minAge !== null) return `${minAge} ans et plus`;
  if (maxAge !== null) return `jusqu'à ${maxAge} ans`;
  return null;
}

/**
 * Feuilles d'appel des groupes demandés (sinon tous les groupes actifs) :
 * élèves par ordre alphabétique, téléphones, responsable légal et colonnes de
 * présence vierges.
 */
export function buildAttendanceSheets(input: {
  season: Pick<OutputSeason, "name" | "startDate" | "endDate">;
  lessons: readonly Lesson[];
  refs: OutputReferences;
  students: readonly OutputStudent[];
  today: string;
  groupIds?: readonly string[];
}): AttendanceSheet[] {
  const { refs, students, groupIds } = input;
  const instructorOf = lookup(refs.instructors);
  const courtOf = lookup(refs.courts);
  const lessons = weekLessons(input.lessons, semaineTypeDate(input.season, input.today));
  const groups = groupIds
    ? refs.groups.filter((g) => groupIds.includes(g.id))
    : refs.groups.filter((g) => g.active);
  const collator = new Intl.Collator("fr", { sensitivity: "base" });
  return groups.map((group) => {
    const members = students
      .filter((s) => s.groups.some((g) => g.id === group.id))
      .sort(
        (a, b) =>
          collator.compare(a.lastName, b.lastName) || collator.compare(a.firstName, b.firstName),
      );
    const slots = lessons
      .filter((l) => l.groupId === group.id)
      .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime))
      .map((l) => {
        const instructor = instructorOf(l.instructorId);
        return [
          `${weekdayLabel(l.weekday)} ${timeRange(timeToMinutes(l.startTime), l.durationMinutes)}`,
          courtOf(l.courtId)?.name ?? "Court inconnu",
          instructor ? `${instructor.initials} (${fullName(instructor)})` : "Moniteur inconnu",
        ].join(" · ");
      });
    const details = [
      group.levelLabel && `Niveau : ${group.levelLabel}`,
      ageRange(group),
      `${members.length} élève${members.length > 1 ? "s" : ""} / ${group.maxSize} places`,
      `Saison ${input.season.name}`,
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      groupId: group.id,
      title: group.name,
      details,
      slots,
      rows: members.map((s, i) => ({
        index: i + 1,
        name: `${s.lastName.toUpperCase()} ${s.firstName}`,
        // Deux colonnes : téléphone de l'élève, contact du responsable légal.
        phone: s.phone ?? "",
        birthDate: formatDate(s.birthDate),
        guardian: [s.guardianName, s.guardianPhone].filter(Boolean).join(" — "),
      })),
      blankRows: Math.max(2, group.maxSize - members.length),
      columns: ATTENDANCE_COLUMNS,
    };
  });
}
