import { useDraggable } from "@dnd-kit/core";
import { memo } from "react";
import { cn } from "@/lib/utils";
import { hoursLabel } from "../grid/geometry";
import { type InteractionStore, useInteraction } from "../interaction";

export interface LegendEntry {
  id: string;
  name: string;
  firstName: string;
  color: string;
  minutes: number;
  noAvailability: boolean;
}

interface LegendProps {
  entries: readonly LegendEntry[];
  totalMinutes: number;
  interaction: InteractionStore;
  /** Saison archivée : les pastilles ne se glissent plus sur les cours. */
  readOnly?: boolean;
}

/**
 * Légende des moniteurs (§4.3) avec leur total d'heures de la semaine. Une
 * pastille se clique pour hachurer les indisponibilités du moniteur (§4.4) et
 * se glisse sur un cours pour le lui confier (§5.2).
 */
export const Legend = memo(function Legend({
  entries,
  totalMinutes,
  interaction,
  readOnly = false,
}: LegendProps) {
  return (
    <fieldset aria-label="Légende des moniteurs" className="flex flex-wrap items-center gap-1.5">
      {entries.map((entry) => (
        <InstructorPill
          key={entry.id}
          entry={entry}
          interaction={interaction}
          readOnly={readOnly}
        />
      ))}
      <span data-testid="week-total" className="ml-1 text-muted-foreground text-xs">
        Total : {hoursLabel(totalMinutes)}
      </span>
    </fieldset>
  );
});

function InstructorPill({
  entry,
  interaction,
  readOnly,
}: {
  entry: LegendEntry;
  interaction: InteractionStore;
  readOnly: boolean;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `instructor:${entry.id}`,
    data: { type: "instructor", instructorId: entry.id },
    disabled: readOnly,
    attributes: { roleDescription: "pastille de moniteur" },
  });
  const pinned = useInteraction(interaction, (s) => s.pinnedInstructorId === entry.id);
  const hours = hoursLabel(entry.minutes);
  return (
    <button
      type="button"
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-pressed={pinned}
      aria-label={`${entry.name}, ${hours} cette semaine`}
      title={`${entry.name}${entry.noAvailability ? " — aucune disponibilité saisie" : ""}\nCliquer : afficher ses indisponibilités${readOnly ? "" : "\nGlisser sur un cours : le lui confier"}`}
      data-testid="instructor-pill"
      onClick={() => interaction.update({ pinnedInstructorId: pinned ? null : entry.id })}
      className={cn(
        "inline-flex touch-none select-none items-center gap-1.5 rounded-full border bg-card py-1 pr-2.5 pl-1.5 text-xs",
        readOnly ? "cursor-pointer" : "cursor-grab",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        pinned && "border-primary bg-accent",
      )}
    >
      <span className="size-3.5 rounded-full" style={{ backgroundColor: entry.color }} />
      {entry.firstName}
      {entry.noAvailability && (
        <span className="text-destructive" aria-hidden>
          ⚠
        </span>
      )}
      <small className="text-muted-foreground">{hours}</small>
    </button>
  );
}
