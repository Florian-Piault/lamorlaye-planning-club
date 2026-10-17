/**
 * Suite proposée par le guidage (« Étape suivante : … ») et toast commun
 * (spec UX v1.1) : la suite complète la confirmation de l'écran plutôt que de
 * la masquer, sans jamais retirer une action déjà présente (« Annuler cette
 * action », « Ajouter des élèves »). Règles pures, appliquées par `Toast.tsx`.
 */

/** Délai pendant lequel une suite et la confirmation de l'écran se rejoignent. */
export const SUGGESTION_WINDOW = 1500;

/** Délai au-delà duquel une suite mise en attente n'est plus affichée. */
export const QUEUE_WINDOW = 10_000;

/** Toast affiché, vu par les règles. */
export interface ShownToast {
  kind: "success" | "error";
  /** Le toast a déjà son action. */
  hasAction: boolean;
  /** Instant d'affichage (ms). */
  shownAt: number;
}

/**
 * Sort d'une suite proposée :
 * - `skip` : une fenêtre modale est ouverte, la suite ferait quitter la saisie ;
 * - `attach` : le succès de l'écran, affiché à l'instant et sans action, la reçoit ;
 * - `defer` : rien n'est affiché ; la suite attend la confirmation de l'écran
 *   (`SUGGESTION_WINDOW`), puis s'affiche seule ;
 * - `show` : le toast affiché est un ancien succès sans action, la suite le remplace ;
 * - `queue` : le toast affiché a son action ou est une erreur, la suite
 *   s'affichera après lui.
 */
export type SuggestionDecision = "skip" | "attach" | "defer" | "show" | "queue";

export function decideSuggestion(
  shown: ShownToast | null,
  now: number,
  modalOpen: boolean,
): SuggestionDecision {
  if (modalOpen) return "skip";
  if (!shown) return "defer";
  if (shown.kind === "success" && !shown.hasAction) {
    return now - shown.shownAt < SUGGESTION_WINDOW ? "attach" : "show";
  }
  return "queue";
}

/**
 * Sort d'une suite en attente (`defer`) quand un toast s'affiche :
 * - `take` : un succès sans action la reçoit (action présente dès l'affichage) ;
 * - `queue` : le toast a son action ou est une erreur, la suite passe après lui ;
 * - `none` : pas de suite en attente, ou délai dépassé.
 */
export function pendingOnShow(
  pendingUntil: number | null,
  now: number,
  kind: ShownToast["kind"],
  hasOwnAction: boolean,
): "take" | "queue" | "none" {
  if (pendingUntil === null || now >= pendingUntil) return "none";
  return kind === "success" && !hasOwnAction ? "take" : "queue";
}

/** Fermeture d'un toast : délai écoulé, action suivie, ou fermeture demandée. */
export type ToastClosing = "timeout" | "action" | "user";

/**
 * Une suite en attente derrière un toast s'affiche-t-elle quand il se ferme ?
 * Oui à la fin de son délai ou après son action, dans `QUEUE_WINDOW` et hors
 * fenêtre modale ; jamais quand on le ferme exprès (« Masquer le message » ou
 * fermeture par l'écran) : on demande alors le calme.
 */
export function showQueued(
  queuedUntil: number | null,
  now: number,
  modalOpen: boolean,
  closing: ToastClosing,
): boolean {
  return queuedUntil !== null && now < queuedUntil && !modalOpen && closing !== "user";
}
