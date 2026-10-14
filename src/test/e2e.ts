/**
 * Outils des tests de bout en bout (Playwright), chargés dans la page par le
 * serveur Vite (`import("/src/test/e2e.ts")`) : ils partagent la base sql.js
 * en mémoire de l'application ouverte. Jamais importés par l'application.
 */
import { openAppDatabase } from "@/db";
import { loadPlanningState } from "@/db/repositories/planning";
import { getActiveSeason } from "@/db/repositories/seasons";
import {
  courts,
  groupStudents,
  groups,
  instructorAvailabilities,
  instructors,
  lessons,
  students,
} from "@/db/schema";

export interface SeedInstructor {
  firstName: string;
  lastName: string;
  initials: string;
  color: string;
  /** Plages `[jour, "HH:MM", "HH:MM"]`. */
  availability: [number, string, string][];
}

export interface SeedGroup {
  name: string;
  maxSize: number;
  /** Élèves (prénoms) ; un même prénom dans deux groupes désigne le même élève. */
  students: string[];
}

export interface SeedLesson {
  weekday: number;
  startTime: string;
  durationMinutes: number;
  court: string;
  group: string;
  instructor: string;
  /** Dates d'effet (par défaut : toute la saison). */
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface SeedPlanning {
  courts: { name: string; kind: "indoor" | "outdoor" }[];
  instructors: SeedInstructor[];
  groups: SeedGroup[];
  lessons: SeedLesson[];
}

async function activeSeason() {
  const { db } = await openAppDatabase();
  const season = await getActiveSeason(db);
  if (!season) throw new Error("Aucune saison active : créez-la d'abord.");
  return { db, season };
}

/** Insère les référentiels et les cours dans la saison active. */
export async function seedPlanning(spec: SeedPlanning): Promise<void> {
  const { db, season } = await activeSeason();
  const ids = new Map<string, string>();
  const id = (key: string) => {
    const value = ids.get(key);
    if (!value) throw new Error(`Référence inconnue : ${key}`);
    return value;
  };
  for (const [i, court] of spec.courts.entries()) {
    const courtId = crypto.randomUUID();
    ids.set(`court:${court.name}`, courtId);
    await db.insert(courts).values({ id: courtId, seasonId: season.id, ...court, sortOrder: i });
  }
  for (const instructor of spec.instructors) {
    const instructorId = crypto.randomUUID();
    ids.set(`instructor:${instructor.firstName}`, instructorId);
    await db.insert(instructors).values({
      id: instructorId,
      seasonId: season.id,
      firstName: instructor.firstName,
      lastName: instructor.lastName,
      initials: instructor.initials,
      color: instructor.color,
    });
    for (const [weekday, startTime, endTime] of instructor.availability) {
      await db
        .insert(instructorAvailabilities)
        .values({ instructorId, weekday, startTime, endTime });
    }
  }
  for (const group of spec.groups) {
    const groupId = crypto.randomUUID();
    ids.set(`group:${group.name}`, groupId);
    await db
      .insert(groups)
      .values({ id: groupId, seasonId: season.id, name: group.name, maxSize: group.maxSize });
    for (const firstName of group.students) {
      if (!ids.has(`student:${firstName}`)) {
        const studentId = crypto.randomUUID();
        ids.set(`student:${firstName}`, studentId);
        await db.insert(students).values({
          id: studentId,
          seasonId: season.id,
          firstName,
          lastName: "Test",
          phone: "0600000000",
        });
      }
      await db.insert(groupStudents).values({ groupId, studentId: id(`student:${firstName}`) });
    }
  }
  const rows = spec.lessons.map((lesson) => ({
    id: crypto.randomUUID(),
    seasonId: season.id,
    weekday: lesson.weekday,
    startTime: lesson.startTime,
    durationMinutes: lesson.durationMinutes,
    courtId: id(`court:${lesson.court}`),
    groupId: id(`group:${lesson.group}`),
    instructorId: id(`instructor:${lesson.instructor}`),
    effectiveFrom: lesson.effectiveFrom ?? season.startDate,
    effectiveTo: lesson.effectiveTo ?? null,
  }));
  for (let i = 0; i < rows.length; i += 50) {
    await db.insert(lessons).values(rows.slice(i, i + 50));
  }
}

/** Cours enregistrés en base (lecture directe, pour vérifier la persistance). */
export async function readLessons(): Promise<
  {
    group: string;
    instructor: string;
    court: string;
    weekday: number;
    startTime: string;
    durationMinutes: number;
  }[]
> {
  const { db, season } = await activeSeason();
  const state = await loadPlanningState(db, season.id);
  const [courtRows, instructorRows, groupRows] = await Promise.all([
    db.select().from(courts),
    db.select().from(instructors),
    db.select().from(groups),
  ]);
  const name = (rows: { id: string; name?: string; firstName?: string }[], id: string) => {
    const row = rows.find((r) => r.id === id);
    return row?.name ?? row?.firstName ?? "?";
  };
  return state.lessons
    .map((l) => ({
      group: name(groupRows, l.groupId),
      instructor: name(instructorRows, l.instructorId),
      court: name(courtRows, l.courtId),
      weekday: l.weekday,
      startTime: l.startTime,
      durationMinutes: l.durationMinutes,
    }))
    .sort(
      (a, b) =>
        a.weekday - b.weekday ||
        a.startTime.localeCompare(b.startTime) ||
        a.court.localeCompare(b.court) ||
        a.group.localeCompare(b.group),
    );
}
