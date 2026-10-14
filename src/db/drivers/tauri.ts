import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";
import type { SqlDriver, SqlParam, SqlResult, SqlRow, SqlStatement } from "../driver";

/**
 * Implémentation Tauri : fichier SQLite dans le dossier de données de l'application.
 *
 * `tauri-plugin-sql` ouvre et ferme la base ; les lectures et les lots
 * transactionnels passent par deux commandes Rust (`src-tauri/src/db.rs`) qui
 * réutilisent le pool du plugin, pour obtenir des lignes sous forme de tableaux
 * et de vraies transactions.
 */
export async function openTauriDriver(): Promise<SqlDriver> {
  const url = await invoke<string>("database_url");
  const database = await Database.load(url);
  const db = database.path;

  const batch = (statements: readonly SqlStatement[]) =>
    invoke<SqlResult[]>("db_batch", {
      db,
      statements: statements.map((s) => ({ sql: s.sql, params: toJsonParams(s.params) })),
    });

  return {
    kind: "tauri",
    location: url.replace(/^sqlite:/, ""),
    async run(sql, params) {
      const [result] = await batch([{ sql, params }]);
      return { rowsAffected: result?.rowsAffected ?? 0 };
    },
    query(sql, params) {
      return invoke<SqlRow[]>("db_select_rows", { db, sql, params: toJsonParams(params) });
    },
    batch,
    async close() {
      await database.close();
    },
  };
}

/** Les paramètres transitent en JSON : les types non représentables sont convertis. */
function toJsonParams(params: readonly SqlParam[] = []): unknown[] {
  return params.map((value) => {
    if (typeof value === "bigint") return Number(value);
    if (value instanceof Uint8Array) {
      throw new Error("Les paramètres binaires ne sont pas pris en charge par le pilote Tauri.");
    }
    return value;
  });
}
