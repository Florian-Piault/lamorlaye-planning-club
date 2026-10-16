import { asc, eq } from "drizzle-orm";
import type { Usage } from "@/domain/usage";
import type { CourtInput } from "@/domain/validation";
import type { Db } from "../client";
import { type Court, courts, lessonExceptions, lessons } from "../schema";
import { nextSortOrder, usageOf } from "./common";

/** Courts de la saison, dans l'ordre d'affichage. */
export async function listCourts(db: Db, seasonId: string): Promise<Court[]> {
  return db
    .select()
    .from(courts)
    .where(eq(courts.seasonId, seasonId))
    .orderBy(asc(courts.sortOrder), asc(courts.name));
}

/** Crée un court, placé en fin de liste. */
export async function createCourt(db: Db, seasonId: string, input: CourtInput): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(courts).values({
    id,
    seasonId,
    ...input,
    sortOrder: nextSortOrder(courts.sortOrder, eq(courts.seasonId, seasonId)),
  });
  return id;
}

export async function updateCourt(db: Db, id: string, input: CourtInput): Promise<void> {
  await db.update(courts).set(input).where(eq(courts.id, id));
}

/** Enregistre un nouvel ordre d'affichage (identifiants dans l'ordre voulu). */
export async function reorderCourts(db: Db, orderedIds: readonly string[]): Promise<void> {
  if (orderedIds.length === 0) return;
  const [first, ...rest] = orderedIds.map((id, sortOrder) =>
    db.update(courts).set({ sortOrder }).where(eq(courts.id, id)),
  );
  if (first) await db.batch([first, ...rest]);
}

/** Cours et exceptions qui utilisent ce court. */
export async function getCourtUsage(db: Db, id: string): Promise<Usage> {
  return usageOf(db, [
    { table: lessons, where: eq(lessons.courtId, id), singular: "cours", plural: "cours" },
    {
      table: lessonExceptions,
      where: eq(lessonExceptions.courtId, id),
      singular: "séance d'une semaine précise",
      plural: "séances d'une semaine précise",
    },
  ]);
}

export async function setCourtActive(db: Db, id: string, active: boolean): Promise<void> {
  await db.update(courts).set({ active }).where(eq(courts.id, id));
}

export async function deleteCourt(db: Db, id: string): Promise<void> {
  await db.delete(courts).where(eq(courts.id, id));
}
