import { describe, expect, it } from "vitest";
import { closure, exception, lesson, SEASON } from "@/test/planning";
import {
  activeOccurrences,
  closureOn,
  closuresBetween,
  findOccurrence,
  hasOccurrenceOn,
  lessonsInEffect,
  type Occurrence,
  occurrenceKey,
  occurrencesBetween,
  oneOffKey,
  oneOffOccurrence,
  orphanExceptions,
  type PlanningSource,
  weekOccurrences,
} from "./occurrences";

const source = (overrides: Partial<PlanningSource> = {}): PlanningSource => ({
  lessons: [lesson()],
  exceptions: [],
  closures: [],
  season: SEASON,
  ...overrides,
});

const summary = (o: Occurrence) => `${o.date} ${o.startTime}-${o.endTime} ${o.status}`;

describe("occurrences de la semaine type", () => {
  it("génère une occurrence par semaine, au jour du cours", () => {
    const week = weekOccurrences(source(), "2026-11-02");
    expect(week).toHaveLength(1);
    expect(week[0]).toMatchObject({
      key: occurrenceKey("cours", "2026-11-04"),
      kind: "regular",
      lessonId: "cours",
      oneOffId: null,
      occurrenceDate: "2026-11-04",
      date: "2026-11-04",
      weekday: 3,
      startTime: "14:00",
      endTime: "15:00",
      start: 840,
      end: 900,
      courtId: "c1",
      groupId: "g1",
      instructorId: "m1",
      originalInstructorId: null,
      status: "active",
      modified: false,
      replaced: false,
      exceptionIds: [],
    });
  });

  it("respecte les dates d'effet et les limites de la saison", () => {
    const lessons = [
      lesson({ id: "a", effectiveFrom: "2026-09-01", effectiveTo: "2026-09-30" }),
      lesson({ id: "b", effectiveFrom: "2026-10-01" }),
    ];
    const all = occurrencesBetween(source({ lessons }), "2026-08-01", "2026-10-31");
    expect(all.filter((o) => o.lessonId === "a").map((o) => o.date)).toEqual([
      "2026-09-02",
      "2026-09-09",
      "2026-09-16",
      "2026-09-23",
      "2026-09-30",
    ]);
    expect(all.filter((o) => o.lessonId === "b")).toHaveLength(4);
    // Hors saison : aucune occurrence.
    expect(occurrencesBetween(source(), "2027-07-01", "2027-07-31")).toEqual([]);
    // Sans limites de saison : l'occurrence d'août existe.
    expect(occurrencesBetween(source({ season: null }), "2026-08-26", "2026-08-26")).toHaveLength(
      0,
    );
    expect(
      occurrencesBetween(
        source({ season: null, lessons: [lesson({ effectiveFrom: "2026-08-01" })] }),
        "2026-08-26",
        "2026-08-26",
      ),
    ).toHaveLength(1);
    expect(occurrencesBetween(source(), "2026-11-10", "2026-11-01")).toEqual([]);
  });

  it("donne les cours en vigueur à une date", () => {
    const lessons = [
      lesson({ id: "a", effectiveTo: "2026-10-31" }),
      lesson({ id: "b", effectiveFrom: "2026-11-02" }),
    ];
    expect(lessonsInEffect(lessons, "2026-10-15").map((l) => l.id)).toEqual(["a"]);
    expect(lessonsInEffect(lessons, "2026-11-15").map((l) => l.id)).toEqual(["b"]);
    expect(hasOccurrenceOn(lessons[0] as never, "2026-10-14", SEASON)).toBe(true);
    expect(hasOccurrenceOn(lessons[0] as never, "2026-10-15", SEASON)).toBe(false);
  });

  it("trie par date, heure puis court", () => {
    const lessons = [
      lesson({ id: "x", weekday: 5, startTime: "10:00" }),
      lesson({ id: "y", weekday: 3, startTime: "18:00", courtId: "c2" }),
      lesson({ id: "z", weekday: 3, startTime: "18:00", courtId: "c1" }),
      lesson({ id: "w", weekday: 3, startTime: "09:00" }),
    ];
    expect(weekOccurrences(source({ lessons }), "2026-11-02").map((o) => o.lessonId)).toEqual([
      "w",
      "z",
      "y",
      "x",
    ]);
  });
});

