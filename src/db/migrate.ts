import type { SqlDriver } from "./driver";

/**
 * Migrations du schéma, générées par drizzle-kit (`pnpm db:generate`) dans
 * `src/db/migrations` et embarquées dans l'application par Vite.
 *
 * Elles sont appliquées au démarrage (§11.2), chacune dans sa propre
 * transaction, et consignées dans la table `__migrations`.
 */
export interface Migration {
  /** Nom du fichier sans extension, ex. `0000_initial`. */
  tag: string;
  sql: string;
}

const migrationFiles = import.meta.glob<string>("./migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
});

export const bundledMigrations: Migration[] = Object.entries(migrationFiles)
  .map(([path, sql]) => ({ tag: path.replace(/^.*\/(.+)\.sql$/, "$1"), sql }))
  .sort((a, b) => a.tag.localeCompare(b.tag));

const STATEMENT_BREAKPOINT = "--> statement-breakpoint";

export function splitStatements(sql: string): string[] {
  return sql
    .split(STATEMENT_BREAKPOINT)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

/**
 * Applique les migrations manquantes, dans l'ordre.
 * @returns les noms des migrations appliquées lors de cet appel.
 */
export async function migrate(
  driver: SqlDriver,
  migrations: readonly Migration[] = bundledMigrations,
): Promise<string[]> {
  await driver.run(
    `CREATE TABLE IF NOT EXISTS __migrations (
      tag TEXT PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    )`,
  );
  const rows = await driver.query("SELECT tag FROM __migrations");
  const applied = new Set(rows.map(([tag]) => String(tag)));

  const newlyApplied: string[] = [];
  for (const migration of migrations) {
    if (applied.has(migration.tag)) continue;
    await driver.batch([
      ...splitStatements(migration.sql).map((sql) => ({ sql })),
      {
        sql: "INSERT INTO __migrations (tag, applied_at) VALUES (?, ?)",
        params: [migration.tag, new Date().toISOString()],
      },
    ]);
    newlyApplied.push(migration.tag);
  }
  return newlyApplied;
}
