import { describe, expect, it } from "vitest";
import { createConflictIndex, slotFromLesson } from "@/domain/conflicts";
import { lesson } from "@/test/planning";
import {
  busyLabel,
  candidateSlot,
  candidateWarnings,
  displayedCourts,
  displayedRange,
  displayedWeekdays,
  explainConflicts,
  hasFilters,
  type InstructorLabel,
  instructorChoices,
  laterChangesSummary,
  matchesFilters,
  minutesByInstructor,
  NEW_LESSON_ID,
  noAvailabilityMessage,
  noFilters,
  semaineTypeDate,
  toggleId,
  totalMinutes,
  warningMessages,
  weekLessons,
  weekWarnings,
} from "./view";

const season = { startDate: "2026-09-01", endDate: "2027-06-30" };

const instructors = [
  {
    id: "m1",
    firstName: "Karim",
    availabilities: [{ weekday: 3, startTime: "13:00", endTime: "19:00" }],
    unavailabilities: [],
  },
  { id: "m2", firstName: "Marc", availabilities: [], unavailabilities: [] },
];

const index = createConflictIndex({
  courts: [
    { id: "c1", name: "Court 1" },
    { id: "c2", name: "Court 2" },
  ],
  instructors,
  groups: [
    { id: "g1", name: "Galaxie vert", maxSize: 8, minAge: null, maxAge: null },
    { id: "g2", name: "Ados", maxSize: 6, minAge: null, maxAge: null },
  ],
  students: [],
  memberships: [],
  referenceDate: season.startDate,
});

const labels = new Map<string, InstructorLabel>([
  ["m1", { id: "m1", firstName: "Karim", noAvailability: false }],
  ["m2", { id: "m2", firstName: "Marc", noAvailability: true }],
]);

