/**
 * Interface unique d'accès à SQLite (docs/SPECS.md §12.2).
 *
 * Deux implémentations :
 * - `tauri` : fichier SQLite local via `tauri-plugin-sql` (application de bureau) ;
 * - `sqljs` : SQLite compilé en WebAssembly, en mémoire (tests, front servi par Vite).
 *
 * Les lignes sont renvoyées sous forme de **tableaux** de valeurs, dans l'ordre
 * des colonnes, comme l'attend le pilote `sqlite-proxy` de Drizzle.
 */

/** Valeur pouvant être liée à un paramètre `?`. */
export type SqlParam = string | number | bigint | boolean | null | Uint8Array;

/** Valeur lue dans une ligne de résultat. */
export type SqlValue = string | number | null | Uint8Array | number[];

export type SqlRow = SqlValue[];

export interface SqlStatement {
  sql: string;
  params?: readonly SqlParam[];
}

export interface SqlResult {
  rows: SqlRow[];
  rowsAffected: number;
}

export type SqlDriverKind = "tauri" | "sqljs";

export interface SqlDriver {
  readonly kind: SqlDriverKind;
  /** Emplacement de la base : chemin du fichier, ou `:memory:`. */
  readonly location: string;
  /** Exécute une requête d'écriture. */
  run(sql: string, params?: readonly SqlParam[]): Promise<{ rowsAffected: number }>;
  /** Exécute une requête de lecture. */
  query(sql: string, params?: readonly SqlParam[]): Promise<SqlRow[]>;
  /**
   * Exécute un lot de requêtes dans **une seule transaction** : soit tout est
   * appliqué, soit rien. C'est le seul moyen sûr d'obtenir une transaction
   * (le plugin Tauri utilise un pool de connexions).
   */
  batch(statements: readonly SqlStatement[]): Promise<SqlResult[]>;
  close(): Promise<void>;
}
