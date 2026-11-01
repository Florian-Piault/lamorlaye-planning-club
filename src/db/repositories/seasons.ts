import { and, asc, desc, eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { SeasonCounts } from "@/domain/guidance";
import {
  type DuplicationContext,
  type DuplicationSummary,
  defaultDuplicationContext,
  planSeasonDuplication,
  type SeasonSnapshot,
  summarizeDuplication,
} from "@/domain/seasonDuplication";
import type { SeasonInput } from "@/domain/validation";
import type { Db } from "../client";
import {
  courts,
  groupStudents,
  groups,
  instructorAvailabilities,
  instructors,
  lessonExceptions,
  lessons,
  type Season,
  seasons,
  studentAvailabilities,
  students,
} from "../schema";
import { countWhere } from "./common";

/** Saison active (une seule à la fois, garanti par un index unique partiel). */
export async function getActiveSeason(db: Db): Promise<Season | undefined> {
  return db.query.seasons.findFirst({ where: eq(seasons.status, "active") });
}

export async function getSeason(db: Db, id: string): Promise<Season | undefined> {
  return db.query.seasons.findFirst({ where: eq(seasons.id, id) });
}

export async function listSeasons(db: Db): Promise<Season[]> {
  return db.select().from(seasons).orderBy(desc(seasons.startDate), asc(seasons.name));
}

/**
 * Comptes de la saison, pour l'état des étapes du guidage. Les cours sont
 * ceux du planning habituel et les cours ponctuels d'une semaine précise.
 */
export async function countSeasonContents(db: Db, seasonId: string): Promise<SeasonCounts> {
  const inSeason = (table: typeof courts | typeof instructors | typeof groups | typeof students) =>
    countWhere(db, table, eq(table.seasonId, seasonId));
  const [courtCount, instructorCount, groupCount, studentCount, lessonCount, oneOffCount] =
    await Promise.all([
      inSeason(courts),
      inSeason(instructors),
      inSeason(groups),
      inSeason(students),
      countWhere(db, lessons, eq(lessons.seasonId, seasonId)),
      countWhere(
        db,
        lessonExceptions,
        and(eq(lessonExceptions.seasonId, seasonId), eq(lessonExceptions.kind, "one_off")),
      ),
    ]);
  return {
    courts: courtCount,
    instructors: instructorCount,
    groups: groupCount,
    students: studentCount,
    lessons: lessonCount + oneOffCount,
  };
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
  const created = await getSeason(db, id);
  if (!created) throw new Error("La saison n'a pas été créée.");
  return created;
}

/** Modifie une saison (refusé pour une saison archivée, en lecture seule). */
export async function updateSeason(db: Db, id: string, input: SeasonInput): Promise<void> {
  await db.update(seasons).set(input).where(eq(seasons.id, id));
}

/** Données d'une saison copiées par la duplication. */
export async function loadSeasonSnapshot(db: Db, seasonId: string): Promise<SeasonSnapshot> {
  const [
    courtRows,
    instructorRows,
    availabilityRows,
    groupRows,
    studentRows,
    studentSlotRows,
    memberships,
    lessonRows,
  ] = await Promise.all([
    db
      .select()
      .from(courts)
      .where(eq(courts.seasonId, seasonId))
      .orderBy(asc(courts.sortOrder), asc(courts.name)),
    db.select().from(instructors).where(eq(instructors.seasonId, seasonId)),
    db
      .select({ slot: instructorAvailabilities })
      .from(instructorAvailabilities)
      .innerJoin(instructors, eq(instructors.id, instructorAvailabilities.instructorId))
      .where(eq(instructors.seasonId, seasonId)),
    db.select().from(groups).where(eq(groups.seasonId, seasonId)),
    db.select().from(students).where(eq(students.seasonId, seasonId)),
    db
      .select({ slot: studentAvailabilities })
      .from(studentAvailabilities)
      .innerJoin(students, eq(students.id, studentAvailabilities.studentId))
      .where(eq(students.seasonId, seasonId)),
    db
      .select({ groupId: groupStudents.groupId, studentId: groupStudents.studentId })
      .from(groupStudents)
      .innerJoin(groups, eq(groups.id, groupStudents.groupId))
      .where(eq(groups.seasonId, seasonId)),
    db
      .select()
      .from(lessons)
      .where(eq(lessons.seasonId, seasonId))
      .orderBy(asc(lessons.weekday), asc(lessons.startTime), asc(lessons.createdAt)),
  ]);
  return {
    courts: courtRows,
    instructors: instructorRows,
    availabilities: availabilityRows.map((r) => r.slot),
    groups: groupRows,
    students: studentRows,
    studentAvailabilities: studentSlotRows.map((r) => r.slot),
    memberships,
    lessons: lessonRows,
  };
}

/** Lignes insérées par requête : au plus 13 colonnes, bien en deçà des limites de SQLite. */
const CHUNK = 50;

function chunked<T>(rows: readonly T[], insert: (part: T[]) => BatchItem<"sqlite">) {
  const statements: BatchItem<"sqlite">[] = [];
  for (let i = 0; i < rows.length; i += CHUNK) statements.push(insert(rows.slice(i, i + CHUNK)));
  return statements;
}

/**
 * Nouvelle saison par duplication de `sourceId` (§8.1) : courts, moniteurs et
 * disponibilités récurrentes, groupes et composition, élèves et leurs
 * disponibilités, semaine type.
 * Une seule transaction : archivage de la saison active, création de la
 * nouvelle saison (active) et copie de toutes les lignes, ou rien.
 */
export async function duplicateSeason(
  db: Db,
  sourceId: string,
  input: SeasonInput,
  ctx: DuplicationContext = defaultDuplicationContext,
): Promise<{ season: Season; summary: DuplicationSummary }> {
  const source = await getSeason(db, sourceId);
  if (!source) throw new Error("La saison à dupliquer est introuvable.");
  const snapshot = await loadSeasonSnapshot(db, sourceId);
  const id = ctx.newId();
  const plan = planSeasonDuplication(
    snapshot,
    source.endDate,
    { seasonId: id, startDate: input.startDate },
    ctx,
  );
  await db.batch([
    db.update(seasons).set({ status: "archived" }).where(eq(seasons.status, "active")),
    db.insert(seasons).values({ id, ...input, status: "active" }),
    ...chunked(plan.courts, (part) => db.insert(courts).values(part)),
    ...chunked(plan.instructors, (part) => db.insert(instructors).values(part)),
    ...chunked(plan.availabilities, (part) => db.insert(instructorAvailabilities).values(part)),
    ...chunked(plan.groups, (part) => db.insert(groups).values(part)),
    ...chunked(plan.students, (part) => db.insert(students).values(part)),
    ...chunked(plan.studentAvailabilities, (part) => db.insert(studentAvailabilities).values(part)),
    ...chunked(plan.memberships, (part) => db.insert(groupStudents).values(part)),
    ...chunked(plan.lessons, (part) => db.insert(lessons).values(part)),
  ]);
  const season = await getSeason(db, id);
  if (!season) throw new Error("La saison n'a pas été créée.");
  return { season, summary: summarizeDuplication(snapshot, plan) };
}