describe("semaine type", () => {
  it("prend aujourd'hui comme date de référence, ramenée dans la saison", () => {
    expect(semaineTypeDate(season, "2026-11-04")).toBe("2026-11-04");
    expect(semaineTypeDate(season, "2026-07-14")).toBe("2026-09-01");
    expect(semaineTypeDate(season, "2027-08-01")).toBe("2027-06-30");
  });

  it("n'affiche que la version en vigueur d'un cours modifié « à partir de »", () => {
    const before = lesson({ id: "v1", effectiveTo: "2026-11-01" });
    const after = lesson({ id: "v2", effectiveFrom: "2026-11-02", previousLessonId: "v1" });
    expect(weekLessons([before, after], "2026-10-14").map((l) => l.id)).toEqual(["v1"]);
    expect(weekLessons([before, after], "2026-11-04").map((l) => l.id)).toEqual(["v2"]);
    // Les deux versions occupent le même créneau : aucun conflit entre elles.
    expect(weekWarnings(weekLessons([before, after], "2026-11-04"), index, labels).size).toBe(0);
    expect(
      weekWarnings([before, after], index, labels)
        .get("v2")
        ?.map((c) => c.kind),
    ).toEqual(["court_occupied", "instructor_busy"]);
  });

  describe("cours qui évoluent dans la saison (pastille de la barre de mode)", () => {
    const before = lesson({ id: "v1", effectiveTo: "2026-11-01" });
    const after = lesson({ id: "v2", effectiveFrom: "2026-11-02", previousLessonId: "v1" });
    const steady = lesson({ id: "x" });

    it("ne signale rien quand aucun cours n'évolue", () => {
      expect(laterChangesSummary([steady], "2026-10-14")).toBeNull();
    });

    it("compte un cours modifié « à partir de » une seule fois, avant puis après", () => {
      expect(laterChangesSummary([before, after, steady], "2026-10-14")).toEqual({
        label: "1 cours change plus tard",
        detail:
          "Le planning habituel montre les cours tels qu'ils sont le 14/10/2026. 1 cours change d'horaire plus tard. Choisissez une semaine précise pour voir ces semaines-là.",
      });
      expect(laterChangesSummary([before, after], "2026-11-04")).toEqual({
        label: "1 cours a changé",
        detail:
          "Le planning habituel montre les cours tels qu'ils sont le 04/11/2026. 1 cours a changé plus tôt.",
      });
    });

    it("compte des chaînes de versions, pas des versions", () => {
      const third = lesson({ id: "v3", effectiveFrom: "2027-01-04", previousLessonId: "v2" });
      const middle = { ...after, effectiveTo: "2027-01-03" };
      const summary = laterChangesSummary([before, middle, third], "2026-11-04");
      expect(summary?.label).toBe("1 cours change plus tard");
      expect(summary?.detail).toContain("1 cours change d'horaire plus tard.");
      expect(summary?.detail).toContain("1 cours a changé plus tôt.");
    });

    it("distingue un cours qui commence plus tard et un cours qui s'arrête", () => {
      const fresh = lesson({ id: "n", effectiveFrom: "2027-01-04" });
      const ending = lesson({ id: "e", effectiveTo: "2027-02-28" });
      const summary = laterChangesSummary([fresh, ending, steady], "2026-11-04");
      expect(summary?.label).toBe("2 cours changent plus tard");
      expect(summary?.detail).toContain("1 cours commence plus tard.");
      expect(summary?.detail).toContain("1 cours s'arrête avant la fin de la saison.");
      expect(summary?.detail).not.toContain("d'horaire");
    });

    it("signale un cours déjà arrêté", () => {
      const ended = lesson({ id: "e", effectiveTo: "2026-10-01" });
      expect(laterChangesSummary([ended], "2026-11-04")).toEqual({
        label: "1 cours a changé",
        detail:
          "Le planning habituel montre les cours tels qu'ils sont le 04/11/2026. 1 cours s'est arrêté plus tôt.",
      });
    });
  });

  it("affiche les jours de la saison et ceux qui portent malgré tout un cours", () => {
    expect(displayedWeekdays([1, 2, 3, 4, 5, 6], [{ weekday: 7 }, { weekday: 2 }])).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
    expect(displayedWeekdays([3, 1], [])).toEqual([1, 3]);
  });

  it("élargit l'amplitude à l'heure pleine pour montrer les cours qui en débordent", () => {
    const amplitude = { start: 8 * 60, end: 22 * 60 };
    expect(displayedRange(amplitude, [{ startTime: "10:00", durationMinutes: 60 }])).toEqual(
      amplitude,
    );
    expect(
      displayedRange(amplitude, [
        { startTime: "07:15", durationMinutes: 60 },
        { startTime: "21:30", durationMinutes: 45 },
      ]),
    ).toEqual({ start: 7 * 60, end: 23 * 60 });
    expect(displayedRange(amplitude, [{ startTime: "23:30", durationMinutes: 60 }])).toEqual({
      start: 8 * 60,
      end: 24 * 60,
    });
  });

  it("affiche les courts actifs et les courts archivés encore utilisés", () => {
    const courts = [
      { id: "c1", active: true },
      { id: "c2", active: false },
      { id: "c3", active: false },
    ];
    expect(displayedCourts(courts, [{ courtId: "c3" }]).map((c) => c.id)).toEqual(["c1", "c3"]);
  });

  it("totalise les heures par moniteur et pour la semaine", () => {
    const lessons = [
      lesson({ id: "a", durationMinutes: 60 }),
      lesson({ id: "b", durationMinutes: 90 }),
      lesson({ id: "c", instructorId: "m2", durationMinutes: 45 }),
    ];
    expect(minutesByInstructor(lessons)).toEqual(
      new Map([
        ["m1", 150],
        ["m2", 45],
      ]),
    );
    expect(totalMinutes(lessons)).toBe(195);
  });
});