describe("périodes de fermeture", () => {
  it("suspend les occurrences tombant dans une fermeture couvrant une partie de semaine", () => {
    // Fermeture du jeudi 12/11 au dimanche 15/11 (hors du mercredi 11/11).
    const lessons = [
      lesson({ id: "mer", weekday: 3 }),
      lesson({ id: "jeu", weekday: 4 }),
      lesson({ id: "sam", weekday: 6 }),
    ];
    const closures = [
      closure({ id: "f", label: "Pont", startDate: "2026-11-12", endDate: "2026-11-15" }),
    ];
    const week = weekOccurrences(source({ lessons, closures }), "2026-11-09");
    expect(week.map((o) => [o.lessonId, o.status])).toEqual([
      ["mer", "active"],
      ["jeu", "closed"],
      ["sam", "closed"],
    ]);
    expect(week[1]?.closure?.label).toBe("Pont");
    expect(activeOccurrences(week).map((o) => o.lessonId)).toEqual(["mer"]);
  });

  it("garde les cours ponctuels (stages) actifs pendant une fermeture", () => {
    const closures = [closure({ id: "f", startDate: "2026-10-17", endDate: "2026-11-01" })];
    const stage = exception({
      id: "stage",
      kind: "one_off",
      date: "2026-10-21",
      startTime: "10:00",
      durationMinutes: 120,
      courtId: "c1",
      instructorId: "m2",
    });
    const week = weekOccurrences(source({ closures, exceptions: [stage] }), "2026-10-19");
    expect(week.map(summary)).toEqual([
      "2026-10-21 10:00-12:00 active",
      "2026-10-21 14:00-15:00 closed",
    ]);
    expect(week[0]).toMatchObject({ kind: "one_off", key: oneOffKey("stage"), groupId: null });
    expect(week[0]?.closure?.id).toBe("f");
  });

  it("liste les fermetures d'une période", () => {
    const closures = [
      closure({ id: "b", startDate: "2026-12-19", endDate: "2027-01-03" }),
      closure({ id: "a", startDate: "2026-10-17", endDate: "2026-11-01" }),
    ];
    expect(closuresBetween(closures, "2026-10-26", "2026-11-01").map((c) => c.id)).toEqual(["a"]);
    expect(closuresBetween(closures, "2026-10-01", "2027-01-31").map((c) => c.id)).toEqual([
      "a",
      "b",
    ]);
    expect(closureOn(closures, "2026-11-02")).toBeNull();
  });
});

