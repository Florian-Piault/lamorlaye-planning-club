import type { AppDatabase } from "@/db";
import { createDatabase } from "@/db/client";
import { openSqlJsDriver } from "@/db/drivers/sqljs";
import { migrate } from "@/db/migrate";

/** Base sql.js en mémoire, migrée, pour les tests. */
export async function openTestDatabase(): Promise<AppDatabase> {
  const driver = await openSqlJsDriver();
  const appliedMigrations = await migrate(driver);
  return { driver, db: createDatabase(driver), appliedMigrations };
}
