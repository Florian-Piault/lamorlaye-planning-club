import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppDatabase, Db } from "@/db";
import { createCourt } from "@/db/repositories/courts";
import { createGroup } from "@/db/repositories/groups";
import { createInstructor } from "@/db/repositories/instructors";
import { loadPlanningState } from "@/db/repositories/planning";
import { createLesson, type LessonInput, moveLesson, resizeLesson } from "@/domain/commands";
import { canRedo, canUndo } from "@/domain/history";
import { openTestDatabase } from "@/test/database";
import { seedSeason } from "@/test/fixtures";
import { PlanningStore } from "./store";

let app: AppDatabase;
let db: Db;
let seasonId: string;
let input: LessonInput;

beforeEach(async () => {
  app = await openTestDatabase();
  db = app.db;
  seasonId = (await seedSeason(db)).id;
  const courtId = await createCourt(db, seasonId, {
    name: "Court 1",
    kind: "indoor",
    active: true,
  });
  const groupId = await createGroup(db, seasonId, {
    name: "Galaxie vert",
    levelId: null,
    minAge: null,
    maxAge: null,
    maxSize: 8,
    active: true,
  });
  const instructorId = await createInstructor(db, seasonId, {
    lastName: "Benali",
    firstName: "Karim",
    phone: null,
    email: null,
    active: true,
  });
  input = {
    seasonId,
    weekday: 1,
    startTime: "17:00",
    durationMinutes: 60,
    courtId,
    groupId,
    instructorId,
    effectiveFrom: "2026-09-01",
  };
});

afterEach(async () => {
  await app.driver.close();
});

describe("magasin du planning", () => {
  it("applique chaque commande en mémoire tout de suite, puis l'écrit en base", async () => {
    const store = await PlanningStore.load(db, seasonId);
    const notified: number[] = [];
    store.subscribe(() => notified.push(store.getSnapshot().state.lessons.length));

    store.execute(createLesson(store.getSnapshot().state, input));
    expect(store.getSnapshot().state.lessons).toHaveLength(1);
    expect(notified).toEqual([1]);
    const id = store.getSnapshot().state.lessons[0]?.id as string;
    store.execute(
      moveLesson(store.getSnapshot().state, id, {
        weekday: 3,
        startTime: "14:15",
        courtId: input.courtId,
      }),
    );
    store.execute(resizeLesson(store.getSnapshot().state, id, 90));
    await store.flush();

    const stored = await loadPlanningState(db, seasonId);
    expect(stored).toEqual(store.getSnapshot().state);
    expect(stored.lessons[0]).toMatchObject({
      weekday: 3,
      startTime: "14:15",
      durationMinutes: 90,
    });
  });

  it("annule et rétablit, en mémoire et en base", async () => {
    const store = await PlanningStore.load(db, seasonId);
    store.execute(createLesson(store.getSnapshot().state, input));
    const id = store.getSnapshot().state.lessons[0]?.id as string;
    store.execute(resizeLesson(store.getSnapshot().state, id, 120));

    expect(store.undo()?.label).toBe("Changement de durée");
    expect(store.getSnapshot().state.lessons[0]?.durationMinutes).toBe(60);
    expect(store.undo()?.label).toBe("Création du cours");
    expect(store.undo()).toBeNull();
    await store.flush();
    expect((await loadPlanningState(db, seasonId)).lessons).toEqual([]);
    expect(canUndo(store.getSnapshot().history)).toBe(false);

    expect(store.redo()?.label).toBe("Création du cours");
    expect(store.redo()?.label).toBe("Changement de durée");
    expect(store.redo()).toBeNull();
    expect(canRedo(store.getSnapshot().history)).toBe(false);
    await store.flush();
    expect((await loadPlanningState(db, seasonId)).lessons[0]?.durationMinutes).toBe(120);
  });

  it("recharge la base et vide l'historique si une écriture échoue", async () => {
    const store = await PlanningStore.load(db, seasonId);
    store.execute(createLesson(store.getSnapshot().state, input));
    // Court inexistant : refusé par la clé étrangère.
    store.execute(createLesson(store.getSnapshot().state, { ...input, courtId: "inconnu" }));
    expect(store.getSnapshot().state.lessons).toHaveLength(2);
    await store.flush();

    const snapshot = store.getSnapshot();
    expect(snapshot.error).toMatch(/^La modification n'a pas pu être enregistrée/);
    expect(snapshot.state.lessons).toHaveLength(1);
    expect(snapshot.history.past).toEqual([]);
    store.dismissError();
    expect(store.getSnapshot().error).toBeNull();
    store.dismissError();
  });

  it("attend les écritures en cours avant de recharger le planning", async () => {
    // Base lente à écrire (pilote Tauri : écriture et lecture concurrentes).
    const slowDb: Db = Object.assign(Object.create(db), {
      batch: async (queries: Parameters<Db["batch"]>[0]) => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return db.batch(queries);
      },
    });
    const store = await PlanningStore.load(slowDb, seasonId);
    store.execute(createLesson(store.getSnapshot().state, input));
    // L'écran est quitté puis rouvert aussitôt, sans attendre l'écriture.
    const reopened = await PlanningStore.load(slowDb, seasonId);
    expect(reopened.getSnapshot().state.lessons).toHaveLength(1);
  });

  it("abandonne les écritures en file derrière une écriture refusée", async () => {
    const store = await PlanningStore.load(db, seasonId);
    store.execute(createLesson(store.getSnapshot().state, input));
    store.execute(createLesson(store.getSnapshot().state, { ...input, courtId: "inconnu" }));
    // Mise en file avant l'échec : elle repose sur un état qui sera rejeté.
    const id = store.getSnapshot().state.lessons[0]?.id as string;
    store.execute(resizeLesson(store.getSnapshot().state, id, 120));
    await store.flush();

    const stored = await loadPlanningState(db, seasonId);
    expect(store.getSnapshot().state).toEqual(stored);
    expect(stored.lessons.map((l) => l.durationMinutes)).toEqual([60]);

    // Les modifications suivantes sont de nouveau enregistrées.
    store.execute(resizeLesson(store.getSnapshot().state, id, 90));
    await store.flush();
    expect((await loadPlanningState(db, seasonId)).lessons[0]?.durationMinutes).toBe(90);
  });

  it("signale l'erreur même si la base ne peut pas être relue", async () => {
    const store = await PlanningStore.load(db, seasonId);
    await app.driver.close();
    store.execute(createLesson(store.getSnapshot().state, input));
    await store.flush();
    expect(store.getSnapshot().error).toMatch(/n'a pas pu être enregistrée/);
    expect(store.getSnapshot().state.lessons).toHaveLength(1);
    app = await openTestDatabase();
  });
});
