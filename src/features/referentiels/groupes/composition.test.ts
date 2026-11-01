import { describe, expect, it } from "vitest";
import type { WeeklySlot } from "@/domain/availability";
import type { LessonRecord } from "@/domain/occurrences";
import {
  blockingLessons,
  blockingText,
  groupLessonRanges,
  rankCandidates,
  unavailableMembersMessage,
} from "./composition";

const season = { startDate: "2026-09-01", endDate: "2027-06-30" };

function lesson(overrides: Partial<LessonRecord>): LessonRecord {
  return {
    id: "l",
    weekday: 3,
    startTime: "14:00",
    durationMinutes: 60,
    courtId: "c",
    groupId: "g",
    instructorId: "i",
    effectiveFrom: season.startDate,
    effectiveTo: null,
    ...overrides,
  } as LessonRecord;
}

const slot = (weekday: number, startTime: string, endTime: string): WeeklySlot => ({
  weekday,
  startTime,
  endTime,
});

describe("cours du groupe au planning habituel", () => {
  // Le cours du mercredi 14:00 passe au samedi 10:00 à partir du 02/11/2026 (« Appliquer à partir de »).
  const before = lesson({ id: "v1", effectiveTo: "2026-11-01" });
  const after = lesson({
    id: "v2",
    weekday: 6,
    startTime: "10:00",
    effectiveFrom: "2026-11-02",
    previousLessonId: "v1",
  } as Partial<LessonRecord>);
  const wednesdayOnly = [slot(3, "13:00", "18:00")];

  it("ne retient que la version en vigueur à la date du jour", () => {
    expect(groupLessonRanges([before, after], season, "2026-10-14").map((l) => l.label)).toEqual([
      "mercredi 14:00–15:00",
    ]);
    const now = groupLessonRanges([before, after], season, "2026-11-04");
    expect(now.map((l) => l.label)).toEqual(["samedi 10:00–11:00"]);
    // Un élève libre le mercredi seulement coince sur la nouvelle version, pas sur l'ancienne.
    expect(blockingLessons(wednesdayOnly, now)).toEqual(["samedi 10:00–11:00"]);
  });

  it("ramène la date dans la saison, comme la grille", () => {
    // Avant la saison : versions du premier jour ; après : versions du dernier.
    expect(groupLessonRanges([before, after], season, "2026-07-14").map((l) => l.label)).toEqual([
      "mercredi 14:00–15:00",
    ]);
    expect(groupLessonRanges([before, after], season, "2027-08-01").map((l) => l.label)).toEqual([
      "samedi 10:00–11:00",
    ]);
  });

  it("joint dans la bulle tous les cours qui coincent", () => {
    const ranges = groupLessonRanges(
      [lesson({ id: "a" }), lesson({ id: "b", weekday: 6, startTime: "10:00" })],
      season,
      "2026-11-04",
    );
    expect(blockingText(blockingLessons([slot(1, "09:00", "12:00")], ranges))).toBe(
      "Hors disponibilités : mercredi 14:00–15:00, samedi 10:00–11:00",
    );
    expect(blockingLessons([slot(3, "14:00", "15:00")], ranges)).toEqual(["samedi 10:00–11:00"]);
  });
});

describe("élèves proposés par la recherche", () => {
  const names = ["Ada", "Bob", "Cyd", "Dan", "Eve", "Fay", "Gus", "Hal", "Ian", "Jo"];
  const blocked = new Set(["Ada", "Cyd", "Dan"]);
  const ranked = rankCandidates(names, (n) => !blocked.has(n), 8);

  it("trie avant de couper : un compatible 9e par ordre alphabétique reste proposé", () => {
    expect(ranked).toHaveLength(8);
    expect(ranked).toContain("Ian");
    expect(ranked).toContain("Jo");
  });

  it("garde l'ordre reçu dans chaque catégorie", () => {
    expect(ranked).toEqual(["Bob", "Eve", "Fay", "Gus", "Hal", "Ian", "Jo", "Ada"]);
    expect(rankCandidates(names, (n) => !blocked.has(n), 20).slice(-3)).toEqual([
      "Ada",
      "Cyd",
      "Dan",
    ]);
  });
});

describe("alerte des membres hors disponibilités", () => {
  it("ne dit rien sans membre incompatible", () => {
    expect(unavailableMembersMessage([])).toBeNull();
  });

  it("accorde le nombre", () => {
    expect(unavailableMembersMessage([{ firstName: "Léa", lastName: "Martin" }])).toBe(
      "1 élève hors disponibilités : Léa Martin",
    );
    expect(
      unavailableMembersMessage([
        { firstName: "Léa", lastName: "Martin" },
        { firstName: "Tom", lastName: "Petit" },
      ]),
    ).toBe("2 élèves hors disponibilités : Léa Martin, Tom Petit");
  });

  it("trie par nom puis prénom, accents compris", () => {
    expect(
      unavailableMembersMessage([
        { firstName: "Paul", lastName: "Faure" },
        { firstName: "Zoé", lastName: "Émery" },
        { firstName: "Anne", lastName: "Émery" },
      ]),
    ).toBe("3 élèves hors disponibilités : Anne Émery, Zoé Émery, Paul Faure");
  });
});
