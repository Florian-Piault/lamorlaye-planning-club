import { describe, expect, it } from "vitest";
import type { Lesson } from "@/db/schema";
import {
  lessonsToCarryOver,
  nextSeasonName,
  nextSeasonValues,
  nextYearDate,
  planSeasonDuplication,
  type SeasonSnapshot,
  summarizeDuplication,
} from "./seasonDuplication";

const T = "2026-08-01T00:00:00.000Z";
const stamps = { createdAt: T, updatedAt: T };

function lesson(id: string, from: string, to: string | null, extra: Partial<Lesson> = {}): Lesson {
  return {
    id,
    seasonId: "s1",
    weekday: 1,
    startTime: "17:00",
    durationMinutes: 60,
    courtId: "c1",
    groupId: "g1",
    instructorId: "i1",
    effectiveFrom: from,
    effectiveTo: to,
    previousLessonId: null,
    note: null,
    ...stamps,
    ...extra,
  };
}

const snapshot: SeasonSnapshot = {
  courts: [
    {
      id: "c1",
      seasonId: "s1",
      name: "Court 1",
      kind: "indoor",
      sortOrder: 0,
      active: true,
      ...stamps,
    },
  ],
  instructors: [
    {
      id: "i1",
      seasonId: "s1",
      lastName: "Martin",
      firstName: "Julie",
      phone: null,
      email: null,
      color: "#1D4ED8",
      initials: "JM",
      active: true,
      ...stamps,
    },
  ],
  availabilities: [
    { id: "a1", instructorId: "i1", weekday: 1, startTime: "16:00", endTime: "21:00", ...stamps },
    {
      id: "a2",
      instructorId: "autre",
      weekday: 2,
      startTime: "16:00",
      endTime: "21:00",
      ...stamps,
    },
  ],
  groups: [
    {
      id: "g1",
      seasonId: "s1",
      name: "Galaxie",
      levelId: "niveau",
      minAge: 6,
      maxAge: 8,
      maxSize: 8,
      active: true,
      ...stamps,
    },
  ],
  students: [
    {
      id: "e1",
      seasonId: "s1",
      lastName: "Dupont",
      firstName: "Léa",
      phone: "0600000000",
      birthDate: null,
      levelId: null,
      fftRanking: null,
      email: null,
      guardianName: null,
      guardianPhone: null,
      ...stamps,
    },
  ],
  studentAvailabilities: [
    { id: "d1", studentId: "e1", weekday: 3, startTime: "14:00", endTime: "18:00", ...stamps },
    { id: "d2", studentId: "inconnu", weekday: 6, startTime: "09:00", endTime: "12:00", ...stamps },
  ],
  memberships: [
    { groupId: "g1", studentId: "e1" },
    { groupId: "g1", studentId: "inconnu" },
  ],
  lessons: [
    lesson("l1", "2026-09-01", null),
    lesson("l2", "2026-09-01", "2027-01-03"),
    lesson("l3", "2027-01-04", null, { previousLessonId: "l2", note: "v2" }),
    lesson("l4", "2026-09-01", null, { courtId: "court-d-une-autre-saison" }),
  ],
};

function sequence() {
  let n = 0;
  return { newId: () => `n${++n}`, now: () => "2027-07-01T00:00:00.000Z" };
}

describe("versions de cours reprises", () => {
  it("ne garde que les versions en vigueur le dernier jour de la saison", () => {
    expect(lessonsToCarryOver(snapshot.lessons, "2027-06-30").map((l) => l.id)).toEqual([
      "l1",
      "l3",
      "l4",
    ]);
    expect(lessonsToCarryOver(snapshot.lessons, "2026-12-31").map((l) => l.id)).toEqual([
      "l1",
      "l2",
      "l4",
    ]);
  });
});

describe("planSeasonDuplication", () => {
  const plan = planSeasonDuplication(
    snapshot,
    "2027-06-30",
    { seasonId: "s2", startDate: "2027-09-01" },
    sequence(),
  );

  it("attribue de nouveaux identifiants et rattache tout à la nouvelle saison", () => {
    expect(plan.courts).toEqual([
      {
        ...snapshot.courts[0],
        id: "n1",
        seasonId: "s2",
        createdAt: "2027-07-01T00:00:00.000Z",
        updatedAt: "2027-07-01T00:00:00.000Z",
      },
    ]);
    expect(plan.instructors[0]).toMatchObject({ id: "n2", seasonId: "s2", initials: "JM" });
    expect(plan.groups[0]).toMatchObject({ id: "n3", seasonId: "s2", levelId: "niveau" });
    expect(plan.students[0]).toMatchObject({ id: "n4", seasonId: "s2", firstName: "Léa" });
  });

  it("réécrit les références et ignore celles hors de la saison d'origine", () => {
    expect(plan.availabilities).toEqual([
      expect.objectContaining({ instructorId: "n2", weekday: 1, startTime: "16:00" }),
    ]);
    expect(plan.studentAvailabilities).toEqual([
      expect.objectContaining({
        studentId: "n4",
        weekday: 3,
        startTime: "14:00",
        endTime: "18:00",
      }),
    ]);
    expect(plan.memberships).toEqual([expect.objectContaining({ groupId: "n3", studentId: "n4" })]);
    expect(
      plan.lessons.map((l) => [
        l.courtId,
        l.groupId,
        l.instructorId,
        l.note,
        l.effectiveFrom,
        l.effectiveTo,
        l.previousLessonId,
        l.seasonId,
      ]),
    ).toEqual([
      ["n1", "n3", "n2", null, "2027-09-01", null, null, "s2"],
      ["n1", "n3", "n2", "v2", "2027-09-01", null, null, "s2"],
    ]);
    const ids = [
      ...plan.availabilities,
      ...plan.studentAvailabilities,
      ...plan.memberships,
      ...plan.lessons,
    ].map((r) => r.id);
    expect(ids).not.toContain("d1");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("résume la duplication", () => {
    expect(summarizeDuplication(snapshot, plan)).toEqual({
      courts: 1,
      instructors: 1,
      groups: 1,
      students: 1,
      lessons: 2,
      skippedLessons: 2,
    });
  });

  it("produit des UUID par défaut", () => {
    const fresh = planSeasonDuplication(snapshot, "2027-06-30", {
      seasonId: "s2",
      startDate: "2027-09-01",
    });
    expect(fresh.courts[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(fresh.courts[0]?.id).not.toBe("c1");
  });
});

describe("saison suivante proposée", () => {
  it("décale les dates d'un an", () => {
    expect(nextYearDate("2026-09-01")).toBe("2027-09-01");
    expect(nextYearDate("2028-02-29")).toBe("2029-02-28");
  });

  it("propose le nom suivant", () => {
    expect(nextSeasonName("2026-2027")).toBe("2027-2028");
    expect(nextSeasonName("2026/2027")).toBe("2027/2028");
    expect(nextSeasonName("Saison été ")).toBe("Saison été (suite)");
  });

  it("reprend les réglages d'affichage", () => {
    const source = {
      name: "2026-2027",
      startDate: "2026-09-01",
      endDate: "2027-06-30",
      displayStartTime: "09:00",
      displayEndTime: "21:00",
      displayedDays: [1, 2, 3],
    };
    const values = nextSeasonValues(source);
    expect(values).toEqual({
      name: "2027-2028",
      startDate: "2027-09-01",
      endDate: "2028-06-30",
      displayStartTime: "09:00",
      displayEndTime: "21:00",
      displayedDays: [1, 2, 3],
    });
    expect(values.displayedDays).not.toBe(source.displayedDays);
  });
});
