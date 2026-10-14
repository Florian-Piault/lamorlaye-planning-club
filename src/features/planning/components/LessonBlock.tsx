import { useDraggable } from "@dnd-kit/core";
import { type KeyboardEvent, memo, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { type InteractionStore, useInteraction } from "../interaction";

export interface LessonBlockProps {
  id: string;
  instructorId: string;
  left: number;
  top: number;
  width: number;
  height: number;
  color: string;
  groupName: string;
  timeLabel: string;
  /** « KB · 5/8 ». */
  detail: string;
  /** Infobulle : détail complet et avertissements. */
  title: string;
  ariaLabel: string;
  warning: boolean;
  dimmed: boolean;
  selected: boolean;
  interaction: InteractionStore;
  onOpen: (id: string) => void;
  onHover: (instructorId: string | null) => void;
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
  const { id, interaction, onOpen, onHover } = props;
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `lesson:${id}`,
    data: { type: "move", lessonId: id },
    attributes: { roleDescription: "cours déplaçable" },
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
      if (hovered.current) onHover(null);
    },
    [onHover],
  );

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
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
      aria-label={props.ariaLabel}
      title={props.title}
      onClick={() => onOpen(id)}
      onKeyDown={onKeyDown}
      onMouseEnter={() => {
        hovered.current = true;
        onHover(props.instructorId);
      }}
      onMouseLeave={() => {
        hovered.current = false;
        onHover(null);
      }}
      className={cn(
        "group/lesson absolute z-[5] cursor-grab touch-none select-none overflow-hidden rounded-[5px] px-1.5 py-0.5 text-[11px] text-white leading-tight shadow-sm outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring",
        props.warning && "ring-2 ring-destructive",
        props.selected && "z-[6] ring-2 ring-foreground ring-offset-1 ring-offset-card",
        props.selected && props.warning && "ring-destructive ring-offset-2",
        isDropTarget && "z-[7] ring-4 ring-sky-500",
        (isSource || isResizing) && "opacity-30",
        props.dimmed && !props.selected && "opacity-25",
      )}
      style={{
        left: props.left,
        top: props.top,
        width: props.width,
        height: props.height,
        backgroundColor: props.color,
      }}
    >
      <LessonContent
        groupName={props.groupName}
        timeLabel={props.timeLabel}
        detail={props.detail}
        warning={props.warning}
      />
      <ResizeHandle lessonId={id} />
    </div>
  );
});

export function LessonContent({
  groupName,
  timeLabel,
  detail,
  warning,
}: {
  groupName: string;
  timeLabel: string;
  detail: string;
  warning: boolean;
}) {
  return (
    <>
      <div className="truncate pr-3 font-semibold">{groupName}</div>
      <div className="truncate">{timeLabel}</div>
      <div className="truncate">{detail}</div>
      {warning && (
        <span className="absolute top-0.5 right-1 text-xs" aria-hidden>
          ⚠
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
