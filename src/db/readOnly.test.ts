import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createClosure,
  createLesson,
  deleteLesson,
  type LessonInput,
  moveLesson,
} from "@/domain/commands";
import { buildImportCommand, emptyMapping, planImport } from "@/domain/studentImport";
import { PlanningStore } from "@/features/planning/store";
import { errorMessage } from "@/hooks/useLoader";
import { openTestDatabase } from "@/test/database";
import { seedFullSeason, seedSeason } from "@/test/fixtures";
import type { AppDatabase, Db } from ".";
import {
  assertSeasonWritable,
  isReadOnlyViolation,
  READ_ONLY_MESSAGE,
  readOnlyErrorOf,
  SeasonReadOnlyError,
  translateDatabaseError,
} from "./readOnly";
import {
  createCourt,
  deleteCourt,
  reorderCourts,
  setCourtActive,
  updateCourt,
} from "./repositories/courts";
import {
  addGroupMember,
  createGroup,
  deleteGroup,
  removeGroupMember,
  setGroupActive,
  updateGroup,
} from "./repositories/groups";
import {
  addUnavailability,
  createInstructor,
  deleteInstructor,
  deleteUnavailability,
  getInstructor,
  replaceAvailabilities,
  updateInstructor,
} from "./repositories/instructors";
import { deleteLevel, listLevels } from "./repositories/levels";
import { loadPlanningState, persistCommand, persistRevert } from "./repositories/planning";
import { duplicateSeason, updateSeason } from "./repositories/seasons";
import { loadImportContext, persistImport } from "./repositories/studentImport";
import { createStudent, deleteStudent, updateStudent } from "./repositories/students";
import { groups, type Season, seasons, students } from "./schema";

let app: AppDatabase;
let db: Db;
let archived: Season;
let active: Season;
let seeded: Awaited<ReturnType<typeof seedFullSeason>>;

beforeEach(async () => {
  app = await openTestDatabase();
  db = app.db;
  archived = await seedSeason(db);
  seeded = await seedFullSeason(db, archived.id);
  active = (
    await duplicateSeason(db, archived.id, {
      name: "2027-2028",
      startDate: "2027-09-01",
      endDate: "2028-06-30",
      displayStartTime: "08:00",
      displayEndTime: "22:00",
      displayedDays: [1, 2, 3, 4, 5, 6, 7],
    })
  ).season;
});

afterEach(async () => {
  await app.driver.close();
});

/** L'écriture est refusée parce que la saison est archivée. */
async function expectReadOnly(write: () => Promise<unknown>) {
  const error = await write().then(
    () => null,
    (e: unknown) => e,
  );
  expect(error, "l'écriture aurait dû être refusée").not.toBeNull();
  expect(isReadOnlyViolation(error)).toBe(true);
  expect(errorMessage(error)).toMatch(/terminée/);
}

const studentInput = {
  lastName: "Durand",
  firstName: "Paul",
  phone: "0611111111",
  birthDate: null,
  levelId: null,
  fftRanking: null,
  email: null,
  guardianName: null,
  guardianPhone: null,
};

const groupInput = {
  name: "Nouveau",
  levelId: null,
  minAge: null,
  maxAge: null,
  maxSize: 6,
  active: true,
};

