import { describe, expect, it } from "vitest";
import { isoWeekday } from "./dates";
import {
  closureProposals,
  easterSunday,
  proposalClosureLabel,
  publicHolidays,
  publicHolidaysBetween,
  SCHOOL_CALENDAR,
  type SchoolCalendar,
} from "./schoolCalendar";
import { isValidDate } from "./time";

const season = { startDate: "2026-09-01", endDate: "2027-06-30" };

describe("jours fériés", () => {
  it("calcule le dimanche de Pâques", () => {
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
    expect(easterSunday(2028)).toBe("2028-04-16");
    expect(easterSunday(2019)).toBe("2019-04-21");
    expect(easterSunday(2038)).toBe("2038-04-25");
  });

  it("liste les 11 jours fériés, dont Pâques, l'Ascension et la Pentecôte", () => {
    expect(publicHolidays(2027)).toEqual([
      { date: "2027-01-01", label: "Jour de l'an" },
      { date: "2027-03-29", label: "Lundi de Pâques" },
      { date: "2027-05-01", label: "Fête du Travail" },
      { date: "2027-05-06", label: "Ascension" },
      { date: "2027-05-08", label: "Victoire 1945" },
      { date: "2027-05-17", label: "Lundi de Pentecôte" },
      { date: "2027-07-14", label: "Fête nationale" },
      { date: "2027-08-15", label: "Assomption" },
      { date: "2027-11-01", label: "Toussaint" },
      { date: "2027-11-11", label: "Armistice 1918" },
      { date: "2027-12-25", label: "Noël" },
    ]);
    expect(isoWeekday("2027-05-06")).toBe(4);
    expect(isoWeekday("2027-05-17")).toBe(1);
  });

  it("filtre les jours fériés d'une période sur plusieurs années", () => {
    expect(publicHolidaysBetween(season.startDate, season.endDate).map((h) => h.date)).toEqual([
      "2026-11-01",
      "2026-11-11",
      "2026-12-25",
      "2027-01-01",
      "2027-03-29",
      "2027-05-01",
      "2027-05-06",
      "2027-05-08",
      "2027-05-17",
    ]);
  });
});

describe("calendrier scolaire embarqué", () => {
  it("contient des dates valides, dans l'ordre, du samedi ou d'un jour de reprise", () => {
    for (const year of SCHOOL_CALENDAR.years) {
      expect(year.source).toMatch(/Arrêté/);
      for (const period of year.periods) {
        expect(isValidDate(period.start)).toBe(true);
        if (period.end !== null) {
          expect(isValidDate(period.end)).toBe(true);
          expect(period.end >= period.start).toBe(true);
        }
      }
    }
    expect(SCHOOL_CALENDAR.zone).toBe("B");
  });
});

describe("assistant de pré-remplissage des fermetures", () => {
  it("propose les vacances de la zone B 2026-2027 et les jours fériés de la saison", () => {
    const proposals = closureProposals(season, []);
    const school = proposals.filter((p) => p.kind === "school");
    expect(school.map((p) => [p.label, p.startDate, p.endDate, p.inSeason])).toEqual([
      ["Vacances de la Toussaint", "2026-10-17", "2026-11-01", true],
      ["Vacances de Noël", "2026-12-19", "2027-01-03", true],
      ["Vacances d'hiver", "2027-02-20", "2027-03-07", true],
      ["Vacances de printemps", "2027-04-17", "2027-05-02", true],
      ["Pont de l'Ascension", "2027-05-06", "2027-05-09", true],
      ["Vacances d'été", "2027-07-03", "2027-09-01", false],
    ]);
    // Les vacances tombent un samedi et la reprise un lundi.
    for (const p of school)
      expect(isoWeekday(p.startDate)).toBe(p.label.includes("Ascension") ? 4 : 6);
    expect(school.find((p) => p.label === "Vacances d'été")?.selected).toBe(false);

    const toussaint = proposals.find((p) => p.id === "ferie:2026-11-01");
    expect(toussaint).toMatchObject({ duringHolidays: true, selected: false });
    const armistice = proposals.find((p) => p.id === "ferie:2026-11-11");
    expect(armistice).toMatchObject({
      label: "Armistice 1918",
      selected: true,
      detail: "Jour férié — 11/11/2026",
    });
    expect(proposals.find((p) => p.id === "ferie:2027-05-06")?.duringHolidays).toBe(true);
    expect(proposals.find((p) => p.id === "ferie:2027-05-17")?.selected).toBe(true);
    // Triées par date.
    const dates = proposals.map((p) => p.startDate);
    expect(dates).toEqual([...dates].sort());
  });

  it("borne les vacances à la saison et ignore les années sans recouvrement", () => {
    // Rentrée 2027 : jeudi 2 septembre ; les vacances d'été 2027 se terminent la veille.
    const proposals = closureProposals({ startDate: "2027-09-02", endDate: "2028-07-31" }, []);
    expect(proposals.some((p) => p.id.startsWith("2026-2027"))).toBe(false);
    expect(
      closureProposals({ startDate: "2027-09-01", endDate: "2028-07-31" }, []).find(
        (p) => p.id === "2026-2027:ete",
      ),
    ).toMatchObject({ startDate: "2027-09-01", endDate: "2027-09-01", inSeason: true });
    expect(proposals.find((p) => p.id === "2027-2028:hiver")).toMatchObject({
      startDate: "2028-02-05",
      endDate: "2028-02-20",
    });
    // Fin non publiée : jusqu'à la fin de la saison.
    expect(proposals.find((p) => p.id === "2027-2028:ete")).toMatchObject({
      startDate: "2028-07-05",
      endDate: "2028-07-31",
      inSeason: true,
    });
    const short = closureProposals({ startDate: "2026-10-20", endDate: "2026-12-31" }, []);
    expect(short.find((p) => p.id === "2026-2027:toussaint")).toMatchObject({
      startDate: "2026-10-20",
      endDate: "2026-11-01",
    });
    expect(short.find((p) => p.id === "2026-2027:noel")).toMatchObject({
      startDate: "2026-12-19",
      endDate: "2026-12-31",
    });
  });

  it("décoche ce qu'une fermeture existante couvre déjà", () => {
    const proposals = closureProposals(season, [
      { startDate: "2026-10-17", endDate: "2026-11-01" },
      { startDate: "2026-11-11", endDate: "2026-11-11" },
    ]);
    expect(proposals.find((p) => p.id === "2026-2027:toussaint")).toMatchObject({
      existing: true,
      selected: false,
    });
    expect(proposals.find((p) => p.id === "ferie:2026-11-11")?.existing).toBe(true);
    expect(proposals.find((p) => p.id === "2026-2027:noel")?.selected).toBe(true);
  });

  it("accepte un autre calendrier et donne le libellé de la fermeture", () => {
    const calendar: SchoolCalendar = {
      updatedOn: "2026-01-01",
      zone: "B",
      years: [
        {
          schoolYear: "2030-2031",
          source: "Arrêté fictif",
          periods: [
            { key: "x", label: "Vacances X", official: "", start: "2030-10-19", end: null },
          ],
        },
      ],
    };
    const proposals = closureProposals(
      { startDate: "2026-09-01", endDate: "2026-12-31" },
      [],
      calendar,
    );
    expect(proposals.every((p) => p.kind === "public_holiday")).toBe(true);
    expect(proposalClosureLabel({ kind: "public_holiday", label: "Noël" })).toBe("Noël (férié)");
    expect(proposalClosureLabel({ kind: "school", label: "Vacances X" })).toBe("Vacances X");
  });
});
