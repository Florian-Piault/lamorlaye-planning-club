import { describe, expect, it } from "vitest";
import { applyCommand, type Command, type PlanningState } from "@/domain/commands";
import { weekOccurrences } from "@/domain/occurrences";
import { closure, exception, lesson, SEASON, SEASON_ID } from "@/test/planning";
import {
  type ActionContext,
  applyItemFromWeek,
  assignInstructor,
  cancelItem,
  cancellationLabel,
  createdItemId,
  duplicateItemOnFollowingDays,
  type LessonFormValues,
  moveItem,
  removeItem,
  replaceItem,
  resizeItem,
  restoreItem,
  saveItem,
} from "./actions";
import { activeItems, datedItems, datedMode, type GridItem, lessonItem, TYPE_MODE } from "./items";

const WEEK = "2026-11-02";
const dated: ActionContext = { mode: datedMode(WEEK), seasonId: SEASON_ID, season: SEASON };
const typeCtx: ActionContext = { mode: TYPE_MODE, seasonId: SEASON_ID, season: SEASON };

const initial = (overrides: Partial<PlanningState> = {}): PlanningState => ({
  lessons: [lesson()],
  exceptions: [],
  closures: [],
  ...overrides,
});

const items = (state: PlanningState, monday = WEEK): GridItem[] =>
  datedItems(weekOccurrences({ ...state, season: SEASON }, monday));

const item = (state: PlanningState, id: string, monday = WEEK): GridItem => {
  const found = items(state, monday).find((i) => i.id === id);
  if (!found) throw new Error(`élément introuvable : ${id}`);
  return found;
};

const run = (state: PlanningState, command: Command | null): PlanningState => {
  if (!command) throw new Error("commande attendue");
  return applyCommand(state, command);
};

const REGULAR = "cours@2026-11-04";

const values = (overrides: Partial<LessonFormValues> = {}): LessonFormValues => ({
  groupId: "g1",
  instructorId: "m1",
  weekday: 3,
  start: 14 * 60,
  durationMinutes: 60,
  courtId: "c1",
  note: "",
  ...overrides,
});

describe("semaine type : la modification porte sur le cours", () => {
  it("déplace, duplique, redimensionne et change le moniteur", () => {
    const state = initial();
    const base = lessonItem(state.lessons[0] as never);
    let next = run(
      state,
      moveItem(state, typeCtx, base, { weekday: 4, start: 600, courtId: "c2" }, false),
    );
    expect(next.lessons[0]).toMatchObject({ weekday: 4, startTime: "10:00", courtId: "c2" });
    const duplicate = moveItem(
      state,
      typeCtx,
      base,
      { weekday: 4, start: 600, courtId: "c2" },
      true,
    );
    expect(duplicate?.label).toBe("Duplication du cours");
    expect(createdItemId(TYPE_MODE, duplicate as Command)).toMatch(/.+/);
    next = run(state, resizeItem(state, typeCtx, base, 90));
    expect(next.lessons[0]?.durationMinutes).toBe(90);
    next = run(state, assignInstructor(state, typeCtx, base, "m2"));
    expect(next.lessons[0]?.instructorId).toBe("m2");
    expect(removeItem(state, base).label).toBe("Suppression du cours");
  });

  it("crée et modifie un cours depuis le panneau", () => {
    const state = initial();
    const created = saveItem(state, typeCtx, null, values({ weekday: 1, note: " Note " }));
    expect(created?.forward[0]).toMatchObject({
      op: "insert",
      table: "lessons",
      row: { weekday: 1, effectiveFrom: SEASON.startDate, note: "Note" },
    });
    const base = lessonItem(state.lessons[0] as never);
    expect(saveItem(state, typeCtx, base, values())).toBeNull();
    const updated = run(state, saveItem(state, typeCtx, base, values({ durationMinutes: 120 })));
    expect(updated.lessons[0]?.durationMinutes).toBe(120);
  });
});

