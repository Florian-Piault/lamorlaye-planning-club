import { describe, expect, it } from "vitest";
import { closure, exception, lesson, SEASON } from "@/test/planning";
import {
  type ConflictReferences,
  conflictList,
  createConflictIndex,
  detectConflicts,
  detectSlotConflicts,
  type PlanningSlot,
  slotFromLesson,
  slotsFromOccurrences,
  slotsOverlap,
} from "./conflicts";
import { weekOccurrences } from "./occurrences";

const allWeek = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
  weekday,
  startTime: "08:00",
  endTime: "22:00",
}));

const refs: ConflictReferences = {
  courts: [
    { id: "c1", name: "Court 1" },
    { id: "c2", name: "Court 2" },
  ],
  instructors: [
    { id: "m1", firstName: "Karim", availabilities: allWeek, unavailabilities: [] },
    {
      id: "m2",
      firstName: "Marc",
      availabilities: [{ weekday: 3, startTime: "09:00", endTime: "16:00" }],
      unavailabilities: [{ startsAt: "2026-11-04T00:00", endsAt: "2026-11-05T00:00" }],
    },
    { id: "m3", firstName: "Léa", availabilities: allWeek, unavailabilities: [] },
  ],
  groups: [
    { id: "g1", name: "Galaxie vert", maxSize: 8, minAge: 8, maxAge: 10 },
    { id: "g2", name: "Galaxie jaune", maxSize: 2, minAge: null, maxAge: null },
    { id: "g3", name: "Adultes", maxSize: 6, minAge: null, maxAge: null },
  ],
  students: [
    { id: "e1", firstName: "Léa", lastName: "Martin", birthDate: "2017-03-01", availabilities: [] },
    { id: "e2", firstName: "Tom", lastName: "Petit", birthDate: "2016-05-01", availabilities: [] },
    { id: "e3", firstName: "Zoé", lastName: "Roux", birthDate: "2020-01-01", availabilities: [] },
    { id: "e4", firstName: "Hugo", lastName: "Blanc", birthDate: null, availabilities: [] },
  ],
  memberships: [
    { groupId: "g1", studentId: "e1" },
    { groupId: "g1", studentId: "e2" },
    { groupId: "g1", studentId: "e3" },
    { groupId: "g2", studentId: "e1" },
    { groupId: "g2", studentId: "e2" },
    { groupId: "g2", studentId: "e4" },
  ],
  referenceDate: SEASON.startDate,
};

const index = createConflictIndex(refs);

const slot = (overrides: Partial<PlanningSlot> & Pick<PlanningSlot, "id">): PlanningSlot => ({
  date: null,
  weekday: 3,
  start: 14 * 60,
  end: 15 * 60,
  courtId: "c1",
  groupId: "g3",
  instructorId: "m1",
  ...overrides,
});

const messages = (conflicts: Map<string, { message: string }[]>, id: string) =>
  (conflicts.get(id) ?? []).map((c) => c.message);

describe("chevauchements", () => {
  it("compare jour et intervalle semi-ouvert", () => {
    const a = slot({ id: "a" });
    expect(slotsOverlap(a, slot({ id: "b", start: 14 * 60 + 30, end: 16 * 60 }))).toBe(true);
    expect(slotsOverlap(a, slot({ id: "b", start: 15 * 60, end: 16 * 60 }))).toBe(false);
    expect(slotsOverlap(a, slot({ id: "b", weekday: 4 }))).toBe(false);
    expect(slotsOverlap(a, a)).toBe(false);
    expect(
      slotsOverlap(slot({ id: "a", date: "2026-11-04" }), slot({ id: "b", date: "2026-11-11" })),
    ).toBe(false);
  });
});

