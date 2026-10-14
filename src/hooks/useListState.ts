import { useCallback, useState } from "react";
import { type SortState, toggleSort } from "@/domain/search";

/** Recherche et tri d'une liste. */
export function useListState<K extends string>(initialSort: SortState<K>) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState<K>>(initialSort);
  const onSort = useCallback((key: K) => setSort((current) => toggleSort(current, key)), []);
  return { query, setQuery, sort, onSort };
}
