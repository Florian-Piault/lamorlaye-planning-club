import { ListFilter, X } from "lucide-react";
import { memo, type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { FILTERS_MENU_WIDTH, menuPlacement } from "../grid/dayView";
import {
  activeFilterCount,
  hasFilters,
  noFilters,
  type PlanningFilters,
  toggleId,
} from "../grid/view";

interface FiltersProps {
  filters: PlanningFilters;
  onChange: (filters: PlanningFilters) => void;
  instructors: readonly { id: string; name: string; color: string }[];
  courts: readonly { id: string; name: string }[];
  groups: readonly { id: string; name: string }[];
}

/**
 * Menu « Filtres » de l'en-tête du planning (§4.3) : le bouton affiche le
 * nombre de filtres actifs ; le menu déroulant filtre par moniteur(s),
 * court(s) et groupe (les autres cours sont estompés). Il se ferme par Échap,
 * un clic au-dehors ou un second clic sur le bouton.
 */
export const FiltersMenu = memo(function FiltersMenu(props: FiltersProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const count = activeFilterCount(props.filters);
  const [placement, setPlacement] = useState({ left: 0, width: FILTERS_MENU_WIDTH });

  // Le menu reste dans la zone de contenu : décalé vers la gauche (et
  // rétréci) s'il en sortirait, comme à 960 px.
  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    const root = rootRef.current.getBoundingClientRect();
    const area = rootRef.current.closest("main")?.getBoundingClientRect() ?? {
      left: 0,
      right: window.innerWidth,
    };
    setPlacement(menuPlacement(root.left, area.left, area.right));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    // Échap ferme le menu, et seulement lui (le panneau de cours reste ouvert).
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector("[role=tooltip]")) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0" data-menu-open={open || undefined}>
      <Tooltip content={open ? "" : "Filtrer par moniteur, court ou groupe"}>
        <button
          ref={buttonRef}
          type="button"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={count > 0 ? `Filtres, ${count} actif${count > 1 ? "s" : ""}` : "Filtres"}
          onClick={() => setOpen(!open)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border bg-background px-2.5 font-medium text-xs shadow-xs hover:bg-accent @max-[50rem]:gap-1 @max-[50rem]:px-2",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            count > 0 && "border-primary bg-accent",
          )}
        >
          <ListFilter aria-hidden className="size-3.5" />
          {/* Barre d'outils étroite : l'icône et le nombre seuls. */}
          <span className="@max-[50rem]:sr-only">Filtres</span>
          {count > 0 && (
            <span
              data-testid="filter-count"
              className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground"
            >
              {count}
            </span>
          )}
        </button>
      </Tooltip>
      <div
        id={menuId}
        hidden={!open}
        className="absolute top-full z-40 mt-1 rounded-md border bg-card shadow-lg"
        style={{ left: placement.left, width: placement.width }}
      >
        {open && <Filters {...props} />}
      </div>
    </div>
  );
});

/** Filtres par moniteur(s), court(s) et groupe (§4.3) : les autres cours sont estompés. */
const Filters = memo(function Filters({
  filters,
  onChange,
  instructors,
  courts,
  groups,
}: FiltersProps) {
  const groupSelectId = useId();
  return (
    <div className="flex flex-col gap-3 p-3 text-xs">
      <fieldset aria-label="Filtrer par moniteur" className="flex flex-wrap items-center gap-1">
        <legend className="float-left mr-1 w-16 text-muted-foreground">Moniteurs</legend>
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
        <legend className="float-left mr-1 w-16 text-muted-foreground">Courts</legend>
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={groupSelectId} className="flex items-center gap-1">
          <span className="w-16 text-muted-foreground">Groupe</span>
          <Select
            id={groupSelectId}
            aria-label="Filtrer par groupe"
            className="h-7 w-56 text-xs"
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
        {/* Toujours présent (rien ne bouge) : grisé, avec sa raison, sans filtre actif. */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7"
          disabled={!hasFilters(filters)}
          disabledReason="Aucun filtre actif"
          reasonSide="start"
          onClick={() => onChange(noFilters)}
        >
          <X aria-hidden />
          Effacer les filtres
        </Button>
      </div>
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