describe("exceptions", () => {
  const ref = { lessonId: "cours", occurrenceDate: "2026-11-04" };

  it("applique une modification pour une seule semaine", () => {
    const modification = exception({
      id: "mod",
      kind: "modification",
      ...ref,
      date: "2026-11-05",
      startTime: "17:00",
      durationMinutes: 90,
      courtId: "c2",
      note: "Déplacé",
    });
    const all = occurrencesBetween(
      source({ exceptions: [modification] }),
      "2026-11-02",
      "2026-11-15",
    );
    expect(all.map(summary)).toEqual([
      "2026-11-05 17:00-18:30 active",
      "2026-11-11 14:00-15:00 active",
    ]);
    expect(all[0]).toMatchObject({
      key: occurrenceKey("cours", "2026-11-04"),
      occurrenceDate: "2026-11-04",
      weekday: 4,
      courtId: "c2",
      instructorId: "m1",
      modified: true,
      exceptionIds: ["mod"],
      note: "Déplacé",
    });
  });

  it("garde les valeurs du cours quand la modification les laisse vides", () => {
    const modification = exception({ id: "mod", kind: "modification", ...ref, instructorId: "m3" });
    const [occurrence] = weekOccurrences(source({ exceptions: [modification] }), "2026-11-04");
    expect(occurrence).toMatchObject({
      date: "2026-11-04",
      startTime: "14:00",
      instructorId: "m3",
    });
    expect(occurrence?.replaced).toBe(false);
  });

  it("retrouve une séance déplacée dans une autre période", () => {
    // Séance du mercredi déplacée au dimanche : visible le dimanche seulement.
    const modification = exception({ id: "mod", kind: "modification", ...ref, date: "2026-11-08" });
    const sunday = occurrencesBetween(
      source({ exceptions: [modification] }),
      "2026-11-08",
      "2026-11-08",
    );
    expect(sunday.map(summary)).toEqual(["2026-11-08 14:00-15:00 active"]);
    const wednesday = occurrencesBetween(
      source({ exceptions: [modification] }),
      "2026-11-04",
      "2026-11-04",
    );
    expect(wednesday).toEqual([]);
  });

  it("annule une séance avec son motif", () => {
    const cancellation = exception({
      id: "ann",
      kind: "cancellation",
      ...ref,
      cancellationReason: "rain",
    });
    const [occurrence] = weekOccurrences(source({ exceptions: [cancellation] }), "2026-11-04");
    expect(occurrence?.status).toBe("cancelled");
    expect(occurrence?.cancellation).toEqual({ reason: "rain", note: null });
    expect(activeOccurrences([occurrence as Occurrence])).toEqual([]);
  });

  it("attribue la séance au remplaçant", () => {
    const replacement = exception({ id: "rem", kind: "replacement", ...ref, instructorId: "m2" });
    const [occurrence] = weekOccurrences(source({ exceptions: [replacement] }), "2026-11-04");
    expect(occurrence).toMatchObject({
      instructorId: "m2",
      originalInstructorId: "m1",
      replaced: true,
      status: "active",
    });
    // Remplacement par le moniteur prévu : sans effet.
    const same = exception({ id: "rem", kind: "replacement", ...ref, instructorId: "m1" });
    expect(weekOccurrences(source({ exceptions: [same] }), "2026-11-04")[0]?.replaced).toBe(false);
  });

  it("cumule un remplacement suivi d'une annulation", () => {
    const exceptions = [
      exception({ id: "rem", kind: "replacement", ...ref, instructorId: "m2" }),
      exception({
        id: "ann",
        kind: "cancellation",
        ...ref,
        cancellationReason: "instructor_absent",
        updatedAt: "2026-11-03T10:00:00.000Z",
      }),
    ];
    const [occurrence] = weekOccurrences(source({ exceptions }), "2026-11-04");
    expect(occurrence).toMatchObject({
      status: "cancelled",
      instructorId: "m2",
      replaced: true,
      exceptionIds: ["rem", "ann"],
    });
  });

  it("retient l'exception la plus récente d'un même type", () => {
    const exceptions = [
      exception({
        id: "r2",
        kind: "replacement",
        ...ref,
        instructorId: "m3",
        updatedAt: "2026-11-02",
      }),
      exception({
        id: "r1",
        kind: "replacement",
        ...ref,
        instructorId: "m2",
        updatedAt: "2026-11-01",
      }),
    ];
    expect(weekOccurrences(source({ exceptions }), "2026-11-04")[0]?.instructorId).toBe("m3");
  });

  it("annulation et fermeture : la séance est affichée annulée", () => {
    const exceptions = [
      exception({ id: "ann", kind: "cancellation", ...ref, cancellationReason: "other" }),
    ];
    const closures = [closure({ id: "f", startDate: "2026-11-04", endDate: "2026-11-04" })];
    const [occurrence] = weekOccurrences(source({ exceptions, closures }), "2026-11-04");
    expect(occurrence?.status).toBe("cancelled");
    expect(occurrence?.closure?.id).toBe("f");
  });

  it("ignore une exception sur un cours clôturé et la signale comme orpheline", () => {
    // Version 1 clôturée au 01/11, version 2 à partir du 02/11 (le jeudi).
    const lessons = [
      lesson({ id: "v1", effectiveTo: "2026-11-01" }),
      lesson({ id: "v2", weekday: 4, effectiveFrom: "2026-11-02", previousLessonId: "v1" }),
    ];
    const exceptions = [
      exception({ id: "ann", kind: "cancellation", lessonId: "v1", occurrenceDate: "2026-11-11" }),
      exception({ id: "ok", kind: "cancellation", lessonId: "v1", occurrenceDate: "2026-10-28" }),
      exception({ id: "jour", kind: "cancellation", lessonId: "v2", occurrenceDate: "2026-11-11" }),
      exception({
        id: "perdu",
        kind: "replacement",
        lessonId: "inconnu",
        occurrenceDate: "2026-11-11",
      }),
      exception({ id: "stage", kind: "one_off", date: "2026-11-11" }),
    ];
    const week = weekOccurrences(source({ lessons, exceptions }), "2026-11-09");
    expect(week.map((o) => [o.lessonId, o.date, o.status])).toEqual([
      ["v2", "2026-11-12", "active"],
    ]);
    expect(weekOccurrences(source({ lessons, exceptions }), "2026-10-28")[0]?.status).toBe(
      "cancelled",
    );
    expect(orphanExceptions(source({ lessons, exceptions })).map((e) => e.id)).toEqual([
      "ann",
      "jour",
      "perdu",
    ]);
    // Une modification d'un cours clôturé ne fait pas réapparaître la séance.
    const moved = [
      exception({
        id: "mod",
        kind: "modification",
        lessonId: "v1",
        occurrenceDate: "2026-11-11",
        date: "2026-11-13",
      }),
    ];
    expect(weekOccurrences(source({ lessons, exceptions: moved }), "2026-11-09")).toHaveLength(1);
  });

  it("ignore les cours ponctuels incomplets", () => {
    expect(
      oneOffOccurrence(exception({ id: "x", kind: "one_off", date: "2026-11-04" })),
    ).toBeNull();
    expect(
      oneOffOccurrence(
        exception({ id: "x", kind: "one_off", date: "2026-11-04", startTime: "10:00" }),
      ),
    ).toBeNull();
    expect(oneOffOccurrence(exception({ id: "x", kind: "cancellation" }))).toBeNull();
    const incomplete = [exception({ id: "x", kind: "one_off", date: "2026-11-04" })];
    expect(weekOccurrences(source({ lessons: [], exceptions: incomplete }), "2026-11-04")).toEqual(
      [],
    );
  });

  it("retrouve une occurrence précise", () => {
    const exceptions = [exception({ id: "rem", kind: "replacement", ...ref, instructorId: "m2" })];
    expect(findOccurrence(source({ exceptions }), "cours", "2026-11-04")?.instructorId).toBe("m2");
    expect(findOccurrence(source(), "cours", "2026-11-05")).toBeNull();
    expect(findOccurrence(source(), "inconnu", "2026-11-04")).toBeNull();
  });
});