describe("semaine datée : la modification crée une exception pour cette seule semaine", () => {
  it("un cours déplacé ne modifie ni la semaine type ni les autres semaines", () => {
    const state = initial();
    const next = run(
      state,
      moveItem(
        state,
        dated,
        item(state, REGULAR),
        { weekday: 5, start: 17 * 60, courtId: "c2" },
        false,
      ),
    );
    expect(next.lessons).toEqual(state.lessons);
    expect(next.exceptions).toHaveLength(1);
    expect(item(next, REGULAR)).toMatchObject({
      date: "2026-11-06",
      weekday: 5,
      startTime: "17:00",
      courtId: "c2",
    });
    expect(item(next, "cours@2026-11-11", "2026-11-09")).toMatchObject({
      date: "2026-11-11",
      startTime: "14:00",
      courtId: "c1",
    });
    expect(item(next, "cours@2026-10-28", "2026-10-26").startTime).toBe("14:00");

    // Revenir à l'horaire d'origine supprime l'exception.
    const back = moveItem(
      next,
      dated,
      item(next, REGULAR),
      { weekday: 3, start: 840, courtId: "c1" },
      false,
    );
    expect(back?.label).toBe("Retour à l'horaire d'origine du 04/11/2026");
    expect(run(next, back).exceptions).toEqual([]);
    // Aucun changement : rien à faire.
    expect(
      moveItem(
        state,
        dated,
        item(state, REGULAR),
        { weekday: 3, start: 840, courtId: "c1" },
        false,
      ),
    ).toBeNull();
  });

  it("redimensionne une séance et la duplique en cours ponctuel (Alt)", () => {
    const state = initial();
    const resized = run(state, resizeItem(state, dated, item(state, REGULAR), 90));
    expect(item(resized, REGULAR).durationMinutes).toBe(90);
    expect(resized.lessons[0]?.durationMinutes).toBe(60);

    const copy = moveItem(
      state,
      dated,
      item(state, REGULAR),
      { weekday: 6, start: 600, courtId: "c2" },
      true,
    );
    const key = createdItemId(dated.mode, copy as Command);
    expect(key).toMatch(/^ponctuel:/);
    expect(item(run(state, copy), key as string)).toMatchObject({
      kind: "one_off",
      date: "2026-11-07",
      groupId: "g1",
      instructorId: "m1",
    });
  });

  it("modifie la séance depuis le panneau, sans changer le groupe", () => {
    const state = initial();
    const target = item(state, REGULAR);
    expect(saveItem(state, dated, target, values())).toBeNull();
    const next = run(
      state,
      saveItem(state, dated, target, values({ start: 15 * 60, note: "Rattrapage" })),
    );
    expect(item(next, REGULAR)).toMatchObject({ startTime: "15:00", note: "Rattrapage" });
    expect(() => saveItem(state, dated, target, values({ groupId: "g2" }))).toThrow(
      "Appliquer à partir de cette semaine",
    );
  });

  it("annule avec motif, désigne un remplaçant puis rétablit l'occurrence d'origine", () => {
    let state = initial();
    state = run(state, cancelItem(state, dated, item(state, REGULAR), { reason: "rain" }));
    expect(item(state, REGULAR).cancelled).toBe(true);
    expect(item(state, REGULAR).occurrence?.cancellation).toEqual({ reason: "rain", note: null });

    state = run(state, replaceItem(state, dated, item(state, REGULAR), "m2"));
    expect(item(state, REGULAR)).toMatchObject({ instructorId: "m2" });
    expect(item(state, REGULAR).occurrence?.replaced).toBe(true);
    expect(replaceItem(state, dated, item(state, REGULAR), "m2")).toBeNull();

    const restore = restoreItem(state, dated, item(state, REGULAR));
    state = run(state, restore);
    expect(state.exceptions).toEqual([]);
    expect(item(state, REGULAR)).toMatchObject({ cancelled: false, instructorId: "m1" });
  });

  it("dépose une pastille : remplaçant ; le moniteur prévu retire le remplacement", () => {
    let state = initial();
    state = run(state, assignInstructor(state, dated, item(state, REGULAR), "m2"));
    expect(state.exceptions[0]?.kind).toBe("replacement");
    expect(state.lessons[0]?.instructorId).toBe("m1");
    const end = replaceItem(state, dated, item(state, REGULAR), "m1");
    expect(end?.label).toBe("Fin du remplacement du 04/11/2026");
    state = run(state, end);
    expect(state.exceptions).toEqual([]);
    expect(replaceItem(state, dated, item(state, REGULAR), "m1")).toBeNull();
  });

  it("refuse de supprimer une séance de la semaine type", () => {
    const state = initial();
    expect(() => removeItem(state, item(state, REGULAR))).toThrow("annulez-le");
  });
});

