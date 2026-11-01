/**
 * Parcours de la saisie des disponibilités en série (docs/SPECS.md §8) : la
 * liste des élèves telle qu'elle est filtrée au lancement, un élève à la fois,
 * avec sa progression « n / N » et le bilan du toast de fin.
 */

export interface Series<T> {
  /** Élèves de la série, figés au lancement (dans l'ordre de la liste). */
  items: readonly T[];
  /** Rang de l'élève affiché ; `items.length` quand la série est finie. */
  index: number;
  /** Élèves enregistrés (« Enregistrer et suivant »). */
  saved: number;
  /** Élèves passés sans rien enregistrer (« Passer »). */
  skipped: number;
}

/** Série sur ces élèves ; aucune s'il n'y a personne. */
export function startSeries<T>(items: readonly T[]): Series<T> | null {
  return items.length === 0 ? null : { items: [...items], index: 0, saved: 0, skipped: 0 };
}

/** Élève affiché ; aucun quand la série est finie. */
export function currentItem<T>(series: Series<T>): T | undefined {
  return series.items[series.index];
}

/** Passe à l'élève suivant, l'actuel ayant été enregistré ou passé. */
export function advanceSeries<T>(series: Series<T>, outcome: "saved" | "skipped"): Series<T> {
  if (isFinished(series)) return series;
  return {
    ...series,
    index: series.index + 1,
    saved: series.saved + (outcome === "saved" ? 1 : 0),
    skipped: series.skipped + (outcome === "skipped" ? 1 : 0),
  };
}

/** Plus aucun élève à afficher (le dernier a été enregistré ou passé). */
export function isFinished<T>(series: Series<T>): boolean {
  return series.index >= series.items.length;
}

/** Progression affichée : « 4 / 23 ». */
export function progressLabel<T>(series: Series<T>): string {
  return `${Math.min(series.index + 1, series.items.length)} / ${series.items.length}`;
}

function count(n: number, word: string): string {
  return `${n} ${n > 1 ? `${word}s` : word}`;
}

/**
 * Bilan du toast : « Saisie en série terminée : 2 élèves enregistrés, 1 passé. »
 * après le dernier élève, « Saisie en série arrêtée : … » sur « Terminer ».
 * Un arrêt avant tout geste n'a rien à dire.
 */
export function seriesSummary<T>(series: Series<T>): string | null {
  const finished = isFinished(series);
  if (!finished && series.saved === 0 && series.skipped === 0) return null;
  const parts = [
    series.saved === 0
      ? "aucun élève enregistré"
      : `${count(series.saved, "élève")} ${series.saved > 1 ? "enregistrés" : "enregistré"}`,
  ];
  if (series.skipped > 0) parts.push(count(series.skipped, "passé"));
  return `Saisie en série ${finished ? "terminée" : "arrêtée"} : ${parts.join(", ")}.`;
}
