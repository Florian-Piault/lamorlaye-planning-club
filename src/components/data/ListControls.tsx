import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { TableHead } from "@/components/ui/table";
import type { SortState } from "@/domain/search";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  className?: string;
}

/** Champ de recherche d'une liste. */
export function SearchInput({ value, onChange, label, className }: SearchInputProps) {
  return (
    <div className={cn("relative w-full max-w-xs", className)}>
      <Search
        className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 size-4 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        aria-label={label}
        className="pl-8"
      />
    </div>
  );
}

interface SortableHeadProps<K extends string> {
  sortKey: K;
  sort: SortState<K> | undefined;
  onSort: (key: K) => void;
  children: ReactNode;
  className?: string;
}

/** En-tête de colonne cliquable pour trier la liste. */
export function SortableHead<K extends string>({
  sortKey,
  sort,
  onSort,
  children,
  className,
}: SortableHeadProps<K>) {
  const active = sort?.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort?.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead
      className={className}
      aria-sort={active ? (sort?.direction === "asc" ? "ascending" : "descending") : undefined}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="-mx-1 inline-flex items-center gap-1 rounded px-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {children}
        <Icon className={cn("size-3.5", !active && "opacity-40")} aria-hidden />
      </button>
    </TableHead>
  );
}

/** Ligne vide d'un tableau. */
export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-8 text-center text-muted-foreground text-sm">
        {children}
      </td>
    </tr>
  );
}
