import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_LEVELS } from "@/domain/levels";
import type { SeasonInput } from "@/domain/validation";
import { openTestDatabase } from "@/test/database";
import { seedFullSeason } from "@/test/fixtures";
import type { AppDatabase } from "..";
import { onDataChange } from "../changes";
import { lessons, seasons } from "../schema";
import { createLevel, listLevels, reorderLevels } from "./levels";
import {
  countSeasonContents,
  createSeason,
  getActiveSeason,
  listSeasons,
  updateSeason,
} from "./seasons";

const input = (name: string, startDate: string, endDate: string): SeasonInput => ({
  name,
  startDate,
  endDate,
  displayStartTime: "08:00",
  displayEndTime: "22:00",
  displayedDays: [1, 2, 3, 4, 5, 6],
});

describe("saisons", () => {
  let database: AppDatabase;
  beforeEach(async () => {
    database = await openTestDatabase();
  });
  afterEach(async () => {
    await database.driver.close();
  });

  it("n'a aucune saison active au départ", async () => {
    expect(await getActiveSeason(database.db)).toBeUndefined();
  });

  it("crée une saison active", async () => {
    const season = await createSeason(database.db, input("2026-2027", "2026-09-01", "2027-06-30"));
    expect(season.status).toBe("active");
    expect(season.displayedDays).toEqual([1, 2, 3, 4, 5, 6]);
    expect((await getActiveSeason(database.db))?.id).toBe(season.id);
  });

  it("archive la saison active précédente : une seule saison active", async () => {
    const first = await createSeason(database.db, input("2026-2027", "2026-09-01", "2027-06-30"));
    const second = await createSeason(database.db, input("2027-2028", "2027-09-01", "2028-06-30"));
    expect((await getActiveSeason(database.db))?.id).toBe(second.id);
    const all = await listSeasons(database.db);
    expect(all.map((s) => [s.name, s.status])).toEqual([
      ["2027-2028", "active"],
      ["2026-2027", "archived"],
    ]);
    expect(all.find((s) => s.id === first.id)?.status).toBe("archived");
  });

  it("refuse deux saisons actives au niveau de la base", async () => {
    await createSeason(database.db, input("2026-2027", "2026-09-01", "2027-06-30"));
    await expect(
      database.db.insert(seasons).values({ ...input("Bis", "2026-09-01", "2027-06-30") }),
    ).rejects.toThrow();
  });

  it("modifie une saison", async () => {
    const season = await createSeason(database.db, input("2026-2027", "2026-09-01", "2027-06-30"));
    await updateSeason(database.db, season.id, {
      ...input("Saison 26-27", "2026-09-07", "2027-06-26"),
      displayStartTime: "09:00",
      displayedDays: [1, 2, 3, 4, 5, 6, 7],
    });
    const updated = await getActiveSeason(database.db);
    expect(updated).toMatchObject({
      name: "Saison 26-27",
      startDate: "2026-09-07",
      displayStartTime: "09:00",
      displayedDays: [1, 2, 3, 4, 5, 6, 7],
    });
    expect((updated?.updatedAt ?? "") >= season.updatedAt).toBe(true);
  });
});

describe("niveaux", () => {
  let database: AppDatabase;
  beforeEach(async () => {
    database = await openTestDatabase();
  });
  afterEach(async () => {
    await database.driver.close();
  });

  it("sont pré-remplis avec les niveaux Galaxie et adultes", async () => {
    const levels = await listLevels(database.db);
    expect(levels.map((l) => l.label)).toEqual(DEFAULT_LEVELS);
    expect(levels.every((l) => l.active)).toBe(true);
  });

  it("ajoute un niveau en fin de liste et réordonne", async () => {
    const id = await createLevel(database.db, { label: "Loisir", active: true });
    let levels = await listLevels(database.db);
    expect(levels.at(-1)).toMatchObject({ id, label: "Loisir", sortOrder: DEFAULT_LEVELS.length });

    await reorderLevels(database.db, [id, ...levels.filter((l) => l.id !== id).map((l) => l.id)]);
    levels = await listLevels(database.db);
    expect(levels[0]?.label).toBe("Loisir");
    expect(levels[1]?.label).toBe("Galaxie blanc");
  });
});

describe("guidage : comptes de la saison et avis d'écriture", () => {
  let database: AppDatabase;
  beforeEach(async () => {
    database = await openTestDatabase();
  });
  afterEach(async () => {
    await database.driver.close();
  });

  it("compte les fiches de la saison, de la saison vide à la saison complète", async () => {
    const season = await createSeason(database.db, input("2026-2027", "2026-09-01", "2027-06-30"));
    expect(await countSeasonContents(database.db, season.id)).toEqual({
      courts: 0,
      instructors: 0,
      groups: 0,
      students: 0,
      lessons: 0,
    });
    await seedFullSeason(database.db, season.id);
    const counts = await countSeasonContents(database.db, season.id);
    expect(Object.values(counts).every((n) => n > 0)).toBe(true);
  });

  it("un cours ponctuel compte comme premier cours", async () => {
    const season = await createSeason(database.db, input("2026-2027", "2026-09-01", "2027-06-30"));
    await seedFullSeason(database.db, season.id);
    // Plus aucun cours du planning habituel : reste le cours ponctuel de la saison.
    await database.db.delete(lessons).where(eq(lessons.seasonId, season.id));
    expect((await countSeasonContents(database.db, season.id)).lessons).toBe(1);
  });

  it("signale les écritures, pas les lectures", async () => {
    let writes = 0;
    const stop = onDataChange(() => {
      writes += 1;
    });
    try {
      const season = await createSeason(
        database.db,
        input("2026-2027", "2026-09-01", "2027-06-30"),
      );
      expect(writes).toBeGreaterThan(0);
      const before = writes;
      await listSeasons(database.db);
      await countSeasonContents(database.db, season.id);
      expect(writes).toBe(before);
      await updateSeason(
        database.db,
        season.id,
        input("2026-2027 bis", "2026-09-01", "2027-06-30"),
      );
      expect(writes).toBe(before + 1);
    } finally {
      stop();
    }
  });
});
