import { X } from "lucide-react";
import { memo, type ReactNode, useId } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { hasFilters, noFilters, type PlanningFilters, toggleId } from "../grid/view";

interface FiltersProps {
  filters: PlanningFilters;
  onChange: (filters: PlanningFilters) => void;
  instructors: readonly { id: string; name: string; color: string }[];
  courts: readonly { id: string; name: string }[];
  groups: readonly { id: string; name: string }[];
}

/** Filtres par moniteur(s), court(s) et groupe (§4.3) : les autres cours sont estompés. */
export const Filters = memo(function Filters({
  filters,
  onChange,
  instructors,
  courts,
  groups,
}: FiltersProps) {
  const groupSelectId = useId();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-card px-4 py-2 text-xs">
      <fieldset aria-label="Filtrer par moniteur" className="flex flex-wrap items-center gap-1">
        <legend className="float-left mr-1 text-muted-foreground">Moniteurs</legend>
        {instructors.map((i) => (
          <ToggleChip
            key={i.id}
            pressed={filters.instructorIds.includes(i.id)}
            onClick={() =>
              onChange({ ...filters, instructorIds: toggleId(filters.instructorIds, i.id) })
            }
          >
            <span className="size-2.5 rounded-full" style={{ backgroundColor: i.color }} />
            {i.name}
          </ToggleChip>
        ))}
      </fieldset>
      <fieldset aria-label="Filtrer par court" className="flex flex-wrap items-center gap-1">
        <legend className="float-left mr-1 text-muted-foreground">Courts</legend>
        {courts.map((c) => (
          <ToggleChip
            key={c.id}
            pressed={filters.courtIds.includes(c.id)}
            onClick={() => onChange({ ...filters, courtIds: toggleId(filters.courtIds, c.id) })}
          >
            {c.name}
          </ToggleChip>
        ))}
      </fieldset>
      <label htmlFor={groupSelectId} className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Groupe</span>
        <Select
          id={groupSelectId}
          aria-label="Filtrer par groupe"
          className="h-7 w-48 text-xs"
          value={filters.groupId ?? ""}
          onChange={(e) => onChange({ ...filters, groupId: e.target.value || null })}
        >
          <option value="">Tous les groupes</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
      </label>
      {hasFilters(filters) && (
        <Button variant="ghost" size="sm" className="h-7" onClick={() => onChange(noFilters)}>
          <X aria-hidden />
          Effacer les filtres
        </Button>
      )}
    </div>
  );
});

function ToggleChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full border px-2 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        pressed ? "border-primary bg-accent text-accent-foreground" : "hover:bg-accent/60",
      )}
    >
      {children}
    </button>
  );
}
