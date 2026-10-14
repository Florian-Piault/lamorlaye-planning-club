import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyFromWeek,
  cancelOccurrence,
  createClosure,
  createLesson,
  createOneOff,
  deleteLesson,
  moveLesson,
  type PlanningState,
  replaceInstructor,
} from "@/domain/commands";
import { emptyHistory, execute, redo, undo } from "@/domain/history";
import { openTestDatabase } from "@/test/database";
import { seedSeason } from "@/test/fixtures";
import type { AppDatabase, Db } from "..";
import { createCourt } from "./courts";
import { createGroup } from "./groups";
import { createInstructor } from "./instructors";
import { loadPlanningState, persistCommand, persistMutations, persistRevert } from "./planning";

let app: AppDatabase;
let db: Db;
let seasonId: string;
let refs: { courtId: string; groupId: string; instructorId: string; otherInstructorId: string };

beforeEach(async () => {
  app = await openTestDatabase();
  db = app.db;
  seasonId = (await seedSeason(db)).id;
  const court = await createCourt(db, seasonId, { name: "Court 1", kind: "indoor", active: true });
  const group = await createGroup(db, seasonId, {
    name: "Galaxie vert",
    levelId: null,
    minAge: null,
    maxAge: null,
    maxSize: 8,
    active: true,
  });
  const person = (lastName: string, firstName: string) => ({
    lastName,
    firstName,
    phone: null,
    email: null,
    color: "#2563EB",
    initials: `${firstName[0]}${lastName[0]}`,
    active: true,
  });
  const karim = await createInstructor(db, seasonId, person("Benali", "Karim"));
  const marc = await createInstructor(db, seasonId, person("Durand", "Marc"));
  refs = { courtId: court, groupId: group, instructorId: karim, otherInstructorId: marc };
});

afterEach(async () => {
  await app.driver.close();
});

/** Applique une commande en mémoire et en base, et vérifie que les deux concordent. */
async function expectSameState(state: PlanningState) {
  const stored = await loadPlanningState(db, seasonId);
  const byId = <T extends { id: string }>(rows: readonly T[]) =>
    [...rows].sort((a, b) => a.id.localeCompare(b.id));
  expect(byId(stored.lessons)).toEqual(byId(state.lessons));
  expect(byId(stored.exceptions)).toEqual(byId(state.exceptions));
  expect(byId(stored.closures)).toEqual(byId(state.closures));
}

describe("adaptateur des commandes vers la base", () => {
  it("écrit, annule et rétablit les commandes en base comme en mémoire", async () => {
    let state = await loadPlanningState(db, seasonId);
    expect(state).toEqual({ lessons: [], exceptions: [], closures: [] });
    let history = emptyHistory;

    const run = async (build: (s: PlanningState) => Parameters<typeof execute>[2]) => {
      const command = build(state);
      await persistCommand(db, command);
      ({ history, state } = execute(history, state, command));
      await expectSameState(state);
    };

    await run((s) =>
      createLesson(s, {
        seasonId,
        weekday: 3,
        startTime: "14:00",
        durationMinutes: 60,
        courtId: refs.courtId,
        groupId: refs.groupId,
        instructorId: refs.instructorId,
        effectiveFrom: "2026-09-01",
      }),
    );
    const lessonId = state.lessons[0]?.id as string;
    const ref = { lessonId, occurrenceDate: "2026-11-18" };
    await run((s) => replaceInstructor(s, ref, refs.otherInstructorId));
    await run((s) => cancelOccurrence(s, ref, { reason: "rain" }));
    await run((s) => applyFromWeek(s, lessonId, "2026-11-09", { startTime: "16:00" }));
    // Changement de jour de la nouvelle version : ses exceptions suivent (même semaine).
    const nextId = state.lessons.find((l) => l.previousLessonId === lessonId)?.id as string;
    await run((s) =>
      moveLesson(s, nextId, { weekday: 5, startTime: "16:00", courtId: refs.courtId }),
    );
    expect(state.exceptions.map((e) => [e.lessonId, e.occurrenceDate])).toEqual([
      [nextId, "2026-11-20"],
      [nextId, "2026-11-20"],
    ]);
    await run((s) =>
      createClosure(s, { seasonId, label: "Noël", startDate: "2026-12-19", endDate: "2027-01-03" }),
    );
    await run((s) =>
      createOneOff(s, {
        seasonId,
        date: "2026-12-21",
        startTime: "10:00",
        durationMinutes: 120,
        courtId: refs.courtId,
        instructorId: refs.instructorId,
      }),
    );
    // Suppression de la première version : lien de la nouvelle version remis à nul.
    await run((s) => deleteLesson(s, lessonId));
    expect(state.lessons).toHaveLength(1);
    expect(state.lessons[0]?.previousLessonId).toBeNull();

    // Tout annuler, puis tout rétablir.
    while (history.past.length > 0) {
      const step = undo(history, state);
      await persistRevert(db, step.command as NonNullable<typeof step.command>);
      ({ history, state } = step);
      await expectSameState(state);
    }
    expect(state).toEqual({ lessons: [], exceptions: [], closures: [] });
    while (history.future.length > 0) {
      const step = redo(history, state);
      await persistCommand(db, step.command as NonNullable<typeof step.command>);
      ({ history, state } = step);
      await expectSameState(state);
    }
    expect(state.exceptions).toHaveLength(3);
  });

  it("n'écrit rien si une mutation échoue (transaction)", async () => {
    const state = await loadPlanningState(db, seasonId);
    const command = createLesson(state, {
      seasonId,
      weekday: 3,
      startTime: "14:00",
      durationMinutes: 60,
      courtId: refs.courtId,
      groupId: refs.groupId,
      instructorId: "moniteur-inconnu",
      effectiveFrom: "2026-09-01",
    });
    const closure = createClosure(state, {
      seasonId,
      label: "Noël",
      startDate: "2026-12-19",
      endDate: "2027-01-03",
    });
    await expect(persistMutations(db, [...closure.forward, ...command.forward])).rejects.toThrow();
    expect(await loadPlanningState(db, seasonId)).toEqual(state);
    await persistMutations(db, []);
  });
});
