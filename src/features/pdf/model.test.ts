import { describe, expect, it } from "vitest";
import { OUTPUT_REFS, OUTPUT_SEASON, OUTPUT_STATE, OUTPUT_STUDENTS } from "@/test/outputs";
import { exception, lesson } from "@/test/planning";
import {
  buildAttendanceSheets,
  buildInstructorSheets,
  buildWeekSheet,
  courtHeading,
  fullName,
  pdfFileNames,
  slug,
  tint,
  type WeekContext,
  weekItems,
  weekTitle,
} from "./model";

const context = (overrides: Partial<WeekContext> = {}): WeekContext => ({
  season: OUTPUT_SEASON,
  state: OUTPUT_STATE,
  refs: OUTPUT_REFS,
  mode: { kind: "dated", monday: "2026-11-02" },
  today: "2026-10-15",
  ...overrides,
});

describe("libellés des documents", () => {
  it("met en forme les titres et les noms de fichiers", () => {
    expect(fullName({ firstName: "Julie", lastName: "Martin" })).toBe("Julie Martin");
    expect(weekTitle({ kind: "type" }, OUTPUT_SEASON)).toBe("Semaine type — saison 2026-2027");
    expect(weekTitle({ kind: "dated", monday: "2026-11-02" }, OUTPUT_SEASON)).toBe(
      "Semaine du 02/11/2026 au 08/11/2026",
    );
    expect(slug("  Galaxie Vert — Été 2027 ! ")).toBe("galaxie-vert-ete-2027");
    expect(pdfFileNames.week({ kind: "type" }, OUTPUT_SEASON, "A3")).toBe(
      "planning-semaine-type-2026-2027-a3.pdf",
    );
    expect(pdfFileNames.week({ kind: "dated", monday: "2026-11-02" }, OUTPUT_SEASON, "A4")).toBe(
      "planning-semaine-2026-11-02-a4.pdf",
    );
    expect(
      pdfFileNames.instructors({ kind: "type" }, OUTPUT_SEASON, {
        firstName: "Hélène",
        lastName: "Lefèvre",
      }),
    ).toBe("planning-helene-lefevre-semaine-type-2026-2027.pdf");
    expect(pdfFileNames.instructors({ kind: "dated", monday: "2026-11-02" }, OUTPUT_SEASON)).toBe(
      "planning-moniteurs-semaine-2026-11-02.pdf",
    );
    expect(pdfFileNames.attendance(OUTPUT_SEASON, { name: "Galaxie vert" })).toBe(
      "feuille-appel-galaxie-vert.pdf",
    );
    expect(pdfFileNames.attendance(OUTPUT_SEASON)).toBe("feuilles-appel-2026-2027.pdf");
  });

  it("abrège les noms de courts trop longs et éclaircit les couleurs", () => {
    expect(courtHeading("Court 1", 0)).toBe("Court 1");
    expect(courtHeading("Court central extérieur", 1)).toBe("C2");
    expect(tint("#1D4ED8")).toBe("#CDD8F6");
    expect(tint("#000000", 0.5)).toBe("#808080");
    expect(tint("bleu")).toBe("#F1F5F9");
  });
});

