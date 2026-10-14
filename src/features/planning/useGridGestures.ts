import {
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { type PointerEvent as ReactPointerEvent, type RefObject, useEffect, useRef } from "react";
import type { ConflictIndex, PlanningSlot } from "@/domain/conflicts";
import {
  boardSize,
  columnAt,
  type GridGeometry,
  itemAtPoint,
  moveTarget,
  type PlacedBox,
  type Point,
  resizeDuration,
  type SlotTarget,
  selectionRange,
  yToMinute,
} from "./grid/geometry";
import { type GridItem, toCandidate } from "./grid/items";
import {
  type CandidateLesson,
  candidateWarnings,
  type DateOfWeekday,
  type InstructorLabel,
  NEW_LESSON_ID,
} from "./grid/view";
import type { DragState, InteractionStore } from "./interaction";

/** Distance (px) à parcourir avant qu'un glisser commence : en deçà, c'est un clic. */
const DRAG_THRESHOLD = 4;

export interface GestureContext {
  geometry: GridGeometry;
  boxes: readonly PlacedBox[];
  /** Éléments de la grille (cours ou séances datées), par identifiant. */
  lessonsById: ReadonlyMap<string, GridItem>;
  slots: readonly PlanningSlot[];
  index: ConflictIndex;
  labels: ReadonlyMap<string, InstructorLabel>;
  /** Date de chaque jour affiché (semaine datée) : indisponibilités datées des avertissements. */
  dateOf: DateOfWeekday;
}

export interface GestureHandlers {
  onMove: (lessonId: string, target: SlotTarget, duplicate: boolean) => void;
  onResize: (lessonId: string, durationMinutes: number) => void;
  onAssignInstructor: (lessonId: string, instructorId: string) => void;
  /** Sélection d'un créneau vide : ouvre le panneau pré-rempli. */
  onSelectSlot: (candidate: CandidateLesson) => void;
  /** Clic dans une zone vide de la grille. */
  onBoardClick: () => void;
  /** Glisser interrompu (Échap). */
  onCancel: () => void;
}

type DragData =
  | { type: "move"; lessonId: string }
  | { type: "resize"; lessonId: string }
  | { type: "instructor"; instructorId: string };

interface PointerInfo {
  clientX: number;
  clientY: number;
  alt: boolean;
}

interface PendingSelection {
  clientX: number;
  clientY: number;
  weekday: number;
  courtId: string;
  anchorY: number;
}

function sameCandidate(a: CandidateLesson | null, b: CandidateLesson | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.id === b.id &&
    a.weekday === b.weekday &&
    a.start === b.start &&
    a.durationMinutes === b.durationMinutes &&
    a.courtId === b.courtId &&
    a.groupId === b.groupId &&
    a.instructorId === b.instructorId
  );
}

/**
 * Gestes de la grille (§5.1–5.2) :
 * - glisser-déposer dnd-kit d'un cours (déplacer, Alt pour dupliquer), de sa
 *   poignée (redimensionner) et d'une pastille de moniteur ;
 * - cliquer-glisser dans une zone vide pour sélectionner un créneau.
 *
 * La position du pointeur est suivie hors de React : chaque mouvement calcule
 * le créneau visé (aimanté à 15 min) et ses avertissements, puis met à jour le
 * magasin d'interaction, auquel seuls les calques d'aperçu sont abonnés.
 */
