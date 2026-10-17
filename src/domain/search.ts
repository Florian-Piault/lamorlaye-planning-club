/**
 * Recherche et tri des listes des référentiels (docs/SPECS.md §8).
 *
 * La recherche ignore la casse et les accents ; chaque mot saisi doit
 * apparaître dans l'un des champs. Le tri suit l'ordre alphabétique français,
 * les valeurs vides étant toujours placées en fin de liste.
 */

export type SortDirection = "asc" | "desc";

export type SortValue = string | number | boolean | null | undefined;

export interface SortState<K extends string = string> {
  key: K;
  direction: SortDirection;
}

/** Minuscules, sans accents, espaces superflus retirés. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Tous les mots de `query` apparaissent-ils dans au moins un des champs ? */
export function matchesSearch(fields: readonly SortValue[], query: string): boolean {
  const tokens = normalizeText(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = normalizeText(
    fields.filter((f) => f !== null && f !== undefined && f !== "").join(" "),
  );
  return tokens.every((token) => haystack.includes(token));
}

const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

const isEmpty = (value: SortValue) => value === null || value === undefined || value === "";

/** Comparaison croissante ; les valeurs vides sont placées après les autres. */
export function compareValues(a: SortValue, b: SortValue): number {
  if (isEmpty(a) || isEmpty(b)) return Number(isEmpty(a)) - Number(isEmpty(b));
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(b) - Number(a);
  return collator.compare(String(a), String(b));
}

/**
 * Filtre puis trie une liste. Le tri est stable ; en ordre décroissant, les
 * valeurs vides restent en fin de liste.
 */
export function filterAndSort<T, K extends string>(
  rows: readonly T[],
  options: {
    query: string;
    searchFields: (row: T) => readonly SortValue[];
    sort?: SortState<K>;
    sortValue?: (row: T, key: K) => SortValue;
  },
): T[] {
  const filtered = rows.filter((row) => matchesSearch(options.searchFields(row), options.query));
  const { sort, sortValue } = options;
  if (!sort || !sortValue) return filtered;
  const sign = sort.direction === "asc" ? 1 : -1;
  return filtered
    .map((row, index) => ({ row, index, value: sortValue(row, sort.key) }))
    .sort((a, b) => {
      if (isEmpty(a.value) || isEmpty(b.value)) {
        const diff = Number(isEmpty(a.value)) - Number(isEmpty(b.value));
        return diff !== 0 ? diff : a.index - b.index;
      }
      return sign * compareValues(a.value, b.value) || a.index - b.index;
    })
    .map(({ row }) => row);
}

/** Nouvel état de tri après un clic sur l'en-tête d'une colonne. */
export function toggleSort<K extends string>(
  current: SortState<K> | undefined,
  key: K,
): SortState<K> {
  if (current?.key === key) {
    return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { key, direction: "asc" };
}
