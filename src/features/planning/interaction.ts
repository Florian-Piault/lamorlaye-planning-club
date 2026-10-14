/**
 * État éphémère des interactions avec la grille : survol, pastille épinglée,
 * glisser-déposer en cours, brouillon d'un nouveau cours.
 *
 * Il change à chaque mouvement de la souris : il est tenu hors de l'état
 * React de l'écran, dans un petit magasin auquel seuls les calques concernés
 * (aperçu, hachures, infobulle) s'abonnent, avec un sélecteur. La grille et
 * ses 150 cours ne sont donc pas redessinés pendant un glisser (§11.5).
 */
import { useCallback, useSyncExternalStore } from "react";
import type { Conflict } from "@/domain/conflicts";
import type { CandidateLesson } from "./grid/view";

export interface PointerPosition {
  clientX: number;
  clientY: number;
}

export type DragState =
  | {
      kind: "move";
      lessonId: string;
      instructorId: string;
      /** Écart (minutes) entre le point saisi et le début du cours. */
      grabOffset: number;
      /** Alt / Option enfoncée : duplication. */
      duplicate: boolean;
      candidate: CandidateLesson | null;
      warnings: Conflict[];
    }
  | {
      kind: "resize";
      lessonId: string;
      instructorId: string;
      candidate: CandidateLesson | null;
      warnings: Conflict[];
    }
  | {
      kind: "instructor";
      instructorId: string;
      targetLessonId: string | null;
      candidate: CandidateLesson | null;
      warnings: Conflict[];
    }
  | {
      kind: "select";
      weekday: number;
      courtId: string;
      anchorY: number;
      candidate: CandidateLesson | null;
      warnings: Conflict[];
    };

export interface InteractionState {
  hoverInstructorId: string | null;
  pinnedInstructorId: string | null;
  drag: DragState | null;
  pointer: PointerPosition | null;
  /** Brouillon du panneau « Nouveau cours », dessiné en pointillés. */
  draft: CandidateLesson | null;
}

const initialState: InteractionState = {
  hoverInstructorId: null,
  pinnedInstructorId: null,
  drag: null,
  pointer: null,
  draft: null,
};

export class InteractionStore {
  private state: InteractionState = initialState;
  private readonly listeners = new Set<() => void>();

  get = (): InteractionState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  update(patch: Partial<InteractionState>): void {
    let changed = false;
    for (const key of Object.keys(patch) as (keyof InteractionState)[]) {
      if (this.state[key] !== patch[key]) changed = true;
    }
    if (!changed) return;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
}

/** Abonnement à une partie de l'état : le composant n'est redessiné que si elle change. */
export function useInteraction<T>(
  store: InteractionStore,
  selector: (state: InteractionState) => T,
): T {
  const getSnapshot = useCallback(() => selector(store.get()), [store, selector]);
  return useSyncExternalStore(store.subscribe, getSnapshot);
}

/** Moniteur dont les indisponibilités sont hachurées (§4.4). */
export function hatchedInstructorId(state: InteractionState): string | null {
  return (
    (state.drag && state.drag.kind !== "select" ? state.drag.instructorId : null) ??
    state.hoverInstructorId ??
    state.pinnedInstructorId
  );
}
