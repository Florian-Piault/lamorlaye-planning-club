import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidDate } from "@/domain/time";
import { cn } from "@/lib/utils";
import { clampWeek, type PlanningMode, type SeasonRange, weekNeighbours } from "../grid/items";

interface WeekNavigatorProps {
  mode: PlanningMode;
  season: SeasonRange;
  /** Lundi proposé pour le mode daté (dernière semaine consultée). */
  datedMonday: string;
  /** Lundi de la semaine d'aujourd'hui, ramenée dans la saison. */
  todayMonday: string;
  onChange: (mode: PlanningMode) => void;
}

/**
 * Sélecteur de mode « Planning habituel » / « Une semaine précise » (semaine
 * type et semaine datée, §4.2) et navigation entre les semaines : précédente,
 * suivante, aujourd'hui, sélecteur de date. Les flèches ← / → du clavier font
 * de même. La semaine affichée est nommée dans la barre de mode.
 */
export function WeekNavigator({
  mode,
  season,
  datedMonday,
  todayMonday,
  onChange,
}: WeekNavigatorProps) {
  const monday = mode.kind === "dated" ? mode.monday : datedMonday;
  const { previous, next } = weekNeighbours(season, monday);
  const go = (target: string) => onChange({ kind: "dated", monday: target });
  const segment = (active: boolean) =>
    cn(
      "rounded px-2.5 py-1 font-medium text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      active
        ? mode.kind === "type"
          ? "bg-sky-700 text-white"
          : "bg-emerald-700 text-white"
        : "text-muted-foreground hover:text-foreground",
    );
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <fieldset aria-label="Mode d'affichage" className="inline-flex rounded-md border p-0.5">
        <button
          type="button"
          aria-pressed={mode.kind === "type"}
          className={segment(mode.kind === "type")}
          onClick={() => onChange({ kind: "type" })}
        >
          Planning habituel
        </button>
        <button
          type="button"
          aria-pressed={mode.kind === "dated"}
          className={segment(mode.kind === "dated")}
          onClick={() => go(monday)}
        >
          Une semaine précise
        </button>
      </fieldset>
      {mode.kind === "dated" && (
        <>
          <Button
            size="icon"
            variant="outline"
            className="size-8"
            aria-label="Semaine précédente"
            tooltip="Semaine précédente (←)"
            aria-keyshortcuts="ArrowLeft"
            disabled={!previous}
            disabledReason="Première semaine de la saison"
            reasonSide="none"
            onClick={() => previous && go(previous)}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="size-8"
            aria-label="Semaine suivante"
            tooltip="Semaine suivante (→)"
            aria-keyshortcuts="ArrowRight"
            disabled={!next}
            disabledReason="Dernière semaine de la saison"
            reasonSide="none"
            onClick={() => next && go(next)}
          >
            <ChevronRight aria-hidden />
          </Button>
          <Button size="sm" variant="outline" onClick={() => go(todayMonday)}>
            Aujourd'hui
          </Button>
          <Input
            type="date"
            aria-label="Aller à la date"
            className="h-8 w-[9.5rem]"
            min={season.startDate}
            max={season.endDate}
            value={monday}
            onChange={(e) => {
              if (isValidDate(e.target.value)) go(clampWeek(season, e.target.value));
            }}
          />
        </>
      )}
    </div>
  );
}
