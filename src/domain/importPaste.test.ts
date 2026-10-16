import { describe, expect, it } from "vitest";
import { describeFormat, ImportFileError, parsePastedText, readPastedText } from "./importFile";
import { guessMapping, looksLikeHeaderRow } from "./studentImport";

/**
 * Lecture d'un tableau collé depuis un tableur (« Coller depuis Excel », spec
 * UX v1.1). Les jeux reproduisent le texte que chaque tableur dépose dans le
 * presse-papiers : cellules séparées par des tabulations, lignes par CRLF
 * (Windows), LF (macOS, Linux) ou CR (anciens Excel pour Mac), cellule
 * multiligne ou contenant des guillemets entourée de guillemets, retour à la
 * ligne final.
 */

/** Excel sous Windows : CRLF, cellule multiligne (Alt+Entrée) en LF entre guillemets. */
const EXCEL_WINDOWS =
  "Nom\tPrénom\tTél. portable\tDate de naissance\tGroupe\r\n" +
  'Martin\tLéa\t06 11 22 33 44\t12/03/2017\t"Galaxie vert\nMini-tennis"\r\n' +
  "Durand\tTom\t622334455\t\t\r\n";

/** Excel pour Mac (récent) : LF ; cellule contenant des guillemets doublés. */
const EXCEL_MAC =
  "Nom\tPrénom\tTéléphone\n" +
  'Martin\t"Léa ""Lili"""\t06 11 22 33 44\n' +
  "Durand\tTom\t0622334455\n";

/** Ancien Excel pour Mac : lignes séparées par CR seul. */
const EXCEL_MAC_CR = "Nom\tPrénom\tTéléphone\rMartin\tLéa\t0611223344\rDurand\tTom\t0622334455\r";

/** LibreOffice Calc sous Linux : LF, cellule multiligne en LF, tabulation dans une cellule. */
const LIBREOFFICE_LINUX =
  "Nom\tPrénom\tResponsable légal\tGroupe\n" +
  'Martin\tLéa\t"Paul Martin\n06 99 88 77 66"\tGalaxie vert\n' +
  'Durand\tTom\t"tab\there"\t\n';

/** Collage sans ligne d'en-têtes (la sélection commence au premier élève). */
const WITHOUT_HEADERS =
  "Martin\tLéa\t06 11 22 33 44\tGalaxie vert\r\n" +
  "Durand\tTom\t0622334455\tGalaxie vert\r\n" +
  "Petit\tZoé\t\t\r\n";

describe("parsePastedText", () => {
  it("lit un collage d'Excel sous Windows (CRLF, cellule multiligne)", () => {
    const { delimiter, rows } = parsePastedText(EXCEL_WINDOWS);
    expect(delimiter).toBe("\t");
    expect(rows.slice(0, 3)).toEqual([
      ["Nom", "Prénom", "Tél. portable", "Date de naissance", "Groupe"],
      // Les lignes d'une cellule deviennent « , » : deux groupes.
      ["Martin", "Léa", "06 11 22 33 44", "12/03/2017", "Galaxie vert, Mini-tennis"],
      ["Durand", "Tom", "622334455", "", ""],
    ]);
  });

  it("lit les fins de ligne LF et CR seul, et les guillemets doublés", () => {
    expect(parsePastedText(EXCEL_MAC).rows[1]).toEqual(["Martin", 'Léa "Lili"', "06 11 22 33 44"]);
    expect(parsePastedText(EXCEL_MAC_CR).rows.slice(0, 3)).toEqual([
      ["Nom", "Prénom", "Téléphone"],
      ["Martin", "Léa", "0611223344"],
      ["Durand", "Tom", "0622334455"],
    ]);
    expect(parsePastedText(LIBREOFFICE_LINUX).rows.slice(1, 3)).toEqual([
      ["Martin", "Léa", "Paul Martin, 06 99 88 77 66", "Galaxie vert"],
      ["Durand", "Tom", "tab\there", ""],
    ]);
  });

  it("détecte le séparateur d'un texte sans tabulation (CSV copié)", () => {
    const { delimiter, rows } = parsePastedText("﻿Nom;Prénom\nMartin;Léa\n");
    expect(delimiter).toBe(";");
    expect(rows[0]).toEqual(["Nom", "Prénom"]);
  });
});

