/**
 * Fiche du cours au survol (SPECS.md §4.1) : contenu, description pour les
 * lecteurs d'écran, et cours survolé, affiché après un court délai.
 */

/** Délai avant l'apparition de la fiche : balayer la grille ne la fait pas clignoter. */
export const HOVER_CARD_DELAY = 400;

/** Contenu de la fiche d'un cours au survol. */
export interface LessonCard {
  /** Nom complet du groupe. */
  heading: string;
  /** Jour et horaire, court, moniteur, effectif, état de la séance, note. */
  lines: readonly string[];
  /** Avertissements, en rouge. */
  warnings: readonly string[];
  /** Couleur du moniteur (liseré). */
  color: string;
}

/**
 * Description d'un cours pour les lecteurs d'écran (`aria-describedby`) :
 * les lignes de la fiche puis le texte des avertissements.
 */
export function lessonDescription(card: Pick<LessonCard, "lines" | "warnings">): string {
  return [...card.lines, ...card.warnings.map((w) => `Avertissement : ${w}`)].join(". ");
}

/** Id de l'élément qui porte la description d'un cours. */
export function lessonDescriptionId(lessonId: string): string {
  return `lesson-description-${lessonId}`;
}

export interface HoveredLesson {
  id: string;
  rect: { top: number; left: number; right: number; bottom: number };
}

/** Ce que la fiche lit du cours survolé (un élément du DOM, en pratique). */
export interface HoverTarget {
  readonly isConnected: boolean;
  getBoundingClientRect(): { top: number; left: number; right: number; bottom: number };
}

/**
 * Cours survolé, affiché après un court délai. Hors de l'état React des
 * cours : survoler la grille ne redessine aucun cours. Un clic, un
 * défilement (molette ou barre) ou Échap masquent la fiche, ou annulent son
 * apparition pendant le délai ; rien ne s'affiche pendant un glisser.
 */
export class HoverCardStore {
  private state: HoveredLesson | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly listeners = new Set<() => void>();
  private listening = false;

  constructor(
    /** Un glisser est-il en cours ? */
    private readonly dragging: () => boolean = () => false,
    private readonly target: Pick<Window, "addEventListener" | "removeEventListener"> = window,
  ) {}

  get = (): HoveredLesson | null => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Montre la fiche du cours `id` après le délai ; `null` la masque. */
  hover = (id: string | null, element?: HoverTarget) => {
    clearTimeout(this.timer);
    if (id === null || !element || this.dragging()) {
      this.listen(false);
      this.set(null);
      return;
    }
    this.listen(true);
    this.timer = setTimeout(() => {
      if (!element.isConnected || this.dragging()) return;
      const { top, left, right, bottom } = element.getBoundingClientRect();
      this.set({ id, rect: { top, left, right, bottom } });
    }, HOVER_CARD_DELAY);
  };

  private readonly dismiss = () => this.hover(null);

  private readonly onKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    // Affichée, Échap ferme la fiche et seulement elle (comme une bulle) ;
    // pendant le délai, il annule son apparition sans rien empêcher d'autre.
    if (this.state) event.preventDefault();
    this.dismiss();
  };

  private listen(on: boolean) {
    if (on === this.listening) return;
    this.listening = on;
    const { target } = this;
    if (on) {
      target.addEventListener("pointerdown", this.dismiss, true);
      target.addEventListener("wheel", this.dismiss, { capture: true, passive: true });
      target.addEventListener("scroll", this.dismiss, true);
      target.addEventListener("keydown", this.onKey, true);
    } else {
      target.removeEventListener("pointerdown", this.dismiss, true);
      target.removeEventListener("wheel", this.dismiss, true);
      target.removeEventListener("scroll", this.dismiss, true);
      target.removeEventListener("keydown", this.onKey, true);
    }
  }

  private set(next: HoveredLesson | null) {
    if (next === null && this.state === null) return;
    this.state = next;
    for (const listener of this.listeners) listener();
  }
}
