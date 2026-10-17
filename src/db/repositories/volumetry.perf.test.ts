/**
 * Tests de charge de l'accès aux données (sql.js) sur la volumétrie cible
 * (docs/SPECS.md §11.5) : chargement de l'écran Planning et des référentiels,
 * écriture d'une commande, duplication de saison.
 *
 * sql.js (WebAssembly) est plus lent que SQLite natif via `tauri-plugin-sql` :
 * ces seuils sont donc un majorant des temps de l'application de bureau.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { moveLesson } from "@/domain/commands";
import { loadPlanningReferences } from "@/features/planning/references";
import { openTestDatabase } from "@/test/database";
import { seedSeason } from "@/test/fixtures";
import { perfLimit } from "@/test/perf";
import { testContext } from "@/test/planning";
import { medianDuration, seedVolumeData, TARGET_VOLUME, type VolumeData } from "@/test/volumetry";
import { listGroupMembers, listGroups } from "./groups";
import { listInstructors } from "./instructors";
import { loadPlanningState, persistCommand } from "./planning";
import { duplicateSeason, loadSeasonSnapshot } from "./seasons";
import { listStudents } from "./students";

let db: Db;
let seasonId: string;
let data: VolumeData;
let seedDuration: number;

beforeAll(async () => {
  ({ db } = await openTestDatabase());
  seasonId = (await seedSeason(db)).id;
  const start = performance.now();
  data = await seedVolumeData(db, seasonId);
  seedDuration = performance.now() - start;
});

describe("volumétrie cible en base (sql.js)", () => {
  it("insère le club complet en une transaction de moins de 2 s", () => {
    expect(seedDuration).toBeLessThan(perfLimit(2_000));
  });

  it("charge les données de l'écran Planning en moins de 300 ms", async () => {
    const [refs, state] = await Promise.all([
      loadPlanningReferences(db, seasonId),
      loadPlanningState(db, seasonId),
    ]);
    expect(refs.courts).toHaveLength(TARGET_VOLUME.courts);
    expect(refs.instructors).toHaveLength(TARGET_VOLUME.instructors);
    expect(refs.groups).toHaveLength(TARGET_VOLUME.groups);
    expect(refs.students).toHaveLength(TARGET_VOLUME.students);
    expect(state.lessons).toHaveLength(TARGET_VOLUME.lessons);
    const duration = await medianDuration(
      () => Promise.all([loadPlanningReferences(db, seasonId), loadPlanningState(db, seasonId)]),
      { runs: 7, label: "chargement du planning" },
    );
    expect(duration).toBeLessThan(perfLimit(300));
  });

  it("liste les 500 élèves avec leurs groupes en moins de 150 ms", async () => {
    const list = await listStudents(db, seasonId);
    expect(list).toHaveLength(TARGET_VOLUME.students);
    expect(list.filter((s) => s.groups.length === 2).length).toBeGreaterThan(100);
    const duration = await medianDuration(() => listStudents(db, seasonId), {
      runs: 7,
      label: "liste des élèves",
    });
    expect(duration).toBeLessThan(perfLimit(150));
  });

  it("liste les groupes, leurs effectifs et une composition en moins de 100 ms", async () => {
    const list = await listGroups(db, seasonId);
    expect(list).toHaveLength(TARGET_VOLUME.groups);
    const total = list.reduce((sum, g) => sum + g.memberCount, 0);
    expect(total).toBe(data.memberships.length);
    const duration = await medianDuration(
      () =>
        Promise.all([
          listGroups(db, seasonId),
          listInstructors(db, seasonId),
          listGroupMembers(db, data.groups[0]?.id ?? ""),
        ]),
      { runs: 7, label: "groupes, moniteurs et composition" },
    );
    expect(duration).toBeLessThan(perfLimit(100));
  });

  it("enregistre une modification du planning en moins de 50 ms", async () => {
    const state = await loadPlanningState(db, seasonId);
    const ctx = testContext("charge");
    let hour = 8;
    const duration = await medianDuration(
      async () => {
        const lesson = state.lessons[hour % state.lessons.length];
        if (!lesson) throw new Error("aucun cours");
        hour = hour === 8 ? 21 : 8;
        await persistCommand(
          db,
          moveLesson(
            state,
            lesson.id,
            {
              weekday: lesson.weekday,
              startTime: `${hour}:00`.padStart(5, "0"),
              courtId: lesson.courtId,
            },
            ctx,
          ),
        );
      },
      { runs: 9, label: "écriture d'une commande" },
    );
    expect(duration).toBeLessThan(perfLimit(50));
  });

  it("duplique la saison complète en moins de 2 s", async () => {
    const start = performance.now();
    const { season, summary } = await duplicateSeason(db, seasonId, {
      name: "2027-2028",
      startDate: "2027-09-01",
      endDate: "2028-06-30",
      displayStartTime: "08:00",
      displayEndTime: "22:00",
      displayedDays: [1, 2, 3, 4, 5, 6, 7],
    });
    const duration = performance.now() - start;
    if (process.env.CHARGE_VERBOSE) {
      console.info(`[charge] duplication de saison : ${duration.toFixed(2)} ms`);
    }
    expect(summary).toMatchObject({
      courts: TARGET_VOLUME.courts,
      instructors: TARGET_VOLUME.instructors,
      groups: TARGET_VOLUME.groups,
      students: TARGET_VOLUME.students,
      lessons: TARGET_VOLUME.lessons,
    });
    const copy = await loadSeasonSnapshot(db, season.id);
    expect(copy.memberships).toHaveLength(data.memberships.length);
    expect(copy.availabilities).toHaveLength(data.availabilities.length);
    expect(duration).toBeLessThan(perfLimit(2_000));
  });
});
