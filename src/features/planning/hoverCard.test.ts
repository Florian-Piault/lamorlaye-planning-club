// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HOVER_CARD_DELAY,
  HoverCardStore,
  type HoverTarget,
  lessonDescription,
  lessonDescriptionId,
} from "./hoverCard";

const rect = { top: 10, left: 20, right: 120, bottom: 56 };
const target = (connected = true): HoverTarget => ({
  isConnected: connected,
  getBoundingClientRect: () => rect,
});

function pressEscape() {
  const event = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
  window.dispatchEvent(event);
  return event;
}

describe("fiche du cours au survol", () => {
  let dragging = false;
  let store: HoverCardStore;

  beforeEach(() => {
    vi.useFakeTimers();
    dragging = false;
    store = new HoverCardStore(() => dragging);
  });

  afterEach(() => {
    store.hover(null);
    vi.useRealTimers();
  });

  it("s'affiche après le délai, à la place du cours survolé", () => {
    const changes = vi.fn();
    store.subscribe(changes);
    store.hover("c1", target());
    vi.advanceTimersByTime(HOVER_CARD_DELAY - 1);
    expect(store.get()).toBeNull();
    vi.advanceTimersByTime(1);
    expect(store.get()).toEqual({ id: "c1", rect });
    expect(changes).toHaveBeenCalledTimes(1);
    store.hover(null);
    expect(store.get()).toBeNull();
  });

  it("passer d'un cours à l'autre relance le délai", () => {
    store.hover("c1", target());
    vi.advanceTimersByTime(HOVER_CARD_DELAY - 100);
    store.hover("c2", target());
    vi.advanceTimersByTime(HOVER_CARD_DELAY - 1);
    expect(store.get()).toBeNull();
    vi.advanceTimersByTime(1);
    expect(store.get()?.id).toBe("c2");
  });

  it("Échap ferme la fiche affichée, et seulement elle", () => {
    store.hover("c1", target());
    vi.advanceTimersByTime(HOVER_CARD_DELAY);
    expect(pressEscape().defaultPrevented).toBe(true);
    expect(store.get()).toBeNull();
    // Fiche fermée : Échap revient au planning (panneau, sélection).
    expect(pressEscape().defaultPrevented).toBe(false);
  });

  it("Échap pendant le délai annule l'apparition sans rien empêcher", () => {
    store.hover("c1", target());
    expect(pressEscape().defaultPrevented).toBe(false);
    vi.advanceTimersByTime(HOVER_CARD_DELAY);
    expect(store.get()).toBeNull();
  });

  it("un clic ou un défilement la masquent, ou annulent son apparition", () => {
    for (const type of ["pointerdown", "wheel", "scroll"]) {
      store.hover("c1", target());
      vi.advanceTimersByTime(HOVER_CARD_DELAY);
      expect(store.get()).not.toBeNull();
      window.dispatchEvent(new Event(type));
      expect(store.get(), type).toBeNull();

      store.hover("c1", target());
      window.dispatchEvent(new Event(type));
      vi.advanceTimersByTime(HOVER_CARD_DELAY);
      expect(store.get(), `${type} pendant le délai`).toBeNull();
    }
  });

  it("ne s'affiche pas pendant un glisser ni pour un cours retiré", () => {
    dragging = true;
    store.hover("c1", target());
    vi.advanceTimersByTime(HOVER_CARD_DELAY);
    expect(store.get()).toBeNull();

    // Glisser commencé pendant le délai.
    dragging = false;
    store.hover("c1", target());
    dragging = true;
    vi.advanceTimersByTime(HOVER_CARD_DELAY);
    expect(store.get()).toBeNull();

    dragging = false;
    store.hover("c1", target(false));
    vi.advanceTimersByTime(HOVER_CARD_DELAY);
    expect(store.get()).toBeNull();
  });
});

describe("description d'un cours", () => {
  it("reprend les lignes de la fiche puis les avertissements", () => {
    expect(
      lessonDescription({
        lines: ["Lundi 10h00–11h00", "Court 1 (couvert)"],
        warnings: ["Hors disponibilités de Karim"],
      }),
    ).toBe("Lundi 10h00–11h00. Court 1 (couvert). Avertissement : Hors disponibilités de Karim");
    expect(lessonDescriptionId("abc")).toBe("lesson-description-abc");
  });
});
