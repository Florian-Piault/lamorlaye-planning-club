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

// Pas de paramètre de type (le type se déduit de `?raw`). La clé du cache
// disque de Vitest (`node_modules/.vitest-cache`) tient compte du texte du
// fichier et de la configuration, mais pas des fichiers visés par le glob. Vitest
// n'écarte donc de ce cache qu'un module dont le texte contient « glob » suivi
// directement de la parenthèse. Avec un paramètre de type entre les deux, une
// migration ajoutée restait invisible des tests tant que le cache n'était pas
// vidé. Garde-fou : « migrations embarquées » dans `migrations.test.ts`.
const migrationFiles = import.meta.glob("./migrations/*.sql", {
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
 * Migrations à appliquer sur une base **existante** (déjà migrée au moins une
 * fois) : sert à la sauvegarder avant de la migrer. Vide pour une base neuve.
 */
export async function pendingMigrations(
  driver: SqlDriver,
  migrations: readonly Migration[] = bundledMigrations,
): Promise<string[]> {
  const [table] = await driver.query(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__migrations'",
  );
  if (!table) return [];
  const rows = await driver.query("SELECT tag FROM __migrations");
  const applied = new Set(rows.map(([tag]) => String(tag)));
  if (applied.size === 0) return [];
  return migrations.filter((m) => !applied.has(m.tag)).map((m) => m.tag);
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

/** La sauvegarde préalable à une mise à jour a échoué : la base n'a pas été migrée. */
export class MigrationBackupError extends Error {
  override name = "MigrationBackupError";
}

/** Message lisible d'une erreur de commande Tauri (texte, objet `{ message }`, `Error`). */
function describeError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return String(error);
}

/**
 * Applique les migrations en attente, après une copie de sécurité de la base
 * (§11.3) si c'est une base existante qui doit évoluer. Une base neuve ou à
 * jour n'est pas copiée. Si la copie échoue, rien n'est migré : la base reste
 * dans son état d'origine et l'erreur dit pourquoi (nouvel essai au prochain
 * démarrage ou à la prochaine ouverture).
 */
export async function migrateWithBackup(
  driver: SqlDriver,
  backup: () => Promise<unknown>,
  migrations: readonly Migration[] = bundledMigrations,
): Promise<string[]> {
  if ((await pendingMigrations(driver, migrations)).length > 0) {
    try {
      await backup();
    } catch (error) {
      throw new MigrationBackupError(
        `Impossible de sauvegarder avant la mise à jour : ${describeError(error)}`,
      );
    }
  }
  return migrate(driver, migrations);
}