describe("cours ponctuels et stages", () => {
  it("crée, déplace, modifie et supprime un cours ponctuel, y compris sans groupe", () => {
    let state = initial();
    const created = saveItem(state, dated, null, values({ groupId: "", weekday: 6, start: 600 }));
    const key = createdItemId(dated.mode, created as Command) as string;
    state = run(state, created);
    expect(item(state, key)).toMatchObject({ date: "2026-11-07", groupId: null, kind: "one_off" });
    expect(() => saveItem(state, dated, null, values({ instructorId: "", groupId: "" }))).toThrow(
      "Choisissez un moniteur et un court.",
    );

    state = run(
      state,
      moveItem(state, dated, item(state, key), { weekday: 5, start: 660, courtId: "c2" }, false),
    );
    expect(item(state, key)).toMatchObject({
      date: "2026-11-06",
      startTime: "11:00",
      courtId: "c2",
    });
    expect(
      moveItem(state, dated, item(state, key), { weekday: 5, start: 660, courtId: "c2" }, false),
    ).toBeNull();
    state = run(state, resizeItem(state, dated, item(state, key), 180));
    expect(item(state, key).durationMinutes).toBe(180);
    state = run(state, assignInstructor(state, dated, item(state, key), "m2"));
    expect(item(state, key).instructorId).toBe("m2");
    const current = item(state, key);
    expect(
      saveItem(state, dated, current, {
        groupId: "",
        instructorId: "m2",
        weekday: 5,
        start: 660,
        durationMinutes: 180,
        courtId: "c2",
        note: "",
      }),
    ).toBeNull();
    state = run(state, saveItem(state, dated, current, values({ weekday: 5, groupId: "g2" })));
    expect(item(state, key).groupId).toBe("g2");
    state = run(state, removeItem(state, item(state, key)));
    expect(state.exceptions).toEqual([]);
  });

  it("duplique un stage sur les jours suivants, en sautant les jours non affichés", () => {
    let state = initial({
      exceptions: [
        exception({
          id: "stage",
          kind: "one_off",
          date: "2026-10-23",
          startTime: "10:00",
          durationMinutes: 120,
          courtId: "c1",
          instructorId: "m1",
        }),
      ],
    });
    const stage = item(state, "ponctuel:stage", "2026-10-19");
    state = run(state, duplicateItemOnFollowingDays(state, dated, stage, 3, [1, 2, 3, 4, 5, 6]));
    expect(state.exceptions.map((e) => e.date).sort()).toEqual([
      "2026-10-23",
      "2026-10-24",
      "2026-10-26",
      "2026-10-27",
    ]);
  });

  it("duplique pendant une fermeture, mais pas au-delà de la fin de la saison", () => {
    const stageOn = (date: string) =>
      initial({
        closures: [closure({ id: "f", startDate: "2027-04-17", endDate: "2027-05-02" })],
        exceptions: [
          exception({
            id: "stage",
            kind: "one_off",
            date,
            startTime: "10:00",
            durationMinutes: 120,
            courtId: "c1",
            instructorId: "m1",
          }),
        ],
      });
    const holidays = stageOn("2027-04-19");
    const copies = run(
      holidays,
      duplicateItemOnFollowingDays(
        holidays,
        dated,
        item(holidays, "ponctuel:stage", "2027-04-19"),
        4,
        [1, 2, 3, 4, 5, 6, 7],
      ),
    );
    expect(items(copies, "2027-04-19").map((i) => [i.date, i.cancelled])).toEqual([
      ["2027-04-19", false],
      ["2027-04-20", false],
      ["2027-04-21", false],
      ["2027-04-22", false],
      ["2027-04-23", false],
    ]);
    const last = stageOn("2027-06-29");
    expect(() =>
      duplicateItemOnFollowingDays(
        last,
        dated,
        item(last, "ponctuel:stage", "2027-06-28"),
        2,
        [1, 2, 3, 4, 5, 6, 7],
      ),
    ).toThrow("Le 01/07/2027 est hors de la saison");
  });

  it("refuse un cours ponctuel hors saison (semaine à cheval sur le début de la saison)", () => {
    const firstWeek: ActionContext = { ...dated, mode: datedMode("2026-08-31") };
    const state = initial();
    expect(() => saveItem(state, firstWeek, null, values({ weekday: 1 }))).toThrow(
      "Le 31/08/2026 est hors de la saison",
    );
    expect(saveItem(state, firstWeek, null, values({ weekday: 2 }))?.label).toBe(
      "Création d'un cours ponctuel",
    );
  });
});

