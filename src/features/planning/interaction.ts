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
      instructorId: string | null;
      /** Groupe du cours : ses élèves indisponibles sont ombrés (§4.4). */
      groupId: string | null;
      /** Durée du cours, fixe pendant le déplacement : base de l'ombrage (§4.4). */
      durationMinutes: number;
      /** Écart (minutes) entre le point saisi et le début du cours. */
      grabOffset: number;
      /** Alt / Option enfoncée : duplication. */
      duplicate: boolean;
      /** Déplacement au clavier (flèches) plutôt qu'au pointeur. */
      keyboard?: boolean;
      candidate: CandidateLesson | null;
      warnings: Conflict[];
    }
  | {
      kind: "resize";
      lessonId: string;
      instructorId: string | null;
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
      /**
       * Groupe déjà choisi pour le nouveau cours (filtre « Groupe » de la
       * grille) : ses élèves indisponibles sont ombrés et le panneau s'ouvre
       * avec ce groupe.
       */
      groupId: string | null;
      candidate: CandidateLesson | null;
      warnings: Conflict[];
    };

export interface InteractionState {
  hoverInstructorId: string | null;
  pinnedInstructorId: string | null;
  /** Moniteur choisi dans le panneau du cours ouvert (B8). */
  panelInstructorId: string | null;
  drag: DragState | null;
  pointer: PointerPosition | null;
  /** Brouillon du panneau « Nouveau cours », dessiné en pointillés. */
  draft: CandidateLesson | null;
}

const initialState: InteractionState = {
  hoverInstructorId: null,
  pinnedInstructorId: null,
  panelInstructorId: null,
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

/**
 * Moniteur dont les indisponibilités sont hachurées (§4.4) : celui du glisser
 * en cours, sinon celui choisi dans le panneau du cours (B8), sinon le
 * moniteur survolé, sinon celui épinglé dans la légende.
 */
export function hatchedInstructorId(state: InteractionState): string | null {
  return (
    (state.drag && state.drag.kind !== "select" ? state.drag.instructorId : null) ??
    state.panelInstructorId ??
    state.hoverInstructorId ??
    state.pinnedInstructorId
  );
}

/**
 * Groupe dont les élèves indisponibles sont ombrés (§4.4) : celui du cours
 * déplacé, ou celui déjà choisi pour un cours créé à la souris. Il ne change
 * qu'au début et à la fin du geste : l'ombrage est calculé une fois par geste.
 */
export function shadedGroupId(state: InteractionState): string | null {
  const drag = state.drag;
  return drag?.kind === "move" || drag?.kind === "select" ? drag.groupId : null;
}

/**
 * Durée sur laquelle l'ombrage est calculé (§4.4) : celle du cours déplacé ;
 * `null` pour une création, dont la durée n'est connue qu'au relâché.
 */
export function shadedDuration(state: InteractionState): number | null {
  return state.drag?.kind === "move" ? state.drag.durationMinutes : null;
}
