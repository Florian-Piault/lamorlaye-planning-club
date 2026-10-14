import { describe, expect, it } from "vitest";
import { closure, exception, lesson, SEASON, SEASON_ID, testContext } from "@/test/planning";
import {
  applyCommand,
  applyFromWeek,
  applyMutations,
  type Command,
  cancelOccurrence,
  changeLessonInstructor,
  composeCommands,
  createClosure,
  createClosures,
  createLesson,
  createOneOff,
  deleteClosure,
  deleteException,
  deleteLesson,
  deleteOneOff,
  duplicateLesson,
  duplicateOneOffOnFollowingDays,
  emptyPlanningState,
  invertCommand,
  modifyOccurrence,
  moveLesson,
  PlanningError,
  type PlanningState,
  replaceInstructor,
  resizeLesson,
  restoreOccurrence,
  revertCommand,
  updateClosure,
  updateLesson,
  updateOneOff,
} from "./commands";
import { weekOccurrences } from "./occurrences";

const state = (overrides: Partial<PlanningState> = {}): PlanningState => ({
  lessons: [lesson()],
  exceptions: [],
  closures: [],
  ...overrides,
});

/** État comparable, indépendamment de l'ordre des lignes. */
const sorted = (s: PlanningState) => {
  const byId = <T extends { id: string }>(rows: readonly T[]) =>
    [...rows].sort((a, b) => a.id.localeCompare(b.id));
  return { lessons: byId(s.lessons), exceptions: byId(s.exceptions), closures: byId(s.closures) };
};

/** Applique puis annule : l'état doit redevenir identique (puis rétablir redonne le même état). */
function roundTrip(initial: PlanningState, command: Command): PlanningState {
  const applied = applyCommand(initial, command);
  expect(sorted(revertCommand(applied, command))).toEqual(sorted(initial));
  expect(sorted(applyCommand(revertCommand(applied, command), command))).toEqual(sorted(applied));
  return applied;
}

const week = (s: PlanningState, date: string) => weekOccurrences({ ...s, season: SEASON }, date);

const ref = { lessonId: "cours", occurrenceDate: "2026-11-04" };

describe("mutations", () => {
  it("insère, met à jour et supprime sans modifier l'état d'origine", () => {
    const initial = state();
    const next = applyMutations(initial, [
      {
        op: "insert",
        table: "closures",
        row: closure({ id: "f", startDate: "2026-12-19", endDate: "2027-01-03" }),
      },
      { op: "update", table: "lessons", id: "cours", values: { startTime: "15:00" } },
      { op: "delete", table: "closures", id: "f" },
    ]);
    expect(next.lessons[0]?.startTime).toBe("15:00");
    expect(next.closures).toEqual([]);
    expect(initial.lessons[0]?.startTime).toBe("14:00");
  });

  it("refuse les mutations incohérentes", () => {
    expect(() =>
      applyMutations(state(), [{ op: "insert", table: "lessons", row: lesson() }]),
    ).toThrow(PlanningError);
    expect(() =>
      applyMutations(state(), [{ op: "update", table: "lessons", id: "x", values: {} }]),
    ).toThrow("Enregistrement introuvable : x");
    expect(() => applyMutations(state(), [{ op: "delete", table: "closures", id: "x" }])).toThrow(
      PlanningError,
    );
  });

  it("inverse et compose des commandes", () => {
    const ctx = testContext();
    const a = resizeLesson(state(), "cours", 90, ctx);
    const b = moveLesson(
      applyCommand(state(), a),
      "cours",
      { weekday: 4, startTime: "10:00", courtId: "c2" },
      ctx,
    );
    const both = composeCommands("Deux modifications", [a, b]);
    const after = roundTrip(state(), both);
    expect(after.lessons[0]).toMatchObject({ durationMinutes: 90, weekday: 4, courtId: "c2" });
    expect(revertCommand(state(), invertCommand(a))).toEqual(applyCommand(state(), a));
  });
});