describe("cas combinés", () => {
  it("remplacement puis annulation : la séance n'est plus comptée ; rétablir efface tout", () => {
    let state = initial();
    state = run(state, replaceItem(state, dated, item(state, REGULAR), "m2"));
    state = run(state, cancelItem(state, dated, item(state, REGULAR), { reason: "rain" }));
    const cancelled = item(state, REGULAR);
    expect(cancelled).toMatchObject({ cancelled: true, instructorId: "m2" });
    expect(activeItems(items(state))).toEqual([]);
    state = run(state, restoreItem(state, dated, cancelled));
    expect(state.exceptions).toEqual([]);
  });

  it("semaine ISO à cheval sur deux années : déplacement et « Appliquer à partir de »", () => {
    const week = "2026-12-28";
    const ctx: ActionContext = { ...dated, mode: datedMode("2027-01-01") };
    expect(ctx.mode).toEqual({ kind: "dated", monday: week });
    let state = initial({ lessons: [lesson({ weekday: 5 })] });
    const friday = item(state, "cours@2027-01-01", week);
    const moved = run(
      state,
      moveItem(state, ctx, friday, { weekday: 4, start: 840, courtId: "c1" }, false),
    );
    expect(item(moved, "cours@2027-01-01", week).date).toBe("2026-12-31");
    state = applyCommand(
      state,
      applyItemFromWeek(state, ctx, friday, values({ weekday: 5, start: 9 * 60 })),
    );
    expect(state.lessons.map((l) => [l.effectiveFrom, l.effectiveTo])).toEqual([
      [SEASON.startDate, "2026-12-27"],
      [week, null],
    ]);
    expect(items(state, "2026-12-21").map((i) => i.startTime)).toEqual(["14:00"]);
    expect(items(state, "2027-01-04").map((i) => i.startTime)).toEqual(["09:00"]);
  });

  it("« Appliquer à partir de » conserve le remplacement de la semaine affichée", () => {
    let state = initial();
    state = run(state, replaceItem(state, dated, item(state, REGULAR), "m2"));
    state = applyCommand(
      state,
      applyItemFromWeek(state, dated, item(state, REGULAR), values({ start: 16 * 60 })),
    );
    expect(items(state).map((i) => [i.startTime, i.instructorId])).toEqual([["16:00", "m2"]]);
    expect(items(state, "2026-11-09").map((i) => [i.startTime, i.instructorId])).toEqual([
      ["16:00", "m1"],
    ]);
  });
});

describe("fermetures en semaine datée", () => {
  it("refuse de déplacer une séance sur un jour fermé (elle y serait suspendue)", () => {
    const state = initial({
      closures: [
        closure({ id: "f", label: "Tournoi", startDate: "2026-11-05", endDate: "2026-11-05" }),
      ],
    });
    const target = item(state, REGULAR);
    expect(() =>
      moveItem(state, dated, target, { weekday: 4, start: 840, courtId: "c1" }, false),
    ).toThrow("Le 05/11/2026 est fermé (Tournoi) : créez plutôt un cours ponctuel.");
    expect(() => saveItem(state, dated, target, values({ weekday: 4 }))).toThrow("est fermé");
    // Le même jour (non fermé) ou un autre jour ouvert reste possible.
    expect(resizeItem(state, dated, target, 90)?.label).toBe(
      "Modification de la séance du 04/11/2026",
    );
    const moved = run(
      state,
      moveItem(state, dated, target, { weekday: 5, start: 840, courtId: "c1" }, false),
    );
    expect(item(moved, REGULAR).date).toBe("2026-11-06");
    // Une séance suspendue par la fermeture n'est pas affichée (la bande « Fermé » la remplace).
    expect(items(state, "2026-11-02").map((i) => i.id)).toEqual([REGULAR]);
    const closed = initial({
      closures: [closure({ id: "f", startDate: "2026-11-04", endDate: "2026-11-04" })],
    });
    expect(items(closed)).toEqual([]);
  });
});