describe("les sept contrôles", () => {
  it("1. court déjà occupé", () => {
    const conflicts = detectConflicts(
      [
        slot({ id: "a", groupId: "g3", start: 14 * 60, end: 15 * 60 + 30 }),
        slot({ id: "b", groupId: "g3", instructorId: "m3", start: 15 * 60, end: 16 * 60 }),
      ],
      index,
    );
    expect(messages(conflicts, "a")).toEqual(["Court 1 déjà occupé par Adultes (15h00–16h00)"]);
    expect(messages(conflicts, "b")).toEqual(["Court 1 déjà occupé par Adultes (14h00–15h30)"]);
    expect(conflicts.get("a")?.[0]).toMatchObject({ kind: "court_occupied", slotIds: ["b"] });
  });

  it("1 bis. court occupé par un cours ponctuel sans groupe ou un groupe inconnu", () => {
    const conflicts = detectConflicts(
      [
        slot({ id: "a" }),
        slot({ id: "b", groupId: null, instructorId: "m3" }),
        slot({ id: "c", groupId: "inconnu", instructorId: null, courtId: "c1" }),
      ],
      index,
    );
    expect(messages(conflicts, "a")).toEqual([
      "Court 1 déjà occupé par un cours ponctuel (14h00–15h00)",
      "Court 1 déjà occupé par un autre cours (14h00–15h00)",
    ]);
  });

  it("2. moniteur ayant déjà un cours", () => {
    const conflicts = detectConflicts(
      [slot({ id: "a" }), slot({ id: "b", courtId: "c2", start: 14 * 60 + 30, end: 16 * 60 })],
      index,
    );
    expect(messages(conflicts, "a")).toEqual(["Karim a déjà un cours à 14h30"]);
    expect(messages(conflicts, "b")).toEqual(["Karim a déjà un cours à 14h00"]);
    const unknown = detectConflicts(
      [slot({ id: "a", instructorId: "x" }), slot({ id: "b", courtId: "c2", instructorId: "x" })],
      index,
    );
    expect(messages(unknown, "a")).toEqual(["Le moniteur a déjà un cours à 14h00"]);
  });

  it("3. moniteur hors de ses disponibilités récurrentes ou datées", () => {
    const typical = detectSlotConflicts(
      slot({ id: "a", instructorId: "m2", start: 15 * 60, end: 17 * 60 }),
      [],
      index,
    );
    expect(typical.map((c) => c.message)).toEqual(["Hors disponibilités de Marc"]);
    // Dans ses plages, mais indisponible le 04/11.
    const dated = detectSlotConflicts(
      slot({ id: "a", instructorId: "m2", date: "2026-11-04" }),
      [],
      index,
    );
    expect(dated.map((c) => c.kind)).toEqual(["instructor_unavailable"]);
    expect(
      detectSlotConflicts(slot({ id: "a", instructorId: "m2", date: "2026-11-11" }), [], index),
    ).toEqual([]);
    // Sans moniteur, ou moniteur inconnu : pas de contrôle.
    expect(detectSlotConflicts(slot({ id: "a", instructorId: null }), [], index)).toEqual([]);
    expect(detectSlotConflicts(slot({ id: "a", instructorId: "x" }), [], index)).toEqual([]);
  });

  it("4. élèves inscrits dans deux cours simultanés", () => {
    const g1 = slot({ id: "a", groupId: "g1" });
    const g2 = slot({ id: "b", groupId: "g2", courtId: "c2", instructorId: "m3" });
    const conflicts = detectConflicts([g1, g2], index);
    expect(messages(conflicts, "a")).toContain("2 élèves ont un autre cours sur ce créneau");
    expect(conflicts.get("b")?.find((c) => c.kind === "students_overlap")?.slotIds).toEqual(["a"]);
    // Le même groupe sur deux courts (deux moniteurs) n'est pas un conflit d'élèves.
    const twin = detectConflicts(
      [
        slot({ id: "a", groupId: "g1" }),
        slot({ id: "b", groupId: "g1", courtId: "c2", instructorId: "m3" }),
      ],
      index,
    );
    expect(twin.get("a")?.some((c) => c.kind === "students_overlap")).toBeFalsy();
    // Un seul élève en commun.
    const one = createConflictIndex({
      ...refs,
      memberships: [
        { groupId: "g1", studentId: "e1" },
        { groupId: "g3", studentId: "e1" },
        { groupId: "g3", studentId: "e4" },
      ],
    });
    const single = detectSlotConflicts(
      slot({ id: "a", groupId: "g1" }),
      [
        slot({ id: "b", groupId: "g3", courtId: "c2", instructorId: "m3" }),
        slot({ id: "c", groupId: "g2", courtId: "c3", instructorId: null }),
      ],
      one,
    );
    expect(single.map((c) => c.message)).toContain("1 élève a un autre cours sur ce créneau");
  });

  it("5. effectif supérieur au maximum et 6. âge hors tranche", () => {
    const conflicts = detectConflicts(
      [slot({ id: "a", groupId: "g2" }), slot({ id: "b", groupId: "g1", weekday: 4 })],
      index,
    );
    expect(conflicts.get("a")?.map((c) => [c.kind, c.message])).toEqual([
      ["over_capacity", "3 / 2 élèves"],
    ]);
    // e3 a 6 ans au 01/09/2026 : hors de la tranche 8–10 ans.
    expect(conflicts.get("b")?.map((c) => [c.kind, c.message])).toEqual([
      ["age_range", "1 élève hors tranche d'âge"],
    ]);
  });

  it("n'indique rien pour un créneau sans conflit", () => {
    const conflicts = detectConflicts([slot({ id: "a" }), slot({ id: "b", weekday: 4 })], index);
    expect(conflicts.size).toBe(0);
    expect(conflictList([slot({ id: "a" })], conflicts)).toEqual([]);
  });
});

