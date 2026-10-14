import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildStudentExport, studentExportBytes } from "@/domain/rgpd";
import { openTestDatabase } from "@/test/database";
import { seedFullSeason, seedSeason } from "@/test/fixtures";
import type { AppDatabase, Db } from "..";
import { isReadOnlyViolation } from "../readOnly";
import { groupStudents, type Season, studentErasures, students } from "../schema";
import { listGroupMembers } from "./groups";
import { eraseStudents, findStudentRecords, listPeople } from "./rgpd";
import { duplicateSeason } from "./seasons";
import { createStudent, deleteStudent, listStudents } from "./students";

let app: AppDatabase;
let db: Db;
let origin: Season;
let next: Season;
let seeded: Awaited<ReturnType<typeof seedFullSeason>>;

beforeEach(async () => {
  app = await openTestDatabase();
  db = app.db;
  origin = await seedSeason(db);
  seeded = await seedFullSeason(db, origin.id);
  next = (
    await duplicateSeason(db, origin.id, {
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

async function copyOf(firstName: string) {
  const copy = (await listStudents(db, next.id)).find((s) => s.firstName === firstName);
  if (!copy) throw new Error(`${firstName} absente de la nouvelle saison`);
  return copy;
}

describe("RGPD : fiches d'une personne", () => {
  it("retrouve les fiches de toutes les saisons, avec niveau et groupes", async () => {
    const lea = await copyOf("Léa");
    const records = await findStudentRecords(db, lea.id);
    expect(records.map((r) => [r.season.name, r.season.status])).toEqual([
      ["2026-2027", "archived"],
      ["2027-2028", "active"],
    ]);
    expect(records[0]?.student.id).toBe(seeded.students.lea);
    expect(records[1]?.groups.map((g) => g.name)).toEqual(["Ados", "Galaxie vert"]);
  });

  it("distingue les homonymes nés à une autre date et gère l'absence de date de naissance", async () => {
    await createStudent(db, next.id, {
      lastName: "DUPONT",
      firstName: "lea",
      phone: "0600000000",
      birthDate: "2010-01-01",
      levelId: null,
      fftRanking: null,
      email: null,
      guardianName: null,
      guardianPhone: null,
    });
    const lea = await copyOf("Léa");
    expect(await findStudentRecords(db, lea.id)).toHaveLength(2);
    const zoe = await copyOf("Zoé");
    expect((await findStudentRecords(db, zoe.id)).map((r) => r.season.name)).toEqual([
      "2026-2027",
      "2027-2028",
    ]);
    expect(await findStudentRecords(db, "inconnu")).toEqual([]);
  });

  it("liste les personnes de toutes les saisons", async () => {
    const people = await listPeople(db);
    expect(people.map((p) => [p.firstName, p.records.map((r) => r.seasonName)])).toEqual([
      ["Léa", ["2027-2028", "2026-2027"]],
      ["Tom", ["2027-2028", "2026-2027"]],
      ["Zoé", ["2027-2028", "2026-2027"]],
    ]);
  });
});

describe("RGPD : export des données", () => {
  it("exporte toutes les fiches d'un élève en JSON lisible", async () => {
    const lea = await copyOf("Léa");
    const records = await findStudentRecords(db, lea.id);
    const document = buildStudentExport(records, "2027-10-01T08:00:00.000Z");
    expect(document.personne).toEqual({
      nom: "Dupont",
      prénom: "Léa",
      dateDeNaissance: "2017-05-04",
    });
    expect(document.saisons).toHaveLength(2);
    expect(document.saisons[1]).toMatchObject({
      saison: { nom: "2027-2028", statut: "active" },
      fiche: {
        téléphone: "0612345678",
        responsableLégal: { nom: "Marie Dupont", téléphone: "0698765432" },
      },
      groupes: [
        { nom: "Ados", niveau: null },
        { nom: "Galaxie vert", niveau: null },
      ],
    });
    const text = new TextDecoder().decode(studentExportBytes(records, "2027-10-01T08:00:00.000Z"));
    expect(JSON.parse(text)).toEqual(document);
    expect(text).toContain('\n  "personne": {');
  });
});

describe("RGPD : suppression définitive", () => {
  it("efface l'élève de toutes les saisons, y compris de ses groupes", async () => {
    const lea = await copyOf("Léa");
    const ids = (await findStudentRecords(db, lea.id)).map((r) => r.student.id);
    expect(await eraseStudents(db, ids)).toBe(2);

    expect(await findStudentRecords(db, lea.id)).toEqual([]);
    const remaining = await db.select().from(students);
    expect(remaining.map((s) => s.firstName).sort()).toEqual(["Tom", "Tom", "Zoé", "Zoé"]);
    const memberships = await db.select().from(groupStudents);
    expect(memberships.some((m) => ids.includes(m.studentId))).toBe(false);
    expect(memberships).toHaveLength(2);
    expect((await listGroupMembers(db, seeded.groups.galaxie)).map((s) => s.firstName)).toEqual([
      "Tom",
    ]);
    // Aucune trace laissée par l'effacement, ni dans les pages libres du fichier.
    expect(await db.select().from(studentErasures)).toEqual([]);
    expect(await app.driver.query("PRAGMA secure_delete")).toEqual([[1]]);
  });

  it("reste la seule écriture permise sur une saison archivée", async () => {
    // La suppression ordinaire d'un élève archivé est refusée…
    const error = await deleteStudent(db, seeded.students.tom).catch((e: unknown) => e);
    expect(isReadOnlyViolation(error)).toBe(true);
    // …l'effacement RGPD est accepté.
    expect(await eraseStudents(db, [seeded.students.tom])).toBe(1);
    expect(await db.select().from(students).where(eq(students.id, seeded.students.tom))).toEqual(
      [],
    );
  });

  it("ignore les identifiants inconnus", async () => {
    expect(await eraseStudents(db, [])).toBe(0);
    expect(await eraseStudents(db, ["inconnu"])).toBe(0);
  });
});
