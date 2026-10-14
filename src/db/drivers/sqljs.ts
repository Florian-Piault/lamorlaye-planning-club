import initSqlJs, { type BindParams, type SqlValue as SqlJsValue } from "sql.js";
import type { SqlDriver, SqlParam, SqlResult, SqlRow, SqlStatement } from "../driver";

export interface SqlJsDriverOptions {
  /** URL du fichier `sql-wasm.wasm` (navigateur). Inutile sous Node. */
  wasmUrl?: string;
  /** Contenu d'une base existante à charger. */
  data?: Uint8Array;
}

/**
 * Implémentation sql.js : SQLite en mémoire, pour les tests (Vitest, Playwright)
 * et l'exécution du front hors de Tauri.
 */
export async function openSqlJsDriver(options: SqlJsDriverOptions = {}): Promise<SqlDriver> {
  const { wasmUrl } = options;
  const SQL = await initSqlJs(wasmUrl ? { locateFile: () => wasmUrl } : undefined);
  const database = new SQL.Database(options.data);
  // Même comportement que sqlx (pilote Tauri), qui active les clés étrangères par défaut.
  database.run("PRAGMA foreign_keys = ON");

  const execute = (statement: SqlStatement): SqlResult => {
    const stmt = database.prepare(statement.sql);
    try {
      stmt.bind(toSqlJsParams(statement.params));
      const rows: SqlRow[] = [];
      while (stmt.step()) rows.push(stmt.get());
      return { rows, rowsAffected: database.getRowsModified() };
    } finally {
      stmt.free();
    }
  };

  return {
    kind: "sqljs",
    location: ":memory:",
    async run(sql, params) {
      const { rowsAffected } = execute({ sql, params });
      return { rowsAffected };
    },
    async query(sql, params) {
      return execute({ sql, params }).rows;
    },
    async batch(statements) {
      database.run("BEGIN");
      try {
        const results = statements.map(execute);
        database.run("COMMIT");
        return results;
      } catch (error) {
        database.run("ROLLBACK");
        throw error;
      }
    },
    async close() {
      database.close();
    },
  };
}

function toSqlJsParams(params: readonly SqlParam[] = []): BindParams {
  return params.map((value): SqlJsValue => {
    if (typeof value === "boolean") return value ? 1 : 0;
    if (typeof value === "bigint") return Number(value);
    return value;
  });
}
