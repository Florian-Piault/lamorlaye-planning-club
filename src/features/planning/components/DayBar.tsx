import {
  ChevronLeft,
  ChevronRight,
  House,
  PanelRightClose,
  PanelRightOpen,
  Sun,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { weekdayLabel, weekdayShort } from "@/domain/time";
import { cn } from "@/lib/utils";
import { focusedWeekday, type GridView, stepWeekday } from "../grid/dayView";
import { segmentClass } from "./segment";

interface DayBarProps {
  /** Jours affichés de la saison, dans l'ordre. */
  weekdays: readonly number[];
  /** Nombre de cours de chaque jour. */
  counts: ReadonlyMap<number, number>;
  view: GridView;
  onViewChange: (view: GridView) => void;
  /** Jour ouvert par « Jour » depuis la vue Semaine (dernier vu, ou aujourd'hui). */
  openedDay: number;
  /** Navigation des semaines datées, en tête de la barre (semaine précise). */
  weekNavigation?: ReactNode;
  /** Panneau latéral affiché. */
  panelVisible: boolean;
  /** Id du panneau latéral (`aria-controls`). */
  panelId: string;
  onTogglePanel: () => void;
}

/**
 * Barre des jours, au-dessus de la grille (spec UX v1.1, « Grille ») : la
 * navigation des semaines en semaine précise, la bascule « Semaine / Jour »,
 * une pastille par jour avec son nombre de cours (le dimanche est toujours
 * atteignable), les flèches jour précédent / suivant, la légende des courts
 * et le bouton qui replie le panneau latéral.
 */
export function DayBar({
  weekdays,
  counts,
  view,
  onViewChange,
  openedDay,
  weekNavigation,
  panelVisible,
  panelId,
  onTogglePanel,
}: DayBarProps) {
  const focus = focusedWeekday(weekdays, view);
  const dayView = view.kind === "day";
  const showDay = (weekday: number) => onViewChange({ kind: "day", weekday });
  const segment = (active: boolean) =>
    segmentClass(active, "bg-primary text-primary-foreground", "py-0.5");
  return (
    <div
      data-testid="day-bar"
      className="flex min-h-10 shrink-0 flex-wrap items-center gap-x-1.5 gap-y-1 border-b bg-card px-4 py-1"
    >
      {weekNavigation && (
        <>
          {weekNavigation}
          <span aria-hidden className="mx-0.5 h-5 border-l" />
        </>
      )}
      <fieldset aria-label="Affichage de la grille" className="inline-flex rounded-md border p-0.5">
        <button
          type="button"
          aria-pressed={!dayView}
          className={segment(!dayView)}
          onClick={() => onViewChange({ kind: "week" })}
        >
          Semaine
        </button>
        <button
          type="button"
          aria-pressed={dayView}
          className={segment(dayView)}
          onClick={() => showDay(dayView ? focus : openedDay)}
        >
          Jour
        </button>
      </fieldset>
      {/* Flèches toujours en place (rien ne bouge) : masquées en vue Semaine. */}
      <Button
        size="icon"
        variant="ghost"
        className={cn("size-7", !dayView && "invisible")}
        aria-label="Jour précédent"
        tooltip="Jour précédent"
        onClick={() => showDay(stepWeekday(weekdays, focus, -1))}
      >
        <ChevronLeft aria-hidden />
      </Button>
      <fieldset aria-label="Jours de la semaine" className="flex flex-wrap gap-1">
        {weekdays.map((weekday) => {
          const active = dayView && weekday === focus;
          const count = counts.get(weekday) ?? 0;
          return (
            <button
              key={weekday}
              type="button"
              aria-pressed={active}
              aria-label={`${weekdayLabel(weekday)}, ${count} cours`}
              data-testid="day-pill"
              onClick={() => showDay(weekday)}
              className={cn(
                "inline-flex h-6 items-center gap-1 rounded-full border px-1.5 text-xs",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
              )}
            >
              {weekdayShort(weekday)}
              <span
                className={cn(
                  "rounded-full px-1 text-[10px]",
                  active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </fieldset>
      <Button
        size="icon"
        variant="ghost"
        className={cn("size-7", !dayView && "invisible")}
        aria-label="Jour suivant"
        tooltip="Jour suivant"
        onClick={() => showDay(stepWeekday(weekdays, focus, 1))}
      >
        <ChevronRight aria-hidden />
      </Button>
      <div className="ml-auto flex items-center gap-3">
        <p
          data-testid="court-legend"
          className="flex items-center gap-2 text-muted-foreground text-xs"
        >
          <span className="inline-flex items-center gap-1">
            <House aria-hidden className="size-3 opacity-70" /> couvert
          </span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <Sun aria-hidden className="size-3 text-amber-600 dark:text-amber-400" /> extérieur
          </span>
        </p>
        <Button
          size="icon"
          variant="outline"
          className="size-7"
          aria-label={panelVisible ? "Replier le panneau" : "Afficher le panneau"}
          tooltip={panelVisible ? "Replier le panneau" : "Afficher le panneau"}
          aria-expanded={panelVisible}
          aria-controls={panelVisible ? panelId : undefined}
          onClick={onTogglePanel}
        >
          {panelVisible ? <PanelRightClose aria-hidden /> : <PanelRightOpen aria-hidden />}
        </Button>
      </div>
    </div>
  );
}