describe("readPastedText", () => {
  it("lit un collage avec en-têtes : mêmes en-têtes, mêmes lignes qu'un fichier", () => {
    const table = readPastedText(EXCEL_WINDOWS, looksLikeHeaderRow);
    expect(table.headerRow).toBe(true);
    expect(table.format).toEqual({ kind: "pasted", delimiter: "\t" });
    expect(table.headers).toEqual([
      "Nom",
      "Prénom",
      "Tél. portable",
      "Date de naissance",
      "Groupe",
    ]);
    expect(table.rows).toEqual([
      {
        line: 2,
        cells: ["Martin", "Léa", "06 11 22 33 44", "12/03/2017", "Galaxie vert, Mini-tennis"],
      },
      { line: 3, cells: ["Durand", "Tom", "622334455", "", ""] },
    ]);
    // Même correspondance automatique que pour un fichier.
    expect(guessMapping(table.headers)).toMatchObject({
      lastName: 0,
      firstName: 1,
      phone: 2,
      birthDate: 3,
      groups: 4,
    });
    for (const text of [EXCEL_MAC, EXCEL_MAC_CR, LIBREOFFICE_LINUX]) {
      const other = readPastedText(text, looksLikeHeaderRow);
      expect(other.headerRow).toBe(true);
      expect(other.rows).toHaveLength(2);
    }
  });

  it("lit un collage sans en-têtes : colonnes A, B… et première ligne gardée", () => {
    const table = readPastedText(WITHOUT_HEADERS, looksLikeHeaderRow);
    expect(table.headerRow).toBe(false);
    expect(table.headers).toEqual(["Colonne A", "Colonne B", "Colonne C", "Colonne D"]);
    expect(table.rows).toEqual([
      { line: 1, cells: ["Martin", "Léa", "06 11 22 33 44", "Galaxie vert"] },
      { line: 2, cells: ["Durand", "Tom", "0622334455", "Galaxie vert"] },
      { line: 3, cells: ["Petit", "Zoé", "", ""] },
    ]);
    // Aucune correspondance devinée : les colonnes sont associées à la main.
    expect(Object.values(guessMapping(table.headers)).every((c) => c === null)).toBe(true);
  });

  it("suit le choix de l'utilisatrice (case « La première ligne contient des élèves »)", () => {
    // En-têtes non reconnus, considérés comme une ligne d'élèves puis rétablis.
    const text = "Adhérent\tTél\r\nMartin Léa\t0611223344\r\n";
    expect(readPastedText(text, looksLikeHeaderRow).headerRow).toBe(true);
    const forced = readPastedText(text, false);
    expect(forced.headers).toEqual(["Colonne A", "Colonne B"]);
    expect(forced.rows).toHaveLength(2);
    expect(readPastedText(WITHOUT_HEADERS, true).headers).toEqual([
      "Martin",
      "Léa",
      "06 11 22 33 44",
      "Galaxie vert",
    ]);
  });

  it("refuse un collage vide ou réduit à ses en-têtes", () => {
    expect(() => readPastedText("  \r\n\t\r\n")).toThrow("Le tableau collé est vide.");
    expect(() => readPastedText("\t\r\n\t\r\n")).toThrow(ImportFileError);
    expect(() => readPastedText("Nom\tPrénom\r\n", looksLikeHeaderRow)).toThrow(
      "Le tableau collé ne contient aucune ligne après la ligne d'en-tête.",
    );
  });

  it("décrit le collage", () => {
    expect(describeFormat({ kind: "pasted", delimiter: "\t" })).toBe(
      "Tableau collé, séparateur tabulation",
    );
  });
});
