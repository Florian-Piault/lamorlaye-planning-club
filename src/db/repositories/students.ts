import { asc, eq } from "drizzle-orm";
import { nameKey, type StudentCandidate } from "@/domain/duplicates";
import type { StudentInput } from "@/domain/validation";
import type { Db } from "../client";
import { groupStudents, groups, levels, type Student, seasons, students } from "../schema";

export interface StudentGroupRef {
  id: string;
  name: string;
}

export interface StudentListItem extends Student {
  levelLabel: string | null;
  groups: StudentGroupRef[];
}

/** Élèves de la saison avec leur niveau et leurs groupes. */
export async function listStudents(db: Db, seasonId: string): Promise<StudentListItem[]> {
  const [rows, memberships] = await Promise.all([
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
  ]);
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
  }));
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

/** Crée un élève et l'inscrit dans ses groupes (une seule transaction). */
export async function createStudent(
  db: Db,
  seasonId: string,
  input: StudentInput,
  groupIds: readonly string[] = [],
): Promise<string> {
  const id = crypto.randomUUID();
  await db.batch([
    db.insert(students).values({ id, seasonId, ...input }),
    ...[...new Set(groupIds)].map((groupId) =>
      db.insert(groupStudents).values({ groupId, studentId: id }),
    ),
  ]);
  return id;
}

/** Met à jour la fiche d'un élève et remplace ses groupes (une seule transaction). */
export async function updateStudent(
  db: Db,
  id: string,
  input: StudentInput,
  groupIds: readonly string[],
): Promise<void> {
  await db.batch([
    db.update(students).set(input).where(eq(students.id, id)),
    db.delete(groupStudents).where(eq(groupStudents.studentId, id)),
    ...[...new Set(groupIds)].map((groupId) =>
      db.insert(groupStudents).values({ groupId, studentId: id }),
    ),
  ]);
}

/** Supprime un élève, ainsi que son appartenance à ses groupes. */
export async function deleteStudent(db: Db, id: string): Promise<void> {
  await db.delete(students).where(eq(students.id, id));
}