describe("saison archivée en lecture seule : repositories", () => {
  it("refuse toute modification de la saison elle-même", async () => {
    await expectReadOnly(() =>
      updateSeason(db, archived.id, {
        name: "Renommée",
        startDate: archived.startDate,
        endDate: archived.endDate,
        displayStartTime: "08:00",
        displayEndTime: "22:00",
        displayedDays: [1],
      }),
    );
    await expectReadOnly(() => db.delete(seasons).where(eq(seasons.id, archived.id)));
  });

  it("refuse les écritures sur les courts", async () => {
    const { court1 } = seeded.courts;
    await expectReadOnly(() =>
      createCourt(db, archived.id, { name: "Court 3", kind: "indoor", active: true }),
    );
    await expectReadOnly(() =>
      updateCourt(db, court1, { name: "X", kind: "indoor", active: true }),
    );
    await expectReadOnly(() => setCourtActive(db, court1, false));
    await expectReadOnly(() => reorderCourts(db, [seeded.courts.court2, court1]));
    await expectReadOnly(() => deleteCourt(db, seeded.courts.court2));
  });

  it("refuse les écritures sur les moniteurs, leurs disponibilités et indisponibilités", async () => {
    const { julie, karim } = seeded.instructors;
    await expectReadOnly(() =>
      createInstructor(db, archived.id, {
        firstName: "Marc",
        lastName: "Leroy",
        phone: null,
        email: null,
        active: true,
      }),
    );
    await expectReadOnly(() =>
      updateInstructor(db, julie, {
        firstName: "Julie",
        lastName: "M.",
        phone: null,
        email: null,
        color: "#000000",
        initials: "JM",
        active: true,
      }),
    );
    await expectReadOnly(() => replaceAvailabilities(db, julie, []));
    await expectReadOnly(() =>
      addUnavailability(db, karim, {
        startsAt: "2027-01-04T00:00",
        endsAt: "2027-01-05T00:00",
        reason: null,
      }),
    );
    const unavailability = (await getInstructor(db, julie))?.unavailabilities[0];
    if (!unavailability) throw new Error("indisponibilité absente");
    await expectReadOnly(() => deleteUnavailability(db, unavailability.id));
    await expectReadOnly(() => deleteInstructor(db, karim));
    expect((await getInstructor(db, julie))?.availabilities).toHaveLength(2);
  });

  it("refuse les écritures sur les groupes, leur composition et les élèves", async () => {
    const { galaxie } = seeded.groups;
    const { lea, zoe } = seeded.students;
    await expectReadOnly(() => createGroup(db, archived.id, groupInput));
    await expectReadOnly(() => updateGroup(db, galaxie, groupInput));
    await expectReadOnly(() => setGroupActive(db, galaxie, false));
    await expectReadOnly(() => deleteGroup(db, galaxie));
    await expectReadOnly(() => addGroupMember(db, galaxie, zoe));
    await expectReadOnly(() => removeGroupMember(db, galaxie, lea));
    await expectReadOnly(() => createStudent(db, archived.id, studentInput));
    await expectReadOnly(() => updateStudent(db, lea, studentInput, []));
    await expectReadOnly(() => deleteStudent(db, lea));
    expect(await db.select().from(students).where(eq(students.seasonId, archived.id))).toHaveLength(
      3,
    );
  });

  it("refuse la suppression d'un niveau utilisé par une saison archivée", async () => {
    const [level, other] = await listLevels(db);
    if (!level || !other) throw new Error("niveaux absents");
    await db.update(groups).set({ levelId: level.id }).where(eq(groups.seasonId, active.id));
    // Utilisé seulement par la saison active : la suppression reste possible.
    await deleteLevel(db, level.id);
    await db.update(students).set({ levelId: other.id }).where(eq(students.seasonId, active.id));
    // La saison active est archivée à son tour : le niveau n'est plus supprimable.
    await seedSeason(db, "2028-2029");
    await expectReadOnly(() => deleteLevel(db, other.id));
    const error = await deleteLevel(db, other.id).catch((e: unknown) => e);
    expect(errorMessage(error)).toMatch(/^Ce niveau est utilisé par une saison terminée/);
    expect((await listLevels(db)).map((l) => l.id)).toContain(other.id);
  });

  it("laisse la saison active modifiable", async () => {
    await createCourt(db, active.id, { name: "Court 3", kind: "indoor", active: true });
    await createStudent(db, active.id, studentInput);
    await assertSeasonWritable(db, active.id);
  });
});

