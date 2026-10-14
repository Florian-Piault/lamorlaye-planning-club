import type { Db } from "@/db";
import { createSeason } from "@/db/repositories/seasons";
import { lessons } from "@/db/schema";

/** Crée la saison 2026-2027 (active). */
export async function seedSeason(db: Db, name = "2026-2027") {
  return createSeason(db, {
    name,
    startDate: "2026-09-01",
    endDate: "2027-06-30",
    displayStartTime: "08:00",
    displayEndTime: "22:00",
    displayedDays: [1, 2, 3, 4, 5, 6, 7],
  });
}

/** Insère un cours de semaine type (pour tester l'utilisation des référentiels). */
export async function seedLesson(
  db: Db,
  refs: { seasonId: string; courtId: string; groupId: string; instructorId: string },
) {
  const id = crypto.randomUUID();
  await db.insert(lessons).values({
    id,
    ...refs,
    weekday: 3,
    startTime: "14:00",
    durationMinutes: 60,
    effectiveFrom: "2026-09-01",
  });
  return id;
}
