import { asc, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { utils, write } from "xlsx";
import { readImportFile } from "@/domain/importFile";
import {
  buildImportCommand,
  type DuplicateMode,
  guessMapping,
  modifiedSinceImport,
  planImport,
} from "@/domain/studentImport";
import { importHistory } from "@/features/import-export/importHistory";
import { openTestDatabase } from "@/test/database";
import { seedSeason } from "@/test/fixtures";
import type { AppDatabase, Db } from "..";
import { groupStudents, levels, students } from "../schema";
import { addGroupMember, createGroup } from "./groups";
import {
  loadImportContext,
  loadImportFootprint,
  persistImport,
  revertImport,
} from "./studentImport";
import { createStudent, getStudent, listStudents, updateStudent } from "./students";

let database: AppDatabase;
let db: Db;
let seasonId: string;

beforeEach(async () => {
  database = await openTestDatabase();
  db = database.db;
  seasonId = (await seedSeason(db)).id;
  importHistory.reset();
});

afterEach(async () => {
  await database.driver.close();
});

const group = (name: string) =>
  createGroup(db, seasonId, {
    name,
    levelId: null,
    minAge: null,
    maxAge: null,
    maxSize: 8,
    active: true,
  });

/** Texte encodé en Windows-1252 (accents du Latin-1). */
const windows1252 = (text: string) => Uint8Array.from([...text].map((c) => c.charCodeAt(0)));

/** Analyse et importe un fichier ; renvoie la commande et le plan. */
async function importFile(bytes: Uint8Array, duplicates: DuplicateMode = "ignore") {
  const table = readImportFile(bytes, "eleves.csv");
  const context = await loadImportContext(db, seasonId);
  const plan = planImport(table.rows, context, {
    mapping: guessMapping(table.headers),
    duplicates,
  });
  const { command, summary } = buildImportCommand(plan, context, { fileName: "eleves.csv" });
  await persistImport(db, command);
  return { table, plan, command, summary };
}

const FIRST_NAMES = [
  "Zoé",
  "Léa",
  "Hélène",
  "Noé",
  "François",
  "Chloé",
  "Jérôme",
  "Anaïs",
  "Maël",
  "Inès",
];
const LAST_NAMES = [
  "Éluard",
  "Lefèvre",
  "Gérard",
  "Dupré",
  "Boileau",
  "Façon",
  "Mérou",
  "Lâché",
  "Ândré",
  "Brûlé",
];

/** Export d'adhérents de 300 lignes (en-têtes usuels, accents, groupes). */
function members(count: number, groups: readonly string[]): string[][] {
  const rows = [
    ["Nom", "Prénom", "Date de naissance", "Téléphone", "E-mail", "Responsable légal", "Groupe"],
  ];
  for (let i = 0; i < count; i++) {
    const day = String((i % 28) + 1).padStart(2, "0");
    const month = String((i % 12) + 1).padStart(2, "0");
    rows.push([
      `${LAST_NAMES[i % 10]}-${i}`,
      FIRST_NAMES[i % 10] as string,
      `${day}/${month}/${2005 + (i % 15)}`,
      `06 ${String(10_000_000 + i)
        .slice(-8)
        .replace(/(\d\d)(?=\d)/g, "$1 ")}`,
      `eleve${i}@exemple.fr`,
      i % 3 === 0 ? `Parent ${LAST_NAMES[i % 10]}` : "",
      groups[i % groups.length] as string,
    ]);
  }
  return rows;
}

describe("import d'élèves en base", () => {
  it("importe, annule puis rétablit un import en une seule commande", async () => {
    const vert = await group("Galaxie vert 1");
    const adultes = await group("Adultes 1");
    const [debutant] = await db.select().from(levels).where(eq(levels.label, "Débutant"));
    // Élève déjà enregistré, inscrit dans « Galaxie vert 1 ».
    const existingId = crypto.randomUUID();
    await db.insert(students).values({
      id: existingId,
      seasonId,
      lastName: "Martin",
      firstName: "Léa",
      phone: "0611223344",
      birthDate: "2015-01-05",
    });
    await db.insert(groupStudents).values({ groupId: vert, studentId: existingId });

    const csv = [
      "Nom;Prénom;Téléphone;Date de naissance;Niveau;Groupe",
      "MARTIN;lea;07 00 00 00 00;05/01/2015;Débutant;Galaxie vert 1, Adultes 1",
      "Éluard;Zoé;611223344;12/03/2017;;Galaxie vert 1",
      "Durand;Tom;;01/10/2016;;",
      "Cœur;Noé;0622334455;31/02/2016;;",
      "Lefèvre;Hélène;0633445566;;Inconnu;Zumba",
    ].join("\r\n");
    const bytes = new Uint8Array([...csv].map((c) => (c === "œ" ? 0x9c : c.charCodeAt(0))));
    const { table, plan, command, summary } = await importFile(bytes, "update");
    expect(table.format).toMatchObject({ encoding: "windows-1252", delimiter: ";" });
    expect(plan.rows.map((r) => r.status)).toEqual([
      "update",
      "create",
      "error",
      "error",
      "create",
    ]);
    expect(summary).toEqual({ created: 2, updated: 1, memberships: 2 });

    const after = await listStudents(db, seasonId);
    expect(
      after.map((s) => `${s.lastName} ${s.firstName}`).sort((a, b) => a.localeCompare(b, "fr")),
    ).toEqual(["Éluard Zoé", "Lefèvre Hélène", "Martin Léa"]);
    const martin = after.find((s) => s.id === existingId);
    expect(martin).toMatchObject({ phone: "07 00 00 00 00", levelId: debutant?.id });
    expect(martin?.groups.map((g) => g.id).sort()).toEqual([adultes, vert].sort());
    expect(after.find((s) => s.firstName === "Zoé")).toMatchObject({
      phone: "0611223344",
      birthDate: "2017-03-12",
      groups: [{ id: vert, name: "Galaxie vert 1" }],
    });

    // Annulation : retour exact à l'état d'origine.
    await revertImport(db, command);
    const reverted = await listStudents(db, seasonId);
    expect(reverted).toHaveLength(1);
    expect(reverted[0]).toMatchObject({
      id: existingId,
      phone: "0611223344",
      levelId: null,
      groups: [{ id: vert, name: "Galaxie vert 1" }],
    });

    // Rétablissement.
    await persistImport(db, command);
    expect(await listStudents(db, seasonId)).toHaveLength(3);
  });

  it("ignore les élèves déjà enregistrés en mode « ignorer »", async () => {
    const csv = "Nom,Prénom,Téléphone\nMartin,Léa,0611223344\n";
    await importFile(new TextEncoder().encode(csv));
    const second = await importFile(new TextEncoder().encode(`${csv}Durand,Tom,0622334455\n`));
    expect(second.plan.counts).toMatchObject({ create: 1, duplicate: 1 });
    expect(await listStudents(db, seasonId)).toHaveLength(2);
  });

  it("annule et rétablit par l'historique des imports", async () => {
    const table = readImportFile(
      new TextEncoder().encode("Nom\tPrénom\tTél\nMartin\tLéa\t0611223344\n"),
    );
    const context = await loadImportContext(db, seasonId);
    const plan = planImport(table.rows, context, {
      mapping: guessMapping(table.headers),
      duplicates: "ignore",
    });
    const { command, summary } = buildImportCommand(plan, context);
    expect(await importHistory.execute(db, { command, summary, fileName: "a.txt" })).toBe(true);
    expect(importHistory.getSnapshot().past).toHaveLength(1);
    expect(await listStudents(db, seasonId)).toHaveLength(1);

    expect(await importHistory.undo(db)).toBe(true);
    expect(await listStudents(db, seasonId)).toHaveLength(0);
    expect(importHistory.getSnapshot()).toMatchObject({ past: [], busy: false, error: null });
    expect(importHistory.getSnapshot().future).toHaveLength(1);
    expect(await importHistory.undo(db)).toBe(false);

    expect(await importHistory.redo(db)).toBe(true);
    expect(await listStudents(db, seasonId)).toHaveLength(1);
    expect(await importHistory.redo(db)).toBe(false);

    // Un import refusé par la base n'entre pas dans l'historique.
    expect(await importHistory.execute(db, { command, summary, fileName: "a.txt" })).toBe(false);
    expect(importHistory.getSnapshot().error).toMatch(/UNIQUE|constraint/i);
    expect(importHistory.getSnapshot().past).toHaveLength(1);
    importHistory.dismissError();
    expect(importHistory.getSnapshot().error).toBeNull();
  });

  it("protège les modifications faites après l'import", async () => {
    const vert = await group("Galaxie vert 1");
    const adultes = await group("Adultes 1");
    const existingId = await createStudent(db, seasonId, {
      lastName: "Martin",
      firstName: "Léa",
      phone: "0611223344",
      birthDate: "2015-01-05",
      levelId: null,
      fftRanking: null,
      email: null,
      guardianName: null,
      guardianPhone: null,
    });
    const csv = [
      "Nom;Prénom;Téléphone;Date de naissance;Groupe",
      "Martin;Léa;0700000000;05/01/2015;Galaxie vert 1",
      "Durand;Tom;0622334455;;Galaxie vert 1",
    ].join("\n");
    const table = readImportFile(new TextEncoder().encode(csv));
    const context = await loadImportContext(db, seasonId);
    const plan = planImport(table.rows, context, {
      mapping: guessMapping(table.headers),
      duplicates: "update",
    });
    const { command, summary } = buildImportCommand(plan, context);
    expect(await importHistory.execute(db, { command, summary, fileName: "a.csv" })).toBe(true);
    const tom = (await listStudents(db, seasonId)).find((s) => s.firstName === "Tom");
    if (!tom) throw new Error("Tom absent");

    // Rien n'a changé : pas de confirmation.
    const unchanged = modifiedSinceImport(command, await loadImportFootprint(db, command));
    expect(unchanged).toEqual([]);

    // Depuis : Tom est inscrit dans un autre groupe, la fiche de Léa est
    // enregistrée (ses inscriptions sont recréées avec de nouveaux identifiants).
    await addGroupMember(db, adultes, tom.id);
    const lea = await getStudent(db, existingId);
    if (!lea) throw new Error("Léa absente");
    const { id: _id, seasonId: _s, createdAt: _c, updatedAt: _u, ...leaInput } = lea;
    await updateStudent(db, existingId, { ...leaInput, email: "lea@exemple.fr" }, [vert]);

    expect(await importHistory.undo(db)).toBe(false);
    expect(importHistory.getSnapshot()).toMatchObject({
      confirmUndo: expect.stringMatching(/^2 élèves de cet import/),
      past: [expect.anything()],
    });
    importHistory.cancelUndo();
    expect(importHistory.getSnapshot().confirmUndo).toBeNull();
    expect(await listStudents(db, seasonId)).toHaveLength(2);

    expect(await importHistory.undo(db, { force: true })).toBe(true);
    const reverted = await listStudents(db, seasonId);
    expect(reverted).toHaveLength(1);
    // Téléphone d'origine rétabli, inscription ajoutée par l'import retirée
    // malgré son nouvel identifiant.
    expect(reverted[0]).toMatchObject({ id: existingId, phone: "0611223344", groups: [] });

    // Rétablissement alors que l'inscription existe déjà : pas de conflit.
    await addGroupMember(db, vert, existingId);
    expect(await importHistory.redo(db)).toBe(true);
    const redone = await listStudents(db, seasonId);
    expect(redone).toHaveLength(2);
    expect(redone.find((s) => s.id === existingId)?.groups).toEqual([
      { id: vert, name: "Galaxie vert 1" },
    ]);
  });

  it("analyse et importe 300 adhérents en moins de 5 secondes (CSV et Excel)", async () => {
    const groups = Array.from({ length: 15 }, (_, i) => `Groupe ${i + 1}`);
    for (const name of groups) await group(name);
    const rows = members(300, groups);

    const csv = rows.map((r) => r.join(";")).join("\r\n");
    let start = performance.now();
    const fromCsv = await importFile(windows1252(csv));
    const csvDuration = performance.now() - start;
    expect(fromCsv.plan.counts).toMatchObject({ create: 300, error: 0 });
    expect(fromCsv.summary.memberships).toBe(300);
    expect(csvDuration).toBeLessThan(5_000);

    const stored = await db.select().from(students).orderBy(asc(students.lastName));
    expect(stored).toHaveLength(300);
    expect(stored.some((s) => s.lastName === "Ândré-8" && s.firstName === "Maël")).toBe(true);
    await revertImport(db, fromCsv.command);
    expect(await db.select().from(students)).toHaveLength(0);

    const book = utils.book_new();
    utils.book_append_sheet(book, utils.aoa_to_sheet(rows), "Adhérents");
    const xlsx = new Uint8Array(write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
    start = performance.now();
    const fromXlsx = await importFile(xlsx);
    const xlsxDuration = performance.now() - start;
    expect(fromXlsx.plan.counts.create).toBe(300);
    expect(xlsxDuration).toBeLessThan(5_000);
    expect(await db.select().from(groupStudents)).toHaveLength(300);
    console.info(
      `Import de 300 adhérents : CSV ${csvDuration.toFixed(0)} ms, Excel ${xlsxDuration.toFixed(0)} ms`,
    );
  });
});
