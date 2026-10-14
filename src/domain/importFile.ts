/**
 * Lecture des fichiers d'import d'élèves (SPECS.md §9.1) : CSV et classeurs
 * Excel (.xlsx, .xls), transformés en un tableau de cellules texte.
 *
 * - CSV : détection de l'encodage (UTF-8 avec ou sans BOM, UTF-16 avec BOM,
 *   sinon Windows-1252) et du séparateur (`;`, `,` ou tabulation), puis
 *   découpage par PapaParse ;
 * - Excel : lecture du premier onglet par SheetJS ; les dates sont converties
 *   en `AAAA-MM-JJ` sans passer par un objet `Date` (pas d'effet de fuseau).
 *
 * Fonctions pures, sans accès au système de fichiers.
 */
import Papa from "papaparse";
import { type CellObject, read, SSF, utils, type WorkSheet } from "xlsx";

export type TextEncoding = "utf-8" | "utf-16le" | "utf-16be" | "windows-1252";

export const DELIMITERS = [";", ",", "\t"] as const;
export type Delimiter = (typeof DELIMITERS)[number];

export type FileFormat =
  | { kind: "csv"; encoding: TextEncoding; bom: boolean; delimiter: Delimiter }
  | { kind: "xlsx" | "xls"; sheetName: string };

/** Ligne de données du fichier, avec son numéro de ligne d'origine (1 = première ligne). */
export interface TableRow {
  line: number;
  cells: string[];
}

export interface ParsedTable {
  format: FileFormat;
  /** En-têtes des colonnes (première ligne non vide), uniques et non vides. */
  headers: string[];
  rows: TableRow[];
}

/** Nombre maximal de lignes de données acceptées. */
export const MAX_IMPORT_ROWS = 10_000;

export class ImportFileError extends Error {
  override name = "ImportFileError";
}

// ---------------------------------------------------------------------------
// Encodage et séparateur
// ---------------------------------------------------------------------------

const startsWith = (bytes: Uint8Array, prefix: readonly number[]) =>
  prefix.every((byte, i) => bytes[i] === byte);

/**
 * Décode le texte d'un fichier : BOM UTF-8 ou UTF-16 s'il est présent, sinon
 * UTF-8 si les octets sont valides, sinon Windows-1252 (exports Excel « CSV »
 * sous Windows).
 */
export function decodeText(bytes: Uint8Array): {
  text: string;
  encoding: TextEncoding;
  bom: boolean;
} {
  if (startsWith(bytes, [0xef, 0xbb, 0xbf])) {
    return {
      text: new TextDecoder("utf-8").decode(bytes.subarray(3)),
      encoding: "utf-8",
      bom: true,
    };
  }
  if (startsWith(bytes, [0xff, 0xfe])) {
    return {
      text: new TextDecoder("utf-16le").decode(bytes.subarray(2)),
      encoding: "utf-16le",
      bom: true,
    };
  }
  if (startsWith(bytes, [0xfe, 0xff])) {
    return {
      text: new TextDecoder("utf-16be").decode(bytes.subarray(2)),
      encoding: "utf-16be",
      bom: true,
    };
  }
  try {
    return {
      text: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      encoding: "utf-8",
      bom: false,
    };
  } catch {
    return {
      text: new TextDecoder("windows-1252").decode(bytes),
      encoding: "windows-1252",
      bom: false,
    };
  }
}

/** Nombre d'occurrences du séparateur hors des champs entre guillemets. */
function countOutsideQuotes(line: string, delimiter: string): number {
  let count = 0;
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) count++;
  }
  return count;
}

/**
 * Séparateur le plus probable : celui qui apparaît le même nombre de fois sur
 * le plus de lignes (parmi les 20 premières), puis le plus fréquent. À
 * égalité, l'ordre `;`, `,`, tabulation l'emporte (CSV « français » d'Excel).
 */