describe("semaine de changement d'heure", () => {
  it("conserve les heures murales le dimanche du passage à l'heure d'hiver", () => {
    const lessons = [
      lesson({ id: "sam", weekday: 6, startTime: "09:00" }),
      lesson({ id: "dim", weekday: 7, startTime: "10:00", durationMinutes: 90 }),
    ];
    // Semaine du 19/10/2026, dont le dimanche 25/10 compte 25 heures.
    const week = weekOccurrences(source({ lessons }), "2026-10-25");
    expect(week.map(summary)).toEqual([
      "2026-10-24 09:00-10:00 active",
      "2026-10-25 10:00-11:30 active",
    ]);
    // Semaine du passage à l'heure d'été (dimanche 28/03/2027).
    const spring = weekOccurrences(source({ lessons }), "2027-03-24");
    expect(spring.map((o) => o.date)).toEqual(["2027-03-27", "2027-03-28"]);
    expect(spring[1]?.durationMinutes).toBe(90);
  });
});

describe("relecture L2 : cas limites des occurrences", () => {
  it("semaine 53 à cheval sur deux années, fermeture de Noël et jour férié", () => {
    const lessons = [
      lesson({ id: "lun", weekday: 1 }),
      lesson({ id: "ven", weekday: 5 }),
      lesson({ id: "sam", weekday: 6 }),
    ];
    const closures = [closure({ id: "noel", startDate: "2026-12-19", endDate: "2027-01-01" })];
    const oneOff = exception({
      id: "stage",
      kind: "one_off",
      date: "2026-12-29",
      startTime: "10:00",
      durationMinutes: 120,
      instructorId: "m1",
    });
    const week = weekOccurrences(source({ lessons, closures, exceptions: [oneOff] }), "2027-01-02");
    expect(week.map((o) => `${o.key} ${o.date} ${o.status}`)).toEqual([
      "lun@2026-12-28 2026-12-28 closed",
      "ponctuel:stage 2026-12-29 active",
      "ven@2027-01-01 2027-01-01 closed",
      "sam@2027-01-02 2027-01-02 active",
    ]);
  });

  it("borne la dernière semaine de la saison (fin un mercredi)", () => {
    const lessons = [lesson({ id: "mer", weekday: 3 }), lesson({ id: "jeu", weekday: 4 })];
    expect(weekOccurrences(source({ lessons }), "2027-06-30").map((o) => o.key)).toEqual([
      "mer@2027-06-30",
    ]);
  });

  it("une séance déplacée entre ou sort d'une fermeture partielle de la semaine", () => {
    const closures = [closure({ id: "f", startDate: "2026-11-11", endDate: "2026-11-11" })];
    const moveOut = exception({
      id: "out",
      kind: "modification",
      lessonId: "cours",
      occurrenceDate: "2026-11-11",
      date: "2026-11-12",
    });
    expect(
      weekOccurrences(source({ closures, exceptions: [moveOut] }), "2026-11-11"),
    ).toMatchObject([{ date: "2026-11-12", status: "active", closure: null }]);
    const friday = [closure({ id: "v", startDate: "2026-11-13", endDate: "2026-11-15" })];
    const moveIn = { ...moveOut, date: "2026-11-13" };
    expect(
      weekOccurrences(source({ closures: friday, exceptions: [moveIn] }), "2026-11-11"),
    ).toMatchObject([{ key: "cours@2026-11-11", date: "2026-11-13", status: "closed" }]);
  });

  it("cumule modification, remplacement et annulation sur une même séance", () => {
    const at = { lessonId: "cours", occurrenceDate: "2026-11-04" };
    const exceptions = [
      exception({ id: "m", kind: "modification", ...at, startTime: "16:00", instructorId: "m2" }),
      exception({ id: "r", kind: "replacement", ...at, instructorId: "m3" }),
      exception({ id: "a", kind: "cancellation", ...at, cancellationReason: "rain" }),
    ];
    expect(weekOccurrences(source({ exceptions }), "2026-11-04")).toMatchObject([
      {
        startTime: "16:00",
        instructorId: "m3",
        originalInstructorId: "m2",
        status: "cancelled",
        exceptionIds: ["m", "r", "a"],
      },
    ]);
  });

  it("semaine du passage à l'heure d'été : heures murales inchangées", () => {
    // Dimanche 28/03/2027 : passage à l'heure d'été.
    const lessons = [lesson({ weekday: 7, startTime: "09:00", durationMinutes: 90 })];
    expect(weekOccurrences(source({ lessons }), "2027-03-28")).toMatchObject([
      { date: "2027-03-28", startTime: "09:00", endTime: "10:30", durationMinutes: 90 },
    ]);
  });
});
