import { asc, eq } from "drizzle-orm";
import { normalizeSlots, type WeeklySlot } from "@/domain/availability";
import { nameKey, type StudentCandidate } from "@/domain/duplicates";
import type { StudentInput } from "@/domain/validation";
import type { Db } from "../client";
import {
  groupStudents,
  groups,
  levels,
  type Student,
  type StudentAvailability,
  seasons,
  studentAvailabilities,
  students,
} from "../schema";

export interface StudentGroupRef {
  id: string;
  name: string;
}

export interface StudentListItem extends Student {
  levelLabel: string | null;
  groups: StudentGroupRef[];
  /** Disponibilités renseignées (au moins une plage) : colonne et filtre de la liste. */
  hasAvailabilities: boolean;
}

/** Élèves de la saison avec leur niveau, leurs groupes et l'état de leurs disponibilités. */
export async function listStudents(db: Db, seasonId: string): Promise<StudentListItem[]> {
  const [rows, memberships, withSlots] = await Promise.all([
    db
      .select({ student: students, levelLabel: levels.label })
      .from(students)
      .leftJoin(levels, eq(levels.id, students.levelId))
      .where(eq(students.seasonId, seasonId))
      .orderBy(asc(students.lastName), asc(students.firstName)),
    db
      .select({ studentId: groupStudents.studentId, id: groups.id, name: groups.name })
      .from(groupStudents)
      .innerJoin(groups, eq(groups.id, groupStudents.groupId))
      .where(eq(groups.seasonId, seasonId))
      .orderBy(asc(groups.name)),
    db
      .selectDistinct({ studentId: studentAvailabilities.studentId })
      .from(studentAvailabilities)
      .innerJoin(students, eq(students.id, studentAvailabilities.studentId))
      .where(eq(students.seasonId, seasonId)),
  ]);
  const filled = new Set(withSlots.map((r) => r.studentId));
  const byStudent = new Map<string, StudentGroupRef[]>();
  for (const { studentId, id, name } of memberships) {
    const list = byStudent.get(studentId) ?? [];
    list.push({ id, name });
    byStudent.set(studentId, list);
  }
  return rows.map(({ student, levelLabel }) => ({
    ...student,
    levelLabel: levelLabel ?? null,
    groups: byStudent.get(student.id) ?? [],
    hasAvailabilities: filled.has(student.id),
  }));
}

/** Plages hebdomadaires de tous les élèves de la saison (contrôles du planning, §7). */
export async function listSeasonStudentAvailabilities(
  db: Db,
  seasonId: string,
): Promise<StudentAvailability[]> {
  const rows = await db
    .select({ slot: studentAvailabilities })
    .from(studentAvailabilities)
    .innerJoin(students, eq(students.id, studentAvailabilities.studentId))
    .where(eq(students.seasonId, seasonId))
    .orderBy(asc(studentAvailabilities.weekday), asc(studentAvailabilities.startTime));
  return rows.map((r) => r.slot);
}

/** Plages hebdomadaires d'un élève, par jour puis heure de début. */
export async function getStudentAvailabilities(
  db: Db,
  studentId: string,
): Promise<StudentAvailability[]> {
  return db
    .select()
    .from(studentAvailabilities)
    .where(eq(studentAvailabilities.studentId, studentId))
    .orderBy(asc(studentAvailabilities.weekday), asc(studentAvailabilities.startTime));
}

/**
 * Remplace toutes les plages d'un élève (une seule transaction), fusionnées
 * par jour comme celles des moniteurs. Aucune plage : disponible partout.
 */
export async function replaceStudentAvailabilities(
  db: Db,
  studentId: string,
  slots: readonly WeeklySlot[],
): Promise<void> {
  await db.batch([
    db.delete(studentAvailabilities).where(eq(studentAvailabilities.studentId, studentId)),
    ...insertSlots(db, studentId, slots),
  ]);
}

