import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { INSTRUCTOR_PALETTE } from "@/domain/colors";
import type { StudentInput } from "@/domain/validation";
import { openTestDatabase } from "@/test/database";
import { seedLesson, seedSeason } from "@/test/fixtures";
import type { AppDatabase, Db } from "..";
import { groupStudents, students } from "../schema";
import {
  createCourt,
  deleteCourt,
  getCourtUsage,
  listCourts,
  reorderCourts,
  setCourtActive,
  updateCourt,
} from "./courts";
import {
  addGroupMember,
  createGroup,
  deleteGroup,
  getGroupUsage,
  listGroupMembers,
  listGroups,
  removeGroupMember,
} from "./groups";
import {
  addUnavailability,
  createInstructor,
  deleteInstructor,
  deleteUnavailability,
  getInstructor,
  getInstructorDefaults,
  getInstructorUsage,
  listInstructors,
  replaceAvailabilities,
  updateUnavailability,
} from "./instructors";
import { deleteLevel, getLevelUsage, listLevels } from "./levels";
import {
  createStudent,
  deleteStudent,
  getStudentAvailabilities,
  getStudentGroupIds,
  listStudents,
  updateStudent,
} from "./students";

const instructor = (lastName: string, firstName: string) => ({
  lastName,
  firstName,
  phone: null,
  email: null,
  active: true,
});

const student = (
  lastName: string,
  firstName: string,
  extra: Partial<StudentInput> = {},
): StudentInput => ({
  lastName,
  firstName,
  phone: "06 00 00 00 00",
  birthDate: null,
  levelId: null,
  fftRanking: null,
  email: null,
  guardianName: null,
  guardianPhone: null,
  ...extra,
});

const group = (name: string, maxSize = 8) => ({
  name,
  levelId: null,
  minAge: null,
  maxAge: null,
  maxSize,
  active: true,
});

