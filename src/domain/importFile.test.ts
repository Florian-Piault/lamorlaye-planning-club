import { describe, expect, it } from "vitest";
import { utils, write } from "xlsx";
import {
  columnLetter,
  decodeText,
  delimiterLabel,
  describeFormat,
  detectDelimiter,
  encodingLabel,
  excelSerialToIso,
  ImportFileError,
  MAX_IMPORT_ROWS,
  parseSpreadsheet,
  readImportFile,
  spreadsheetKind,
  toTable,
} from "./importFile";

/** Texte encodé en Windows-1252 (caractères de la table utilisés dans les tests). */
function windows1252(text: string): Uint8Array {
  const specials: Record<string, number> = { "€": 0x80, œ: 0x9c, Œ: 0x8c, "’": 0x92 };
  return Uint8Array.from([...text].map((c) => specials[c] ?? c.charCodeAt(0)));
}

const utf8 = (text: string) => new TextEncoder().encode(text);

const withBom = (bytes: Uint8Array) => Uint8Array.from([0xef, 0xbb, 0xbf, ...bytes]);

function utf16le(text: string): Uint8Array {
  const bytes = [0xff, 0xfe];
  for (const char of text) {
    const code = char.charCodeAt(0);
    bytes.push(code & 0xff, code >> 8);
  }
  return Uint8Array.from(bytes);
}

/** Classeur Excel généré par SheetJS. */
function workbook(rows: unknown[][], bookType: "xlsx" | "biff8" = "xlsx", sheetName = "Adhérents") {
  const book = utils.book_new();
  utils.book_append_sheet(book, utils.aoa_to_sheet(rows), sheetName);
  return new Uint8Array(write(book, { type: "array", bookType }) as ArrayBuffer);
}

const CSV = [
  "Nom;Prénom;Téléphone;Date de naissance",
  "Éluard;Zoé;06 11 22 33 44;05/01/2015",
  "Cœur;Léa;0622334455;12/03/2016",
].join("\r\n");

describe("decodeText", () => {
  it("lit l'UTF-8 sans BOM", () => {
    expect(decodeText(utf8("Prénom;Zoé"))).toEqual({
      text: "Prénom;Zoé",
      encoding: "utf-8",
      bom: false,
    });
  });

  it("retire le BOM UTF-8", () => {
    expect(decodeText(withBom(utf8("Prénom")))).toEqual({
      text: "Prénom",
      encoding: "utf-8",
      bom: true,
    });
  });

  it("reconnaît le Windows-1252 (y compris œ et €, absents du Latin-1)", () => {
    expect(decodeText(windows1252("Cœur;Léa;10 €"))).toEqual({
      text: "Cœur;Léa;10 €",
      encoding: "windows-1252",
      bom: false,
    });
  });

  it("lit l'UTF-16 avec BOM (« Texte Unicode » d'Excel)", () => {
    const decoded = decodeText(utf16le("Nom\tPrénom"));
    expect(decoded).toMatchObject({ text: "Nom\tPrénom", encoding: "utf-16le" });
    const be = decodeText(Uint8Array.from([0xfe, 0xff, 0x00, 0x41]));
    expect(be).toMatchObject({ text: "A", encoding: "utf-16be" });
  });
});

describe("detectDelimiter", () => {
  it("reconnaît le point-virgule, la virgule et la tabulation", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter("a,b,c\n1,2,3")).toBe(",");
    expect(detectDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t");
  });

  it("ignore les séparateurs entre guillemets et préfère le plus régulier", () => {
    expect(detectDelimiter('Nom,Adresse\nMartin,"12; rue des Lilas"\nDurand,"3; place"')).toBe(",");
    expect(detectDelimiter("Nom;Ville\nMartin;Senlis, Oise\nDurand;Chantilly")).toBe(";");
  });

  it("prend le point-virgule par défaut", () => {
    expect(detectDelimiter("")).toBe(";");
    expect(detectDelimiter("Nom\nMartin")).toBe(";");
  });

  it("décrit les séparateurs et les encodages", () => {
    expect(delimiterLabel(";")).toBe("« ; »");
    expect(delimiterLabel("\t")).toBe("tabulation");
    expect(encodingLabel("utf-8", true)).toBe("UTF-8 (avec BOM)");
    expect(encodingLabel("utf-8", false)).toBe("UTF-8");
    expect(encodingLabel("utf-16le", true)).toBe("UTF-16");
    expect(encodingLabel("windows-1252", false)).toBe("Windows-1252");
  });
});