/** Fiche d'un élève de n'importe quelle saison, pour la détection des doublons. */
export type StudentIdentity = StudentCandidate & Student;

/**
 * Élèves de toutes les saisons, avec leur saison et les noms de leurs groupes :
 * détection des doublons et reprise des coordonnées (spec UX v1.1).
 */
export async function listStudentIdentities(db: Db): Promise<StudentIdentity[]> {
  const [rows, memberships] = await Promise.all([
    db
      .select({ student: students, seasonName: seasons.name, seasonStartDate: seasons.startDate })
      .from(students)
      .innerJoin(seasons, eq(seasons.id, students.seasonId)),
    db
      .select({ studentId: groupStudents.studentId, name: groups.name })
      .from(groupStudents)
      .innerJoin(groups, eq(groups.id, groupStudents.groupId))
      .orderBy(asc(groups.name)),
  ]);
  const byStudent = new Map<string, string[]>();
  for (const { studentId, name } of memberships) {
    const list = byStudent.get(studentId) ?? [];
    list.push(name);
    byStudent.set(studentId, list);
  }
  return rows.map(({ student, seasonName, seasonStartDate }) => ({
    ...student,
    seasonName,
    seasonStartDate,
    nameKey: nameKey(student),
    groups: byStudent.get(student.id) ?? [],
  }));
}

export async function getStudent(db: Db, id: string): Promise<Student | undefined> {
  return db.query.students.findFirst({ where: eq(students.id, id) });
}

/** Identifiants des groupes d'un élève. */
export async function getStudentGroupIds(db: Db, studentId: string): Promise<string[]> {
  const rows = await db
    .select({ groupId: groupStudents.groupId })
    .from(groupStudents)
    .where(eq(groupStudents.studentId, studentId));
  return rows.map((r) => r.groupId);
}

/** Insertion des plages d'un élève, fusionnées par jour. */
function insertSlots(db: Db, studentId: string, slots: readonly WeeklySlot[]) {
  return normalizeSlots(slots).map(({ weekday, startTime, endTime }) =>
    db.insert(studentAvailabilities).values({ studentId, weekday, startTime, endTime }),
  );
}

/**
 * Crée un élève, l'inscrit dans ses groupes et enregistre ses plages (une
 * seule transaction : en cas d'échec, rien n'est créé).
 */
export async function createStudent(
  db: Db,
  seasonId: string,
  input: StudentInput,
  groupIds: readonly string[] = [],
  slots: readonly WeeklySlot[] = [],
): Promise<string> {
  const id = crypto.randomUUID();
  await db.batch([
    db.insert(students).values({ id, seasonId, ...input }),
    ...[...new Set(groupIds)].map((groupId) =>
      db.insert(groupStudents).values({ groupId, studentId: id }),
    ),
    ...insertSlots(db, id, slots),
  ]);
  return id;
}

/**
 * Met à jour la fiche d'un élève et remplace ses groupes, ainsi que ses
 * plages si `slots` est donné (une seule transaction : en cas d'échec, rien
 * n'est modifié).
 */
export async function updateStudent(
  db: Db,
  id: string,
  input: StudentInput,
  groupIds: readonly string[],
  slots?: readonly WeeklySlot[],
): Promise<void> {
  await db.batch([
    db.update(students).set(input).where(eq(students.id, id)),
    db.delete(groupStudents).where(eq(groupStudents.studentId, id)),
    ...[...new Set(groupIds)].map((groupId) =>
      db.insert(groupStudents).values({ groupId, studentId: id }),
    ),
    ...(slots
      ? [
          db.delete(studentAvailabilities).where(eq(studentAvailabilities.studentId, id)),
          ...insertSlots(db, id, slots),
        ]
      : []),
  ]);
}

/** Supprime un élève, ainsi que son appartenance à ses groupes et ses plages. */
export async function deleteStudent(db: Db, id: string): Promise<void> {
  await db.delete(students).where(eq(students.id, id));
}
