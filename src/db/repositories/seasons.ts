import { asc, desc, eq } from "drizzle-orm";
import type { SeasonInput } from "@/domain/validation";
import type { Db } from "../client";
import { type Season, seasons } from "../schema";

/** Saison active (une seule à la fois, garanti par un index unique partiel). */
export async function getActiveSeason(db: Db): Promise<Season | undefined> {
  return db.query.seasons.findFirst({ where: eq(seasons.status, "active") });
}

export async function listSeasons(db: Db): Promise<Season[]> {
  return db.select().from(seasons).orderBy(desc(seasons.startDate), asc(seasons.name));
}

/**
 * Crée une saison et en fait la saison active : l'éventuelle saison active
 * précédente est archivée dans la même transaction.
 */
export async function createSeason(db: Db, input: SeasonInput): Promise<Season> {
  const id = crypto.randomUUID();
  await db.batch([
    db.update(seasons).set({ status: "archived" }).where(eq(seasons.status, "active")),
    db.insert(seasons).values({ id, ...input, status: "active" }),
  ]);
  const created = await db.query.seasons.findFirst({ where: eq(seasons.id, id) });
  if (!created) throw new Error("La saison n'a pas été créée.");
  return created;
}

export async function updateSeason(db: Db, id: string, input: SeasonInput): Promise<void> {
  await db.update(seasons).set(input).where(eq(seasons.id, id));
}
