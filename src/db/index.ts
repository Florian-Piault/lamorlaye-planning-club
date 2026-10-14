import { isTauri } from "@tauri-apps/api/core";
import { createDatabase, type Db } from "./client";
import type { SqlDriver } from "./driver";
import { migrate } from "./migrate";

export type { Db } from "./client";
export type { SqlDriver } from "./driver";

export interface AppDatabase {
  driver: SqlDriver;
  db: Db;
  /** Migrations appliquées lors de cette ouverture. */
  appliedMigrations: string[];
}

let appDatabase: Promise<AppDatabase> | undefined;

/**
 * Ouvre la base de l'application et applique les migrations en attente.
 *
 * - dans Tauri : fichier `planning.db` du dossier de données de l'application ;
 * - dans un navigateur (développement, tests Playwright) : base sql.js en mémoire.
 *
 * L'ouverture n'a lieu qu'une fois par session : les appels suivants (par
 * exemple le double montage de `<StrictMode>` en développement) reçoivent la
 * même base, ce qui évite deux migrations concurrentes sur le même fichier.
 */
export function openAppDatabase(): Promise<AppDatabase> {
  appDatabase ??= openAndMigrate();
  return appDatabase;
}

async function openAndMigrate(): Promise<AppDatabase> {
  const driver = isTauri() ? await openDesktopDriver() : await openBrowserDriver();
  const appliedMigrations = await migrate(driver);
  return { driver, db: createDatabase(driver), appliedMigrations };
}

async function openDesktopDriver(): Promise<SqlDriver> {
  const { openTauriDriver } = await import("./drivers/tauri");
  return openTauriDriver();
}

async function openBrowserDriver(): Promise<SqlDriver> {
  const [{ openSqlJsDriver }, { default: wasmUrl }] = await Promise.all([
    import("./drivers/sqljs"),
    import("sql.js/dist/sql-wasm.wasm?url"),
  ]);
  return openSqlJsDriver({ wasmUrl });
}
