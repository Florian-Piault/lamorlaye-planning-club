/**
 * Outils des tests de bout en bout (Playwright), chargés dans la page par le
 * serveur Vite (`import("/src/test/e2e.ts")`) : ils partagent la base sql.js
 * en mémoire de l'application ouverte. Jamais importés par l'application.
 */
import { eq } from "drizzle-orm";
import { openAppDatabase } from "@/db";
import { createCourt, listCourts, updateCourt } from "@/db/repositories/courts";
import { loadPlanningState, persistCommand } from "@/db/repositories/planning";
import { getActiveSeason, listSeasons } from "@/db/repositories/seasons";
import {
  closures,
  courts,
  groupStudents,
  groups,
  instructorAvailabilities,
  instructors,
  instructorUnavailabilities,
  lessonExceptions,
  lessons,
  seasons,
  students,
} from "@/db/schema";
import { createClosure, emptyPlanningState } from "@/domain/commands";
import { errorMessage } from "@/hooks/useLoader";
import { seedVolumeData } from "./volumetry";

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
  /** Tranche d'âge (facultative). */
  minAge?: number;
  maxAge?: number;
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
  /** Périodes de fermeture (bornes incluses). */
  closures?: { label: string; startDate: string; endDate: string }[];
  /** Indisponibilités datées (`AAAA-MM-JJTHH:MM`, fin exclue). */
  unavailabilities?: { instructor: string; startsAt: string; endsAt: string; reason?: string }[];
  /**
   * Exceptions sur les séances du premier cours du groupe `group` à la date
   * `occurrenceDate` : annulation (pluie) ou remplacement par `instructor`.
   */
  exceptions?: {
    kind: "cancellation" | "replacement";
    group: string;
    occurrenceDate: string;
    instructor?: string;
  }[];
}

async function activeSeason() {
  const { db } = await openAppDatabase();
  const season = await getActiveSeason(db);
  if (!season) throw new Error("Aucune saison active : créez-la d'abord.");
  return { db, season };
}

/** Saison désignée par son nom, ou saison active. */
async function seasonNamed(name?: string) {
  if (!name) return activeSeason();
  const { db } = await openAppDatabase();
  const season = (await listSeasons(db)).find((s) => s.name === name);
  if (!season) throw new Error(`Saison inconnue : ${name}`);
  return { db, season };
}

/**
 * Tente d'écrire dans une saison sans passer par l'interface (repositories et
 * persistance des commandes) ; renvoie le message de chaque refus, ou « ok ».
 */
export async function tryWritingSeason(name: string): Promise<string[]> {
  const { db, season } = await seasonNamed(name);
  const [court] = await listCourts(db, season.id);
  const attempts: (() => Promise<unknown>)[] = [
    () => createCourt(db, season.id, { name: "Intrus", kind: "indoor", active: true }),
    () => updateCourt(db, court?.id ?? "", { name: "Renommé", kind: "indoor", active: true }),
    () =>
      persistCommand(
        db,
        createClosure(emptyPlanningState, {
          seasonId: season.id,
          label: "Intruse",
          startDate: season.startDate,
          endDate: season.startDate,
        }),
      ),
  ];
  const results: string[] = [];
  for (const attempt of attempts) {
    try {
      await attempt();
      results.push("ok");
    } catch (error) {
      results.push(errorMessage(error));
    }
  }
  return results;
}

/**
 * Archive la saison active en base, à l'insu de l'écran ouvert : ses écritures
 * suivantes sont refusées par la base (échec d'enregistrement simulé).
 */
export async function archiveActiveSeason(): Promise<void> {
  const { db, season } = await activeSeason();
  await db.update(seasons).set({ status: "archived" }).where(eq(seasons.id, season.id));
}

/**
 * Club à la volumétrie cible (§11.5) dans la saison active : 10 courts,
 * 20 moniteurs, 60 groupes, 500 élèves, 150 cours (tests de charge).
 */
