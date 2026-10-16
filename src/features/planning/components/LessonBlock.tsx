import { useDraggable } from "@dnd-kit/core";
import { type KeyboardEvent, memo, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { lessonNameLines } from "../grid/dayView";
import { lessonDescriptionId } from "../hoverCard";
import { type InteractionStore, useInteraction } from "../interaction";

export interface LessonBlockProps {
  id: string;
  instructorId: string | null;
  left: number;
  top: number;
  width: number;
  height: number;
  color: string;
  groupName: string;
  timeLabel: string;
  /** « KB · 5/8 ». */
  detail: string;
  ariaLabel: string;
  warning: boolean;
  dimmed: boolean;
  /** Séance annulée (semaine datée) : grisée, barrée, non déplaçable. */
  cancelled: boolean;
  /** Séance assurée par un remplaçant (semaine datée). */
  replaced: boolean;
  /** Séance modifiée pour cette seule semaine. */
  modified: boolean;
  /** Cours ponctuel (semaine datée). */
  oneOff: boolean;
  /** Saison archivée : ni déplaçable ni redimensionnable. */
  locked: boolean;
  selected: boolean;
  interaction: InteractionStore;
  onOpen: (id: string) => void;
  onHover: (instructorId: string | null) => void;
  /** Fiche du cours au survol : cours survolé, ou `null` à la sortie. */
  onCard: (id: string | null, element?: HTMLElement) => void;
}

/**
 * Cours de la grille (§4.1) : bloc à la couleur du moniteur, avec le groupe,
 * l'horaire, les initiales et l'effectif. Se déplace par glisser-déposer et
 * se redimensionne par son bord inférieur (§5.2).
 *
 * Mémoïsé (props primitives) : pendant un glisser, seuls le cours saisi et la
 * cible d'une pastille sont redessinés.
 */
export const LessonBlock = memo(function LessonBlock(props: LessonBlockProps) {
  const { id, interaction, onOpen, onHover, onCard, cancelled, locked } = props;
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `lesson:${id}`,
    data: { type: "move", lessonId: id },
    disabled: cancelled || locked,
    attributes: {
      roleDescription: cancelled ? "séance annulée" : locked ? "cours" : "cours déplaçable",
    },
  });
  const isSource = useInteraction(
    interaction,
    (s) => s.drag?.kind === "move" && !s.drag.duplicate && s.drag.lessonId === id,
  );
  const isResizing = useInteraction(
    interaction,
    (s) => s.drag?.kind === "resize" && s.drag.lessonId === id,
  );
  const isDropTarget = useInteraction(
    interaction,
    (s) => s.drag?.kind === "instructor" && s.drag.targetLessonId === id,
  );

  // Un cours supprimé sous le pointeur (Suppr, annulation) ne reçoit pas de
  // `mouseleave` : ses hachures sont retirées au démontage.
  const hovered = useRef(false);
  useEffect(
    () => () => {
      if (!hovered.current) return;
      onHover(null);
      onCard(null);
    },
    [onHover, onCard],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Espace saisit le cours pour le déplacer au clavier (dnd-kit).
    listeners?.onKeyDown?.(event);
    // Entrée ouvre le détail, sauf pendant un déplacement (elle dépose alors le cours).
    if (event.key === "Enter" && !interaction.get().drag) {
      event.preventDefault();
      onOpen(id);
    }
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: bloc positionné qui contient la poignée de redimensionnement (un <button> ne peut contenir d'élément interactif).
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      data-testid="lesson"
      data-lesson-id={id}
      data-warning={props.warning || undefined}
      data-dimmed={props.dimmed || undefined}
      data-selected={props.selected || undefined}
      data-cancelled={cancelled || undefined}
      data-replaced={props.replaced || undefined}
      data-modified={props.modified || undefined}
      data-one-off={props.oneOff || undefined}
      data-locked={locked || undefined}
      // Verrouillé (saison archivée), le cours reste consultable : il n'est pas « désactivé ».
      aria-disabled={locked && !cancelled ? undefined : attributes["aria-disabled"]}
      aria-label={props.ariaLabel}
      // Détail de la fiche au survol, pour les lecteurs d'écran, après les consignes de dnd-kit.
      aria-describedby={[attributes["aria-describedby"], lessonDescriptionId(id)]
        .filter(Boolean)
        .join(" ")}
      onClick={() => onOpen(id)}
      onKeyDown={onKeyDown}
      onMouseEnter={(event) => {
        hovered.current = true;
        onHover(cancelled ? null : props.instructorId);
        // La fiche ne s'affiche pas pendant un glisser (voir HoverCardStore).
        onCard(id, event.currentTarget);
      }}
      onMouseLeave={() => {
        hovered.current = false;
        onHover(null);
        onCard(null);
      }}
      className={cn(
        "group/lesson absolute z-[5] touch-none select-none overflow-hidden rounded-[5px] px-1.5 py-0.5 text-[11px] text-white leading-tight shadow-sm",
        locked ? "cursor-pointer" : "cursor-grab",
        // Focus clavier : contour épais distinct des anneaux d'avertissement et de sélection.
        "focus-visible:z-[9] focus-visible:outline-3 focus-visible:outline-foreground focus-visible:outline-offset-2 focus-visible:outline-solid",
        props.warning && "ring-2 ring-destructive",
        props.selected && "z-[6] ring-2 ring-foreground ring-offset-1 ring-offset-card",
        props.selected && props.warning && "ring-destructive ring-offset-2",
        isDropTarget && "z-[7] ring-4 ring-sky-500",
        (isSource || isResizing) && "opacity-30",
        props.oneOff && "outline-2 outline-white/80 outline-dashed -outline-offset-[3px]",
        cancelled &&
          "cursor-pointer border border-muted-foreground/40 border-dashed bg-muted text-muted-foreground line-through decoration-2 shadow-none",
        props.dimmed && !props.selected && "opacity-25",
      )}
      style={{
        left: props.left,
        top: props.top,
        width: props.width,
        height: props.height,
        backgroundColor: cancelled ? undefined : props.color,
      }}
    >
      <LessonContent
        groupName={props.groupName}
        timeLabel={props.timeLabel}
        detail={props.detail}
        warning={props.warning}
        marker={cancelled ? "✕" : props.replaced ? "⇄" : props.modified ? "✎" : null}
        nameLines={lessonNameLines(props.height)}
      />
      {!cancelled && !locked && <ResizeHandle lessonId={id} />}
    </div>
  );
});

