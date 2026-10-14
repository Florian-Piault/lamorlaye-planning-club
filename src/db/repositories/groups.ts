import { and, asc, count, eq } from "drizzle-orm";
import type { Usage } from "@/domain/usage";
import type { GroupInput } from "@/domain/validation";
import type { Db } from "../client";
import {
  type Group,
  groupStudents,
  groups,
  lessonExceptions,
  lessons,
  levels,
  type Student,
  students,
} from "../schema";
import { usageOf } from "./common";

export interface GroupListItem extends Group {
  levelLabel: string | null;
  memberCount: number;
}

/** Groupes de la saison avec leur niveau et leur effectif. */
export async function listGroups(db: Db, seasonId: string): Promise<GroupListItem[]> {
  const rows = await db
    .select({ group: groups, levelLabel: levels.label, memberCount: count(groupStudents.id) })
    .from(groups)
    .leftJoin(levels, eq(levels.id, groups.levelId))
    .leftJoin(groupStudents, eq(groupStudents.groupId, groups.id))
    .where(eq(groups.seasonId, seasonId))
    .groupBy(groups.id)
    .orderBy(asc(groups.name));
  return rows.map(({ group, levelLabel, memberCount }) => ({
    ...group,
    levelLabel: levelLabel ?? null,
    memberCount,
  }));
}

export async function getGroup(db: Db, id: string): Promise<Group | undefined> {
  return db.query.groups.findFirst({ where: eq(groups.id, id) });
}

export async function createGroup(db: Db, seasonId: string, input: GroupInput): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(groups).values({ id, seasonId, ...input });
  return id;
}

export async function updateGroup(db: Db, id: string, input: GroupInput): Promise<void> {
  await db.update(groups).set(input).where(eq(groups.id, id));
}

/** Élèves du groupe, par ordre alphabétique. */
export async function listGroupMembers(db: Db, groupId: string): Promise<Student[]> {
  const rows = await db
    .select({ student: students })
    .from(groupStudents)
    .innerJoin(students, eq(students.id, groupStudents.studentId))
    .where(eq(groupStudents.groupId, groupId))
    .orderBy(asc(students.lastName), asc(students.firstName));
  return rows.map((r) => r.student);
}

/** Ajoute un élève au groupe (sans effet s'il en fait déjà partie). */
export async function addGroupMember(db: Db, groupId: string, studentId: string): Promise<void> {
  await db.insert(groupStudents).values({ groupId, studentId }).onConflictDoNothing();
}

export async function removeGroupMember(db: Db, groupId: string, studentId: string): Promise<void> {
  await db
    .delete(groupStudents)
    .where(and(eq(groupStudents.groupId, groupId), eq(groupStudents.studentId, studentId)));
}

/** Cours (semaine type et ponctuels) de ce groupe. */
export async function getGroupUsage(db: Db, id: string): Promise<Usage> {
  return usageOf(db, [
    { table: lessons, where: eq(lessons.groupId, id), singular: "cours", plural: "cours" },
    {
      table: lessonExceptions,
      where: eq(lessonExceptions.groupId, id),
      singular: "cours ponctuel",
      plural: "cours ponctuels",
    },
  ]);
}

export async function setGroupActive(db: Db, id: string, active: boolean): Promise<void> {
  await db.update(groups).set({ active }).where(eq(groups.id, id));
}

/** Supprime un groupe ; les élèves sont conservés, seule leur appartenance est retirée. */
export async function deleteGroup(db: Db, id: string): Promise<void> {
  await db.delete(groups).where(eq(groups.id, id));
}