export function useGridGestures({
  interaction,
  boardRef,
  scrollerRef,
  context,
  handlers,
}: {
  interaction: InteractionStore;
  boardRef: RefObject<HTMLDivElement | null>;
  scrollerRef: RefObject<HTMLDivElement | null>;
  context: GestureContext;
  handlers: GestureHandlers;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_THRESHOLD } }),
  );
  const latest = useRef({ context, handlers });
  latest.current = { context, handlers };
  const pointer = useRef<PointerInfo>({ clientX: 0, clientY: 0, alt: false });
  const pending = useRef<PendingSelection | null>(null);

  const boardPoint = (p: { clientX: number; clientY: number }): Point => {
    const rect = boardRef.current?.getBoundingClientRect();
    return { x: p.clientX - (rect?.left ?? 0), y: p.clientY - (rect?.top ?? 0) };
  };

  /** Recalcule le créneau visé et ses avertissements pour la position courante du pointeur. */
  const update = (drag: DragState) => {
    const {
      geometry: g,
      boxes,
      lessonsById,
      slots,
      index,
      labels,
      dateOf,
    } = latest.current.context;
    const p = pointer.current;
    const point = boardPoint(p);
    let candidate: CandidateLesson | null = null;
    let next: DragState = drag;
    switch (drag.kind) {
      case "move": {
        const lesson = lessonsById.get(drag.lessonId);
        const target = lesson && moveTarget(g, point, drag.grabOffset, lesson.durationMinutes);
        if (lesson && target) {
          candidate = {
            ...toCandidate(lesson),
            id: p.alt ? NEW_LESSON_ID : lesson.id,
            weekday: target.weekday,
            courtId: target.courtId,
            start: target.start,
          };
        }
        next = { ...drag, duplicate: p.alt };
        break;
      }
      case "resize": {
        const lesson = lessonsById.get(drag.lessonId);
        if (lesson) {
          const base = toCandidate(lesson);
          candidate = { ...base, durationMinutes: resizeDuration(g, point.y, base.start) };
        }
        break;
      }
      case "instructor": {
        const size = boardSize(g);
        const inside =
          point.x >= 0 && point.y >= 0 && point.x <= size.width && point.y <= size.height;
        const targetId = inside ? itemAtPoint(boxes, point) : null;
        const target = targetId ? lessonsById.get(targetId) : undefined;
        const lesson = target && !target.cancelled ? target : undefined;
        if (lesson) candidate = { ...toCandidate(lesson), instructorId: drag.instructorId };
        next = { ...drag, targetLessonId: lesson ? lesson.id : null };
        break;
      }
      case "select": {
        const range = selectionRange(g, drag.anchorY, point.y);
        candidate = {
          id: NEW_LESSON_ID,
          weekday: drag.weekday,
          courtId: drag.courtId,
          start: range.start,
          durationMinutes: range.end - range.start,
          groupId: null,
          instructorId: null,
        };
        break;
      }
    }
    const pointerState = { clientX: p.clientX, clientY: p.clientY };
    const unchanged =
      sameCandidate(candidate, drag.candidate) &&
      (next.kind !== "move" || drag.kind !== "move" || next.duplicate === drag.duplicate);
    if (unchanged) {
      interaction.update({ pointer: pointerState });
      return;
    }
    const warnings = candidate ? candidateWarnings(candidate, slots, index, labels, dateOf) : [];
    interaction.update({
      drag: { ...next, candidate, warnings } as DragState,
      pointer: pointerState,
    });
  };

  const refresh = () => {
    const drag = interaction.get().drag;
    if (drag) update(drag);
  };

  // Suivi du pointeur, de la touche Alt et du défilement pendant un geste.
  // biome-ignore lint/correctness/useExhaustiveDependencies: les écouteurs lisent l'état courant par références.
  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      pointer.current = { clientX: event.clientX, clientY: event.clientY, alt: event.altKey };
      const selection = pending.current;
      // Bouton relâché hors de la fenêtre : le relâchement n'a pas été reçu.
      if (selection && event.buttons === 0) {
        cancelSelection();
        return;
      }
      if (selection && !interaction.get().drag) {
        const distance = Math.hypot(
          event.clientX - selection.clientX,
          event.clientY - selection.clientY,
        );
        if (distance < DRAG_THRESHOLD) return;
        interaction.update({
          drag: {
            kind: "select",
            weekday: selection.weekday,
            courtId: selection.courtId,
            anchorY: selection.anchorY,
            candidate: null,
            warnings: [],
          },
        });
      }
      refresh();
    };
    const onPointerUp = () => {
      const selection = pending.current;
      if (!selection) return;
      pending.current = null;
      const drag = interaction.get().drag;
      if (drag?.kind === "select") {
        interaction.update({ drag: null, pointer: null });
        if (drag.candidate) latest.current.handlers.onSelectSlot(drag.candidate);
      } else {
        latest.current.handlers.onBoardClick();
      }
    };
    // Pointeur perdu (fenêtre quittée, geste système) : la sélection est abandonnée.
    const onPointerCancel = () => {
      cancelSelection();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Alt") return;
      pointer.current = { ...pointer.current, alt: event.type === "keydown" };
      const drag = interaction.get().drag;
      if (drag?.kind === "move") {
        event.preventDefault();
        update(drag);
      }
    };
    const scroller = scrollerRef.current;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    scroller?.addEventListener("scroll", refresh, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      scroller?.removeEventListener("scroll", refresh);
    };
  }, [interaction, scrollerRef]);

  const onDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined;
    const activator = event.activatorEvent as PointerEvent;
    pointer.current = {
      clientX: activator.clientX,
      clientY: activator.clientY,
      alt: activator.altKey,
    };
    const { geometry, lessonsById } = latest.current.context;
    let drag: DragState | null = null;
    if (data?.type === "move" || data?.type === "resize") {
      const lesson = lessonsById.get(data.lessonId);
      if (!lesson || lesson.cancelled) return;
      const base = {
        lessonId: lesson.id,
        instructorId: lesson.instructorId,
        candidate: null,
        warnings: [],
      };
      drag =
        data.type === "move"
          ? {
              kind: "move",
              ...base,
              grabOffset: yToMinute(geometry, boardPoint(activator).y) - lesson.start,
              duplicate: activator.altKey,
            }
          : { kind: "resize", ...base };
    } else if (data?.type === "instructor") {
      drag = {
        kind: "instructor",
        instructorId: data.instructorId,
        targetLessonId: null,
        candidate: null,
        warnings: [],
      };
    }
    if (!drag) return;
    interaction.update({ drag, hoverInstructorId: null });
    update(drag);
  };

  const onDragEnd = (_event: DragEndEvent) => {
    const drag = interaction.get().drag;
    interaction.update({ drag: null, pointer: null });
    const candidate = drag?.candidate;
    if (!drag || !candidate) return;
    const { lessonsById } = latest.current.context;
    const { handlers } = latest.current;
    if (drag.kind === "move") {
      const lesson = lessonsById.get(drag.lessonId);
      if (!lesson) return;
      const target: SlotTarget = {
        weekday: candidate.weekday,
        courtId: candidate.courtId as string,
        start: candidate.start,
        durationMinutes: candidate.durationMinutes,
      };
      const moved =
        target.weekday !== lesson.weekday ||
        target.courtId !== lesson.courtId ||
        target.start !== lesson.start;
      if (drag.duplicate || moved) handlers.onMove(lesson.id, target, drag.duplicate);
    } else if (drag.kind === "resize") {
      const lesson = lessonsById.get(drag.lessonId);
      if (lesson && candidate.durationMinutes !== lesson.durationMinutes) {
        handlers.onResize(lesson.id, candidate.durationMinutes);
      }
    } else if (drag.kind === "instructor" && drag.targetLessonId) {
      const lesson = lessonsById.get(drag.targetLessonId);
      if (lesson && lesson.instructorId !== drag.instructorId) {
        handlers.onAssignInstructor(lesson.id, drag.instructorId);
      }
    }
  };

  const onDragCancel = () => {
    if (!interaction.get().drag) return;
    interaction.update({ drag: null, pointer: null });
    latest.current.handlers.onCancel();
  };

  const onBoardPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as Element).closest("[data-lesson-id]")) return;
    const point = boardPoint(event);
    const column = columnAt(latest.current.context.geometry, point.x);
    if (!column) return;
    event.preventDefault();
    pointer.current = { clientX: event.clientX, clientY: event.clientY, alt: event.altKey };
    pending.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      weekday: column.weekday,
      courtId: column.courtId,
      anchorY: point.y,
    };
  };

  /** Interrompt une sélection en cours ; renvoie vrai si un geste était en cours. */
  const cancelSelection = (): boolean => {
    const drag = interaction.get().drag;
    if (!pending.current && drag?.kind !== "select") return false;
    pending.current = null;
    if (drag?.kind === "select") interaction.update({ drag: null, pointer: null });
    return true;
  };

  return { sensors, onDragStart, onDragEnd, onDragCancel, onBoardPointerDown, cancelSelection };
}
