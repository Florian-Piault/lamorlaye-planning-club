import { describe, expect, it } from "vitest";
import { weekOccurrences } from "@/domain/occurrences";
import { closure, exception, lesson, SEASON } from "@/test/planning";
import {
  activeItems,
  clampWeek,
  closedDays,
  datedItems,
  datedMode,
  dateOfMode,
  dayHeading,
  itemSlot,
  lessonItem,
  shortDate,
  TYPE_MODE,
  toCandidate,
  weekButtonLabel,
  weekNeighbours,
} from "./items";

describe("modes de l'écran Planning", () => {
  it("ramène une date au lundi de sa semaine", () => {
    expect(datedMode("2026-11-04")).toEqual({ kind: "dated", monday: "2026-11-02" });
    expect(dateOfMode(TYPE_MODE)(3)).toBeNull();
    expect(dateOfMode(datedMode("2026-11-04"))(3)).toBe("2026-11-04");
    expect(dateOfMode(datedMode("2026-11-04"))(7)).toBe("2026-11-08");
  });

  it("libelle le mode et les jours", () => {
    expect(shortDate("2026-11-02")).toBe("02/11");
    expect(weekButtonLabel("2026-11-02")).toBe("Semaine du 02/11");
    expect(dayHeading(TYPE_MODE, 1)).toBe("Lundi");
    expect(dayHeading(datedMode("2026-11-02"), 3)).toBe("Mercredi 04/11");
  });

  it("navigue entre les semaines de la saison", () => {
    // Le 01/09/2026 est un mardi : la première semaine commence le lundi 31/08.
    expect(clampWeek(SEASON, "2026-07-01")).toBe("2026-08-31");
    expect(clampWeek(SEASON, "2027-08-01")).toBe("2027-06-28");
    expect(clampWeek(SEASON, "2026-11-04")).toBe("2026-11-02");
    expect(weekNeighbours(SEASON, "2026-11-02")).toEqual({
      previous: "2026-10-26",
      next: "2026-11-09",
    });
    expect(weekNeighbours(SEASON, "2026-08-31")).toEqual({ previous: null, next: "2026-09-07" });
    expect(weekNeighbours(SEASON, "2027-06-28")).toEqual({ previous: "2027-06-21", next: null });
  });
});

describe("éléments de la grille", () => {
  it("convertit un cours de la semaine type", () => {
    const item = lessonItem(lesson({ note: "balles" }));
    expect(item).toMatchObject({
      id: "cours",
      kind: "lesson",
      lessonId: "cours",
      date: null,
      weekday: 3,
      start: 14 * 60,
      durationMinutes: 60,
      cancelled: false,
      note: "balles",
    });
    expect(toCandidate(item)).toEqual({
      id: "cours",
      weekday: 3,
      start: 840,
      durationMinutes: 60,
      courtId: "c1",
      groupId: "g1",
      instructorId: "m1",
    });
    expect(itemSlot(item)).toMatchObject({ id: "cours", date: null, start: 840, end: 900 });
  });

  it("convertit les séances datées, masque celles suspendues par une fermeture", () => {
    const source = {
      lessons: [lesson(), lesson({ id: "lundi", weekday: 1 })],
      exceptions: [
        exception({
          id: "annul",
          kind: "cancellation",
          lessonId: "cours",
          occurrenceDate: "2026-11-04",
          cancellationReason: "rain",
        }),
        exception({
          id: "stage",
          kind: "one_off",
          date: "2026-11-02",
          startTime: "10:00",
          durationMinutes: 120,
          courtId: "c2",
          instructorId: "m2",
        }),
      ],
      closures: [
        closure({ id: "f", label: "Armistice", startDate: "2026-11-02", endDate: "2026-11-02" }),
      ],
      season: SEASON,
    };
    const items = datedItems(weekOccurrences(source, "2026-11-04"));
    expect(items.map((i) => [i.id, i.kind, i.cancelled])).toEqual([
      ["ponctuel:stage", "one_off", false],
      ["cours@2026-11-04", "regular", true],
    ]);
    expect(items[1]).toMatchObject({ lessonId: "cours", date: "2026-11-04", startTime: "14:00" });
    expect(itemSlot(items[0] as never)).toMatchObject({ date: "2026-11-02", end: 720 });
    expect(activeItems(items).map((i) => i.id)).toEqual(["ponctuel:stage"]);

    const mode = datedMode("2026-11-04");
    expect(closedDays(mode, [1, 2, 3], source.closures)).toEqual([
      { weekday: 1, date: "2026-11-02", label: "Fermé — Armistice" },
    ]);
    expect(closedDays(TYPE_MODE, [1, 2, 3], source.closures)).toEqual([]);
  });
});