export async function seedVolume(): Promise<{ firstGroup: string; lessons: number }> {
  const { db, season } = await activeSeason();
  const data = await seedVolumeData(db, season.id);
  return { firstGroup: data.groups[0]?.name ?? "", lessons: data.lessons.length };
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
    await db.insert(groups).values({
      id: groupId,
      seasonId: season.id,
      name: group.name,
      maxSize: group.maxSize,
      minAge: group.minAge ?? null,
      maxAge: group.maxAge ?? null,
    });
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
  for (const closure of spec.closures ?? []) {
    await db.insert(closures).values({ id: crypto.randomUUID(), seasonId: season.id, ...closure });
  }
  for (const u of spec.unavailabilities ?? []) {
    await db.insert(instructorUnavailabilities).values({
      id: crypto.randomUUID(),
      instructorId: id(`instructor:${u.instructor}`),
      startsAt: u.startsAt,
      endsAt: u.endsAt,
      reason: u.reason ?? null,
    });
  }
  for (const e of spec.exceptions ?? []) {
    const lesson = rows.find((l) => l.groupId === id(`group:${e.group}`));
    if (!lesson) throw new Error(`Aucun cours pour le groupe ${e.group}`);
    await db.insert(lessonExceptions).values({
      id: crypto.randomUUID(),
      seasonId: season.id,
      kind: e.kind,
      lessonId: lesson.id,
      occurrenceDate: e.occurrenceDate,
      instructorId: e.instructor ? id(`instructor:${e.instructor}`) : null,
      cancellationReason: e.kind === "cancellation" ? "rain" : null,
    });
  }
}

/** Planning enregistré en base, avec les noms des référentiels (vérification des exceptions). */
export async function readPlanning(): Promise<{
  lessons: {
    group: string;
    instructor: string;
    weekday: number;
    startTime: string;
    durationMinutes: number;
    effectiveFrom: string;
    effectiveTo: string | null;
  }[];
  exceptions: {
    kind: string;
    occurrenceDate: string | null;
    date: string | null;
    startTime: string | null;
    durationMinutes: number | null;
    instructor: string | null;
    group: string | null;
    cancellationReason: string | null;
  }[];
  closures: { label: string; startDate: string; endDate: string }[];
}> {
  const { db, season } = await activeSeason();
  const state = await loadPlanningState(db, season.id);
  const [instructorRows, groupRows] = await Promise.all([
    db.select().from(instructors),
    db.select().from(groups),
  ]);
  const instructor = (id: string | null) =>
    id ? (instructorRows.find((r) => r.id === id)?.firstName ?? "?") : null;
  const group = (id: string | null) =>
    id ? (groupRows.find((r) => r.id === id)?.name ?? "?") : null;
  return {
    lessons: state.lessons
      .map((l) => ({
        group: group(l.groupId) as string,
        instructor: instructor(l.instructorId) as string,
        weekday: l.weekday,
        startTime: l.startTime,
        durationMinutes: l.durationMinutes,
        effectiveFrom: l.effectiveFrom,
        effectiveTo: l.effectiveTo,
      }))
      .sort(
        (a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom) || a.group.localeCompare(b.group),
      ),
    exceptions: state.exceptions
      .map((e) => ({
        kind: e.kind,
        occurrenceDate: e.occurrenceDate,
        date: e.date,
        startTime: e.startTime,
        durationMinutes: e.durationMinutes,
        instructor: instructor(e.instructorId),
        group: group(e.groupId),
        cancellationReason: e.cancellationReason,
      }))
      .sort((a, b) =>
        (a.date ?? a.occurrenceDate ?? "").localeCompare(b.date ?? b.occurrenceDate ?? ""),
      ),
    closures: state.closures.map((c) => ({
      label: c.label,
      startDate: c.startDate,
      endDate: c.endDate,
    })),
  };
}

/** Cours enregistrés en base (lecture directe, pour vérifier la persistance), saison active par défaut. */
export async function readLessons(seasonName?: string): Promise<
  {
    group: string;
    instructor: string;
    court: string;
    weekday: number;
    startTime: string;
    durationMinutes: number;
  }[]
> {
  const { db, season } = await seasonNamed(seasonName);
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
