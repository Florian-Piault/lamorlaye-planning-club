import { describe, expect, it } from "vitest";
import { closure, exception, lesson, SEASON } from "@/test/planning";
import {
  hoursByInstructor,
  instructorHours,
  minutesOf,
  toDecimalHours,
  weekInstructorHours,
} from "./hours";
import type { PlanningSource } from "./occurrences";

/**
 * Novembre 2026 : M1 assure le cours du mercredi (1 h 30) et M2 celui du
 * samedi (1 h). Mercredis : 4, 11, 18, 25 ; samedis : 7, 14, 21, 28.
 */
const source = (overrides: Partial<PlanningSource> = {}): PlanningSource => ({
  lessons: [
    lesson({ id: "mer", weekday: 3, durationMinutes: 90, instructorId: "m1" }),
    lesson({ id: "sam", weekday: 6, startTime: "10:00", instructorId: "m2" }),
  ],
  exceptions: [],
  closures: [],
  season: SEASON,
  ...overrides,
});

describe("récapitulatif des heures", () => {
  it("additionne les séances de la période", () => {
    const hours = instructorHours(source(), "2026-11-01", "2026-11-30");
    expect(minutesOf(hours, "m1")).toBe(4 * 90);
    expect(minutesOf(hours, "m2")).toBe(4 * 60);
    expect(hours.find((h) => h.instructorId === "m1")?.sessions).toBe(4);
    expect(minutesOf(hours, "inconnu")).toBe(0);
  });

  it("exclut fermetures et annulations, crédite le remplaçant, inclut les cours ponctuels", () => {
    const exceptions = [
      // Annulation du mercredi 18/11.
      exception({
        id: "ann",
        kind: "cancellation",
        lessonId: "mer",
        occurrenceDate: "2026-11-18",
        cancellationReason: "rain",
      }),
      // M3 remplace M2 le samedi 21/11.
      exception({
        id: "rem",
        kind: "replacement",
        lessonId: "sam",
        occurrenceDate: "2026-11-21",
        instructorId: "m3",
      }),
      // Remplacement suivi d'une annulation le samedi 28/11 : personne n'est crédité.
      exception({
        id: "rem2",
        kind: "replacement",
        lessonId: "sam",
        occurrenceDate: "2026-11-28",
        instructorId: "m3",
      }),
      exception({
        id: "ann2",
        kind: "cancellation",
        lessonId: "sam",
        occurrenceDate: "2026-11-28",
        cancellationReason: "instructor_absent",
      }),
      // Stage de 3 h pendant la fermeture, assuré par M1.
      exception({
        id: "stage",
        kind: "one_off",
        date: "2026-11-12",
        startTime: "09:00",
        durationMinutes: 180,
        courtId: "c1",
        instructorId: "m1",
      }),
      // Cours ponctuel sans moniteur : ignoré.
      exception({
        id: "libre",
        kind: "one_off",
        date: "2026-11-13",
        startTime: "09:00",
        durationMinutes: 60,
      }),
    ];
    // Fermeture du mercredi 11 au samedi 14 novembre.
    const closures = [closure({ id: "f", startDate: "2026-11-11", endDate: "2026-11-14" })];
    const hours = instructorHours(source({ exceptions, closures }), "2026-11-01", "2026-11-30");
    // M1 : 4/11 et 25/11 (11/11 fermé, 18/11 annulé) + stage de 3 h.
    expect(minutesOf(hours, "m1")).toBe(2 * 90 + 180);
    // M2 : 7/11 seulement (14/11 fermé, 21/11 remplacé, 28/11 annulé).
    expect(minutesOf(hours, "m2")).toBe(60);
    expect(minutesOf(hours, "m3")).toBe(60);
    expect(hours.find((h) => h.instructorId === "m1")?.occurrences.map((o) => o.date)).toEqual([
      "2026-11-04",
      "2026-11-12",
      "2026-11-25",
    ]);
  });

  it("calcule les heures de la semaine, y compris celle du changement d'heure", () => {
    const lessons = [
      lesson({ id: "sam", weekday: 6, instructorId: "m1" }),
      lesson({
        id: "dim",
        weekday: 7,
        startTime: "10:00",
        durationMinutes: 120,
        instructorId: "m1",
      }),
    ];
    // Semaine du 19/10/2026 (retour à l'heure d'hiver le dimanche 25/10).
    expect(minutesOf(weekInstructorHours(source({ lessons }), "2026-10-21"), "m1")).toBe(180);
    // Semaine du 22/03/2027 (passage à l'heure d'été le dimanche 28/03).
    expect(minutesOf(weekInstructorHours(source({ lessons }), "2027-03-28"), "m1")).toBe(180);
  });

  it("compte les heures sur la saison entière", () => {
    const hours = instructorHours(source(), SEASON.startDate, SEASON.endDate);
    // 44 mercredis (du 02/09/2026 au 30/06/2027) et 43 samedis (du 05/09 au 26/06).
    expect(hours.find((h) => h.instructorId === "m1")?.sessions).toBe(44);
    expect(minutesOf(hours, "m2")).toBe(43 * 60);
    expect(hoursByInstructor([])).toEqual([]);
  });

  it("convertit en heures décimales", () => {
    expect(toDecimalHours(90)).toBe(1.5);
    expect(toDecimalHours(100)).toBe(1.67);
  });
});