export function LessonContent({
  groupName,
  timeLabel,
  detail,
  warning,
  marker = null,
  nameLines = 1,
}: {
  groupName: string;
  timeLabel: string;
  detail: string;
  warning: boolean;
  /** Indicateur de séance datée : annulée ✕, remplacement ⇄, modifiée ✎. */
  marker?: string | null;
  /** Nom sur deux lignes quand la carte est assez haute. */
  nameLines?: 1 | 2;
}) {
  return (
    <>
      <div
        data-testid="lesson-name"
        className={cn(
          "font-semibold",
          nameLines === 2 ? "line-clamp-2 break-words" : "truncate",
          // Place réservée aux indicateurs du coin supérieur droit, s'il y en a.
          (warning || marker) && "pr-3",
        )}
      >
        {groupName}
      </div>
      <div className="truncate">{timeLabel}</div>
      <div className="truncate">{detail}</div>
      {(warning || marker) && (
        <span className="absolute top-0.5 right-1 flex gap-0.5 text-xs no-underline" aria-hidden>
          {marker && <span data-testid="lesson-marker">{marker}</span>}
          {warning && <span>⚠</span>}
        </span>
      )}
    </>
  );
}

function ResizeHandle({ lessonId }: { lessonId: string }) {
  const { listeners, setNodeRef } = useDraggable({
    id: `resize:${lessonId}`,
    data: { type: "resize", lessonId },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      data-testid="resize-handle"
      aria-hidden
      className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
    >
      <span className="-translate-x-1/2 absolute bottom-0.5 left-1/2 h-[3px] w-[18px] rounded-sm bg-white/75 opacity-0 transition-opacity group-hover/lesson:opacity-100" />
    </div>
  );
}
