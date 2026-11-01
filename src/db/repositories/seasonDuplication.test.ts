import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLesson, moveLesson } from "@/domain/commands";
import { openTestDatabase } from "@/test/database";
import { seedFullSeason, seedSeason } from "@/test/fixtures";
import type { AppDatabase, Db } from "..";
import {
  courts,
  groupStudents,
  instructorAvailabilities,
  instructors,
  instructorUnavailabilities,
  lessonExceptions,
  lessons,
  type Season,
  students,
} from "../schema";
import { updateCourt } from "./courts";
import { addGroupMember, listGroups, listMemberships, removeGroupMember } from "./groups";
import { listInstructors, replaceAvailabilities, updateInstructor } from "./instructors";
import { loadPlanningState, persistCommand } from "./planning";
import { duplicateSeason, getActiveSeason, listSeasons, loadSeasonSnapshot } from "./seasons";
import {
  deleteStudent,
  getStudentAvailabilities,
  listStudents,
  replaceStudentAvailabilities,
  updateStudent,
} from "./students";

let app: AppDatabase;
let db: Db;
let origin: Season;

const nextInput = {
  name: "2027-2028",
  startDate: "2027-09-01",
  endDate: "2028-06-30",
  displayStartTime: "08:00",
  displayEndTime: "21:00",
  displayedDays: [1, 2, 3, 4, 5, 6],
};

beforeEach(async () => {
  app = await openTestDatabase();
  db = app.db;
  origin = await seedSeason(db);
  await seedFullSeason(db, origin.id);
});

afterEach(async () => {
  await app.driver.close();
});

/** Toutes les lignes de la saison d'origine, pour vérifier qu'elles n'ont pas bougé. */
async function originRows() {
  return {
    snapshot: await loadSeasonSnapshot(db, origin.id),
    planning: await loadPlanningState(db, origin.id),
    unavailabilities: await db.select().from(instructorUnavailabilities),
  };
}