export function detectDelimiter(text: string): Delimiter {
  const lines = text
    .split(/\r\n|\n|\r/)
    .filter((line) => line.trim() !== "")
    .slice(0, 20);
  let best: Delimiter = ";";
  let bestScore = 0;
  for (const delimiter of DELIMITERS) {
    const counts = lines.map((line) => countOutsideQuotes(line, delimiter));
    const first = counts[0] ?? 0;
    if (first === 0) continue;
    const consistent = counts.filter((c) => c === first).length;
    const score = consistent * 1_000 + first;
    if (score > bestScore) {
      best = delimiter;
      bestScore = score;
    }
  }
  return best;
}

/** Libellé d'un séparateur pour l'interface. */
export function delimiterLabel(delimiter: Delimiter): string {
  return delimiter === "\t" ? "tabulation" : `« ${delimiter} »`;
}

/** Libellé d'un encodage pour l'interface. */
export function encodingLabel(encoding: TextEncoding, bom: boolean): string {
  switch (encoding) {
    case "utf-8":
      return bom ? "UTF-8 (avec BOM)" : "UTF-8";
    case "utf-16le":
    case "utf-16be":
      return "UTF-16";
    case "windows-1252":
      return "Windows-1252";
  }
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** Découpe un texte CSV en lignes de cellules. */
export function parseCsv(text: string, delimiter: Delimiter): string[][] {
  const result = Papa.parse<string[]>(text, { delimiter, skipEmptyLines: false });
  return result.data;
}

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------

type SpreadsheetKind = "xlsx" | "xls";

const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];
const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

/** Classeur Excel (d'après la signature du fichier, sinon son extension), ou `null` pour un CSV. */
export function spreadsheetKind(bytes: Uint8Array, fileName = ""): SpreadsheetKind | null {
  if (startsWith(bytes, ZIP_SIGNATURE)) return "xlsx";
  if (startsWith(bytes, OLE_SIGNATURE)) return "xls";
  const extension = fileName.toLowerCase().split(".").pop();
  if (extension === "xlsx") return "xlsx";
  if (extension === "xls") return "xls";
  return null;
}

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

/** Le format de nombre désigne-t-il une date ? */
const isDateFormat = (format: unknown): boolean =>
  typeof format === "string" && (SSF.is_date(format) as boolean);

/**
 * Numéro de série Excel → `AAAA-MM-JJ` (calendrier 1900, ou 1904 pour certains
 * classeurs créés sur Mac) ; `null` hors de la plage des dates Excel.
 */
export function excelSerialToIso(serial: number, date1904 = false): string | null {
  const parsed = SSF.parse_date_code(serial, { date1904 }) as {
    y: number;
    m: number;
    d: number;
  } | null;
  if (!parsed) return null;
  return `${pad(parsed.y, 4)}-${pad(parsed.m)}-${pad(parsed.d)}`;
}

/** Texte d'une cellule ; les dates deviennent `AAAA-MM-JJ`, les nombres restent bruts. */
function cellText(cell: CellObject | undefined, date1904: boolean): string {
  if (!cell || cell.v === undefined || cell.v === null) return "";
  switch (cell.t) {
    case "n": {
      const value = cell.v as number;
      if (isDateFormat(cell.z)) return excelSerialToIso(value, date1904) ?? String(value);
      return String(value);
    }
    case "d": {
      const date = cell.v as Date;
      return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }
    case "b":
      return cell.v ? "VRAI" : "FAUX";
    case "e":
    case "z":
      return "";
    default:
      return String(cell.v);
  }
}

function sheetRows(sheet: WorkSheet, date1904: boolean): string[][] {
  const ref = sheet["!ref"];
  if (!ref) return [];
  const range = utils.decode_range(ref);
  const rows: string[][] = [];
  // Les lignes vides en tête de feuille comptent pour la numérotation.
  for (let r = 0; r < range.s.r; r++) rows.push([]);
  for (let r = range.s.r; r <= range.e.r; r++) {
    const cells: string[] = [];
    for (let c = 0; c <= range.e.c; c++) {
      cells.push(cellText(sheet[utils.encode_cell({ r, c })] as CellObject | undefined, date1904));
    }
    rows.push(cells);
  }
  return rows;
}

