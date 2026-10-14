import { asc, eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { Command, Mutation, PlanningState } from "@/domain/commands";
import type { Db } from "../client";
import { assertWritable, type WriteTargets } from "../readOnly";
import { closures, lessonExceptions, lessons } from "../schema";

/**
 * Adaptateur entre les commandes du domaine (`domain/commands.ts`) et la base :
 * chargement de l'état du planning d'une saison et écriture des mutations
 * d'une commande dans une seule transaction (`db.batch`).
 */

const tables = {
  lessons,
  exceptions: lessonExceptions,
  closures,
} as const;

/** Cours, exceptions et fermetures d'une saison. */
export async function loadPlanningState(db: Db, seasonId: string): Promise<PlanningState> {
  const [lessonRows, exceptionRows, closureRows] = await Promise.all([
    db
      .select()
      .from(lessons)
      .where(eq(lessons.seasonId, seasonId))
      .orderBy(asc(lessons.weekday), asc(lessons.startTime), asc(lessons.createdAt)),
    db
      .select()
      .from(lessonExceptions)
      .where(eq(lessonExceptions.seasonId, seasonId))
      .orderBy(asc(lessonExceptions.createdAt)),
    db
      .select()
      .from(closures)
      .where(eq(closures.seasonId, seasonId))
      .orderBy(asc(closures.startDate)),
  ]);
  return { lessons: lessonRows, exceptions: exceptionRows, closures: closureRows };
}

function toStatement(db: Db, mutation: Mutation): BatchItem<"sqlite"> {
  const table = tables[mutation.table];
  switch (mutation.op) {
    case "insert":
      return db.insert(table).values(mutation.row);
    case "update":
      return db.update(table).set(mutation.values).where(eq(table.id, mutation.id));
    case "delete":
      return db.delete(table).where(eq(table.id, mutation.id));
  }
}

/** Lignes visées par des mutations : saisons des insertions, identifiants des autres. */
export function mutationTargets(mutations: readonly Mutation[]): WriteTargets {
  const targets = {
    seasons: new Set<string>(),
    lessons: new Set<string>(),
    exceptions: new Set<string>(),
    closures: new Set<string>(),
  };
  for (const mutation of mutations) {
    if (mutation.op === "insert") targets.seasons.add(mutation.row.seasonId);
    else targets[mutation.table].add(mutation.id);
  }
  return targets;
}

/**
 * Écrit des mutations en base, dans une transaction : tout ou rien. Refusé
 * (`SeasonReadOnlyError`) si une ligne visée appartient à une saison archivée.
 */
export async function persistMutations(db: Db, mutations: readonly Mutation[]): Promise<void> {
  const [first, ...rest] = mutations.map((m) => toStatement(db, m));
  if (!first) return;
  await assertWritable(db, mutationTargets(mutations));
  await db.batch([first, ...rest]);
}

/** Applique une commande en base. */
export function persistCommand(db: Db, command: Command): Promise<void> {
  return persistMutations(db, command.forward);
}

/** Annule une commande en base. */
export function persistRevert(db: Db, command: Command): Promise<void> {
  return persistMutations(db, command.backward);
}
