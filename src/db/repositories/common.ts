import { count, type SQL, sql } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import { describeUsage, type Usage } from "@/domain/usage";
import type { Db } from "../client";

/** Nombre de lignes d'une table vérifiant une condition. */
export async function countWhere(
  db: Db,
  table: SQLiteTable,
  where: SQL | undefined,
): Promise<number> {
  const [row] = await db.select({ n: count() }).from(table).where(where);
  return row?.n ?? 0;
}

export interface UsageQuery {
  table: SQLiteTable;
  where: SQL | undefined;
  singular: string;
  plural: string;
}

/** Utilisation d'un élément, à partir de plusieurs comptages. */
export async function usageOf(db: Db, queries: readonly UsageQuery[]): Promise<Usage> {
  const counts = await Promise.all(
    queries.map(async (q) => ({
      count: await countWhere(db, q.table, q.where),
      singular: q.singular,
      plural: q.plural,
    })),
  );
  return describeUsage(counts);
}

/** Ordre suivant dans une liste ordonnée (`max(sort_order) + 1`), calculé par SQLite. */
export function nextSortOrder(column: SQLiteColumn, where?: SQL): SQL<number> {
  const table = column.table;
  return where
    ? sql<number>`(select coalesce(max(${column}), -1) + 1 from ${table} where ${where})`
    : sql<number>`(select coalesce(max(${column}), -1) + 1 from ${table})`;
}
