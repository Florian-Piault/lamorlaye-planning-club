import { and, asc, eq, inArray, or } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import {
  type ImportCommand,
  type ImportContext,
  type ImportFootprint,
  importedStudents,
  type StudentMutation,
} from "@/domain/studentImport";
import type { Db } from "../client";
import { assertWritable, type WriteTargets } from "../readOnly";
import {
  type GroupStudent,
  groupStudents,
  groups,
  levels,
  type Student,
  seasons,
  students,
} from "../schema";

/**
 * Adaptateur entre la commande d'import d'élèves (`domain/studentImport.ts`)
 * et la base : chargement du contexte (élèves, groupes, niveaux de la saison)
 * et écriture des mutations dans une seule transaction (`db.batch`).
 */

/** Élèves, groupes, niveaux et inscriptions utiles à l'aperçu de l'import. */
export async function loadImportContext(db: Db, seasonId: string): Promise<ImportContext> {
  const [studentRows, groupRows, levelRows, memberships, season] = await Promise.all([
    db.select().from(students).where(eq(students.seasonId, seasonId)),
    db
      .select({ id: groups.id, name: groups.name, minAge: groups.minAge, maxAge: groups.maxAge })
      .from(groups)
      .where(eq(groups.seasonId, seasonId))
      .orderBy(asc(groups.name)),
    db.select({ id: levels.id, label: levels.label }).from(levels).orderBy(asc(levels.sortOrder)),
    db
      .select({ groupId: groupStudents.groupId, studentId: groupStudents.studentId })
      .from(groupStudents)
      .innerJoin(groups, eq(groups.id, groupStudents.groupId))
      .where(eq(groups.seasonId, seasonId)),
    db.query.seasons.findFirst({ where: eq(seasons.id, seasonId) }),
  ]);
  if (!season) throw new Error("Saison introuvable.");
  return {
    seasonId,
    seasonStartDate: season.startDate,
    students: studentRows,
    groups: groupRows,
    levels: levelRows,
    memberships,
  };
}

/** Lignes insérées par requête (13 colonnes au plus : bien en deçà des limites de SQLite). */
const CHUNK = 50;

function chunks<T>(items: readonly T[]): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) result.push(items.slice(i, i + CHUNK));
  return result;
}

/**
 * Requêtes d'une suite de mutations, dans l'ordre : les insertions et
 * suppressions consécutives sur une même table sont regroupées.
 */
function toStatements(db: Db, mutations: readonly StudentMutation[]): BatchItem<"sqlite">[] {
  const statements: BatchItem<"sqlite">[] = [];
  let i = 0;
  while (i < mutations.length) {
    const mutation = mutations[i] as StudentMutation;
    if (mutation.op === "update") {
      statements.push(db.update(students).set(mutation.values).where(eq(students.id, mutation.id)));
      i++;
      continue;
    }
    let end = i;
    while (mutations[end]?.op === mutation.op && mutations[end]?.table === mutation.table) end++;
    const run = mutations.slice(i, end);
    i = end;
    if (mutation.op === "insert") {
      const rows = run.map((m) => (m as { row: Student | GroupStudent }).row);
      for (const part of chunks(rows)) {
        statements.push(
          mutation.table === "students"
            ? db.insert(students).values(part as Student[])
            : db
                .insert(groupStudents)
                .values(part as GroupStudent[])
                .onConflictDoNothing(),
        );
      }
    } else if (mutation.table === "students") {
      const ids = run.map((m) => (m as { id: string }).id);
      for (const part of chunks(ids)) {
        statements.push(db.delete(students).where(inArray(students.id, part)));
      }
    } else {
      const pairs = run as Extract<StudentMutation, { table: "groupStudents"; op: "delete" }>[];
      for (const part of chunks(pairs)) {
        statements.push(
          db
            .delete(groupStudents)
            .where(
              or(
                ...part.map((p) =>
                  and(
                    eq(groupStudents.groupId, p.groupId),
                    eq(groupStudents.studentId, p.studentId),
                  ),
                ),
              ),
            ),
        );
      }
    }
  }
  return statements;
}

/** Lignes visées par des mutations : saisons des élèves créés, élèves et groupes existants. */
export function studentMutationTargets(mutations: readonly StudentMutation[]): WriteTargets {
  const targets = {
    seasons: new Set<string>(),
    students: new Set<string>(),
    groups: new Set<string>(),
  };
  for (const mutation of mutations) {
    if (mutation.table === "groupStudents") {
      targets.groups.add(mutation.op === "insert" ? mutation.row.groupId : mutation.groupId);
    } else if (mutation.op === "insert") {
      targets.seasons.add(mutation.row.seasonId);
    } else {
      targets.students.add(mutation.id);
    }
  }
  return targets;
}

/**
 * Écrit des mutations en base, dans une transaction : tout ou rien. Refusé
 * (`SeasonReadOnlyError`) si l'import touche une saison archivée.
 */
export async function persistStudentMutations(
  db: Db,
  mutations: readonly StudentMutation[],
): Promise<void> {
  const [first, ...rest] = toStatements(db, mutations);
  if (!first) return;
  await assertWritable(db, studentMutationTargets(mutations));
  await db.batch([first, ...rest]);
}

/** État actuel des élèves créés ou modifiés par un import (voir `modifiedSinceImport`). */
export async function loadImportFootprint(
  db: Db,
  command: ImportCommand,
): Promise<ImportFootprint> {
  const { created, updated } = importedStudents(command);
  const createdIds = [...created.keys()];
  const studentRows = await Promise.all(
    chunks([...createdIds, ...updated.keys()]).map((part) =>
      db
        .select({ id: students.id, updatedAt: students.updatedAt })
        .from(students)
        .where(inArray(students.id, part)),
    ),
  );
  const membershipRows = await Promise.all(
    chunks(createdIds).map((part) =>
      db
        .select({ groupId: groupStudents.groupId, studentId: groupStudents.studentId })
        .from(groupStudents)
        .where(inArray(groupStudents.studentId, part)),
    ),
  );
  return { students: studentRows.flat(), memberships: membershipRows.flat() };
}

/** Réalise (ou rétablit) un import. */
export function persistImport(db: Db, command: ImportCommand): Promise<void> {
  return persistStudentMutations(db, command.forward);
}

/** Annule un import. */
export function revertImport(db: Db, command: ImportCommand): Promise<void> {
  return persistStudentMutations(db, command.backward);
}