describe("« Appliquer à partir de cette semaine »", () => {
  it("les semaines précédentes sont inchangées, les suivantes reflètent la modification", () => {
    let state = initial();
    const command = applyItemFromWeek(
      state,
      dated,
      item(state, REGULAR),
      values({ weekday: 4, start: 16 * 60 }),
    );
    state = applyCommand(state, command);
    expect(state.lessons).toHaveLength(2);
    expect(item(state, "cours@2026-10-28", "2026-10-26").startTime).toBe("14:00");
    const newKey = createdItemId(dated.mode, command) as string;
    expect(newKey).toMatch(/@2026-11-05$/);
    expect(item(state, newKey)).toMatchObject({ weekday: 4, startTime: "16:00" });
    const later = items(state, "2026-11-09");
    expect(later.map((i) => [i.date, i.startTime])).toEqual([["2026-11-12", "16:00"]]);
  });

  it("absorbe la modification de la semaine affichée", () => {
    let state = initial();
    state = run(state, resizeItem(state, dated, item(state, REGULAR), 90));
    const command = applyItemFromWeek(
      state,
      dated,
      item(state, REGULAR),
      values({ durationMinutes: 90 }),
    );
    state = applyCommand(state, command);
    expect(state.exceptions).toEqual([]);
    expect(items(state).map((i) => i.durationMinutes)).toEqual([90]);
    expect(items(state, "2026-10-26").map((i) => i.durationMinutes)).toEqual([60]);
    expect(items(state, "2027-01-04").map((i) => i.durationMinutes)).toEqual([90]);
  });

  it("revient au cours si les valeurs sont celles d'origine, refuse sinon les cas sans effet", () => {
    let state = initial();
    expect(() => applyItemFromWeek(state, dated, item(state, REGULAR), values())).toThrow(
      "Aucune modification à appliquer.",
    );
    state = run(state, resizeItem(state, dated, item(state, REGULAR), 90));
    const command = applyItemFromWeek(state, dated, item(state, REGULAR), values());
    expect(command.label).toBe("Retour à l'horaire d'origine du 04/11/2026");
    expect(applyCommand(state, command).exceptions).toEqual([]);
    expect(() =>
      applyItemFromWeek(state, dated, item(state, REGULAR), values({ courtId: "" })),
    ).toThrow("Choisissez un groupe");
    expect(() =>
      applyItemFromWeek(state, typeCtx, item(state, REGULAR), values({ start: 600 })),
    ).toThrow("Aucune semaine précise affichée.");
    const base = lessonItem(state.lessons[0] as never);
    expect(() => applyItemFromWeek(state, dated, base, values())).toThrow(
      "Seul un cours du planning habituel",
    );
  });
});

describe("cas d'erreur et libellés", () => {
  it("signale les éléments incomplets", () => {
    const state = initial();
    const orphan = { ...item(state, REGULAR), occurrence: null };
    expect(() => cancelItem(state, dated, orphan, { reason: "rain" })).toThrow(
      "Séance introuvable.",
    );
    const lost = { ...item(state, REGULAR), lessonId: "inconnu" };
    expect(() => resizeItem(state, dated, lost, 90)).toThrow("Cours introuvable.");
    const oneOff = { ...item(state, REGULAR), kind: "one_off" as const, oneOffId: null };
    expect(() => removeItem(state, oneOff)).toThrow("Cours ponctuel introuvable.");
    const noInstructor = { ...item(state, REGULAR), instructorId: null };
    expect(() =>
      moveItem(state, dated, noInstructor, { weekday: 3, start: 600, courtId: "c1" }, true),
    ).toThrow("Choisissez d'abord un moniteur.");
    expect(createdItemId(dated.mode, { label: "", forward: [], backward: [] })).toBeNull();
  });

  it("libelle les motifs d'annulation", () => {
    expect(cancellationLabel("rain", null)).toBe("Pluie");
    expect(cancellationLabel("instructor_absent", "grippe")).toBe("Moniteur absent — grippe");
    expect(cancellationLabel("other", "Tournoi")).toBe("Tournoi");
    expect(cancellationLabel(null, null)).toBe("Annulée");
  });
});
