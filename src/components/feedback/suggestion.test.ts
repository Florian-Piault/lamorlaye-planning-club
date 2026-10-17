import { describe, expect, it } from "vitest";
import {
  decideSuggestion,
  pendingOnShow,
  QUEUE_WINDOW,
  type ShownToast,
  SUGGESTION_WINDOW,
  showQueued,
} from "./suggestion";

const success = (shownAt: number, hasAction = false): ShownToast => ({
  kind: "success",
  hasAction,
  shownAt,
});

describe("suite du guidage proposée au toast", () => {
  it("complète la confirmation de l'écran affichée à l'instant", () => {
    expect(decideSuggestion(success(1000), 1000 + SUGGESTION_WINDOW - 1, false)).toBe("attach");
  });

  it("remplace un ancien succès sans action", () => {
    expect(decideSuggestion(success(1000), 1000 + SUGGESTION_WINDOW, false)).toBe("show");
  });

  it("préserve une action existante ou une erreur : la suite passe après", () => {
    expect(decideSuggestion(success(1000, true), 1001, false)).toBe("queue");
    expect(decideSuggestion({ kind: "error", hasAction: false, shownAt: 1000 }, 1001, false)).toBe(
      "queue",
    );
  });

  it("sans toast affiché, attend la confirmation de l'écran", () => {
    expect(decideSuggestion(null, 1000, false)).toBe("defer");
  });

  it("ne propose rien pendant qu'une fenêtre modale est ouverte", () => {
    expect(decideSuggestion(null, 1000, true)).toBe("skip");
    expect(decideSuggestion(success(1000), 1001, true)).toBe("skip");
  });
});

describe("suite en attente quand un toast s'affiche", () => {
  it("un succès sans action la reçoit dès son affichage, dans le délai", () => {
    expect(pendingOnShow(2500, 2000, "success", false)).toBe("take");
  });

  it("un toast avec son action ou une erreur la garde pour après", () => {
    expect(pendingOnShow(2500, 2000, "success", true)).toBe("queue");
    expect(pendingOnShow(2500, 2000, "error", false)).toBe("queue");
  });

  it("rien sans suite en attente ou après le délai (suite vidée)", () => {
    expect(pendingOnShow(null, 2000, "success", false)).toBe("none");
    expect(pendingOnShow(2000, 2000, "success", false)).toBe("none");
  });
});

describe("suite affichée après le toast", () => {
  it("s'affiche à la fin du délai ou après l'action, dans le délai et hors fenêtre", () => {
    const until = 1000 + QUEUE_WINDOW;
    expect(showQueued(until, 1000, false, "timeout")).toBe(true);
    expect(showQueued(until, 1000, false, "action")).toBe(true);
    expect(showQueued(until, until, false, "timeout")).toBe(false);
    expect(showQueued(until, 1000, true, "timeout")).toBe(false);
    expect(showQueued(null, 1000, false, "timeout")).toBe(false);
  });

  it("jamais quand le toast est fermé exprès", () => {
    expect(showQueued(1000 + QUEUE_WINDOW, 1000, false, "user")).toBe(false);
  });
});
