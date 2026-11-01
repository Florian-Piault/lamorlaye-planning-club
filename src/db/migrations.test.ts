// @vitest-environment node
import { readdirSync } from "node:fs";
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

/** Migrations qu'une base v1.0 reçoit à la mise à jour. */
const SINCE_V1_0 = ["0005_student_phone_optional", "0006_student_availabilities"];

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

describe("migrations embarquées", () => {
  it("comprennent tous les fichiers de src/db/migrations, dans l'ordre", () => {
    // Liste lue sur le disque à chaque exécution : si elle diffère, `migrate.ts`
    // vient d'un cache de transformation périmé (voir le commentaire de
    // `import.meta.glob` dans `migrate.ts`).
    const files = readdirSync(new URL("./migrations", import.meta.url))
      .filter((name) => name.endsWith(".sql"))
      .map((name) => name.replace(/\.sql$/, ""))
      .sort();
    expect(files).toContain("0006_student_availabilities");
    expect(bundledMigrations.map((m) => m.tag)).toEqual(files);
  });
});

describe("migration 0005 : téléphone de l'élève facultatif", () => {
  it("migre une base v1.0 sans perte", async () => {
    const d = await v1Database();
    driver = d;
    const before = {
      students: await dump(d, "students"),
      memberships: await dump(d, "group_students"),
    };
    expect(before.memberships).toHaveLength(3);
    expect(await pendingMigrations(d)).toEqual(SINCE_V1_0);

    expect(await migrate(d)).toEqual(SINCE_V1_0);
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
    expect(await migrate(d)).toEqual(SINCE_V1_0);
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
    expect(await migrateWithBackup(d, backup)).toEqual(SINCE_V1_0);
    // Copie faite avant la migration, quand la base était encore en v1.0.
    expect(calls).toEqual([`sauvegarde (${SINCE_V1_0.join(", ")})`]);

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
    expect(await pendingMigrations(d)).toEqual(SINCE_V1_0);
    expect(await migrateWithBackup(d, async () => {})).toEqual(SINCE_V1_0);
  });
});

describe("migration 0006 : disponibilités des élèves", () => {
  /** Base v1.1 (migrations 0000 à 0005) remplie, puis mise à jour. */
  async function v1_1Database(): Promise<SqlDriver> {
    const d = await v1Database();
    await migrate(
      d,
      bundledMigrations.filter((m) => m.tag < "0006"),
    );
    return d;
  }

  it("ajoute la table sans toucher aux élèves ni aux groupes", async () => {
    const d = await v1_1Database();
    driver = d;
    const before = {
      students: await dump(d, "students"),
      memberships: await dump(d, "group_students"),
    };
    expect(await migrate(d)).toEqual(["0006_student_availabilities"]);
    expect(await dump(d, "students")).toEqual(before.students);
    expect(await dump(d, "group_students")).toEqual(before.memberships);
    expect(await d.query("SELECT count(*) FROM student_availabilities")).toEqual([[0]]);
    const references = await d.query("PRAGMA foreign_key_list(student_availabilities)");
    expect(references.map((row) => [row[2], row[6]])).toEqual([["students", "CASCADE"]]);
    expect(await d.query("PRAGMA integrity_check")).toEqual([["ok"]]);
  });

  it("refuse un jour hors de 1 à 7 et une plage dont le début n'est pas avant la fin", async () => {
    const d = await v1_1Database();
    driver = d;
    await migrate(d);
    const insert = (id: string, weekday: number, start: string, end: string) =>
      d.run(
        `INSERT INTO student_availabilities (id, student_id, weekday, start_time, end_time)
         VALUES ('${id}', 'e3', ${weekday}, '${start}', '${end}')`,
      );

    await expect(insert("j0", 0, "14:00", "18:00")).rejects.toThrow(
      /student_availabilities_weekday_check/,
    );
    await expect(insert("j8", 8, "14:00", "18:00")).rejects.toThrow(
      /student_availabilities_weekday_check/,
    );
    await expect(insert("vide", 3, "14:00", "14:00")).rejects.toThrow(
      /student_availabilities_times_check/,
    );
    await expect(insert("inverse", 3, "18:00", "14:00")).rejects.toThrow(
      /student_availabilities_times_check/,
    );
    await insert("lundi", 1, "08:00", "09:00");
    await insert("dimanche", 7, "08:00", "09:00");
    expect(await d.query("SELECT id FROM student_availabilities ORDER BY id")).toEqual([
      ["dimanche"],
      ["lundi"],
    ]);
  });

  it("emporte les plages avec l'élève et protège celles d'une saison archivée", async () => {
    const d = await v1_1Database();
    driver = d;
    await migrate(d);
    const insert = (id: string, studentId: string, weekday = 3) =>
      d.run(
        `INSERT INTO student_availabilities (id, student_id, weekday, start_time, end_time)
         VALUES ('${id}', '${studentId}', ${weekday}, '14:00', '18:00')`,
      );

    // Saison active : plages libres (jour contrôlé), supprimées avec l'élève.
    await expect(insert("p0", "e3", 8)).rejects.toThrow(/CHECK/);
    await insert("p3", "e3");
    await d.run("DELETE FROM students WHERE id = 'e3'");
    expect(await d.query("SELECT id FROM student_availabilities")).toEqual([]);

    // Saison archivée : lecture seule…
    await insert("p2", "e2");
    await d.run("UPDATE seasons SET status = 'archived' WHERE id = 's2'");
    const readOnly = /Saison archivée : lecture seule\./;
    await expect(insert("p4", "e2", 6)).rejects.toThrow(readOnly);
    await expect(
      d.run("UPDATE student_availabilities SET end_time = '19:00' WHERE id = 'p2'"),
    ).rejects.toThrow(readOnly);
    await expect(d.run("DELETE FROM student_availabilities WHERE id = 'p2'")).rejects.toThrow(
      readOnly,
    );
    // …sauf l'effacement RGPD de l'élève, qui emporte ses plages.
    await d.batch([
      { sql: "INSERT INTO student_erasures (id, student_id) VALUES ('r2', 'e2')" },
      { sql: "DELETE FROM group_students WHERE student_id = 'e2'" },
      { sql: "DELETE FROM students WHERE id = 'e2'" },
      { sql: "DELETE FROM student_erasures WHERE id = 'r2'" },
    ]);
    expect(await d.query("SELECT id FROM student_availabilities")).toEqual([]);
  });
});
