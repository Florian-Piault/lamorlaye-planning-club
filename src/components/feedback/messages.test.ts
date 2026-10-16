import { describe, expect, it } from "vitest";
import { errorMessages, type Message, messageLayout, moreLabel, warnings } from "./messages";

const warning = (text: string): Message => ({ kind: "warning", text });
const error = (text: string): Message => ({ kind: "error", text });

describe("zone de message réservée", () => {
  it("n'affiche rien sans message", () => {
    expect(messageLayout([])).toEqual({ lines: [], hidden: 0, folded: [], wrap: false });
  });

  it("laisse un message seul occuper les deux lignes", () => {
    expect(messageLayout([warning("Élève mineur")])).toEqual({
      lines: [warning("Élève mineur")],
      hidden: 0,
      folded: [],
      wrap: true,
    });
  });

  it("affiche deux messages sur deux lignes, sans repli", () => {
    const layout = messageLayout([warning("a"), warning("b")]);
    expect(layout.lines).toEqual([warning("a"), warning("b")]);
    expect(layout.hidden).toBe(0);
    expect(layout.wrap).toBe(false);
  });

  it("met l'erreur générale en tête, en gardant l'ordre des avertissements", () => {
    const layout = messageLayout([warning("a"), error("Échec"), { kind: "info", text: "i" }]);
    expect(layout.lines).toEqual([error("Échec")]);
    expect(layout.hidden).toBe(2);
    expect(messageLayout([warning("a"), error("Échec")]).lines).toEqual([
      error("Échec"),
      warning("a"),
    ]);
  });

  it("au-delà de deux, remplace la dernière ligne par « + N autres »", () => {
    const layout = messageLayout([warning("a"), warning("b"), warning("c")]);
    expect(layout.lines).toEqual([warning("a")]);
    expect(layout.hidden).toBe(2);
    expect(moreLabel(layout.folded)).toBe("+ 2 autres avertissements");
    expect(moreLabel([warning("x")])).toBe("+ 1 autre avertissement");
  });

  it("nomme « messages » une ligne de repli qui contient autre chose que des avertissements", () => {
    const layout = messageLayout([error("Échec"), warning("a"), { kind: "info", text: "i" }]);
    expect(moreLabel(layout.folded)).toBe("+ 2 autres messages");
    expect(moreLabel([{ kind: "info", text: "i" }])).toBe("+ 1 autre message");
  });

  it("déplié, affiche tous les messages", () => {
    const layout = messageLayout([warning("a"), warning("b"), warning("c")], true);
    expect(layout.lines.map((m) => m.text)).toEqual(["a", "b", "c"]);
    expect(layout.hidden).toBe(0);
  });

  it("retire les doublons", () => {
    expect(messageLayout([warning("a"), warning("a")]).lines).toEqual([warning("a")]);
  });

  it("construit les messages à partir de textes", () => {
    expect(warnings(["a"])).toEqual([warning("a")]);
    expect(errorMessages("Échec")).toEqual([error("Échec")]);
    expect(errorMessages(null)).toEqual([]);
  });
});