describe("7. élèves hors disponibilités", () => {
  const wednesday = (startTime: string, endTime: string) => [{ weekday: 3, startTime, endTime }];
  const saturdayOnly = [{ weekday: 6, startTime: "09:00", endTime: "12:00" }];
  /**
   * g4 : Inès (mercredi 14h–15h), trois élèves du samedi matin et un élève sans
   * plage ; g5 : Inès et l'élève sans plage ; g6 : l'élève sans plage seul.
   */
  const studentIndex = createConflictIndex({
    ...refs,
    groups: [
      ...refs.groups,
      { id: "g4", name: "Mercredi", maxSize: 8, minAge: null, maxAge: null },
      { id: "g5", name: "Inès et Sans", maxSize: 8, minAge: null, maxAge: null },
      { id: "g6", name: "Sans plage", maxSize: 8, minAge: null, maxAge: null },
    ],
    students: [
      ...refs.students,
      {
        id: "s1",
        firstName: "Inès",
        lastName: "Garnier",
        birthDate: null,
        availabilities: wednesday("14:00", "15:00"),
      },
      {
        id: "s2",
        firstName: "Jules",
        lastName: "Faure",
        birthDate: null,
        availabilities: saturdayOnly,
      },
      {
        id: "s3",
        firstName: "Anna",
        lastName: "Faure",
        birthDate: null,
        availabilities: saturdayOnly,
      },
      {
        id: "s4",
        firstName: "Noé",
        lastName: "Andre",
        birthDate: null,
        availabilities: saturdayOnly,
      },
      { id: "s5", firstName: "Sans", lastName: "Plage", birthDate: null, availabilities: [] },
    ],
    memberships: [
      ...refs.memberships,
      ...["s1", "s2", "s3", "s4", "s5"].map((studentId) => ({ groupId: "g4", studentId })),
      { groupId: "g5", studentId: "s1" },
      { groupId: "g5", studentId: "s5" },
      { groupId: "g6", studentId: "s5" },
    ],
  });
  const studentConflicts = (s: PlanningSlot) =>
    detectSlotConflicts(s, [], studentIndex).filter((c) => c.kind === "students_unavailable");

  it("signale un cours qui déborde d'une plage, même partiellement, et pas un cours couvert", () => {
    expect(studentConflicts(slot({ id: "a", groupId: "g5" }))).toEqual([]);
    expect(
      studentConflicts(slot({ id: "a", groupId: "g5", start: 14 * 60 + 30, end: 15 * 60 + 30 })),
    ).toEqual([
      {
        kind: "students_unavailable",
        message: "1 élève hors disponibilités",
        slotIds: [],
        students: ["Inès Garnier"],
      },
    ]);
    // Un autre jour que celui de sa plage : hors disponibilités aussi.
    expect(
      studentConflicts(slot({ id: "a", groupId: "g5", weekday: 4 })).map((c) => c.students),
    ).toEqual([["Inès Garnier"]]);
  });

  it("ne signale jamais un élève sans plage", () => {
    for (const weekday of [1, 3, 7]) {
      expect(
        studentConflicts(slot({ id: "a", groupId: "g6", weekday, start: 6 * 60, end: 23 * 60 })),
      ).toEqual([]);
    }
  });

  it("donne un seul conflit par créneau, qui liste tous les élèves indisponibles", () => {
    const conflicts = detectConflicts([slot({ id: "a", groupId: "g4" })], studentIndex);
    const found = (conflicts.get("a") ?? []).filter((c) => c.kind === "students_unavailable");
    expect(found).toEqual([
      {
        kind: "students_unavailable",
        message: "3 élèves hors disponibilités",
        slotIds: [],
        students: ["Noé Andre", "Anna Faure", "Jules Faure"],
      },
    ]);
  });

  it("contrôle les séances d'une semaine précise : annulée ignorée, modifiée et ponctuelle contrôlées", () => {
    const lessons = [
      lesson({ id: "mer", groupId: "g5", courtId: "c1", startTime: "14:00" }),
      lesson({ id: "jeu", groupId: "g5", courtId: "c2", weekday: 4, startTime: "10:00" }),
    ];
    const week = (exceptions: Parameters<typeof weekOccurrences>[0]["exceptions"]) =>
      detectConflicts(
        slotsFromOccurrences(
          weekOccurrences({ lessons, exceptions, closures: [], season: SEASON }, "2026-11-09"),
        ),
        studentIndex,
      );
    const kinds = (conflicts: Map<string, { kind: string }[]>, id: string) =>
      (conflicts.get(id) ?? []).map((c) => c.kind);
    // Sans exception : le cours du jeudi est hors des plages d'Inès.
    expect(kinds(week([]), "jeu@2026-11-12")).toEqual(["students_unavailable"]);
    // Séance annulée : plus aucun avertissement.
    const cancelled = week([
      exception({
        id: "x",
        kind: "cancellation",
        lessonId: "jeu",
        occurrenceDate: "2026-11-12",
        cancellationReason: "rain",
      }),
    ]);
    expect(cancelled.has("jeu@2026-11-12")).toBe(false);
    // Séance du mercredi décalée à 15h : elle sort de la plage.
    const modified = week([
      exception({
        id: "x",
        kind: "modification",
        lessonId: "mer",
        occurrenceDate: "2026-11-11",
        date: "2026-11-11",
        startTime: "15:00",
      }),
    ]);
    expect(kinds(modified, "mer@2026-11-11")).toEqual(["students_unavailable"]);
    // Cours ponctuel du groupe le vendredi, hors plage.
    const oneOff = week([
      exception({
        id: "p",
        kind: "one_off",
        date: "2026-11-13",
        startTime: "14:00",
        durationMinutes: 60,
        courtId: "c1",
        instructorId: "m1",
        groupId: "g5",
      }),
    ]);
    const [oneOffSlot] = [...oneOff.entries()].filter(
      ([id]) => !id.startsWith("mer") && !id.startsWith("jeu"),
    );
    expect(oneOffSlot?.[1].map((c) => c.message)).toEqual(["1 élève hors disponibilités"]);
  });
});