describe("planning de la semaine", () => {
  it("dessine la semaine type : cours en vigueur, légende des heures", () => {
    const sheet = buildWeekSheet(context({ mode: { kind: "type" } }));
    expect(sheet.title).toBe("Planning — semaine type");
    expect(sheet.subtitle).toBe("Semaine type — saison 2026-2027");
    expect(sheet.days.map((d) => d.label)).toEqual([
      "Lundi",
      "Mardi",
      "Mercredi",
      "Jeudi",
      "Vendredi",
      "Samedi",
    ]);
    expect(sheet.days.every((d) => d.closure === null)).toBe(true);
    expect(sheet.courts).toEqual([
      { id: "c1", label: "Court 1" },
      { id: "c2", label: "C2" },
    ]);
    expect(sheet.ticks).toEqual([
      480, 540, 600, 660, 720, 780, 840, 900, 960, 1020, 1080, 1140, 1200,
    ]);
    const mer = sheet.blocks.find((b) => b.id === "mer");
    expect(mer).toMatchObject({
      dayIndex: 2,
      courtIndex: 0,
      top: 0.5,
      height: 90 / 720,
      left: 0,
      width: 1,
      initials: "JM",
      groupName: "Galaxie vert",
      time: "14:00–15:30",
      size: "3/8",
      color: "#1D4ED8",
      background: "#CDD8F6",
      cancelled: false,
      tag: null,
    });
    expect(sheet.legend).toEqual([
      { initials: "KB", name: "Karim Benali", color: "#C2410C", minutes: 60, hours: "1 h" },
      { initials: "JM", name: "Julie Martin", color: "#1D4ED8", minutes: 90, hours: "1 h 30" },
    ]);
    expect(sheet.totalHours).toBe("2 h 30");
    expect(sheet.notes).toHaveLength(1);
  });

  it("affiche une semaine datée avec annulation et remplacement, écrits en toutes lettres", () => {
    const sheet = buildWeekSheet(context());
    expect(sheet.title).toBe("Planning de la semaine");
    expect(sheet.days[0]?.label).toBe("Lundi 02/11");
    const cancelled = sheet.blocks.find((b) => b.cancelled);
    expect(cancelled).toMatchObject({ initials: "JM", tag: "ANNULÉ", background: "#FFFFFF" });
    const replaced = sheet.blocks.find((b) => b.initials === "ML");
    expect(replaced).toMatchObject({ tag: "Rempl. KB", groupName: "Adultes débutants" });
    // Seule la séance assurée compte : Marc, 1 h.
    expect(sheet.legend.map((e) => `${e.initials} ${e.hours}`)).toEqual(["ML 1 h"]);
    expect(sheet.totalHours).toBe("1 h");
    expect(sheet.notes).toHaveLength(2);
  });

  it("indique les fermetures, les cours ponctuels et les séances modifiées", () => {
    const vacances = buildWeekSheet(context({ mode: { kind: "dated", monday: "2026-10-19" } }));
    expect(vacances.days.map((d) => d.closure)).toEqual(
      Array(6).fill("Fermé — Vacances de la Toussaint"),
    );
    expect(vacances.blocks).toHaveLength(1);
    expect(vacances.blocks[0]).toMatchObject({
      groupName: "Cours ponctuel",
      tag: "Ponctuel",
      size: "",
      time: "09:00–12:00",
    });
    expect(vacances.totalHours).toBe("3 h");

    const deplacee = buildWeekSheet(context({ mode: { kind: "dated", monday: "2026-11-16" } }));
    expect(deplacee.blocks.find((b) => b.initials === "JM")).toMatchObject({
      tag: "Modifié",
      time: "16:00–17:30",
    });
  });

  it("place côte à côte les cours qui se chevauchent et signale les références inconnues", () => {
    const state = {
      ...OUTPUT_STATE,
      lessons: [
        lesson({ id: "a", weekday: 1, startTime: "10:00" }),
        lesson({ id: "b", weekday: 1, startTime: "10:30", instructorId: "inconnu", groupId: "x" }),
      ],
    };
    const sheet = buildWeekSheet(context({ state, mode: { kind: "type" } }));
    const [a, b] = ["a", "b"].map((id) => sheet.blocks.find((x) => x.id === id));
    expect(a).toMatchObject({ left: 0, width: 0.5 });
    expect(b).toMatchObject({
      left: 0.5,
      width: 0.5,
      initials: "?",
      groupName: "Groupe inconnu",
      size: "",
      color: "#64748B",
    });
  });

  it("retient la version des cours en vigueur à la date du jour en semaine type", () => {
    const state = {
      ...OUTPUT_STATE,
      lessons: [
        lesson({ id: "v1", effectiveTo: "2026-12-31" }),
        lesson({ id: "v2", effectiveFrom: "2027-01-01", startTime: "16:00" }),
      ],
    };
    const ids = (today: string) =>
      weekItems({ season: OUTPUT_SEASON, state, mode: { kind: "type" }, today }).map((i) => i.id);
    expect(ids("2026-10-15")).toEqual(["v1"]);
    expect(ids("2027-02-01")).toEqual(["v2"]);
    // Hors saison : ramené dans la saison.
    expect(ids("2027-08-01")).toEqual(["v2"]);
  });
});