describe("nouvelle saison par duplication", () => {
  it("archive la saison d'origine et active la nouvelle", async () => {
    const { season, summary } = await duplicateSeason(db, origin.id, nextInput);
    expect(season).toMatchObject({ ...nextInput, status: "active" });
    expect((await getActiveSeason(db))?.id).toBe(season.id);
    expect((await listSeasons(db)).map((s) => [s.name, s.status])).toEqual([
      ["2027-2028", "active"],
      ["2026-2027", "archived"],
    ]);
    expect(summary).toEqual({
      courts: 2,
      instructors: 2,
      groups: 2,
      students: 3,
      lessons: 2,
      skippedLessons: 2,
    });
  });

  it("copie courts, moniteurs, disponibilités, groupes, composition et élèves avec de nouveaux UUID", async () => {
    const before = await loadSeasonSnapshot(db, origin.id);
    const { season } = await duplicateSeason(db, origin.id, nextInput);
    const after = await loadSeasonSnapshot(db, season.id);

    const strip = <
      T extends { id: string; seasonId?: string; createdAt: string; updatedAt: string },
    >(
      rows: readonly T[],
    ) => rows.map(({ id: _i, seasonId: _s, createdAt: _c, updatedAt: _u, ...rest }) => rest);
    expect(strip(after.courts)).toEqual(strip(before.courts));
    expect(strip(after.instructors).sort((a, b) => a.firstName.localeCompare(b.firstName))).toEqual(
      strip(before.instructors).sort((a, b) => a.firstName.localeCompare(b.firstName)),
    );
    expect(after.students.map((s) => s.firstName).sort()).toEqual(["Léa", "Tom", "Zoé"]);
    expect(after.availabilities).toHaveLength(3);
    expect(after.memberships).toHaveLength(3);

    // Aucun identifiant partagé avec l'origine.
    const originIds = new Set(
      [
        ...before.courts,
        ...before.instructors,
        ...before.availabilities,
        ...before.groups,
        ...before.students,
        ...before.lessons,
      ].map((r) => r.id),
    );
    for (const row of [
      ...after.courts,
      ...after.instructors,
      ...after.availabilities,
      ...after.groups,
      ...after.students,
      ...after.lessons,
    ]) {
      expect(originIds.has(row.id)).toBe(false);
    }
    // Références réécrites vers les copies.
    const newInstructorIds = new Set(after.instructors.map((i) => i.id));
    expect(after.availabilities.every((a) => newInstructorIds.has(a.instructorId))).toBe(true);
    const newGroupIds = new Set(after.groups.map((g) => g.id));
    const newStudentIds = new Set(after.students.map((s) => s.id));
    expect(
      after.memberships.every((m) => newGroupIds.has(m.groupId) && newStudentIds.has(m.studentId)),
    ).toBe(true);
    const memberships = await listMemberships(db, season.id);
    const groupsByName = new Map((await listGroups(db, season.id)).map((g) => [g.name, g]));
    expect(groupsByName.get("Galaxie vert")?.memberCount).toBe(2);
    expect(groupsByName.get("Ados")?.memberCount).toBe(1);
    expect(memberships).toHaveLength(3);
  });

  it("recopie les plages de disponibilité de chaque élève sur sa copie", async () => {
    const { season } = await duplicateSeason(db, origin.id, nextInput);
    const byName = async (seasonId: string) =>
      new Map((await listStudents(db, seasonId)).map((s) => [s.firstName, s]));
    const [source, copy] = [await byName(origin.id), await byName(season.id)];
    const slotsOf = async (id: string | undefined) =>
      (await getStudentAvailabilities(db, id ?? "")).map((a) => ({
        id: a.id,
        studentId: a.studentId,
        slot: [a.weekday, a.startTime, a.endTime],
      }));
    const original = await slotsOf(source.get("Léa")?.id);
    const copied = await slotsOf(copy.get("Léa")?.id);
    expect(copied.map((a) => a.slot)).toEqual([
      [3, "14:00", "18:00"],
      [6, "09:00", "12:00"],
    ]);
    expect(copied.map((a) => a.slot)).toEqual(original.map((a) => a.slot));
    expect(copied.every((a) => a.studentId === copy.get("Léa")?.id)).toBe(true);
    expect(copied.map((a) => a.id)).not.toContain(original[0]?.id);
    // Un élève sans plage reste sans plage (disponible partout).
    expect(copy.get("Tom")?.hasAvailabilities).toBe(false);
    expect(copy.get("Léa")?.hasAvailabilities).toBe(true);
  });

  it("ne reprend que les versions de cours en vigueur en fin de saison, sur toute la nouvelle saison", async () => {
    const { season } = await duplicateSeason(db, origin.id, nextInput);
    const { lessons: copied, exceptions, closures } = await loadPlanningState(db, season.id);
    expect(exceptions).toEqual([]);
    expect(closures).toEqual([]);
    expect(
      copied.map((l) => [l.weekday, l.effectiveFrom, l.effectiveTo, l.previousLessonId]),
    ).toEqual([
      [1, "2027-09-01", null, null],
      [4, "2027-09-01", null, null],
    ]);
    const after = await loadSeasonSnapshot(db, season.id);
    const ids = {
      courts: new Set(after.courts.map((c) => c.id)),
      groups: new Set(after.groups.map((g) => g.id)),
      instructors: new Set(after.instructors.map((i) => i.id)),
    };
    for (const lesson of copied) {
      expect(lesson.seasonId).toBe(season.id);
      expect(ids.courts.has(lesson.courtId)).toBe(true);
      expect(ids.groups.has(lesson.groupId)).toBe(true);
      expect(ids.instructors.has(lesson.instructorId)).toBe(true);
      expect(lesson.note).toBe("Raquettes fournies");
    }
  });

  it("ne copie ni exceptions, ni indisponibilités datées, ni fermetures", async () => {
    const { season } = await duplicateSeason(db, origin.id, nextInput);
    const newInstructors = await listInstructors(db, season.id);
    const unavailabilities = await db.select().from(instructorUnavailabilities);
    expect(unavailabilities).toHaveLength(1);
    expect(newInstructors.map((i) => i.id)).not.toContain(unavailabilities[0]?.instructorId);
    expect(
      await db.select().from(lessonExceptions).where(eq(lessonExceptions.seasonId, season.id)),
    ).toEqual([]);
  });

  it("la nouvelle saison est modifiable sans aucun effet sur l'origine", async () => {
    const before = await originRows();
    const { season } = await duplicateSeason(db, origin.id, nextInput);
    const copy = await loadSeasonSnapshot(db, season.id);
    const court = copy.courts[0];
    const instructor = copy.instructors[0];
    const group = copy.groups.find((g) => g.name === "Galaxie vert");
    const lea = copy.students.find((s) => s.firstName === "Léa");
    const tom = copy.students.find((s) => s.firstName === "Tom");
    if (!court || !instructor || !group || !lea || !tom) throw new Error("copie incomplète");

    // Référentiels.
    await updateCourt(db, court.id, { name: "Court central", kind: "indoor", active: true });
    await updateInstructor(db, instructor.id, {
      firstName: "Julia",
      lastName: instructor.lastName,
      phone: null,
      email: null,
      color: "#000000",
      initials: "JX",
      active: false,
    });
    await replaceAvailabilities(db, instructor.id, []);
    await replaceStudentAvailabilities(db, lea.id, []);
    await removeGroupMember(db, group.id, lea.id);
    await addGroupMember(db, group.id, lea.id);
    await updateStudent(
      db,
      lea.id,
      {
        lastName: "Durand",
        firstName: "Léa",
        phone: "0700000000",
        birthDate: null,
        levelId: null,
        fftRanking: "30/2",
        email: null,
        guardianName: null,
        guardianPhone: null,
      },
      [],
    );
    await deleteStudent(db, tom.id);
    // Semaine type.
    const state = await loadPlanningState(db, season.id);
    const firstLesson = state.lessons[0];
    if (!firstLesson) throw new Error("aucun cours copié");
    await persistCommand(
      db,
      moveLesson(state, firstLesson.id, { weekday: 6, startTime: "09:00", courtId: court.id }),
    );
    await persistCommand(
      db,
      createLesson(await loadPlanningState(db, season.id), {
        seasonId: season.id,
        weekday: 2,
        startTime: "18:00",
        durationMinutes: 90,
        courtId: court.id,
        groupId: group.id,
        instructorId: instructor.id,
        effectiveFrom: season.startDate,
      }),
    );

    expect(await originRows()).toEqual(before);
    // L'origine garde ses élèves, ses inscriptions et ses disponibilités.
    expect((await listStudents(db, origin.id)).map((s) => s.firstName)).toEqual([
      "Léa",
      "Tom",
      "Zoé",
    ]);
    expect(await db.select().from(courts).where(eq(courts.seasonId, origin.id))).toEqual(
      before.snapshot.courts,
    );
    expect((await db.select().from(students).where(eq(students.seasonId, origin.id))).length).toBe(
      3,
    );
  });

  it("ajoute les copies sans retirer aucune ligne de l'origine", async () => {
    await duplicateSeason(db, origin.id, nextInput);
    const counts = async () => ({
      instructors: (await db.select().from(instructors)).length,
      availabilities: (await db.select().from(instructorAvailabilities)).length,
      memberships: (await db.select().from(groupStudents)).length,
      lessons: (await db.select().from(lessons)).length,
    });
    expect(await counts()).toEqual({
      instructors: 4,
      availabilities: 6,
      memberships: 6,
      lessons: 6,
    });
  });

  it("refuse une saison d'origine inconnue", async () => {
    await expect(duplicateSeason(db, "inconnue", nextInput)).rejects.toThrow(
      "La saison à dupliquer est introuvable.",
    );
  });

  it("duplique une saison vide", async () => {
    const empty = await seedSeason(db, "Vide");
    const { season, summary } = await duplicateSeason(db, empty.id, nextInput);
    expect(summary.lessons).toBe(0);
    expect(season.status).toBe("active");
  });
});