/** Lit le premier onglet d'un classeur Excel. */
export function parseSpreadsheet(bytes: Uint8Array): { sheetName: string; rows: string[][] } {
  let workbook: ReturnType<typeof read>;
  try {
    workbook = read(bytes, { type: "array", cellNF: true, cellDates: false, dense: false });
  } catch {
    throw new ImportFileError(
      "Impossible de lire ce classeur Excel : le fichier est peut-être endommagé.",
    );
  }
  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheetName || !sheet) throw new ImportFileError("Le classeur ne contient aucune feuille.");
  const date1904 = workbook.Workbook?.WBProps?.date1904 === true;
  return { sheetName, rows: sheetRows(sheet, date1904) };
}

// ---------------------------------------------------------------------------
// Tableau
// ---------------------------------------------------------------------------

const isBlank = (cells: readonly string[]) => cells.every((cell) => cell.trim() === "");

/** Lettre de colonne Excel (0 → A, 26 → AA). */
export function columnLetter(index: number): string {
  let letter = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letter = String.fromCharCode(65 + ((n - 1) % 26)) + letter;
  }
  return letter;
}

/** En-têtes nettoyés : vides → « Colonne C », doublons numérotés. */
function uniqueHeaders(cells: readonly string[], width: number): string[] {
  const seen = new Map<string, number>();
  return Array.from({ length: width }, (_, i) => {
    const base = (cells[i] ?? "").trim().replace(/\s+/g, " ") || `Colonne ${columnLetter(i)}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

/**
 * Construit le tableau : la première ligne non vide donne les en-têtes, les
 * lignes vides suivantes sont ignorées.
 */
export function toTable(format: FileFormat, raw: readonly (readonly string[])[]): ParsedTable {
  const headerIndex = raw.findIndex((cells) => !isBlank(cells));
  if (headerIndex === -1) throw new ImportFileError("Le fichier est vide.");
  const dataRows: TableRow[] = [];
  for (let i = headerIndex + 1; i < raw.length; i++) {
    const cells = raw[i] as readonly string[];
    if (!isBlank(cells)) dataRows.push({ line: i + 1, cells: cells.map((c) => c.trim()) });
  }
  if (dataRows.length === 0) {
    throw new ImportFileError("Le fichier ne contient aucune ligne après la ligne d'en-tête.");
  }
  if (dataRows.length > MAX_IMPORT_ROWS) {
    throw new ImportFileError(
      `Le fichier contient ${dataRows.length} lignes : ${MAX_IMPORT_ROWS} au maximum.`,
    );
  }
  const width = Math.max(
    ...[raw[headerIndex], ...dataRows.map((r) => r.cells)].map((c) => c?.length ?? 0),
  );
  const headers = uniqueHeaders(raw[headerIndex] ?? [], width);
  const rows = dataRows.map((row) => ({
    line: row.line,
    cells: Array.from({ length: width }, (_, i) => row.cells[i] ?? ""),
  }));
  return { format, headers, rows };
}

/** Lit un fichier d'import (CSV ou Excel) à partir de ses octets. */
export function readImportFile(bytes: Uint8Array, fileName = ""): ParsedTable {
  if (bytes.length === 0) throw new ImportFileError("Le fichier est vide.");
  const kind = spreadsheetKind(bytes, fileName);
  if (kind) {
    const { sheetName, rows } = parseSpreadsheet(bytes);
    return toTable({ kind, sheetName }, rows);
  }
  const { text, encoding, bom } = decodeText(bytes);
  const delimiter = detectDelimiter(text);
  return toTable({ kind: "csv", encoding, bom, delimiter }, parseCsv(text, delimiter));
}

/** Description du format détecté, pour l'interface. */
export function describeFormat(format: FileFormat): string {
  if (format.kind === "csv") {
    return `CSV, séparateur ${delimiterLabel(format.delimiter)}, encodage ${encodingLabel(format.encoding, format.bom)}`;
  }
  return `Classeur Excel (.${format.kind}), onglet « ${format.sheetName} »`;
}