describe("saison archivée en lecture seule : commandes", () => {
  it("refuse la persistance d'une commande du planning ou des fermetures", async () => {
    const state = await loadPlanningState(db, archived.id);
    const input: LessonInput = {
      seasonId: archived.id,
      weekday: 2,
      startTime: "10:00",
      durationMinutes: 60,
      courtId: seeded.courts.court1,
      groupId: seeded.groups.galaxie,
      instructorId: seeded.instructors.julie,
      effectiveFrom: archived.startDate,
    };
    const creation = createLesson(state, input);
    await expect(persistCommand(db, creation)).rejects.toBeInstanceOf(SeasonReadOnlyError);
    const move = moveLesson(state, seeded.lessons.current, {
      weekday: 2,
      startTime: "09:00",
      courtId: seeded.courts.court1,
    });
    await expect(persistCommand(db, move)).rejects.toThrow(/2026-2027 est terminée/);
    await expect(
      persistRevert(db, deleteLesson(state, seeded.lessons.current)),
    ).rejects.toBeInstanceOf(SeasonReadOnlyError);
    const closure = createClosure(state, {
      seasonId: archived.id,
      label: "Toussaint",
      startDate: "2026-10-17",
      endDate: "2026-11-01",
    });
    await expect(persistCommand(db, closure)).rejects.toBeInstanceOf(SeasonReadOnlyError);
    expect(await loadPlanningState(db, archived.id)).toEqual(state);
  });

  it("refuse les commandes du magasin du planning (exécuter, annuler, rétablir)", async () => {
    const store = await PlanningStore.load(db, archived.id, { readOnly: true });
    expect(store.readOnly).toBe(true);
    const state = store.getSnapshot().state;
    expect(() =>
      store.execute(
        moveLesson(state, seeded.lessons.current, {
          weekday: 2,
          startTime: "09:00",
          courtId: seeded.courts.court1,
        }),
      ),
    ).toThrow(SeasonReadOnlyError);
    expect(store.undo()).toBeNull();
    expect(store.redo()).toBeNull();
    expect(store.getSnapshot().state).toBe(state);
    await store.flush();
    expect(await loadPlanningState(db, archived.id)).toEqual(state);
  });

  it("un magasin ouvert avant l'archivage voit ses écritures refusées puis rechargées", async () => {
    const other = await seedSeason(db, "Autre");
    const courtId = await createCourt(db, other.id, { name: "C", kind: "indoor", active: true });
    const groupId = await createGroup(db, other.id, groupInput);
    const instructorId = await createInstructor(db, other.id, {
      firstName: "A",
      lastName: "B",
      phone: null,
      email: null,
      active: true,
    });
    const store = await PlanningStore.load(db, other.id);
    // La saison est archivée (nouvelle saison créée ailleurs) alors que l'écran est ouvert.
    await seedSeason(db, "Encore une autre");
    store.execute(
      createLesson(store.getSnapshot().state, {
        seasonId: other.id,
        weekday: 1,
        startTime: "10:00",
        durationMinutes: 60,
        courtId,
        groupId,
        instructorId,
        effectiveFrom: other.startDate,
      }),
    );
    await store.flush();
    expect(store.getSnapshot().error).toMatch(/terminée/);
    expect(store.getSnapshot().state.lessons).toEqual([]);
  });

  it("refuse un import d'élèves dans une saison archivée", async () => {
    const context = await loadImportContext(db, archived.id);
    const mapping = { ...emptyMapping(), lastName: 0, firstName: 1, phone: 2 };
    const plan = planImport([{ line: 2, cells: ["Martin", "Hugo", "0601020304"] }], context, {
      mapping,
      duplicates: "ignore",
    });
    expect(plan.counts.create).toBe(1);
    const { command } = buildImportCommand(plan, context);
    await expect(persistImport(db, command)).rejects.toBeInstanceOf(SeasonReadOnlyError);
  });
});

describe("traduction des erreurs de lecture seule", () => {
  it("reconnaît le message des déclencheurs, y compris enveloppé", () => {
    const raw = new Error(
      "error returned from database: (code: 1811) Saison archivée : lecture seule.",
    );
    expect(translateDatabaseError(raw)).toBeInstanceOf(SeasonReadOnlyError);
    const wrapped = new Error("Failed query", { cause: raw });
    expect(readOnlyErrorOf(wrapped)?.message).toBe(READ_ONLY_MESSAGE);
    expect(readOnlyErrorOf("Saison archivée : lecture seule.")).toBeInstanceOf(SeasonReadOnlyError);
    const other = new Error("UNIQUE constraint failed");
    expect(translateDatabaseError(other)).toBe(other);
    expect(isReadOnlyViolation(null)).toBe(false);
    const explicit = new SeasonReadOnlyError("message");
    expect(translateDatabaseError(explicit)).toBe(explicit);
  });
});