describe("cours de la semaine type", () => {
  it("crée un cours", () => {
    const command = createLesson(
      emptyPlanningState,
      {
        seasonId: SEASON_ID,
        weekday: 2,
        startTime: "17:00",
        durationMinutes: 90,
        courtId: "c1",
        groupId: "g1",
        instructorId: "m1",
        effectiveFrom: SEASON.startDate,
      },
      testContext(),
    );
    expect(command.label).toBe("Création du cours");
    const after = roundTrip(emptyPlanningState, command);
    expect(after.lessons[0]).toMatchObject({
      id: "id-1",
      effectiveTo: null,
      previousLessonId: null,
      note: null,
      createdAt: "2026-10-01T12:00:00.000Z",
    });
  });

  it("valide les valeurs du cours", () => {
    const base = {
      seasonId: SEASON_ID,
      weekday: 2,
      startTime: "17:00",
      durationMinutes: 60,
      courtId: "c1",
      groupId: "g1",
      instructorId: "m1",
      effectiveFrom: SEASON.startDate,
    };
    const create = (overrides: object) => () =>
      createLesson(emptyPlanningState, { ...base, ...overrides });
    expect(create({ weekday: 8 })).toThrow("Jour de la semaine invalide.");
    expect(create({ startTime: "25:00" })).toThrow("Heure de début invalide.");
    expect(create({ durationMinutes: 50 })).toThrow(
      "La durée doit être un multiple de 15 minutes.",
    );
    expect(create({ startTime: "23:30", durationMinutes: 60 })).toThrow("avant minuit");
    expect(create({ effectiveFrom: "2026-02-30" })).toThrow("Date d'effet invalide.");
    expect(create({ effectiveTo: "2026-13-01" })).toThrow("Date de fin d'effet invalide.");
    expect(create({ effectiveTo: "2026-08-01" })).toThrow("La fin d'effet doit suivre");
    expect(create({ note: "Prévoir les balles" })().forward).toHaveLength(1);
  });

  it("déplace, redimensionne et change le moniteur", () => {
    const ctx = testContext();
    const move = moveLesson(
      state(),
      "cours",
      { weekday: 5, startTime: "18:00", courtId: "c2" },
      ctx,
    );
    expect(move.label).toBe("Déplacement du cours");
    expect(move.forward).toEqual([
      {
        op: "update",
        table: "lessons",
        id: "cours",
        values: {
          weekday: 5,
          startTime: "18:00",
          courtId: "c2",
          updatedAt: "2026-10-01T12:00:00.000Z",
        },
      },
    ]);
    roundTrip(state(), move);
    expect(resizeLesson(state(), "cours", 120, ctx).label).toBe("Changement de durée");
    const instructor = changeLessonInstructor(state(), "cours", "m2", ctx);
    expect(roundTrip(state(), instructor).lessons[0]?.instructorId).toBe("m2");
    expect(() => resizeLesson(state(), "cours", 0, ctx)).toThrow(PlanningError);
    expect(() => changeLessonInstructor(state(), "cours", "m1", ctx)).toThrow(
      "Aucune modification à enregistrer.",
    );
    expect(() => updateLesson(state(), "inconnu", { note: "x" })).toThrow("Cours introuvable.");
  });

  it("duplique un cours (glisser avec Alt)", () => {
    const command = duplicateLesson(
      state({ lessons: [lesson({ previousLessonId: "v0" })] }),
      "cours",
      { courtId: "c2" },
      testContext(),
    );
    const after = applyCommand(state(), command);
    expect(after.lessons).toHaveLength(2);
    expect(after.lessons[1]).toMatchObject({
      id: "id-1",
      courtId: "c2",
      weekday: 3,
      previousLessonId: null,
    });
  });

  it("supprime un cours avec ses exceptions et le lien des versions suivantes", () => {
    const initial = state({
      lessons: [
        lesson(),
        lesson({ id: "v2", previousLessonId: "cours", effectiveFrom: "2027-01-04" }),
      ],
      exceptions: [
        exception({ id: "ann", kind: "cancellation", ...ref, cancellationReason: "rain" }),
        exception({
          id: "autre",
          kind: "cancellation",
          lessonId: "v2",
          occurrenceDate: "2027-01-06",
        }),
      ],
    });
    const command = deleteLesson(initial, "cours", testContext());
    const after = roundTrip(initial, command);
    expect(after.lessons.map((l) => [l.id, l.previousLessonId])).toEqual([["v2", null]]);
    expect(after.exceptions.map((e) => e.id)).toEqual(["autre"]);
  });
});