describe("readImportFile (CSV)", () => {
  it("lit un CSV UTF-8 séparé par des points-virgules", () => {
    const table = readImportFile(utf8(CSV), "eleves.csv");
    expect(table.format).toEqual({ kind: "csv", encoding: "utf-8", bom: false, delimiter: ";" });
    expect(table.headers).toEqual(["Nom", "Prénom", "Téléphone", "Date de naissance"]);
    expect(table.rows).toEqual([
      { line: 2, cells: ["Éluard", "Zoé", "06 11 22 33 44", "05/01/2015"] },
      { line: 3, cells: ["Cœur", "Léa", "0622334455", "12/03/2016"] },
    ]);
  });

  it("lit un CSV Windows-1252 avec accents", () => {
    const table = readImportFile(windows1252(CSV), "eleves.csv");
    expect(table.format).toMatchObject({ encoding: "windows-1252", delimiter: ";" });
    expect(table.rows[1]?.cells.slice(0, 2)).toEqual(["Cœur", "Léa"]);
  });

  it("lit un CSV UTF-8 avec BOM séparé par des virgules, avec guillemets", () => {
    const text = 'Nom,Prénom,Groupe\r\n"Martin","Léa","Galaxie vert, mercredi"\r\n';
    const table = readImportFile(withBom(utf8(text)));
    expect(table.format).toEqual({ kind: "csv", encoding: "utf-8", bom: true, delimiter: "," });
    expect(table.rows).toEqual([{ line: 2, cells: ["Martin", "Léa", "Galaxie vert, mercredi"] }]);
  });

  it("lit un fichier séparé par des tabulations", () => {
    const table = readImportFile(utf8("Nom\tPrénom\nMartin\tLéa\n"), "eleves.txt");
    expect(table.format).toMatchObject({ delimiter: "\t" });
    expect(table.rows[0]?.cells).toEqual(["Martin", "Léa"]);
  });

  it("ignore les lignes vides et complète les cellules manquantes", () => {
    const text = ";;\nNom;;Nom\n\nMartin;Léa\n;;\nDurand;Tom;x;extra\n";
    const table = readImportFile(utf8(text));
    expect(table.headers).toEqual(["Nom", "Colonne B", "Nom (2)", "Colonne D"]);
    expect(table.rows).toEqual([
      { line: 4, cells: ["Martin", "Léa", "", ""] },
      { line: 6, cells: ["Durand", "Tom", "x", "extra"] },
    ]);
  });

  it("refuse un fichier vide ou sans données", () => {
    expect(() => readImportFile(new Uint8Array())).toThrow("Le fichier est vide.");
    expect(() => readImportFile(utf8("\n;;\n"))).toThrow("Le fichier est vide.");
    expect(() => readImportFile(utf8("Nom;Prénom\n"))).toThrow(ImportFileError);
  });

  it("limite le nombre de lignes", () => {
    const raw = [["Nom"], ...Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => [`N${i}`])];
    expect(() => toTable({ kind: "xlsx", sheetName: "A" }, raw)).toThrow(/au maximum/);
  });
});