describe("aperçu pendant un glisser", () => {
  it("ignore le cours déplacé lui-même parmi les autres", () => {
    const others = [
      slot({ id: "a" }),
      slot({ id: "b", courtId: "c2", instructorId: "m3", start: 16 * 60, end: 17 * 60 }),
    ];
    const ghost = slot({ id: "a", start: 16 * 60 + 30, end: 17 * 60 + 30 });
    expect(detectSlotConflicts(ghost, others, index).map((c) => c.message)).toEqual([]);
    const onCourt2 = { ...ghost, courtId: "c2" };
    expect(detectSlotConflicts(onCourt2, others, index).map((c) => c.message)).toEqual([
      "Court 2 déjà occupé par Adultes (16h00–17h00)",
    ]);
  });
});

describe("semaine datée", () => {
  it("ignore les séances annulées ou fermées et contrôle les remplaçants", () => {
    const lessons = [
      lesson({ id: "a", groupId: "g3", instructorId: "m1" }),
      lesson({ id: "b", groupId: "g3", instructorId: "m3", courtId: "c1" }),
      lesson({ id: "c", groupId: "g3", instructorId: "m3", courtId: "c2", weekday: 4 }),
      lesson({ id: "d", groupId: "g3", instructorId: "m1", courtId: "c2", weekday: 5 }),
    ];
    const exceptions = [
      exception({
        id: "ann",
        kind: "cancellation",
        lessonId: "b",
        occurrenceDate: "2026-11-11",
        cancellationReason: "rain",
      }),
      exception({
        id: "rem",
        kind: "replacement",
        lessonId: "a",
        occurrenceDate: "2026-11-11",
        instructorId: "m2",
      }),
    ];
    const closures = [closure({ id: "f", startDate: "2026-11-13", endDate: "2026-11-13" })];
    const week = weekOccurrences({ lessons, exceptions, closures, season: SEASON }, "2026-11-09");
    const slots = slotsFromOccurrences(week);
    expect(slots.map((s) => s.id)).toEqual(["a@2026-11-11", "c@2026-11-12"]);
    const conflicts = detectConflicts(slots, index);
    // Marc remplace Karim, mais n'est disponible le mercredi que jusqu'à 16h : OK à 14h.
    expect(conflicts.size).toBe(0);
    const list = conflictList(
      slots,
      detectConflicts(
        slots.map((s) => ({ ...s, start: 16 * 60, end: 17 * 60 })),
        index,
      ),
    );
    expect(list).toEqual([
      {
        slotId: "a@2026-11-11",
        conflict: {
          kind: "instructor_unavailable",
          message: "Hors disponibilités de Marc",
          slotIds: [],
        },
      },
    ]);
  });

  it("crée des créneaux depuis la semaine type", () => {
    expect(slotFromLesson(lesson({ startTime: "17:00", durationMinutes: 90 }))).toEqual({
      id: "cours",
      date: null,
      weekday: 3,
      start: 17 * 60,
      end: 18 * 60 + 30,
      courtId: "c1",
      groupId: "g1",
      instructorId: "m1",
    });
  });
});

