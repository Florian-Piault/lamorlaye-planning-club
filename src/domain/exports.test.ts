import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { OUTPUT_COURTS, OUTPUT_GROUPS, OUTPUT_INSTRUCTORS, OUTPUT_STATE } from "@/test/outputs";
import { lesson, SEASON } from "@/test/planning";
import {
  csvBytes,
  csvCell,
  type DataTable,
  groupsTable,
  hoursDetailTable,
  hoursSummaryTable,
  lessonsTable,
  studentsTable,
  toCsv,
  xlsxBytes,
} from "./exports";
import { buildHoursReport } from "./hoursReport";

const refs = {
  courts: OUTPUT_COURTS,
  groups: OUTPUT_GROUPS,
  instructors: OUTPUT_INSTRUCTORS,
};

const table: DataTable = {
  sheetName: "Essai",
  headers: ["Nom", "Heures"],
  rows: [
    ["Léa", 1.5],
    ['Dupont; "Jo"', null],
  ],
};

describe("sérialisation", () => {
  it("met en forme les cellules CSV", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(12)).toBe("12");
    expect(csvCell(1.75)).toBe("1,75");
    expect(csvCell("simple")).toBe("simple");
    expect(csvCell("a;b")).toBe('"a;b"');
    expect(csvCell('dit "oui"')).toBe('"dit ""oui"""');
    expect(csvCell("deux\nlignes")).toBe('"deux\nlignes"');
    expect(csvCell(" espace")).toBe('" espace"');
  });

  it("produit un CSV UTF-8 avec BOM, séparé par des points-virgules", () => {
    expect(toCsv(table)).toBe('Nom;Heures\r\nLéa;1,5\r\n"Dupont; ""Jo""";\r\n');
    const bytes = csvBytes(table);
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes)).toBe(toCsv(table));
  });

  it("produit un classeur Excel, un onglet par tableau", async () => {
    const bytes = await xlsxBytes([
      table,
      { ...table, sheetName: "Un nom d'onglet beaucoup trop long" },
    ]);
    const book = XLSX.read(bytes, { type: "array" });
    expect(book.SheetNames).toEqual(["Essai", "Un nom d'onglet beaucoup trop l"]);
    const rows = XLSX.utils.sheet_to_json(book.Sheets.Essai as XLSX.WorkSheet, { header: 1 });
    expect(rows).toEqual([["Nom", "Heures"], ["Léa", 1.5], ['Dupont; "Jo"']]);
  });
});

describe("tableaux exportés", () => {
  it("exporte les cours de la semaine type avec leurs dates d'effet", () => {
    const lessons = [
      ...OUTPUT_STATE.lessons,
      lesson({
        id: "v2",
        weekday: 3,
        startTime: "14:00",
        effectiveFrom: "2027-01-04",
        effectiveTo: "2027-03-31",
      }),
      lesson({ id: "x", weekday: 1, courtId: "?", groupId: "?", instructorId: "?" }),
    ];
    const result = lessonsTable(lessons, refs);
    expect(result.headers).toHaveLength(11);
    expect(result.rows).toEqual([
      ["Lundi", "14:00", "15:00", 60, "", "", "", "", "01/09/2026", "", null],
      [
        "Mercredi",
        "14:00",
        "15:30",
        90,
        "Court 1",
        "Galaxie vert",
        "Julie Martin",
        "JM",
        "01/09/2026",
        "",
        null,
      ],
      [
        "Mercredi",
        "14:00",
        "15:00",
        60,
        "Court 1",
        "Galaxie vert",
        "Julie Martin",
        "JM",
        "04/01/2027",
        "31/03/2027",
        null,
      ],
      [
        "Samedi",
        "10:00",
        "11:00",
        60,
        "Court central extérieur",
        "Adultes débutants",
        "Karim Benali",
        "KB",
        "01/09/2026",
        "",
        "Prévoir les balles",
      ],
    ]);
  });

  it("exporte les groupes avec leurs créneaux", () => {
    const result = groupsTable(
      OUTPUT_GROUPS,
      [
        ...OUTPUT_STATE.lessons,
        lesson({ id: "x", weekday: 1, groupId: "g1", courtId: "?", instructorId: "?" }),
      ],
      refs,
    );
    expect(result.rows).toEqual([
      [
        "Adultes débutants",
        null,
        18,
        null,
        2,
        6,
        "oui",
        "Samedi 10:00–11:00 (Court central extérieur, KB)",
      ],
      [
        "Galaxie vert",
        "Vert",
        6,
        8,
        3,
        8,
        "oui",
        "Lundi 14:00–15:00 (?, ?) ; Mercredi 14:00–15:30 (Court 1, JM)",
      ],
      ["Ancien groupe", null, null, 12, 0, 4, "non", ""],
    ]);
  });

  it("exporte les élèves avec leurs groupes", () => {
    const result = studentsTable([
      {
        lastName: "Durand",
        firstName: "Zoé",
        phone: "06 11 22 33 44",
        birthDate: "2018-05-12",
        levelLabel: "Vert",
        fftRanking: null,
        email: "zoe@example.org",
        guardianName: "Claire Durand",
        guardianPhone: "06 99 88 77 66",
        groups: [{ name: "Galaxie vert" }, { name: "Mini-tennis" }],
      },
      {
        lastName: "Martin",
        firstName: "Anne",
        phone: "06 00 00 00 03",
        birthDate: null,
        levelLabel: null,
        fftRanking: "30/2",
        email: null,
        guardianName: null,
        guardianPhone: null,
        groups: [],
      },
    ]);
    expect(result.headers[0]).toBe("Nom");
    expect(result.rows).toEqual([
      [
        "Durand",
        "Zoé",
        "06 11 22 33 44",
        "12/05/2018",
        "Vert",
        null,
        "zoe@example.org",
        "Claire Durand",
        "06 99 88 77 66",
        "Galaxie vert, Mini-tennis",
      ],
      ["Martin", "Anne", "06 00 00 00 03", "", null, "30/2", null, null, null, ""],
    ]);
  });

  it("exporte le récapitulatif et le détail des heures", () => {
    const report = buildHoursReport({ ...OUTPUT_STATE, season: SEASON }, refs, {
      from: "2026-10-15",
      to: "2026-11-15",
    });
    const summary = hoursSummaryTable(report);
    expect(summary.rows).toEqual([
      ["Karim Benali", "KB", 1, 60, 1, "15/10/2026 → 15/11/2026"],
      ["Marc Leroy", "ML", 1, 60, 1, "15/10/2026 → 15/11/2026"],
      ["Julie Martin", "JM", 2, 270, 4.5, "15/10/2026 → 15/11/2026"],
      ["Total", "", 4, 390, 6.5, "15/10/2026 → 15/11/2026"],
    ]);
    expect(toCsv(summary).split("\r\n")[4]).toBe("Total;;4;390;6,5;15/10/2026 → 15/11/2026");

    const detail = hoursDetailTable(report);
    expect(detail.rows).toHaveLength(4);
    expect(detail.rows[1]).toEqual([
      "Marc Leroy",
      "ML",
      "07/11/2026",
      "Samedi",
      "10:00",
      "11:00",
      1,
      "Adultes débutants",
      "Court central extérieur",
      "Remplace KB",
    ]);
  });
});
