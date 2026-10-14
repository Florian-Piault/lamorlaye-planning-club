import { inArray } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Db } from "./client";
import { closures, groups, lessonExceptions, lessons, seasons, students } from "./schema";

/**
 * Saisons archivées en lecture seule (SPECS.md §3.1, §8.1).
 *
 * Le garde-fou est à trois niveaux :
 * 1. **la base** : des déclencheurs SQLite (migration
 *    `0004_archived_seasons_read_only`) refusent toute écriture touchant une
 *    saison archivée, quel que soit le chemin emprunté ; leur message est
 *    traduit en `SeasonReadOnlyError` par `createDatabase` ;
 * 2. **la persistance des commandes** (planning, fermetures, import) : les
 *    lignes visées sont vérifiées avant l'écriture (`assertWritable`), pour
 *    un refus explicite et sans aller-retour inutile ;
 * 3. **l'interface** : la saison consultée porte un indicateur de lecture
 *    seule (`useSeason().readOnly`) qui retire les actions d'écriture.
 */

/** Message des déclencheurs SQLite (voir la migration). */
export const READ_ONLY_MARKER = "Saison archivée : lecture seule";

export const READ_ONLY_MESSAGE =
  "Cette saison est archivée : elle est consultable en lecture seule et ne peut plus être modifiée.";

export class SeasonReadOnlyError extends Error {
  override name = "SeasonReadOnlyError";
  constructor(message: string = READ_ONLY_MESSAGE) {
    super(message);
  }
}

/**
 * Refus de lecture seule contenu dans une erreur, le cas échéant. Drizzle
 * enveloppe les erreurs d'une requête isolée (`DrizzleQueryError`) : la
 * chaîne des causes est parcourue.
 */
export function readOnlyErrorOf(error: unknown): SeasonReadOnlyError | null {
  let current: unknown = error;
  for (let depth = 0; current !== undefined && current !== null && depth < 5; depth++) {
    if (current instanceof SeasonReadOnlyError) return current;
    const message = current instanceof Error ? current.message : String(current);
    if (message.includes(READ_ONLY_MARKER)) return new SeasonReadOnlyError();
    current = current instanceof Error ? current.cause : undefined;
  }
  return null;
}

/** Erreur due à une écriture sur une saison archivée ? */
export function isReadOnlyViolation(error: unknown): boolean {
  return readOnlyErrorOf(error) !== null;
}

/** Traduit le refus des déclencheurs en `SeasonReadOnlyError` ; autres erreurs inchangées. */
export function translateDatabaseError(error: unknown): unknown {
  return readOnlyErrorOf(error) ?? error;
}

/** Lignes visées par une écriture, par table (identifiants existants). */
export interface WriteTargets {
  seasons?: Iterable<string>;
  lessons?: Iterable<string>;
  exceptions?: Iterable<string>;
  closures?: Iterable<string>;
  students?: Iterable<string>;
  groups?: Iterable<string>;
}

/** Requêtes de 50 identifiants au plus. */
const CHUNK = 50;

function chunks(ids: readonly string[]): string[][] {
  const result: string[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK) result.push(ids.slice(i, i + CHUNK));
  return result;
}

async function seasonIdsOf(
  db: Db,
  table: SQLiteTable,
  idColumn: SQLiteColumn,
  seasonColumn: SQLiteColumn,
  ids: Iterable<string> | undefined,
): Promise<string[]> {
  const unique = [...new Set(ids ?? [])];
  const rows = await Promise.all(
    chunks(unique).map((part) =>
      db.selectDistinct({ seasonId: seasonColumn }).from(table).where(inArray(idColumn, part)),
    ),
  );
  return rows.flat().map((r) => r.seasonId as string);
}

/**
 * Refuse (`SeasonReadOnlyError`) une écriture dont une ligne appartient à une
 * saison archivée. Les identifiants inconnus sont ignorés (insertion d'une
 * ligne nouvelle : sa saison est passée dans `seasons`).
 */
export async function assertWritable(db: Db, targets: WriteTargets): Promise<void> {
  const seasonIds = new Set<string>(targets.seasons ?? []);
  const lookups = await Promise.all([
    seasonIdsOf(db, lessons, lessons.id, lessons.seasonId, targets.lessons),
    seasonIdsOf(
      db,
      lessonExceptions,
      lessonExceptions.id,
      lessonExceptions.seasonId,
      targets.exceptions,
    ),
    seasonIdsOf(db, closures, closures.id, closures.seasonId, targets.closures),
    seasonIdsOf(db, students, students.id, students.seasonId, targets.students),
    seasonIdsOf(db, groups, groups.id, groups.seasonId, targets.groups),
  ]);
  for (const id of lookups.flat()) seasonIds.add(id);
  if (seasonIds.size === 0) return;
  const rows = await Promise.all(
    chunks([...seasonIds]).map((part) =>
      db
        .select({ name: seasons.name, status: seasons.status })
        .from(seasons)
        .where(inArray(seasons.id, part)),
    ),
  );
  const archived = rows.flat().find((s) => s.status === "archived");
  if (archived) {
    throw new SeasonReadOnlyError(
      `La saison ${archived.name} est archivée : elle est consultable en lecture seule et ne peut plus être modifiée.`,
    );
  }
}

/** Refuse toute écriture sur une saison archivée. */
export function assertSeasonWritable(db: Db, seasonId: string): Promise<void> {
  return assertWritable(db, { seasons: [seasonId] });
}