describe("planning par moniteur", () => {
  it("liste les séances de chaque moniteur, avec annulations et remplacements barrés", () => {
    const sheets = buildInstructorSheets(context());
    expect(sheets.map((s) => s.title)).toEqual([
      "Karim Benali (KB)",
      "Marc Leroy (ML)",
      "Julie Martin (JM)",
    ]);
    const [karim, marc, julie] = sheets;
    expect(karim?.sessions).toEqual([
      {
        key: "sam@2026-11-07",
        day: "Samedi 07/11/2026",
        time: "10:00–11:00",
        duration: "1 h",
        court: "Court central extérieur",
        group: "Adultes débutants",
        size: "2/6",
        remarks: "Remplacé(e) par Marc Leroy · Prévoir les balles",
        struck: true,
      },
    ]);
    expect(karim).toMatchObject({
      totalHours: "0 h",
      sessionCount: 0,
      subtitle: "Semaine du 02/11/2026 au 08/11/2026",
    });
    expect(marc?.sessions[0]).toMatchObject({
      remarks: "Remplace KB · Prévoir les balles",
      struck: false,
    });
    expect(marc).toMatchObject({ totalHours: "1 h", sessionCount: 1 });
    expect(julie?.sessions[0]).toMatchObject({ remarks: "Annulé : Pluie", struck: true });
  });

  it("produit la page d'un moniteur choisi, même sans séance", () => {
    const [anne] = buildInstructorSheets(context(), ["m4"]);
    expect(anne).toMatchObject({ title: "Anne Ancienne (AA)", sessions: [], totalHours: "0 h" });

    const vacances = buildInstructorSheets(
      context({ mode: { kind: "dated", monday: "2026-10-19" } }),
      ["m1"],
    );
    expect(vacances[0]?.sessions[0]).toMatchObject({
      group: "Cours ponctuel",
      court: "Court 1",
      size: "",
      remarks: "Cours ponctuel",
      struck: false,
    });

    const deplacee = buildInstructorSheets(
      context({ mode: { kind: "dated", monday: "2026-11-16" } }),
      ["m1"],
    );
    expect(deplacee[0]?.sessions[0]?.remarks).toBe("Modifié cette semaine");

    const type = buildInstructorSheets(context({ mode: { kind: "type" } }), ["m1"]);
    expect(type[0]).toMatchObject({
      subtitle: "Semaine type — saison 2026-2027",
      totalHours: "1 h 30",
    });
    expect(type[0]?.sessions[0]?.day).toBe("Mercredi");
  });

  it("signale un remplacement suivi d'une annulation", () => {
    const state = {
      ...OUTPUT_STATE,
      exceptions: [
        ...OUTPUT_STATE.exceptions,
        exception({
          id: "pluie-samedi",
          kind: "cancellation",
          lessonId: "sam",
          occurrenceDate: "2026-11-07",
          cancellationReason: "rain",
        }),
      ],
    };
    const [karim] = buildInstructorSheets(context({ state }), ["m2"]);
    expect(karim?.sessions[0]?.remarks).toBe(
      "Remplacé(e) par Marc Leroy · Annulé · Prévoir les balles",
    );
  });
});

describe("feuilles d'appel", () => {
  const input = {
    season: OUTPUT_SEASON,
    lessons: OUTPUT_STATE.lessons,
    refs: OUTPUT_REFS,
    students: OUTPUT_STUDENTS,
    today: "2026-10-15",
  };

  it("liste les élèves de chaque groupe actif, par ordre alphabétique", () => {
    const sheets = buildAttendanceSheets(input);
    expect(sheets.map((s) => s.title)).toEqual(["Adultes débutants", "Galaxie vert"]);
    const galaxie = sheets[1];
    expect(galaxie).toMatchObject({
      details: "Niveau : Vert · 6 à 8 ans · 3 élèves / 8 places · Saison 2026-2027",
      slots: ["Mercredi 14:00–15:30 · Court 1 · JM (Julie Martin)"],
      blankRows: 5,
      columns: 10,
    });
    expect(galaxie?.rows).toEqual([
      {
        index: 1,
        name: "BERNARD Tom",
        phone: "06 00 00 00 02",
        birthDate: "03/01/2017",
        guardian: "Paul Bernard",
      },
      {
        index: 2,
        name: "DURAND Zoé",
        phone: "06 11 22 33 44",
        birthDate: "12/05/2018",
        guardian: "Claire Durand — 06 99 88 77 66",
      },
      { index: 3, name: "ÉLUARD Léa", phone: "06 00 00 00 01", birthDate: "", guardian: "" },
    ]);
    expect(sheets[0]?.details).toBe("18 ans et plus · 2 élèves / 6 places · Saison 2026-2027");
  });

  it("produit la feuille d'un groupe choisi, même vide ou archivé", () => {
    const lessons = [
      ...OUTPUT_STATE.lessons,
      lesson({ id: "ancien", groupId: "g3", courtId: "x", instructorId: "y", weekday: 2 }),
    ];
    const [ancien] = buildAttendanceSheets({ ...input, lessons, groupIds: ["g3"] });
    expect(ancien).toMatchObject({
      title: "Ancien groupe",
      details: "jusqu'à 12 ans · 0 élève / 4 places · Saison 2026-2027",
      slots: ["Mardi 14:00–15:00 · Court inconnu · Moniteur inconnu"],
      rows: [],
      blankRows: 4,
    });
  });
});