describe("« Appliquer à partir de cette semaine »", () => {
  it("clôt le cours à la veille du lundi et crée une nouvelle version", () => {
    const initial = state({ lessons: [lesson({ effectiveTo: "2027-05-31" })] });
    // Appliqué depuis le jeudi 12/11 : semaine du lundi 09/11.
    const command = applyFromWeek(
      initial,
      "cours",
      "2026-11-12",
      { startTime: "16:00", instructorId: "m2" },
      testContext(),
    );
    expect(command.label).toBe("Modification à partir de la semaine du 09/11/2026");
    const after = roundTrip(initial, command);
    expect(after.lessons).toMatchObject([
      {
        id: "cours",
        effectiveFrom: SEASON.startDate,
        effectiveTo: "2026-11-08",
        startTime: "14:00",
      },
      {
        id: "id-1",
        effectiveFrom: "2026-11-09",
        effectiveTo: "2027-05-31",
        startTime: "16:00",
        instructorId: "m2",
        previousLessonId: "cours",
      },
    ]);
    // Semaines précédentes inchangées, suivantes modifiées.
    expect(week(after, "2026-11-04").map((o) => [o.lessonId, o.startTime])).toEqual([
      ["cours", "14:00"],
    ]);
    expect(week(after, "2026-11-11").map((o) => [o.lessonId, o.startTime])).toEqual([
      ["id-1", "16:00"],
    ]);
    expect(week(after, "2027-06-02")).toEqual([]);
  });

  it("rattache les exceptions des semaines suivantes à la nouvelle version", () => {
    const initial = state({
      exceptions: [
        exception({ id: "avant", kind: "cancellation", ...ref, cancellationReason: "rain" }),
        exception({
          id: "apres",
          kind: "replacement",
          lessonId: "cours",
          occurrenceDate: "2026-11-18",
          instructorId: "m3",
        }),
      ],
    });
    // Le cours passe du mercredi au vendredi à partir de la semaine du 09/11.
    const command = applyFromWeek(initial, "cours", "2026-11-09", { weekday: 5 }, testContext());
    const after = roundTrip(initial, command);
    expect(after.exceptions.map((e) => [e.id, e.lessonId, e.occurrenceDate])).toEqual([
      ["avant", "cours", "2026-11-04"],
      ["apres", "id-1", "2026-11-20"],
    ]);
    expect(week(after, "2026-11-04")[0]?.status).toBe("cancelled");
    expect(week(after, "2026-11-18")[0]).toMatchObject({ date: "2026-11-20", instructorId: "m3" });
  });

  it("modifie simplement un cours qui commence cette semaine-là", () => {
    const initial = state({ lessons: [lesson({ effectiveFrom: "2026-11-11" })] });
    const command = applyFromWeek(initial, "cours", "2026-11-09", { courtId: "c2" }, testContext());
    expect(applyCommand(initial, command).lessons).toMatchObject([{ id: "cours", courtId: "c2" }]);
  });

  it("refuse un cours déjà clôturé", () => {
    const initial = state({ lessons: [lesson({ effectiveTo: "2026-10-31" })] });
    expect(() => applyFromWeek(initial, "cours", "2026-11-09", { courtId: "c2" })).toThrow(
      "Le cours n'est plus en vigueur cette semaine-là.",
    );
    expect(() => applyFromWeek(initial, "cours", "09/11/2026", {})).toThrow("Date invalide.");
  });
});