describe("readImportFile (Excel)", () => {
  it("lit le premier onglet d'un classeur .xlsx, dates et nombres compris", () => {
    const bytes = workbook([
      ["Nom", "Prénom", "Téléphone", "Date de naissance", "Licencié", "Classement"],
      // SheetJS écrit les dates en heure locale, comme Excel.
      ["Éluard", "Zoé", 611223344, new Date(2015, 0, 5), true, "30/2"],
      [],
      ["Cœur", "Léa", "06 22 33 44 55", null, false, 15.4],
    ]);
    const table = readImportFile(bytes, "export.xlsx");
    expect(table.format).toEqual({ kind: "xlsx", sheetName: "Adhérents" });
    expect(table.headers[0]).toBe("Nom");
    expect(table.rows).toEqual([
      { line: 2, cells: ["Éluard", "Zoé", "611223344", "2015-01-05", "VRAI", "30/2"] },
      { line: 4, cells: ["Cœur", "Léa", "06 22 33 44 55", "", "FAUX", "15.4"] },
    ]);
  });

  it("lit un classeur .xls (BIFF8)", () => {
    const table = readImportFile(
      workbook(
        [
          ["Nom", "Prénom"],
          ["Martin", "Léa"],
        ],
        "biff8",
      ),
    );
    expect(table.format).toEqual({ kind: "xls", sheetName: "Adhérents" });
    expect(table.rows[0]?.cells).toEqual(["Martin", "Léa"]);
  });

  it("conserve la numérotation des lignes quand la feuille ne commence pas en A1", () => {
    const book = utils.book_new();
    const sheet = utils.sheet_add_aoa({}, [["Nom"], ["Martin"]], { origin: "B3" });
    utils.book_append_sheet(book, sheet, "Feuil1");
    const bytes = new Uint8Array(write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
    const table = readImportFile(bytes);
    expect(table.headers).toEqual(["Colonne A", "Nom"]);
    expect(table.rows).toEqual([{ line: 4, cells: ["", "Martin"] }]);
  });

  it("signale un classeur endommagé ou vide", () => {
    const broken = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5]);
    expect(() => parseSpreadsheet(broken)).toThrow(ImportFileError);
    const book = utils.book_new();
    utils.book_append_sheet(book, {}, "Vide");
    const empty = new Uint8Array(write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
    expect(() => readImportFile(empty)).toThrow("Le fichier est vide.");
  });

  it("détecte le type de fichier par sa signature, sinon par son extension", () => {
    expect(spreadsheetKind(Uint8Array.from([0x50, 0x4b, 0x03, 0x04]))).toBe("xlsx");
    expect(spreadsheetKind(Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))).toBe(
      "xls",
    );
    expect(spreadsheetKind(utf8("a"), "LISTE.XLSX")).toBe("xlsx");
    expect(spreadsheetKind(utf8("a"), "liste.xls")).toBe("xls");
    expect(spreadsheetKind(utf8("a"), "liste.csv")).toBeNull();
  });
});

describe("utilitaires", () => {
  it("convertit les numéros de série Excel en dates", () => {
    expect(excelSerialToIso(45000)).toBe("2023-03-15");
    expect(excelSerialToIso(42009)).toBe("2015-01-05");
    expect(excelSerialToIso(42009.75)).toBe("2015-01-05");
    // Calendrier 1904 (anciens classeurs Mac) : 1 462 jours de décalage.
    expect(excelSerialToIso(42009 - 1462, true)).toBe("2015-01-05");
    expect(excelSerialToIso(-1)).toBeNull();
  });

  it("lit les dates d'un classeur au calendrier 1904", () => {
    const book = utils.book_new();
    const sheet = utils.aoa_to_sheet([
      ["Nom", "Date de naissance"],
      ["Martin", 40547],
    ]);
    const cell = sheet.B2 as { z?: string };
    cell.z = "dd/mm/yyyy";
    utils.book_append_sheet(book, sheet, "Feuil1");
    book.Workbook = { WBProps: { date1904: true } };
    const bytes = new Uint8Array(write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
    expect(readImportFile(bytes).rows[0]?.cells).toEqual(["Martin", "2015-01-05"]);
  });

  it("nomme les colonnes comme Excel", () => {
    expect([0, 1, 25, 26, 27, 701, 702].map(columnLetter)).toEqual([
      "A",
      "B",
      "Z",
      "AA",
      "AB",
      "ZZ",
      "AAA",
    ]);
  });

  it("décrit le format détecté", () => {
    expect(
      describeFormat({ kind: "csv", encoding: "windows-1252", bom: false, delimiter: ";" }),
    ).toBe("CSV, séparateur « ; », encodage Windows-1252");
    expect(describeFormat({ kind: "xlsx", sheetName: "Adhérents" })).toBe(
      "Classeur Excel (.xlsx), onglet « Adhérents »",
    );
  });
});
