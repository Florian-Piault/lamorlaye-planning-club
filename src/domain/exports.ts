/**
 * Exports CSV et Excel (SPECS.md §9.2, §10) : cours, groupes, élèves et heures
 * des moniteurs. Les tableaux sont préparés ici (fonctions pures), puis
 * sérialisés en CSV (séparateur « ; », UTF-8 avec BOM, comme l'attend Excel
 * en français) ou en classeur Excel (SheetJS, chargé à la demande).
 */

import { toDecimalHours } from "./hours";
import type { HoursReport } from "./hoursReport";
import { formatDate, minutesToTime, timeToMinutes, weekdayLabel } from "./time";

export type Cell = string | number | null;

export interface DataTable {
  /** Nom de l'onglet Excel (31 caractères au plus). */
  sheetName: string;
  headers: string[];
  rows: Cell[][];
}

// ---------------------------------------------------------------------------
// Sérialisation
// ---------------------------------------------------------------------------

export const CSV_SEPARATOR = ";";

/** Valeur d'une cellule CSV : nombres à virgule décimale, guillemets si nécessaire. */
export function csvCell(value: Cell): string {
  if (value === null) return "";
  const text = typeof value === "number" ? String(value).replace(".", ",") : value;
  return /[";\r\n]/.test(text) || /^\s|\s$/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Texte CSV d'un tableau (lignes terminées par CRLF). */
export function toCsv(table: DataTable): string {
  return [table.headers, ...table.rows]
    .map((row) => row.map(csvCell).join(CSV_SEPARATOR))
    .map((line) => `${line}\r\n`)
    .join("");
}

/** Octets du fichier CSV : UTF-8 précédé du BOM (accents corrects dans Excel). */
export function csvBytes(table: DataTable): Uint8Array {
  return new TextEncoder().encode(`﻿${toCsv(table)}`);
}

/** Classeur Excel (.xlsx), un onglet par tableau. SheetJS est chargé à la demande. */
export async function xlsxBytes(tables: readonly DataTable[]): Promise<Uint8Array> {
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();
  for (const table of tables) {
    const sheet = XLSX.utils.aoa_to_sheet([table.headers, ...table.rows]);
    sheet["!cols"] = table.headers.map((header, i) => ({
      wch: Math.min(
        40,
        Math.max(header.length, ...table.rows.map((row) => String(row[i] ?? "").length)) + 2,
      ),
    }));
    XLSX.utils.book_append_sheet(book, sheet, table.sheetName.slice(0, 31));
  }
  const data: ArrayBuffer = XLSX.write(book, {
    bookType: "xlsx",
    type: "array",
    compression: true,
  });
  return new Uint8Array(data);
}

// ---------------------------------------------------------------------------
// Tableaux
// ---------------------------------------------------------------------------

interface Named {
  id: string;
  name: string;
}

interface InstructorRef {
  id: string;
  firstName: string;
  lastName: string;
  initials: string;
}

export interface LessonRow {
  id: string;
  weekday: number;
  startTime: string;
  durationMinutes: number;
  courtId: string;
  groupId: string;
  instructorId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string | null;
}

export interface ExportReferences {
  courts: readonly Named[];
  groups: readonly Named[];
  instructors: readonly InstructorRef[];
}

function index<T extends { id: string }>(list: readonly T[]): Map<string, T> {
  return new Map(list.map((item) => [item.id, item]));
}

function endTime(startTime: string, durationMinutes: number): string {
  return minutesToTime(timeToMinutes(startTime) + durationMinutes);
}

function byWeekdayAndTime(a: LessonRow, b: LessonRow): number {
  return (
    a.weekday - b.weekday ||
    a.startTime.localeCompare(b.startTime) ||
    a.effectiveFrom.localeCompare(b.effectiveFrom)
  );
}

/** Cours de la semaine type (toutes les versions, avec leurs dates d'effet). */
export function lessonsTable(lessons: readonly LessonRow[], refs: ExportReferences): DataTable {
  const courts = index(refs.courts);
  const groups = index(refs.groups);
  const instructors = index(refs.instructors);
  return {
    sheetName: "Cours",
    headers: [
      "Jour",
      "Début",
      "Fin",
      "Durée (min)",
      "Court",
      "Groupe",
      "Moniteur",
      "Initiales",
      "En vigueur du",
      "En vigueur au",
      "Note",
    ],
    rows: [...lessons].sort(byWeekdayAndTime).map((l) => {
      const instructor = instructors.get(l.instructorId);
      return [
        weekdayLabel(l.weekday),
        l.startTime,
        endTime(l.startTime, l.durationMinutes),
        l.durationMinutes,
        courts.get(l.courtId)?.name ?? "",
        groups.get(l.groupId)?.name ?? "",
        instructor ? `${instructor.firstName} ${instructor.lastName}` : "",
        instructor?.initials ?? "",
        formatDate(l.effectiveFrom),
        l.effectiveTo ? formatDate(l.effectiveTo) : "",
        l.note,
      ];
    }),
  };
}

export interface GroupRow {
  id: string;
  name: string;
  levelLabel: string | null;
  minAge: number | null;
  maxAge: number | null;
  memberCount: number;
  maxSize: number;
  active: boolean;
}

/**
 * Groupes avec leur effectif et leurs créneaux de la semaine type
 * (`lessons` : cours en vigueur à la date de référence).
 */
export function groupsTable(
  groupList: readonly GroupRow[],
  lessons: readonly LessonRow[],
  refs: ExportReferences,
): DataTable {
  const courts = index(refs.courts);
  const instructors = index(refs.instructors);
  return {
    sheetName: "Groupes",
    headers: [
      "Groupe",
      "Niveau",
      "Âge min",
      "Âge max",
      "Inscrits",
      "Effectif max",
      "Actif",
      "Créneaux",
    ],
    rows: groupList.map((g) => [
      g.name,
      g.levelLabel,
      g.minAge,
      g.maxAge,
      g.memberCount,
      g.maxSize,
      g.active ? "oui" : "non",
      lessons
        .filter((l) => l.groupId === g.id)
        .sort(byWeekdayAndTime)
        .map(
          (l) =>
            `${weekdayLabel(l.weekday)} ${l.startTime}–${endTime(l.startTime, l.durationMinutes)} (${
              courts.get(l.courtId)?.name ?? "?"
            }, ${instructors.get(l.instructorId)?.initials ?? "?"})`,
        )
        .join(" ; "),
    ]),
  };
}

export interface StudentRow {
  lastName: string;
  firstName: string;
  phone: string;
  birthDate: string | null;
  levelLabel: string | null;
  fftRanking: string | null;
  email: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  groups: readonly { name: string }[];
}

/** Élèves de la saison avec leurs groupes. */
export function studentsTable(students: readonly StudentRow[]): DataTable {
  return {
    sheetName: "Élèves",
    headers: [
      "Nom",
      "Prénom",
      "Téléphone",
      "Date de naissance",
      "Niveau",
      "Classement FFT",
      "E-mail",
      "Responsable légal",
      "Téléphone du responsable",
      "Groupes",
    ],
    rows: students.map((s) => [
      s.lastName,
      s.firstName,
      s.phone,
      s.birthDate ? formatDate(s.birthDate) : "",
      s.levelLabel,
      s.fftRanking,
      s.email,
      s.guardianName,
      s.guardianPhone,
      s.groups.map((g) => g.name).join(", "),
    ]),
  };
}

/** Récapitulatif des heures : une ligne par moniteur, puis le total. */
export function hoursSummaryTable(report: HoursReport): DataTable {
  const period = `${formatDate(report.period.from)} → ${formatDate(report.period.to)}`;
  return {
    sheetName: "Heures",
    headers: ["Moniteur", "Initiales", "Séances", "Minutes", "Heures", "Période"],
    rows: [
      ...report.lines.map((l) => [
        l.name,
        l.initials,
        l.sessions,
        l.minutes,
        toDecimalHours(l.minutes),
        period,
      ]),
      [
        "Total",
        "",
        report.totalSessions,
        report.totalMinutes,
        toDecimalHours(report.totalMinutes),
        period,
      ],
    ],
  };
}

/** Détail des séances comptées, par moniteur puis par date. */
export function hoursDetailTable(report: HoursReport): DataTable {
  return {
    sheetName: "Détail des heures",
    headers: [
      "Moniteur",
      "Initiales",
      "Date",
      "Jour",
      "Début",
      "Fin",
      "Heures",
      "Groupe",
      "Court",
      "Remarque",
    ],
    rows: report.lines.flatMap((l) =>
      l.details.map((d) => [
        l.name,
        l.initials,
        formatDate(d.date),
        weekdayLabel(d.weekday),
        d.startTime,
        d.endTime,
        toDecimalHours(d.minutes),
        d.groupName,
        d.courtName,
        d.remark,
      ]),
    ),
  };
}