describe("exceptions sur une séance", () => {
  it("modifie une séance pour une seule semaine", () => {
    const ctx = testContext();
    const command = modifyOccurrence(
      state(),
      ref,
      { date: "2026-11-06", startTime: "14:00", courtId: "c2" },
      ctx,
    );
    expect(command.label).toBe("Modification de la séance du 04/11/2026");
    const after = roundTrip(state(), command);
    // L'heure identique à celle du cours est enregistrée comme inchangée.
    expect(after.exceptions[0]).toMatchObject({
      kind: "modification",
      lessonId: "cours",
      occurrenceDate: "2026-11-04",
      date: "2026-11-06",
      startTime: null,
      courtId: "c2",
      seasonId: SEASON_ID,
    });
    // Seule cette semaine change ; la semaine type est intacte.
    expect(after.lessons).toEqual(state().lessons);
    expect(week(after, "2026-11-04")[0]).toMatchObject({ date: "2026-11-06", courtId: "c2" });
    expect(week(after, "2026-11-11")[0]).toMatchObject({ date: "2026-11-11", courtId: "c1" });

    // Une deuxième modification met à jour l'exception existante.
    const again = modifyOccurrence(after, ref, { durationMinutes: 90 }, ctx);
    expect(again.forward).toHaveLength(1);
    expect(applyCommand(after, again).exceptions).toHaveLength(1);
  });

  it("valide la séance et le déplacement", () => {
    expect(() => modifyOccurrence(state(), { ...ref, occurrenceDate: "2026-11-05" }, {})).toThrow(
      "Ce cours n'a pas lieu le 05/11/2026.",
    );
    expect(() => modifyOccurrence(state(), { ...ref, occurrenceDate: "2026-11-4" }, {})).toThrow(
      "Date de séance invalide.",
    );
    expect(() => modifyOccurrence(state(), ref, { date: "2026-11-09" })).toThrow("même semaine");
    expect(() => modifyOccurrence(state(), ref, { date: "2026-11-31" })).toThrow("Date invalide.");
    expect(() => modifyOccurrence(state(), ref, { durationMinutes: 20 })).toThrow(PlanningError);
    expect(() =>
      modifyOccurrence(state(), { ...ref, occurrenceDate: "2027-07-07", season: SEASON }, {}),
    ).toThrow("n'a pas lieu");
  });

  it("annule une séance avec un motif obligatoire", () => {
    const command = cancelOccurrence(
      state(),
      ref,
      { reason: "other", note: "  Tournoi  " },
      testContext(),
    );
    const after = roundTrip(state(), command);
    expect(after.exceptions[0]).toMatchObject({
      cancellationReason: "other",
      cancellationNote: "Tournoi",
    });
    expect(() => cancelOccurrence(state(), ref, { reason: "other", note: " " })).toThrow(
      "Précisez le motif de l'annulation.",
    );
    expect(cancelOccurrence(state(), ref, { reason: "rain" }).label).toBe(
      "Annulation de la séance du 04/11/2026",
    );
  });

  it("enchaîne remplacement puis annulation, et rétablit la séance d'origine", () => {
    const ctx = testContext();
    let current = state();
    const replace = replaceInstructor(current, ref, "m2", ctx);
    current = roundTrip(current, replace);
    expect(week(current, "2026-11-04")[0]).toMatchObject({ instructorId: "m2", replaced: true });

    const cancel = cancelOccurrence(current, ref, { reason: "instructor_absent" }, ctx);
    current = roundTrip(current, cancel);
    expect(week(current, "2026-11-04")[0]).toMatchObject({
      status: "cancelled",
      instructorId: "m2",
    });

    const restore = restoreOccurrence(current, ref);
    expect(restore.label).toBe("Rétablissement de la séance du 04/11/2026");
    current = roundTrip(current, restore);
    expect(current.exceptions).toEqual([]);
    expect(week(current, "2026-11-04")[0]).toMatchObject({ status: "active", instructorId: "m1" });
    expect(() => restoreOccurrence(current, ref)).toThrow("Cette séance n'a pas d'exception.");
  });

  it("remplace un remplaçant et nettoie les doublons", () => {
    const initial = state({
      exceptions: [
        exception({ id: "r1", kind: "replacement", ...ref, instructorId: "m2" }),
        exception({ id: "r2", kind: "replacement", ...ref, instructorId: "m3" }),
      ],
    });
    const after = roundTrip(initial, replaceInstructor(initial, ref, "m4", testContext()));
    expect(after.exceptions).toMatchObject([{ id: "r1", instructorId: "m4" }]);
  });

  it("supprime une exception isolée", () => {
    const initial = state({
      exceptions: [
        exception({ id: "rem", kind: "replacement", ...ref, instructorId: "m2" }),
        exception({ id: "ann", kind: "cancellation", ...ref, cancellationReason: "rain" }),
      ],
    });
    const after = roundTrip(initial, deleteException(initial, "rem"));
    expect(after.exceptions.map((e) => e.id)).toEqual(["ann"]);
    expect(() => deleteException(initial, "x")).toThrow("Exception introuvable.");
  });
});

