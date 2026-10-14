import { asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { groupPeople, type Person, type StudentRecord, samePerson } from "@/domain/rgpd";
import type { Db } from "../client";
import { groupStudents, groups, levels, seasons, studentErasures, students } from "../schema";

/**
 * Données personnelles des élèves (RGPD, §11.6) : recherche de toutes les
 * fiches d'une personne (une par saison), export et effacement définitif.
 */

/** Fiches d'élèves de toutes les saisons, regroupées par personne. */
export async function listPeople(db: Db): Promise<Person[]> {
  const rows = await db
    .select({
      studentId: students.id,
      lastName: students.lastName,
      firstName: students.firstName,
      birthDate: students.birthDate,
      seasonName: seasons.name,
      seasonStartDate: seasons.startDate,
    })
    .from(students)
    .innerJoin(seasons, eq(seasons.id, students.seasonId));
  return groupPeople(rows);
}

/**
 * Toutes les fiches de la personne désignée par `studentId` (même nom,
 * prénom et date de naissance), dans toutes les saisons, de la plus ancienne
 * à la plus récente, avec leur niveau et leurs groupes.
 */
export async function findStudentRecords(db: Db, studentId: string): Promise<StudentRecord[]> {
  const student = await db.query.students.findFirst({ where: eq(students.id, studentId) });
  if (!student) return [];
  const candidates = await db
    .select({ student: students, season: seasons, levelLabel: levels.label })
    .from(students)
    .innerJoin(seasons, eq(seasons.id, students.seasonId))
    .leftJoin(levels, eq(levels.id, students.levelId))
    .where(
      student.birthDate === null
        ? isNull(students.birthDate)
        : eq(students.birthDate, student.birthDate),
    )
    .orderBy(asc(seasons.startDate));
  const matches = samePerson(
    student,
    candidates.map((c) => ({ ...c.student, row: c })),
  ).map((m) => m.row);
  if (matches.length === 0) return [];
  const memberships = await db
    .select({ studentId: groupStudents.studentId, name: groups.name, levelLabel: levels.label })
    .from(groupStudents)
    .innerJoin(groups, eq(groups.id, groupStudents.groupId))
    .leftJoin(levels, eq(levels.id, groups.levelId))
    .where(
      inArray(
        groupStudents.studentId,
        matches.map((m) => m.student.id),
      ),
    )
    .orderBy(asc(groups.name));
  return matches.map(({ student: row, season, levelLabel }) => ({
    student: row,
    season: {
      id: season.id,
      name: season.name,
      startDate: season.startDate,
      endDate: season.endDate,
      status: season.status,
    },
    levelLabel: levelLabel ?? null,
    groups: memberships
      .filter((m) => m.studentId === row.id)
      .map((m) => ({ name: m.name, levelLabel: m.levelLabel ?? null })),
  }));
}

/**
 * Effacement définitif de fiches d'élèves (droit à l'effacement) : retrait de
 * tous leurs groupes puis suppression, en une seule transaction.
 *
 * C'est la seule écriture autorisée sur une saison archivée : les élèves sont
 * d'abord inscrits dans `student_erasures`, que les déclencheurs de lecture
 * seule consultent, puis cette inscription est retirée dans la même
 * transaction. Aucune trace de l'élève ne subsiste : `secure_delete` fait
 * écraser par des zéros le contenu supprimé, qui sinon resterait lisible dans
 * les pages libres du fichier de la base.
 */
export async function eraseStudents(db: Db, studentIds: readonly string[]): Promise<number> {
  const ids = [...new Set(studentIds)];
  if (ids.length === 0) return 0;
  const existing = await db
    .select({ id: students.id })
    .from(students)
    .where(inArray(students.id, ids));
  if (existing.length === 0) return 0;
  const found = existing.map((s) => s.id);
  await db.batch([
    db.run(sql`PRAGMA secure_delete = ON`),
    db.insert(studentErasures).values(found.map((studentId) => ({ studentId }))),
    db.delete(groupStudents).where(inArray(groupStudents.studentId, found)),
    db.delete(students).where(inArray(students.id, found)),
    db.delete(studentErasures).where(inArray(studentErasures.studentId, found)),
  ]);
  return found.length;
}
