import { useDraggable } from "@dnd-kit/core";
import { memo, type PointerEventHandler } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { hoursLabel } from "../grid/geometry";
import { type InteractionStore, useInteraction } from "../interaction";

export interface LegendEntry {
  id: string;
  name: string;
  firstName: string;
  initials: string;
  color: string;
  minutes: number;
  noAvailability: boolean;
}

interface LegendProps {
  entries: readonly LegendEntry[];
  interaction: InteractionStore;
  /** Saison archivée : les pastilles ne se glissent plus sur les cours. */
  readOnly?: boolean;
}

/**
 * Légende des moniteurs (§4.3), dans l'en-tête du planning : pastilles
 * réduites à la couleur et au prénom, sur une seule ligne qui défile si la
 * place manque ; nom et heures de la semaine en bulle (le total est dans
 * « Heures »). Une pastille se clique pour hachurer les indisponibilités du
 * moniteur (§4.4) et se glisse sur un cours pour le lui confier (§5.2).
 */
export const Legend = memo(function Legend({
  entries,
  interaction,
  readOnly = false,
}: LegendProps) {
  return (
    <fieldset
      aria-label="Légende des moniteurs"
      data-testid="instructor-legend"
      onWheel={(event) => {
        // La molette fait défiler la ligne de pastilles horizontalement.
        const strip = event.currentTarget;
        if (event.deltaX === 0 && strip.scrollWidth > strip.clientWidth) {
          strip.scrollLeft += event.deltaY;
        }
      }}
      className="flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-x-auto py-1 [scrollbar-width:thin] @max-[60rem]:gap-0.5"
    >
      {entries.map((entry) => (
        <InstructorPill
          key={entry.id}
          entry={entry}
          interaction={interaction}
          readOnly={readOnly}
        />
      ))}
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
  // Au clavier, Espace et Entrée activent la pastille (hachures) : le moniteur
  // d'un cours se change alors dans son panneau. Seul le pointeur la glisse.
  const pointerListeners = listeners?.onPointerDown
    ? { onPointerDown: listeners.onPointerDown as PointerEventHandler<HTMLButtonElement> }
    : undefined;
  const help = (
    <>
      <span className="block">
        {entry.name} · {hours} cette semaine
        {entry.noAvailability && " — aucune disponibilité saisie"}
      </span>
      <span className="block">Cliquer : afficher ses indisponibilités</span>
      {!readOnly && <span className="block">Glisser sur un cours : le lui confier</span>}
    </>
  );
  return (
    <Tooltip content={help}>
      <button
        type="button"
        ref={setNodeRef}
        {...attributes}
        {...pointerListeners}
        aria-pressed={pinned}
        aria-label={`${entry.name}, ${hours} cette semaine`}
        data-testid="instructor-pill"
        onClick={() => interaction.update({ pinnedInstructorId: pinned ? null : entry.id })}
        className={cn(
          "inline-flex shrink-0 touch-none select-none items-center gap-1.5 whitespace-nowrap rounded-full border bg-card py-0.5 pr-2 pl-1 text-xs",
          // Barre de moins de 60rem (960 px, menu déplié ou réduit) : un rond à la
          // couleur du moniteur, avec ses initiales.
          "@max-[60rem]:border-transparent @max-[60rem]:bg-transparent @max-[60rem]:p-0",
          readOnly ? "cursor-pointer" : "cursor-grab",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          pinned && "border-primary bg-accent @max-[60rem]:ring-2 @max-[60rem]:ring-foreground",
        )}
      >
        <span className="contents @max-[60rem]:hidden">
          <span className="size-3 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.firstName}
          {entry.noAvailability && (
            <span className="text-destructive" aria-hidden>
              ⚠
            </span>
          )}
        </span>
        <span
          aria-hidden
          data-testid="instructor-initials"
          className="hidden size-6 items-center justify-center rounded-full font-semibold text-[10px] text-white @max-[60rem]:inline-flex"
          style={{ backgroundColor: entry.color }}
        >
          {entry.initials}
        </span>
      </button>
    </Tooltip>
  );
}