describe("cours ponctuels", () => {
  const input = {
    seasonId: SEASON_ID,
    date: "2026-10-19",
    startTime: "10:00",
    durationMinutes: 120,
    courtId: "c1",
    instructorId: "m1",
  };

  it("crée, modifie et supprime un cours ponctuel", () => {
    const ctx = testContext();
    const create = createOneOff(emptyPlanningState, { ...input, note: "Stage" }, ctx);
    let current = roundTrip(emptyPlanningState, create);
    expect(current.exceptions[0]).toMatchObject({
      id: "id-1",
      kind: "one_off",
      groupId: null,
      lessonId: null,
      note: "Stage",
    });

    current = roundTrip(
      current,
      updateOneOff(current, "id-1", { startTime: "09:00", groupId: "g1" }, ctx),
    );
    expect(current.exceptions[0]).toMatchObject({ startTime: "09:00", groupId: "g1" });
    expect(() => updateOneOff(current, "id-1", { date: "2026-02-31" })).toThrow("Date invalide.");
    expect(() => updateOneOff(current, "id-1", { durationMinutes: 10 })).toThrow(PlanningError);

    const remove = deleteOneOff(current, "id-1");
    expect(roundTrip(current, remove).exceptions).toEqual([]);
    expect(deleteException(current, "id-1")).toEqual(remove);

    const notOneOff = state({
      exceptions: [exception({ id: "ann", kind: "cancellation", ...ref })],
    });
    expect(() => deleteOneOff(notOneOff, "ann")).toThrow("Ce n'est pas un cours ponctuel.");
    expect(() => createOneOff(emptyPlanningState, { ...input, date: "" })).toThrow(
      "Date invalide.",
    );
  });

  it("duplique un stage sur les jours suivants, en sautant les jours non affichés", () => {
    const ctx = testContext();
    // Vendredi 23/10 : copies sur lundi 26 et mardi 27 (samedi et dimanche masqués).
    const initial = applyCommand(
      emptyPlanningState,
      createOneOff(emptyPlanningState, { ...input, date: "2026-10-23" }, ctx),
    );
    const command = duplicateOneOffOnFollowingDays(initial, "id-1", 2, [1, 2, 3, 4, 5], ctx);
    expect(command.label).toBe("Duplication sur les 2 jours suivants");
    const after = roundTrip(initial, command);
    expect(after.exceptions.map((e) => [e.date, e.startTime, e.courtId, e.instructorId])).toEqual([
      ["2026-10-23", "10:00", "c1", "m1"],
      ["2026-10-26", "10:00", "c1", "m1"],
      ["2026-10-27", "10:00", "c1", "m1"],
    ]);
    expect(duplicateOneOffOnFollowingDays(initial, "id-1", 1, [6], ctx).forward).toMatchObject([
      { op: "insert", row: { date: "2026-10-24" } },
    ]);
    expect(duplicateOneOffOnFollowingDays(initial, "id-1", 1, [6], ctx).label).toBe(
      "Duplication sur le jour suivant",
    );
    expect(() => duplicateOneOffOnFollowingDays(initial, "id-1", 0, [1])).toThrow(PlanningError);
    expect(() => duplicateOneOffOnFollowingDays(initial, "id-1", 2, [])).toThrow(
      "Aucun jour affiché.",
    );
  });
});

