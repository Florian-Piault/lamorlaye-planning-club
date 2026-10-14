import { asc, eq } from "drizzle-orm";
import type { Usage } from "@/domain/usage";
import type { LevelInput } from "@/domain/validation";
import type { Db } from "../client";
import { groups, type Level, levels, students } from "../schema";
import { nextSortOrder, usageOf } from "./common";

/** Niveaux (communs à toutes les saisons), dans l'ordre du référentiel. */
export async function listLevels(db: Db): Promise<Level[]> {
  return db.select().from(levels).orderBy(asc(levels.sortOrder), asc(levels.label));
}

/** Crée un niveau, placé en fin de liste. */
export async function createLevel(db: Db, input: LevelInput): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(levels).values({ id, ...input, sortOrder: nextSortOrder(levels.sortOrder) });
  return id;
}

export async function updateLevel(db: Db, id: string, input: LevelInput): Promise<void> {
  await db.update(levels).set(input).where(eq(levels.id, id));
}

export async function reorderLevels(db: Db, orderedIds: readonly string[]): Promise<void> {
  const [first, ...rest] = orderedIds.map((id, sortOrder) =>
    db.update(levels).set({ sortOrder }).where(eq(levels.id, id)),
  );
  if (first) await db.batch([first, ...rest]);
}

/** Groupes et élèves qui utilisent ce niveau (toutes saisons confondues). */
export async function getLevelUsage(db: Db, id: string): Promise<Usage> {
  return usageOf(db, [
    { table: groups, where: eq(groups.levelId, id), singular: "groupe", plural: "groupes" },
    { table: students, where: eq(students.levelId, id), singular: "élève", plural: "élèves" },
  ]);
}

export async function setLevelActive(db: Db, id: string, active: boolean): Promise<void> {
  await db.update(levels).set({ active }).where(eq(levels.id, id));
}

/** Supprime un niveau ; les groupes et élèves qui l'utilisaient n'ont plus de niveau. */
export async function deleteLevel(db: Db, id: string): Promise<void> {
  await db.delete(levels).where(eq(levels.id, id));
}
