// @vitest-environment node
import initSqlJs from "sql.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SqlDriver, SqlStatement } from "./driver";
import { openSqlJsDriver } from "./drivers/sqljs";
import {
  bundledMigrations,
  MigrationBackupError,
  migrate,
  migrateWithBackup,
  pendingMigrations,
  splitStatements,
} from "./migrate";

/**
 * Migration 0005 (téléphone de l'élève facultatif, v1.1) appliquée à une base
 * v1.0 : schéma des migrations 0000 à 0004, avec une saison active et une
 * saison archivée remplies. Rien ne doit se perdre, et les garde-fous (clés
 * étrangères, lecture seule des saisons archivées) doivent rester en place.
 */

const V1_0 = bundledMigrations.filter((m) => m.tag < "0005");

let driver: SqlDriver | undefined;

afterEach(async () => {
  await driver?.close();
  driver = undefined;
});

/** Données d'un club en v1.0 : deux saisons (2025-2026 archivée, 2026-2027 active). */
function v1Data(level: string): SqlStatement[] {
  const season = (id: string, name: string, start: string, end: string): SqlStatement => ({
    sql: `INSERT INTO seasons (id, name, start_date, end_date, status, displayed_days)
          VALUES (?, ?, ?, ?, 'active', '[1,2,3,4,5,6]')`,
    params: [id, name, start, end],
  });
  const group = (id: string, seasonId: string): SqlStatement => ({
    sql: "INSERT INTO groups (id, season_id, name, level_id, max_size) VALUES (?, ?, 'Galaxie vert', ?, 8)",
    params: [id, seasonId, level],
  });
  const member = (id: string, groupId: string, studentId: string): SqlStatement => ({
    sql: `INSERT INTO group_students (id, group_id, student_id, created_at, updated_at)
          VALUES (?, ?, ?, '2025-09-02T10:00:00.000Z', '2025-09-02T10:00:00.000Z')`,
    params: [id, groupId, studentId],
  });
  return [
    // Saison passée, remplie puis archivée (une seule saison active à la fois).
    season("s1", "2025-2026", "2025-09-01", "2026-06-30"),
    group("g1", "s1"),
    {
      sql: `INSERT INTO students (id, season_id, last_name, first_name, phone, birth_date, level_id,
              fft_ranking, email, guardian_name, guardian_phone, created_at, updated_at)
            VALUES ('e1', 's1', 'Martin', 'Léa', '06 11 22 33 44', '2017-03-12', ?, '30/2',
                    'lea@exemple.fr', 'Paul Martin', '06 99 88 77 66',
                    '2025-09-02T10:00:00.000Z', '2025-09-03T10:00:00.000Z')`,
      params: [level],
    },
    member("m1", "g1", "e1"),
    { sql: "UPDATE seasons SET status = 'archived' WHERE id = 's1'" },
    // Saison active.
    season("s2", "2026-2027", "2026-09-01", "2027-06-30"),
    group("g2", "s2"),
    {
      sql: `INSERT INTO students (id, season_id, last_name, first_name, phone, birth_date, level_id,
              fft_ranking, email, guardian_name, guardian_phone, created_at, updated_at)
            VALUES ('e2', 's2', 'Martin', 'Léa', '06 11 22 33 44', '2017-03-12', ?, NULL,
                    NULL, NULL, NULL, '2026-09-02T10:00:00.000Z', '2026-09-02T10:00:00.000Z'),
                   ('e3', 's2', 'Durand', 'Tom', '0622334455', NULL, NULL, NULL, NULL, NULL,
                    NULL, '2026-09-02T10:00:00.000Z', '2026-09-02T10:00:00.000Z')`,
      params: [level],
    },
    member("m2", "g2", "e2"),
    member("m3", "g2", "e3"),
  ];
}

/** Base v1.0 remplie, ouverte par le pilote de l'application. */
async function v1Database(): Promise<SqlDriver> {
  const sqlDriver = await openSqlJsDriver();
  await migrate(sqlDriver, V1_0);
  const [[level]] = (await sqlDriver.query("SELECT id FROM levels ORDER BY sort_order")) as [
    [string],
  ];
  await sqlDriver.batch(v1Data(level));
  return sqlDriver;
}

const dump = (d: SqlDriver, table: string) => d.query(`SELECT * FROM ${table} ORDER BY id`);