describe("avertissements", () => {
  it("explique qu'un moniteur sans aucune plage est indisponible partout", () => {
    const warnings = weekWarnings([lesson({ id: "a", instructorId: "m2" })], index, labels);
    expect(warnings.get("a")?.map((c) => c.message)).toEqual([noAvailabilityMessage("Marc")]);
    expect(noAvailabilityMessage("Marc")).toBe("Aucune disponibilité saisie pour Marc");
  });

  it("garde « Hors disponibilités » pour un moniteur qui a des plages", () => {
    const warnings = weekWarnings([lesson({ id: "a", weekday: 2 })], index, labels);
    expect(warnings.get("a")?.map((c) => c.message)).toEqual(["Hors disponibilités de Karim"]);
    expect(weekWarnings([lesson({ id: "a" })], index, labels).size).toBe(0);
  });

  it("ne modifie pas les autres conflits, ni ceux d'un créneau sans moniteur connu", () => {
    const conflict = { kind: "court_occupied" as const, message: "Court 1 occupé", slotIds: [] };
    expect(explainConflicts({ instructorId: "m2" }, [conflict], labels)).toEqual([conflict]);
    expect(explainConflicts({ instructorId: null }, [conflict], labels)).toEqual([conflict]);
  });

  it("calcule en temps réel les avertissements d'un cours déplacé ou dupliqué", () => {
    const slots = [lesson({ id: "a" }), lesson({ id: "b", courtId: "c2", startTime: "16:00" })].map(
      slotFromLesson,
    );
    const moved = {
      id: "a",
      weekday: 3,
      start: 16 * 60 + 30,
      durationMinutes: 60,
      courtId: "c2",
      groupId: "g1",
      instructorId: "m1",
    };
    expect(warningMessages(candidateWarnings(moved, slots, index, labels))).toEqual([
      "Court 2 déjà occupé par Galaxie vert (16h00–17h00)",
      "Karim a déjà un cours à 16h00",
    ]);
    // Duplication au même endroit : conflit avec l'original.
    const copy = { ...moved, id: NEW_LESSON_ID, start: 14 * 60, courtId: "c1" };
    expect(warningMessages(candidateWarnings(copy, slots, index, labels))).toEqual([
      "Court 1 déjà occupé par Galaxie vert (14h00–15h00)",
      "Karim a déjà un cours à 14h00",
    ]);
    expect(candidateSlot(copy)).toMatchObject({ date: null, start: 840, end: 900 });
  });

  it("dédoublonne les messages", () => {
    const busy = {
      kind: "instructor_busy" as const,
      message: "Karim a déjà un cours",
      slotIds: [],
    };
    expect(warningMessages([busy, { ...busy, slotIds: ["x"] }])).toEqual(["Karim a déjà un cours"]);
  });
});