describe("périodes de fermeture", () => {
  const input = {
    seasonId: SEASON_ID,
    label: " Vacances de la Toussaint ",
    startDate: "2026-10-17",
    endDate: "2026-11-01",
  };

  it("ajoute, modifie et supprime une fermeture", () => {
    const ctx = testContext();
    let current = roundTrip(state(), createClosure(state(), input, ctx));
    expect(current.closures[0]).toMatchObject({ id: "id-1", label: "Vacances de la Toussaint" });
    expect(week(current, "2026-10-21")[0]?.status).toBe("closed");

    current = roundTrip(
      current,
      updateClosure(current, "id-1", { label: "Toussaint ", endDate: "2026-10-25" }, ctx),
    );
    expect(current.closures[0]).toMatchObject({ label: "Toussaint", endDate: "2026-10-25" });
    expect(updateClosure(current, "id-1", { startDate: "2026-10-18" }, ctx).forward).toHaveLength(
      1,
    );

    current = roundTrip(current, deleteClosure(current, "id-1"));
    expect(current.closures).toEqual([]);
  });

  it("valide la fermeture", () => {
    expect(() => createClosure(state(), { ...input, label: " " })).toThrow(
      "Le libellé est obligatoire.",
    );
    expect(() => createClosure(state(), { ...input, startDate: "x" })).toThrow(
      "Date de début invalide.",
    );
    expect(() => createClosure(state(), { ...input, endDate: "x" })).toThrow(
      "Date de fin invalide.",
    );
    expect(() => createClosure(state(), { ...input, endDate: "2026-10-01" })).toThrow(
      "La date de fin doit suivre",
    );
    expect(() => deleteClosure(state(), "x")).toThrow("Période de fermeture introuvable.");
    expect(createClosure(state(), input).forward[0]).toMatchObject({
      op: "insert",
      table: "closures",
    });
  });

  it("ajoute plusieurs fermetures en une seule commande (assistant)", () => {
    const ctx = testContext();
    const noel = {
      ...input,
      label: "Vacances de Noël",
      startDate: "2026-12-19",
      endDate: "2027-01-03",
    };
    const command = createClosures(state(), [input, noel], ctx);
    expect(command.label).toBe("Ajout de 2 fermetures");
    const current = roundTrip(state(), command);
    expect(current.closures.map((c) => c.label)).toEqual([
      "Vacances de la Toussaint",
      "Vacances de Noël",
    ]);
    expect(createClosures(state(), [input], ctx).label).toBe("Ajout d'une fermeture");
    expect(() => createClosures(state(), [])).toThrow("Aucune fermeture à ajouter.");
  });
});

