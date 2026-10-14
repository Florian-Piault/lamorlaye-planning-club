import { drizzle } from "drizzle-orm/sqlite-proxy";
import type { SqlDriver, SqlParam, SqlRow } from "./driver";
import { translateDatabaseError } from "./readOnly";
import * as schema from "./schema";

/**
 * Instance Drizzle branchée sur un pilote SQLite (`sqlite-proxy`).
 *
 * Pour une écriture atomique, utiliser `db.batch([...])`, qui passe par la
 * transaction du pilote. `db.transaction()` est à proscrire avec le pilote
 * Tauri : `BEGIN` et `COMMIT` pourraient partir sur deux connexions du pool.
 *
 * Une écriture refusée parce qu'elle touche une saison archivée (déclencheurs
 * de la base) lève une `SeasonReadOnlyError` (voir `readOnly.ts`).
 */
export function createDatabase(driver: SqlDriver) {
  return drizzle(
    async (sql, params, method) => {
      try {
        if (method === "run") {
          await driver.run(sql, params as SqlParam[]);
          return { rows: [] };
        }
        const rows = await driver.query(sql, params as SqlParam[]);
        return { rows: method === "get" ? firstRow(rows) : rows };
      } catch (error) {
        throw translateDatabaseError(error);
      }
    },
    async (queries) => {
      try {
        const results = await driver.batch(
          queries.map((q) => ({ sql: q.sql, params: q.params as SqlParam[] })),
        );
        return results.map((result, i) => ({
          rows: queries[i]?.method === "get" ? firstRow(result.rows) : result.rows,
        }));
      } catch (error) {
        throw translateDatabaseError(error);
      }
    },
    { schema, casing: "snake_case" },
  );
}

export type Db = ReturnType<typeof createDatabase>;

/**
 * Pour la méthode `get`, Drizzle attend la ligne elle-même (et `undefined`
 * si aucune ligne), et non un tableau de lignes.
 */
function firstRow(rows: SqlRow[]): SqlRow {
  return rows[0] as SqlRow;
}