describe("performance", () => {
  it("calcule les conflits d'une semaine de 150 cours en moins de 10 ms", () => {
    // Volumétrie cible (§11.5) : 10 courts, 20 moniteurs, 60 groupes, 500 élèves.
    const courts = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, name: `Court ${i + 1}` }));
    const instructors = Array.from({ length: 20 }, (_, i) => ({
      id: `m${i}`,
      firstName: `Moniteur ${i}`,
      availabilities: [1, 2, 3, 4, 5, 6].map((weekday) => ({
        weekday,
        startTime: "09:00",
        endTime: i % 2 === 0 ? "21:00" : "18:00",
      })),
      unavailabilities: [{ startsAt: "2026-11-11T08:00", endsAt: "2026-11-11T12:00" }],
    }));
    const groups = Array.from({ length: 60 }, (_, i) => ({
      id: `g${i}`,
      name: `Groupe ${i}`,
      maxSize: 8,
      minAge: 6 + (i % 10),
      maxAge: 8 + (i % 10),
    }));
    const students = Array.from({ length: 500 }, (_, i) => ({
      id: `e${i}`,
      firstName: `Prénom ${i}`,
      lastName: `Nom ${i}`,
      birthDate: `${2008 + (i % 15)}-0${1 + (i % 9)}-15`,
      // Un élève sur deux a des plages (le samedi matin) : le 7e contrôle travaille.
      availabilities: i % 2 === 0 ? [{ weekday: 6, startTime: "09:00", endTime: "12:00" }] : [],
    }));
    const memberships = students.flatMap((s, i) => [
      { groupId: `g${i % 60}`, studentId: s.id },
      ...(i % 3 === 0 ? [{ groupId: `g${(i * 7) % 60}`, studentId: s.id }] : []),
    ]);
    const lessons = Array.from({ length: 150 }, (_, i) =>
      lesson({
        id: `l${i}`,
        weekday: 1 + (i % 6),
        startTime: `${String(9 + (i % 12)).padStart(2, "0")}:${i % 4 === 0 ? "30" : "00"}`,
        durationMinutes: 60 + 15 * (i % 3),
        courtId: `c${i % 10}`,
        groupId: `g${i % 60}`,
        instructorId: `m${i % 20}`,
      }),
    );
    const source = { lessons, exceptions: [], closures: [], season: SEASON };
    const references = {
      courts,
      instructors,
      groups,
      students,
      memberships,
      referenceDate: SEASON.startDate,
    };

    const run = () => {
      const slots = slotsFromOccurrences(weekOccurrences(source, "2026-11-09"));
      return detectConflicts(slots, createConflictIndex(references));
    };
    const result = run();
    expect(result.size).toBeGreaterThan(0);
    for (let i = 0; i < 5; i++) run();
    const timings = Array.from({ length: 21 }, () => {
      const start = performance.now();
      run();
      return performance.now() - start;
    }).sort((a, b) => a - b);
    const median = timings[10] as number;
    expect(median).toBeLessThan(10);
  });
});

