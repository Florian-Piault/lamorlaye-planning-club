// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { openTestDatabase } from "@/test/database";
import type { AppDatabase } from ".";
import { bundledMigrations, migrate } from "./migrate";
import { courts, seasons } from "./schema";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe("base de données", () => {
  let database: AppDatabase;

  afterEach(async () => {
    await database?.driver.close();
  });

  it("applique la migration initiale une seule fois", async () => {
    database = await openTestDatabase();
    expect(database.appliedMigrations).toEqual(bundledMigrations.map((m) => m.tag));
    expect(database.appliedMigrations[0]).toBe("0000_initial");

    // Un second démarrage ne réapplique rien.
    expect(await migrate(database.driver)).toEqual([]);
  });

  it("crée toutes les tables du modèle avec UUID et horodatages", async () => {
    database = await openTestDatabase();
    const tables = (
      await database.driver.query(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> '__migrations' ORDER BY name",
      )
    ).map(([name]) => String(name));

    expect(tables).toEqual([
      "closures",
      "courts",
      "group_students",
      "groups",
      "instructor_availabilities",
      "instructor_unavailabilities",
      "instructors",
      "lesson_exceptions",
      "lessons",
      "levels",
      "seasons",
      "students",
    ]);

    for (const table of tables) {
      const columns = (await database.driver.query(`PRAGMA table_info(${table})`)).map(([, name]) =>
        String(name),
      );
      expect(columns, table).toEqual(expect.arrayContaining(["id", "created_at", "updated_at"]));
    }
  });

  it("insère et relit une saison via Drizzle", async () => {
    database = await openTestDatabase();
    const { db } = database;

    const [season] = await db
      .insert(seasons)
      .values({ name: "2026-2027", startDate: "2026-09-01", endDate: "2027-06-30" })
      .returning();

    expect(season?.id).toMatch(UUID);
    expect(season?.createdAt).toMatch(ISO_TIMESTAMP);
    expect(season?.status).toBe("active");
    expect(season?.displayedDays).toEqual([1, 2, 3, 4, 5, 6, 7]);

    const found = await db.query.seasons.findFirst({ where: eq(seasons.name, "2026-2027") });
    expect(found?.displayStartTime).toBe("08:00");
    expect(found?.displayEndTime).toBe("22:00");
  });

  it("annule entièrement un lot en échec (transaction)", async () => {
    database = await openTestDatabase();
    const { db } = database;
    const seasonId = crypto.randomUUID();

    await expect(
      db.batch([
        db.insert(seasons).values({
          id: seasonId,
          name: "2026-2027",
          startDate: "2026-09-01",
          endDate: "2027-06-30",
        }),
        // Clé étrangère invalide : le lot entier doit être annulé.
        db.insert(courts).values({ seasonId: "inexistante", name: "Court 1" }),
      ]),
    ).rejects.toThrow();

    expect(await db.select().from(seasons)).toEqual([]);
  });
});