describe("migration 0005 : téléphone de l'élève facultatif", () => {
  it("migre une base v1.0 sans perte", async () => {
    const d = await v1Database();
    driver = d;
    const before = {
      students: await dump(d, "students"),
      memberships: await dump(d, "group_students"),
    };
    expect(before.memberships).toHaveLength(3);
    expect(await pendingMigrations(d)).toEqual(["0005_student_phone_optional"]);

    expect(await migrate(d)).toEqual(["0005_student_phone_optional"]);
    expect(await pendingMigrations(d)).toEqual([]);

    // Mêmes élèves, mêmes valeurs (horodatages compris), même composition des groupes.
    expect(await dump(d, "students")).toEqual(before.students);
    expect(await dump(d, "group_students")).toEqual(before.memberships);
    expect(await d.query("PRAGMA foreign_key_check")).toEqual([]);
    expect(await d.query("PRAGMA integrity_check")).toEqual([["ok"]]);

    // Colonne nullable, index recréés.
    const phone = (await d.query("PRAGMA table_info(students)")).find(([, n]) => n === "phone");
    expect(phone?.[3]).toBe(0);
    const indexes = (
      await d.query(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name IN ('students', 'group_students') AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
    ).map(([name]) => name);
    expect(indexes).toEqual([
      "group_students_student_idx",
      "group_students_unique_idx",
      "students_identity_idx",
      "students_season_idx",
    ]);
  });

  it("garde les clés étrangères et la lecture seule des saisons archivées", async () => {
    const d = await v1Database();
    driver = d;
    await migrate(d);

    // Élève sans téléphone, joignable par son responsable.
    await d.run(
      "INSERT INTO students (id, season_id, last_name, first_name, phone, guardian_phone) VALUES ('e4', 's2', 'Petit', 'Zoé', NULL, '0600000000')",
    );
    // La composition désigne la nouvelle table des élèves : contrôle et cascade intacts.
    await d.run("INSERT INTO group_students (id, group_id, student_id) VALUES ('m4', 'g2', 'e4')");
    await expect(
      d.run("INSERT INTO group_students (id, group_id, student_id) VALUES ('m5', 'g2', 'zz')"),
    ).rejects.toThrow(/FOREIGN KEY/);
    await d.run("DELETE FROM students WHERE id = 'e4'");
    expect(await d.query("SELECT id FROM group_students WHERE student_id = 'e4'")).toEqual([]);
    const references = await d.query("PRAGMA foreign_key_list(group_students)");
    expect(references.map((row) => row[2]).sort()).toEqual(["groups", "students"]);

    // Saison archivée : élèves, composition et niveaux utilisés restent protégés.
    const readOnly = /Saison archivée : lecture seule\./;
    await expect(d.run("UPDATE students SET phone = NULL WHERE id = 'e1'")).rejects.toThrow(
      readOnly,
    );
    await expect(d.run("DELETE FROM students WHERE id = 'e1'")).rejects.toThrow(readOnly);
    await expect(
      d.run(
        "INSERT INTO students (id, season_id, last_name, first_name) VALUES ('x', 's1', 'A', 'B')",
      ),
    ).rejects.toThrow(readOnly);
    await expect(d.run("DELETE FROM group_students WHERE id = 'm1'")).rejects.toThrow(readOnly);
    await expect(
      d.run("DELETE FROM levels WHERE id = (SELECT level_id FROM students WHERE id = 'e1')"),
    ).rejects.toThrow(readOnly);

    // L'effacement RGPD reste possible dans une saison archivée.
    await d.batch([
      { sql: "INSERT INTO student_erasures (id, student_id) VALUES ('r1', 'e1')" },
      { sql: "DELETE FROM students WHERE id = 'e1'" },
      { sql: "DELETE FROM student_erasures WHERE id = 'r1'" },
    ]);
    expect(await d.query("SELECT id FROM group_students WHERE student_id = 'e1'")).toEqual([]);
  });

  it("migre une sauvegarde v1.0 rouverte depuis son fichier", async () => {
    // Fichier de sauvegarde v1.0 : octets d'une base migrée et remplie par la v1.0.
    const SQL = await initSqlJs();
    const file = new SQL.Database();
    file.run("CREATE TABLE __migrations (tag TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL)");
    for (const migration of V1_0) {
      for (const statement of splitStatements(migration.sql)) file.run(statement);
      file.run("INSERT INTO __migrations (tag, applied_at) VALUES (?, ?)", [
        migration.tag,
        "2026-06-01T10:00:00.000Z",
      ]);
    }
    const level = String(file.exec("SELECT id FROM levels ORDER BY sort_order")[0]?.values[0]?.[0]);
    for (const { sql, params } of v1Data(level)) {
      file.run(sql, params ? (params as string[]) : undefined);
    }
    const bytes = file.export();
    file.close();

    const d = await openSqlJsDriver({ data: bytes });
    driver = d;
    expect(await migrate(d)).toEqual(["0005_student_phone_optional"]);
    expect(await d.query("SELECT count(*) FROM students")).toEqual([[3]]);
    expect(await d.query("SELECT count(*) FROM group_students")).toEqual([[3]]);
    expect(await d.query("PRAGMA foreign_key_check")).toEqual([]);
  });
});

describe("sauvegarde avant mise à jour", () => {
  it("sauvegarde une base existante avant de la migrer, et elle seule", async () => {
    const d = await v1Database();
    driver = d;
    const calls: string[] = [];
    // Simule la commande Tauri « backup_before_migration ».
    const backup = vi.fn(async () => {
      calls.push(`sauvegarde (${(await pendingMigrations(d)).join(", ")})`);
    });
    expect(await migrateWithBackup(d, backup)).toEqual(["0005_student_phone_optional"]);
    // Copie faite avant la migration, quand la base était encore en v1.0.
    expect(calls).toEqual(["sauvegarde (0005_student_phone_optional)"]);

    // Base déjà à jour : aucune copie.
    expect(await migrateWithBackup(d, backup)).toEqual([]);
    expect(backup).toHaveBeenCalledTimes(1);
  });

  it("ne sauvegarde pas une base neuve", async () => {
    const d = await openSqlJsDriver();
    driver = d;
    const backup = vi.fn(async () => {});
    expect(await migrateWithBackup(d, backup)).toEqual(bundledMigrations.map((m) => m.tag));
    expect(backup).not.toHaveBeenCalled();
  });

  it("ne migre rien si la sauvegarde échoue, avec un message clair", async () => {
    const d = await v1Database();
    driver = d;
    // Erreur renvoyée par la commande Rust : un simple texte.
    const failing = vi.fn(async () => {
      throw "Espace disque insuffisant";
    });
    const error = await migrateWithBackup(d, failing).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MigrationBackupError);
    expect((error as Error).message).toBe(
      "Impossible de sauvegarder avant la mise à jour : Espace disque insuffisant",
    );
    // La base reste en v1.0 ; un nouvel essai réussi la migre.
    expect(await pendingMigrations(d)).toEqual(["0005_student_phone_optional"]);
    expect(await migrateWithBackup(d, async () => {})).toEqual(["0005_student_phone_optional"]);
  });
});