describe("relecture L2 : cas limites des conflits", () => {
  it("une indisponibilité qui se termine au début du cours n'est pas un conflit", () => {
    const at = (endsAt: string, startsAt = "2026-11-11T08:00") =>
      createConflictIndex({
        ...refs,
        instructors: [
          {
            id: "m2",
            firstName: "Marc",
            availabilities: allWeek,
            unavailabilities: [{ startsAt, endsAt }],
          },
        ],
      });
    const s = slot({ id: "a", instructorId: "m2", date: "2026-11-11" });
    expect(detectSlotConflicts(s, [], at("2026-11-11T14:00"))).toEqual([]);
    expect(detectSlotConflicts(s, [], at("2026-11-11T14:15")).map((c) => c.kind)).toEqual([
      "instructor_unavailable",
    ]);
    // Indisponibilité commençant à la fin du cours : pas de conflit.
    expect(detectSlotConflicts(s, [], at("2026-11-11T18:00", "2026-11-11T15:00"))).toEqual([]);
  });

  it("le calcul de la semaine équivaut au contrôle cours par cours", () => {
    let seed = 42;
    const random = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed % n;
    };
    const slots: PlanningSlot[] = Array.from({ length: 80 }, (_, i) => {
      const start = 8 * 60 + 15 * random(40);
      return slot({
        id: `s${i}`,
        weekday: 1 + random(2),
        start,
        end: start + 15 * (1 + random(16)),
        courtId: `c${1 + random(2)}`,
        groupId: `g${1 + random(3)}`,
        instructorId: `m${1 + random(3)}`,
      });
    });
    const all = detectConflicts(slots, index);
    for (const s of slots) {
      const single = detectSlotConflicts(s, slots, index);
      const sortKey = (c: { kind: string; message: string }) => `${c.kind}|${c.message}`;
      expect((all.get(s.id) ?? []).map(sortKey).sort()).toEqual(single.map(sortKey).sort());
    }
  });
});