describe("référentiels de la saison", () => {
  let database: AppDatabase;
  let db: Db;
  let seasonId: string;

  beforeEach(async () => {
    database = await openTestDatabase();
    db = database.db;
    seasonId = (await seedSeason(db)).id;
  });
  afterEach(async () => {
    await database.driver.close();
  });

  describe("courts", () => {
    it("crée les courts en fin de liste et les réordonne", async () => {
      const c1 = await createCourt(db, seasonId, { name: "Court 1", kind: "indoor", active: true });
      const c2 = await createCourt(db, seasonId, {
        name: "Court 2",
        kind: "outdoor",
        active: true,
      });
      const c3 = await createCourt(db, seasonId, {
        name: "Court 3",
        kind: "outdoor",
        active: true,
      });
      expect((await listCourts(db, seasonId)).map((c) => [c.name, c.sortOrder])).toEqual([
        ["Court 1", 0],
        ["Court 2", 1],
        ["Court 3", 2],
      ]);

      await reorderCourts(db, [c3, c1, c2]);
      expect((await listCourts(db, seasonId)).map((c) => c.name)).toEqual([
        "Court 3",
        "Court 1",
        "Court 2",
      ]);

      await updateCourt(db, c1, { name: "Central", kind: "indoor", active: false });
      expect((await listCourts(db, seasonId))[1]).toMatchObject({ name: "Central", active: false });
    });

    it("signale l'utilisation par des cours, empêche la suppression et permet l'archivage", async () => {
      const courtId = await createCourt(db, seasonId, {
        name: "Court 1",
        kind: "indoor",
        active: true,
      });
      expect(await getCourtUsage(db, courtId)).toEqual({ total: 0, description: "" });

      const instructorId = await createInstructor(db, seasonId, instructor("Benali", "Karim"));
      const groupId = await createGroup(db, seasonId, group("Galaxie vert"));
      await seedLesson(db, { seasonId, courtId, groupId, instructorId });

      expect(await getCourtUsage(db, courtId)).toEqual({ total: 1, description: "1 cours" });
      expect(await getInstructorUsage(db, instructorId)).toEqual({
        total: 1,
        description: "1 cours",
      });
      expect(await getGroupUsage(db, groupId)).toEqual({ total: 1, description: "1 cours" });

      await expect(deleteCourt(db, courtId)).rejects.toThrow();
      await expect(deleteInstructor(db, instructorId)).rejects.toThrow();
      await expect(deleteGroup(db, groupId)).rejects.toThrow();

      await setCourtActive(db, courtId, false);
      expect((await listCourts(db, seasonId))[0]?.active).toBe(false);
    });

    it("supprime un court inutilisé", async () => {
      const courtId = await createCourt(db, seasonId, {
        name: "Court 1",
        kind: "indoor",
        active: true,
      });
      await deleteCourt(db, courtId);
      expect(await listCourts(db, seasonId)).toEqual([]);
    });
  });

  describe("moniteurs", () => {
    it("attribue automatiquement une couleur non utilisée et des initiales uniques", async () => {
      const a = await createInstructor(db, seasonId, instructor("Benali", "Karim"));
      const b = await createInstructor(db, seasonId, instructor("Bertin", "Kevin"));
      const c = await createInstructor(db, seasonId, {
        ...instructor("Durand", "Marc"),
        color: INSTRUCTOR_PALETTE[5]?.value,
      });
      const d = await createInstructor(db, seasonId, instructor("Petit", "Julie"));

      const list = await listInstructors(db, seasonId);
      const byId = new Map(list.map((i) => [i.id, i]));
      expect(byId.get(a)).toMatchObject({ color: INSTRUCTOR_PALETTE[0]?.value, initials: "KB" });
      expect(byId.get(b)).toMatchObject({ color: INSTRUCTOR_PALETTE[1]?.value, initials: "KBe" });
      expect(byId.get(c)).toMatchObject({ color: INSTRUCTOR_PALETTE[5]?.value, initials: "MD" });
      expect(byId.get(d)?.color).toBe(INSTRUCTOR_PALETTE[2]?.value);
      expect(new Set(list.map((i) => i.color)).size).toBe(4);
    });

    it("propose une couleur en ignorant le moniteur modifié", async () => {
      const a = await createInstructor(db, seasonId, instructor("Benali", "Karim"));
      expect(await getInstructorDefaults(db, seasonId)).toMatchObject({
        color: INSTRUCTOR_PALETTE[1]?.value,
      });
      expect(
        await getInstructorDefaults(db, seasonId, { firstName: "Karim", lastName: "Benali" }, a),
      ).toEqual({ color: INSTRUCTOR_PALETTE[0]?.value, initials: "KB" });
    });

    it("n'utilise que les couleurs de la saison", async () => {
      await createInstructor(db, seasonId, instructor("Benali", "Karim"));
      const next = await seedSeason(db, "2027-2028");
      expect((await getInstructorDefaults(db, next.id)).color).toBe(INSTRUCTOR_PALETTE[0]?.value);
    });

    it("enregistre les plages hebdomadaires normalisées", async () => {
      const id = await createInstructor(db, seasonId, instructor("Benali", "Karim"));
      await replaceAvailabilities(db, id, [
        { weekday: 3, startTime: "14:00", endTime: "16:00" },
        { weekday: 1, startTime: "09:00", endTime: "12:00" },
        { weekday: 3, startTime: "16:00", endTime: "19:00" },
      ]);
      let detail = await getInstructor(db, id);
      expect(detail?.availabilities.map((s) => [s.weekday, s.startTime, s.endTime])).toEqual([
        [1, "09:00", "12:00"],
        [3, "14:00", "19:00"],
      ]);

      await replaceAvailabilities(db, id, [{ weekday: 2, startTime: "10:00", endTime: "11:00" }]);
      detail = await getInstructor(db, id);
      expect(detail?.availabilities.map((s) => s.weekday)).toEqual([2]);
      expect((await listInstructors(db, seasonId))[0]?.availabilities).toHaveLength(1);
    });

    it("gère les indisponibilités datées", async () => {
      const id = await createInstructor(db, seasonId, instructor("Benali", "Karim"));
      const u1 = await addUnavailability(db, id, {
        startsAt: "2026-11-09T00:00",
        endsAt: "2026-11-11T00:00",
        reason: "Tournoi",
      });
      await addUnavailability(db, id, {
        startsAt: "2026-10-05T08:00",
        endsAt: "2026-10-05T12:00",
        reason: null,
      });
      let detail = await getInstructor(db, id);
      expect(detail?.unavailabilities.map((u) => u.startsAt)).toEqual([
        "2026-10-05T08:00",
        "2026-11-09T00:00",
      ]);

      await updateUnavailability(db, u1, {
        startsAt: "2026-11-09T00:00",
        endsAt: "2026-11-12T00:00",
        reason: "Congé",
      });
      await expect(
        addUnavailability(db, id, {
          startsAt: "2026-11-09T10:00",
          endsAt: "2026-11-09T09:00",
          reason: null,
        }),
      ).rejects.toThrow();
      detail = await getInstructor(db, id);
      expect(detail?.unavailabilities[1]).toMatchObject({
        endsAt: "2026-11-12T00:00",
        reason: "Congé",
      });

      await deleteUnavailability(db, u1);
      expect((await getInstructor(db, id))?.unavailabilities).toHaveLength(1);
    });

    it("supprime un moniteur inutilisé avec ses disponibilités", async () => {
      const id = await createInstructor(db, seasonId, instructor("Benali", "Karim"));
      await replaceAvailabilities(db, id, [{ weekday: 1, startTime: "09:00", endTime: "12:00" }]);
      await deleteInstructor(db, id);
      expect(await getInstructor(db, id)).toBeUndefined();
      expect(await listInstructors(db, seasonId)).toEqual([]);
    });
  });

  describe("groupes et élèves", () => {
    it("compose un groupe et calcule son effectif", async () => {
      const levels = await listLevels(db);
      const vert = levels.find((l) => l.label === "Galaxie vert");
      const groupId = await createGroup(db, seasonId, {
        ...group("Galaxie vert 1"),
        levelId: vert?.id ?? null,
      });
      await createGroup(db, seasonId, group("Adultes"));
      const lea = await createStudent(db, seasonId, student("Martin", "Léa"));
      const tom = await createStudent(db, seasonId, student("Durand", "Tom"));

      await addGroupMember(db, groupId, lea);
      await addGroupMember(db, groupId, tom);
      await addGroupMember(db, groupId, tom);

      expect((await listGroupMembers(db, groupId)).map((s) => s.firstName)).toEqual(["Tom", "Léa"]);
      expect(
        (await listGroups(db, seasonId)).map((g) => [g.name, g.levelLabel, g.memberCount]),
      ).toEqual([
        ["Adultes", null, 0],
        ["Galaxie vert 1", "Galaxie vert", 2],
      ]);

      await removeGroupMember(db, groupId, tom);
      expect(await listGroupMembers(db, groupId)).toHaveLength(1);
    });

    it("inscrit un élève dans plusieurs groupes et les remplace", async () => {
      const g1 = await createGroup(db, seasonId, group("Groupe 1"));
      const g2 = await createGroup(db, seasonId, group("Groupe 2"));
      const g3 = await createGroup(db, seasonId, group("Groupe 3"));
      const id = await createStudent(db, seasonId, student("Martin", "Léa"), [g2, g1, g1]);

      let list = await listStudents(db, seasonId);
      expect(list[0]?.groups.map((g) => g.name)).toEqual(["Groupe 1", "Groupe 2"]);

      await updateStudent(db, id, student("Martin", "Léa", { fftRanking: "30/2" }), [g3]);
      list = await listStudents(db, seasonId);
      expect(list[0]).toMatchObject({ fftRanking: "30/2" });
      expect(list[0]?.groups.map((g) => g.name)).toEqual(["Groupe 3"]);
      expect(await getStudentGroupIds(db, id)).toEqual([g3]);
    });

    it("n'enregistre rien si l'inscription dans un groupe échoue", async () => {
      await expect(
        createStudent(db, seasonId, student("Martin", "Léa"), ["groupe-inexistant"]),
      ).rejects.toThrow();
      expect(await db.select().from(students)).toEqual([]);
    });

    it("enregistre les plages avec la fiche, fusionnées par jour, et les garde si on ne les donne pas", async () => {
      const g1 = await createGroup(db, seasonId, group("Groupe 1"));
      const id = await createStudent(
        db,
        seasonId,
        student("Martin", "Léa"),
        [g1],
        [
          { weekday: 3, startTime: "14:00", endTime: "16:00" },
          { weekday: 3, startTime: "16:00", endTime: "18:00" },
        ],
      );
      const slotsOf = async () =>
        (await getStudentAvailabilities(db, id)).map((s) => [s.weekday, s.startTime, s.endTime]);
      expect(await slotsOf()).toEqual([[3, "14:00", "18:00"]]);

      await updateStudent(
        db,
        id,
        student("Martin", "Léa"),
        [g1],
        [{ weekday: 6, startTime: "09:00", endTime: "12:00" }],
      );
      expect(await slotsOf()).toEqual([[6, "09:00", "12:00"]]);

      await updateStudent(db, id, student("Martin", "Léa", { fftRanking: "30/2" }), [g1]);
      expect(await slotsOf()).toEqual([[6, "09:00", "12:00"]]);

      await updateStudent(db, id, student("Martin", "Léa"), [g1], []);
      expect(await slotsOf()).toEqual([]);
    });

    it("n'enregistre ni la fiche ni les groupes si l'écriture des plages échoue", async () => {
      const g1 = await createGroup(db, seasonId, group("Groupe 1"));
      const g2 = await createGroup(db, seasonId, group("Groupe 2"));
      // Jour hors de 1 à 7 : refusé par la base (contrôle de la migration 0006).
      const invalid = [{ weekday: 9, startTime: "09:00", endTime: "12:00" }];

      // Création : aucun élève (un nouvel essai ne crée pas de doublon).
      await expect(
        createStudent(db, seasonId, student("Martin", "Léa"), [g1], invalid),
      ).rejects.toThrow();
      expect(await db.select().from(students)).toEqual([]);
      expect(await db.select().from(groupStudents)).toEqual([]);

      // Modification : identité, groupes et plages d'avant intacts.
      const id = await createStudent(
        db,
        seasonId,
        student("Martin", "Léa"),
        [g1],
        [{ weekday: 3, startTime: "14:00", endTime: "18:00" }],
      );
      await expect(
        updateStudent(db, id, student("Martin", "Léa", { fftRanking: "30/2" }), [g2], invalid),
      ).rejects.toThrow();
      expect((await listStudents(db, seasonId))[0]).toMatchObject({ fftRanking: null });
      expect(await getStudentGroupIds(db, id)).toEqual([g1]);
      expect(
        (await getStudentAvailabilities(db, id)).map((s) => [s.weekday, s.startTime, s.endTime]),
      ).toEqual([[3, "14:00", "18:00"]]);
    });

    it("supprime un élève et ses inscriptions, et un groupe sans supprimer ses élèves", async () => {
      const g1 = await createGroup(db, seasonId, group("Groupe 1"));
      const lea = await createStudent(db, seasonId, student("Martin", "Léa"), [g1]);
      const tom = await createStudent(db, seasonId, student("Durand", "Tom"), [g1]);

      await deleteStudent(db, lea);
      expect((await db.select().from(groupStudents)).map((m) => m.studentId)).toEqual([tom]);

      await deleteGroup(db, g1);
      expect(await db.select().from(groupStudents)).toEqual([]);
      expect((await listStudents(db, seasonId)).map((s) => s.firstName)).toEqual(["Tom"]);
    });

    it("signale l'utilisation d'un niveau et le retire des fiches à la suppression", async () => {
      const level = (await listLevels(db))[0];
      if (!level) throw new Error("niveau manquant");
      await createGroup(db, seasonId, { ...group("G"), levelId: level.id });
      await createStudent(db, seasonId, student("Martin", "Léa", { levelId: level.id }));
      await createStudent(db, seasonId, student("Durand", "Tom", { levelId: level.id }));

      expect(await getLevelUsage(db, level.id)).toEqual({
        total: 3,
        description: "1 groupe et 2 élèves",
      });
      await deleteLevel(db, level.id);
      expect((await listStudents(db, seasonId)).map((s) => s.levelId)).toEqual([null, null]);
    });
  });
});
