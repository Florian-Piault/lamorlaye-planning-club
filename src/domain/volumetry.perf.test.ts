/**
 * Tests de charge du moteur métier sur la volumétrie cible (docs/SPECS.md §11.5) :
 * 10 courts, 20 moniteurs, 60 groupes, 500 élèves, 150 cours, plus des
 * exceptions et les vacances d'une saison complète.
 *
 * Les seuils sont volontairement larges (machines de CI partagées) ; les
 * durées mesurées sur un poste de développement sont bien inférieures et
 * sont rappelées dans `docs/TRACABILITE.md`.
 */
import { describe, expect, it } from "vitest";
import { perfLimit } from "@/test/perf";
import { testContext } from "@/test/planning";
import {
  buildVolumeData,
  medianDuration,
  TARGET_VOLUME,
  VOLUME_SEASON,
  volumeConflictReferences,
  volumePlanningState,
} from "@/test/volumetry";
import { applyCommand, moveLesson } from "./commands";
import { createConflictIndex, detectConflicts, slotsFromOccurrences } from "./conflicts";
import { shiftWeek } from "./dates";
import { instructorHours } from "./hours";
import { buildHoursReport, seasonPeriod } from "./hoursReport";
import {
  activeOccurrences,
  occurrenceKey,
  occurrencesBetween,
  weekOccurrences,
} from "./occurrences";
import { planSeasonDuplication } from "./seasonDuplication";
import { addDays } from "./time";

const data = buildVolumeData("saison");
const state = volumePlanningState(data);
const source = { ...state, season: VOLUME_SEASON };
const references = volumeConflictReferences(data);
/** Semaine ordinaire de novembre (avec exceptions), hors vacances. */
const WEEK = "2026-11-16";

/** Toutes les semaines (lundis) de la saison. */
function seasonMondays(): string[] {
  const mondays: string[] = [];
  for (let monday = "2026-08-31"; monday <= VOLUME_SEASON.endDate; monday = shiftWeek(monday, 1)) {
    mondays.push(monday);
  }
  return mondays;
}

