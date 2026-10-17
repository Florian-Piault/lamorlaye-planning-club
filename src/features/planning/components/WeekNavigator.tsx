import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidDate } from "@/domain/time";
import { clampWeek, type PlanningMode, type SeasonRange, weekNeighbours } from "../grid/items";
import { segmentClass } from "./segment";

interface ModeSelectorProps {
  mode: PlanningMode;
  /** Lundi proposé pour le mode daté (dernière semaine consultée). */
  datedMonday: string;
  onChange: (mode: PlanningMode) => void;
}

/**
 * Sélecteur de mode « Planning habituel » / « Une semaine précise » (semaine
 * type et semaine datée, §4.2), dans l'en-tête du planning. La semaine
 * affichée est nommée dans la barre de mode ; on change de semaine depuis la
 * barre des jours ({@link WeekNavigator}).
 */
export function ModeSelector({ mode, datedMonday, onChange }: ModeSelectorProps) {
  const monday = mode.kind === "dated" ? mode.monday : datedMonday;
  const segment = (active: boolean) =>
    segmentClass(
      active,
      mode.kind === "type" ? "bg-sky-700 text-white" : "bg-emerald-700 text-white",
      "py-1 @max-[50rem]:px-1.5 @max-[50rem]:text-[11px]",
    );
  return (
    <fieldset
      aria-label="Mode d'affichage"
      className="inline-flex shrink-0 rounded-md border p-0.5"
    >
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
        onClick={() => onChange({ kind: "dated", monday })}
      >
        Une semaine précise
      </button>
    </fieldset>
  );
}

interface WeekNavigatorProps {
  /** Semaine datée affichée. */
  monday: string;
  season: SeasonRange;
  /** Lundi de la semaine d'aujourd'hui, ramenée dans la saison. */
  todayMonday: string;
  onChange: (mode: PlanningMode) => void;
}

/**
 * Navigation entre les semaines datées, en tête de la barre des jours :
 * précédente, suivante, aujourd'hui, sélecteur de date. Les flèches ← / → du
 * clavier font de même.
 */
export function WeekNavigator({ monday, season, todayMonday, onChange }: WeekNavigatorProps) {
  const { previous, next } = weekNeighbours(season, monday);
  const go = (target: string) => onChange({ kind: "dated", monday: target });
  return (
    <div data-testid="week-navigator" className="flex shrink-0 items-center gap-1">
      <Button
        size="icon"
        variant="outline"
        className="size-7"
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
        className="size-7"
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
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2 text-xs"
        onClick={() => go(todayMonday)}
      >
        Aujourd'hui
      </Button>
      <Input
        type="date"
        aria-label="Aller à la date"
        className="h-7 w-[9rem] text-xs"
        min={season.startDate}
        max={season.endDate}
        value={monday}
        onChange={(e) => {
          if (isValidDate(e.target.value)) go(clampWeek(season, e.target.value));
        }}
      />
    </div>
  );
}