describe("filtres", () => {
  const target = { instructorId: "m1", courtId: "c1", groupId: "g1" };

  it("laisse tout visible sans filtre", () => {
    expect(hasFilters(noFilters)).toBe(false);
    expect(matchesFilters(target, noFilters)).toBe(true);
  });

  it("combine moniteurs, courts et groupe", () => {
    expect(matchesFilters(target, { ...noFilters, instructorIds: ["m2"] })).toBe(false);
    expect(matchesFilters(target, { ...noFilters, instructorIds: ["m2", "m1"] })).toBe(true);
    expect(matchesFilters(target, { ...noFilters, courtIds: ["c2"] })).toBe(false);
    expect(matchesFilters(target, { ...noFilters, groupId: "g2" })).toBe(false);
    const all = { instructorIds: ["m1"], courtIds: ["c1"], groupId: "g1" };
    expect(hasFilters(all)).toBe(true);
    expect(matchesFilters(target, all)).toBe(true);
  });

  it("ajoute ou retire un identifiant", () => {
    expect(toggleId(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleId(["a", "b"], "a")).toEqual(["b"]);
  });
});

describe("choix du moniteur", () => {
  it("propose d'abord les moniteurs disponibles, puis les autres avec une mention", () => {
    const slot = { date: null, weekday: 3, start: 14 * 60, end: 15 * 60 };
    expect(
      instructorChoices([...instructors].reverse(), slot).map((c) => [c.instructor.id, c.note]),
    ).toEqual([
      ["m1", null],
      ["m2", "aucune disponibilité saisie"],
    ]);
    expect(
      instructorChoices(instructors, { ...slot, weekday: 1 }).map((c) => [
        c.instructor.id,
        c.available,
        c.note,
      ]),
    ).toEqual([
      ["m1", false, "indisponible"],
      ["m2", false, "aucune disponibilité saisie"],
    ]);
  });

  describe("en trois groupes : disponibles, occupés, indisponibles", () => {
    const h = (hours: number, minutes = 0) => hours * 60 + minutes;
    const team = [
      {
        id: "karim",
        availabilities: [{ weekday: 3, startTime: "13:00", endTime: "19:00" }],
        unavailabilities: [],
      },
      {
        id: "julie",
        availabilities: [{ weekday: 3, startTime: "13:00", endTime: "19:00" }],
        unavailabilities: [],
      },
      {
        id: "marc",
        availabilities: [{ weekday: 3, startTime: "16:00", endTime: "19:00" }],
        unavailabilities: [],
      },
      { id: "lea", availabilities: [], unavailabilities: [] },
    ];
    const galaxie = {
      id: "l1",
      date: null,
      weekday: 3,
      start: h(17),
      end: h(18),
      instructorId: "julie",
      label: busyLabel("Galaxie vert", h(17), h(18)),
    };
    const ados = { ...galaxie, id: "l2", instructorId: "marc", label: "Ados 14:00–15:00" };
    const slot = { date: null, weekday: 3, start: h(14), end: h(18) };
    const rows = (choices: ReturnType<typeof instructorChoices>) =>
      choices.map((c) => [c.instructor.id, c.status, c.note]);

    it("range parmi les occupés un moniteur dont un cours chevauche une partie du créneau", () => {
      expect(galaxie.label).toBe("Galaxie vert 17:00–18:00");
      expect(rows(instructorChoices(team, { ...slot, start: h(17, 45) }, [galaxie]))).toEqual([
        ["karim", "available", null],
        ["marc", "available", null],
        ["julie", "busy", "Galaxie vert 17:00–18:00"],
        ["lea", "unavailable", "aucune disponibilité saisie"],
      ]);
      // Créneau contigu (18:00) : pas de chevauchement.
      expect(
        instructorChoices(team, { ...slot, start: h(18), end: h(19) }, [galaxie]).find(
          (c) => c.instructor.id === "julie",
        )?.status,
      ).toBe("available");
      // Autre jour : pas occupé.
      expect(
        instructorChoices(team, { ...slot, weekday: 4 }, [galaxie]).every(
          (c) => c.status === "unavailable",
        ),
      ).toBe(true);
    });

    it("ne compte pas le cours en cours d'édition", () => {
      const editing = { date: null, weekday: 3, start: h(17), end: h(18) };
      expect(
        instructorChoices(team, editing, [galaxie], "l1").find((c) => c.instructor.id === "julie"),
      ).toMatchObject({ status: "available", available: true, note: null });
    });

    it("range parmi les indisponibles un moniteur occupé et hors disponibilités, une seule fois", () => {
      const choices = instructorChoices(team, slot, [galaxie, ados]);
      expect(rows(choices)).toEqual([
        ["karim", "available", null],
        ["julie", "busy", "Galaxie vert 17:00–18:00"],
        ["marc", "unavailable", "indisponible, Ados 14:00–15:00"],
        ["lea", "unavailable", "aucune disponibilité saisie"],
      ]);
      expect(new Set(choices.map((c) => c.instructor.id)).size).toBe(team.length);
    });

    it("compare les dates en semaine datée", () => {
      const dated = { ...galaxie, date: "2026-11-04" };
      const other = { ...slot, date: "2026-11-11" };
      expect(
        instructorChoices(team, other, [dated]).find((c) => c.instructor.id === "julie")?.status,
      ).toBe("available");
      expect(
        instructorChoices(team, { ...slot, date: "2026-11-04" }, [dated]).find(
          (c) => c.instructor.id === "julie",
        )?.status,
      ).toBe("busy");
    });
  });
});
