import { describe, expect, it } from "vitest";
import { OUTPUT_COURTS, OUTPUT_GROUPS, OUTPUT_INSTRUCTORS, OUTPUT_STATE } from "@/test/outputs";
import { exception, lesson, SEASON } from "@/test/planning";
import { instructorHours, minutesOf } from "./hours";
import {
  buildHoursReport,
  hoursLabel,
  monthPeriod,
  periodProblem,
  previousMonthPeriod,
  seasonPeriod,
} from "./hoursReport";
import type { PlanningSource } from "./occurrences";

const source: PlanningSource = { ...OUTPUT_STATE, season: SEASON };
const refs = { instructors: OUTPUT_INSTRUCTORS, groups: OUTPUT_GROUPS, courts: OUTPUT_COURTS };

describe("périodes du récapitulatif", () => {
  it("propose le mois en cours, le mois précédent et la saison", () => {
    expect(monthPeriod("2026-11-15")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(monthPeriod("2027-02-10")).toEqual({ from: "2027-02-01", to: "2027-02-28" });
    expect(previousMonthPeriod("2027-01-15")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
    expect(seasonPeriod(SEASON)).toEqual({ from: "2026-09-01", to: "2027-06-30" });
  });

  it("vérifie la période saisie", () => {
    expect(periodProblem({ from: "2026-11-01", to: "2026-11-30" })).toBeNull();
    expect(periodProblem({ from: "", to: "2026-11-30" })).toBe(
      "Saisissez une date de début et une date de fin.",
    );
    expect(periodProblem({ from: "2026-12-01", to: "2026-11-30" })).toBe(
      "La date de fin précède la date de début.",
    );
  });

  it("affiche les durées", () => {
    expect(hoursLabel(0)).toBe("0 h");
    expect(hoursLabel(90)).toBe("1 h 30");
  });
});

describe("récapitulatif des heures", () => {
  /**
   * Du 15/10 au 15/11/2026 : vacances de la Toussaint (17/10 → 01/11), stage
   * de 3 h le 21/10, séance du 04/11 annulée, Marc remplace Karim le 07/11.
   */
  const period = { from: "2026-10-15", to: "2026-11-15" };

  it("correspond au moteur sur une période avec vacances, annulation et remplacement", () => {
    const report = buildHoursReport(source, refs, period);
    const engine = instructorHours(source, period.from, period.to);
    for (const line of report.lines) {
      expect(line.minutes).toBe(minutesOf(engine, line.instructorId));
    }
    // Julie : stage (3 h) + mercredi 11/11 (1 h 30) ; 21/10 et 28/10 fermés, 04/11 annulé.
    // Karim : samedi 14/11 (1 h) ; 07/11 remplacé. Marc : samedi 07/11 (1 h).
    expect(report.lines.map((l) => [l.initials, l.sessions, l.minutes])).toEqual([
      ["KB", 1, 60],
      ["ML", 1, 60],
      ["JM", 2, 270],
    ]);
    expect(report.totalMinutes).toBe(390);
    expect(report.totalSessions).toBe(4);
    expect(report.period).toEqual(period);
  });

  it("détaille les séances de chaque moniteur", () => {
    const report = buildHoursReport(source, refs, { from: "2026-10-15", to: "2026-11-30" });
    const julie = report.lines.find((l) => l.initials === "JM");
    expect(julie?.details).toEqual([
      {
        key: "ponctuel:stage",
        date: "2026-10-21",
        weekday: 3,
        startTime: "09:00",
        endTime: "12:00",
        minutes: 180,
        groupName: "Cours ponctuel",
        courtName: "Court 1",
        remark: "Cours ponctuel",
      },
      expect.objectContaining({ date: "2026-11-11", groupName: "Galaxie vert", remark: "" }),
      expect.objectContaining({
        date: "2026-11-18",
        startTime: "16:00",
        remark: "Séance modifiée",
      }),
      expect.objectContaining({ date: "2026-11-25" }),
    ]);
    const marc = report.lines.find((l) => l.initials === "ML");
    expect(marc?.details[0]).toMatchObject({
      date: "2026-11-07",
      remark: "Remplace KB",
      courtName: "Court central extérieur",
    });
  });

  it("garde les moniteurs actifs sans séance et ignore les inactifs sans séance", () => {
    const report = buildHoursReport(source, refs, { from: "2026-10-19", to: "2026-10-20" });
    expect(report.lines.map((l) => [l.initials, l.minutes])).toEqual([
      ["KB", 0],
      ["ML", 0],
      ["JM", 0],
    ]);
    expect(report.totalMinutes).toBe(0);
  });

  it("compte un moniteur inactif qui a assuré des séances, même avec des références inconnues", () => {
    const report = buildHoursReport(
      {
        lessons: [lesson({ id: "x", instructorId: "m4", groupId: "?", courtId: "?" })],
        exceptions: [
          exception({
            id: "r",
            kind: "replacement",
            lessonId: "x",
            occurrenceDate: "2026-11-04",
            instructorId: "m1",
          }),
        ],
        closures: [],
        season: SEASON,
      },
      { ...refs, instructors: [...OUTPUT_INSTRUCTORS.filter((i) => i.id !== "m4")] },
      { from: "2026-11-02", to: "2026-11-15" },
    );
    expect(report.lines.find((l) => l.initials === "JM")?.details[0]).toMatchObject({
      groupName: "—",
      courtName: "—",
      remark: "Remplace ?",
    });
    const withInactive = buildHoursReport(
      { lessons: [lesson({ id: "x", instructorId: "m4" })], exceptions: [], closures: [] },
      refs,
      { from: "2026-11-02", to: "2026-11-08" },
    );
    expect(withInactive.lines.map((l) => l.initials)).toEqual(["KB", "ML", "JM", "AA"]);
  });
});