describe("volumétrie cible (§11.5)", () => {
  it("génère le club attendu", () => {
    expect(data.courts).toHaveLength(TARGET_VOLUME.courts);
    expect(data.instructors).toHaveLength(TARGET_VOLUME.instructors);
    expect(data.groups).toHaveLength(TARGET_VOLUME.groups);
    expect(data.students).toHaveLength(TARGET_VOLUME.students);
    expect(data.lessons).toHaveLength(TARGET_VOLUME.lessons);
    // Une semaine ordinaire affiche les 150 cours (plus les cours ponctuels).
    const week = weekOccurrences(source, WEEK);
    expect(week.filter((o) => o.kind === "regular")).toHaveLength(TARGET_VOLUME.lessons);
  });

  it("génère les séances d'une semaine en moins de 5 ms", async () => {
    const duration = await medianDuration(() => weekOccurrences(source, WEEK), {
      runs: 21,
      label: "séances d'une semaine",
    });
    expect(duration).toBeLessThan(perfLimit(5));
  });

  it("génère les séances de toute la saison en moins de 100 ms", async () => {
    const all = occurrencesBetween(source, VOLUME_SEASON.startDate, VOLUME_SEASON.endDate);
    // Environ 43 semaines × 150 cours, moins rien : les fermetures suspendent sans supprimer.
    expect(all.length).toBeGreaterThan(6_000);
    const duration = await medianDuration(
      () => occurrencesBetween(source, VOLUME_SEASON.startDate, VOLUME_SEASON.endDate),
      { label: "séances de la saison" },
    );
    expect(duration).toBeLessThan(perfLimit(100));
  });

  it("calcule les conflits d'une semaine en moins de 10 ms (référentiels compris)", async () => {
    const run = () =>
      detectConflicts(
        slotsFromOccurrences(activeOccurrences(weekOccurrences(source, WEEK))),
        createConflictIndex(references),
      );
    // Les groupes chargés à plus de 8 élèves et les élèves inscrits deux fois sont signalés.
    expect(run().size).toBeGreaterThan(0);
    expect(await medianDuration(run, { runs: 21, label: "conflits d'une semaine" })).toBeLessThan(
      perfLimit(10),
    );
  });

  it("parcourt les conflits de toutes les semaines de la saison en moins de 300 ms", async () => {
    const mondays = seasonMondays();
    expect(mondays.length).toBeGreaterThanOrEqual(43);
    const index = createConflictIndex(references);
    const duration = await medianDuration(
      () => {
        for (const monday of mondays) {
          detectConflicts(
            slotsFromOccurrences(activeOccurrences(weekOccurrences(source, monday))),
            index,
          );
        }
      },
      { runs: 5, warmup: 1, label: "conflits des 43 semaines" },
    );
    expect(duration).toBeLessThan(perfLimit(300));
  });

  it("calcule les heures de la saison par moniteur en moins de 150 ms", async () => {
    const period = seasonPeriod(VOLUME_SEASON);
    const refs = {
      instructors: data.instructors.map((i) => ({ ...i, active: true })),
      groups: data.groups,
      courts: data.courts,
    };
    const report = buildHoursReport(source, refs, period);
    expect(report.lines).toHaveLength(TARGET_VOLUME.instructors);
    // Cohérence avec le moteur : même total que la somme des séances actives.
    const total = instructorHours(source, period.from, period.to).reduce(
      (sum, h) => sum + h.minutes,
      0,
    );
    expect(report.totalMinutes).toBe(total);
    const duration = await medianDuration(() => buildHoursReport(source, refs, period), {
      label: "heures de la saison",
    });
    expect(duration).toBeLessThan(perfLimit(150));
  });

  it("prépare la duplication de la saison en moins de 50 ms", async () => {
    const snapshot = {
      courts: data.courts,
      instructors: data.instructors,
      availabilities: data.availabilities,
      groups: data.groups,
      students: data.students,
      memberships: data.memberships,
      lessons: state.lessons,
    } as unknown as Parameters<typeof planSeasonDuplication>[0];
    const target = { seasonId: "suivante", startDate: "2027-09-01" };
    const plan = planSeasonDuplication(snapshot, VOLUME_SEASON.endDate, target, testContext());
    expect(plan.students).toHaveLength(TARGET_VOLUME.students);
    expect(plan.lessons).toHaveLength(TARGET_VOLUME.lessons);
    expect(plan.memberships).toHaveLength(data.memberships.length);
    const duration = await medianDuration(
      () => planSeasonDuplication(snapshot, VOLUME_SEASON.endDate, target, testContext()),
      { label: "plan de duplication" },
    );
    expect(duration).toBeLessThan(perfLimit(50));
  });

  it("applique une commande (déplacement) en moins de 5 ms", async () => {
    const lesson = state.lessons[0];
    if (!lesson) throw new Error("aucun cours");
    const run = () =>
      applyCommand(
        state,
        moveLesson(
          state,
          lesson.id,
          { weekday: lesson.weekday === 1 ? 2 : 1, startTime: "08:00", courtId: lesson.courtId },
          testContext(),
        ),
      );
    expect(run().lessons.find((l) => l.id === lesson.id)?.startTime).toBe("08:00");
    expect(await medianDuration(run, { runs: 21, label: "commande de déplacement" })).toBeLessThan(
      perfLimit(5),
    );
  });

  it("place les séances déplacées dans la bonne semaine", () => {
    // Une modification datée d'une semaine reste visible dans sa semaine.
    const modification = state.exceptions.find((e) => e.kind === "modification");
    if (!modification?.date) throw new Error("aucune modification");
    const week = weekOccurrences(source, modification.date);
    expect(week.some((o) => o.modified && o.date === modification.date)).toBe(true);
    const next = weekOccurrences(source, addDays(modification.date, 7));
    const key = occurrenceKey(modification.lessonId ?? "", modification.occurrenceDate ?? "");
    expect(next.some((o) => o.key === key)).toBe(false);
  });
});