describe("relecture L2 : cas limites des commandes", () => {
  it("un changement de jour en semaine type emporte les exceptions du cours", () => {
    const initial = state({
      exceptions: [
        exception({ id: "ann", kind: "cancellation", ...ref, cancellationReason: "rain" }),
        exception({
          id: "mod",
          kind: "modification",
          lessonId: "cours",
          occurrenceDate: "2026-12-30",
          startTime: "15:00",
        }),
      ],
    });
    const command = moveLesson(
      initial,
      "cours",
      { weekday: 5, startTime: "14:00", courtId: "c1" },
      testContext(),
    );
    const after = roundTrip(initial, command);
    expect(after.exceptions.map((e) => [e.id, e.occurrenceDate])).toEqual([
      ["ann", "2026-11-06"],
      ["mod", "2027-01-01"], // semaine 53 de 2026, à cheval sur deux années
    ]);
    expect(week(after, "2026-11-04")[0]).toMatchObject({ date: "2026-11-06", status: "cancelled" });
    expect(week(after, "2026-12-28")[0]).toMatchObject({ date: "2027-01-01", startTime: "15:00" });
    // Sans changement de jour, les exceptions ne bougent pas.
    expect(
      moveLesson(initial, "cours", { weekday: 3, startTime: "16:00", courtId: "c1" }).forward,
    ).toHaveLength(1);
  });

  it("contrôle la fin de séance avec la modification déjà enregistrée", () => {
    const initial = state({
      exceptions: [exception({ id: "mod", kind: "modification", ...ref, durationMinutes: 120 })],
    });
    expect(() => modifyOccurrence(initial, ref, { startTime: "23:00" })).toThrow(
      "Le cours doit se terminer avant minuit.",
    );
    // Revenir à la durée du cours (`null`) rend l'horaire possible.
    expect(
      modifyOccurrence(initial, ref, { startTime: "23:00", durationMinutes: null }).forward,
    ).toHaveLength(1);
  });

  it("refuse une duplication sans jour affiché valide (pas de boucle infinie)", () => {
    const initial = state({
      exceptions: [
        exception({
          id: "p",
          kind: "one_off",
          date: "2026-10-23",
          startTime: "10:00",
          durationMinutes: 60,
        }),
      ],
    });
    expect(() => duplicateOneOffOnFollowingDays(initial, "p", 1, [0, 8])).toThrow(
      "Aucun jour affiché.",
    );
  });

  it("applique à partir d'une semaine à cheval sur deux années (semaine 53)", () => {
    const initial = state({ lessons: [lesson({ weekday: 5 })] });
    const command = applyFromWeek(initial, "cours", "2027-01-01", { courtId: "c2" }, testContext());
    expect(command.label).toBe("Modification à partir de la semaine du 28/12/2026");
    const after = roundTrip(initial, command);
    expect(after.lessons.map((l) => [l.id, l.effectiveFrom, l.effectiveTo])).toEqual([
      ["cours", SEASON.startDate, "2026-12-27"],
      ["id-1", "2026-12-28", null],
    ]);
    expect(week(after, "2026-12-25")[0]).toMatchObject({ lessonId: "cours", courtId: "c1" });
    expect(week(after, "2027-01-01")[0]).toMatchObject({ lessonId: "id-1", courtId: "c2" });
  });

  it("applique à partir d'un dimanche : la séance de la veille du lundi reste à l'ancienne version", () => {
    const initial = state({ lessons: [lesson({ weekday: 7 })] });
    // Dimanche 15/11 : semaine du lundi 09/11, clôture le dimanche 08/11.
    const after = roundTrip(
      initial,
      applyFromWeek(initial, "cours", "2026-11-15", { startTime: "10:00" }, testContext()),
    );
    expect(week(after, "2026-11-08")[0]).toMatchObject({ lessonId: "cours", startTime: "14:00" });
    expect(week(after, "2026-11-15")[0]).toMatchObject({ lessonId: "id-1", startTime: "10:00" });
  });

  it("cours clôturé le jour même de la semaine visée", () => {
    const initial = state({ lessons: [lesson({ weekday: 1, effectiveTo: "2026-11-09" })] });
    const after = roundTrip(
      initial,
      applyFromWeek(initial, "cours", "2026-11-09", { startTime: "10:00" }, testContext()),
    );
    expect(after.lessons.map((l) => [l.id, l.effectiveFrom, l.effectiveTo])).toEqual([
      ["cours", SEASON.startDate, "2026-11-08"],
      ["id-1", "2026-11-09", "2026-11-09"],
    ]);
    expect(week(after, "2026-11-09")[0]).toMatchObject({ lessonId: "id-1", startTime: "10:00" });
    expect(week(after, "2026-11-16")).toEqual([]);
  });

  it("enchaîne deux « à partir de » : les exceptions suivent chaque version, et tout s'annule", () => {
    const ctx = testContext();
    const initial = state({
      exceptions: [
        exception({
          id: "rem",
          kind: "replacement",
          lessonId: "cours",
          occurrenceDate: "2026-12-16",
          instructorId: "m3",
        }),
      ],
    });
    const first = applyFromWeek(initial, "cours", "2026-11-09", { weekday: 4 }, ctx);
    const middle = applyCommand(initial, first);
    const second = applyFromWeek(middle, "id-1", "2026-12-07", { weekday: 2 }, ctx);
    const after = applyCommand(middle, second);
    expect(after.exceptions).toMatchObject([{ lessonId: "id-2", occurrenceDate: "2026-12-15" }]);
    expect(week(after, "2026-12-15")[0]).toMatchObject({ instructorId: "m3", replaced: true });

    // Composition : l'inverse rejoue les commandes en ordre inverse.
    const both = composeCommands("Deux étapes", [first, second]);
    expect(sorted(revertCommand(after, both))).toEqual(sorted(initial));
    expect(sorted(applyCommand(after, invertCommand(both)))).toEqual(sorted(initial));
    // Dans le mauvais ordre, la reprise échoue au lieu de corrompre l'état.
    expect(() => applyMutations(after, [...first.backward, ...second.backward])).toThrow(
      PlanningError,
    );
  });
});
