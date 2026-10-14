/**
 * Utilisation d'un élément des référentiels, pour décider entre suppression
 * et archivage (SPECS.md §8).
 */

export interface UsageCount {
  count: number;
  singular: string;
  plural: string;
}

export interface Usage {
  /** Nombre total de références. */
  total: number;
  /** Description lisible, ex. « 3 cours et 1 exception ». */
  description: string;
}

/** Liste lisible : « a », « a et b », « a, b et c ». */
export function joinFrench(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} et ${items.at(-1)}`;
}

export function describeUsage(counts: readonly UsageCount[]): Usage {
  const used = counts.filter((c) => c.count > 0);
  return {
    total: used.reduce((sum, c) => sum + c.count, 0),
    description: joinFrench(used.map((c) => `${c.count} ${c.count > 1 ? c.plural : c.singular}`)),
  };
}

/** Déplace un élément d'une liste (glisser pour réordonner). */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const result = [...items];
  if (from < 0 || from >= result.length || to < 0 || to >= result.length) return result;
  const [moved] = result.splice(from, 1);
  result.splice(to, 0, moved as T);
  return result;
}
