import { describe, expect, it } from "vitest";
import { computeInitials, suggestInitials } from "./initials";

describe("initiales des moniteurs", () => {
  it.each([
    ["Karim", "Benali", "KB"],
    ["marc", "durand", "MD"],
    ["Jean-Pierre", "Dupont", "JPD"],
    ["Marie Anne Sophie", "Martin", "MAM"],
    ["Élodie", "Éluard", "ÉÉ"],
    ["Jean", "de La Fontaine", "JL"],
    ["Anne", "d'Arc", "AA"],
    ["Yann", "Le Goff", "YL"],
    ["Paul", "De Gaulle", "PD"],
    ["  Luc ", "  Martin-Durand ", "LM"],
    ["", "Martin", "M"],
    ["", "", ""],
  ])("%s %s → %s", (firstName, lastName, expected) => {
    expect(computeInitials(firstName, lastName)).toBe(expected);
  });

  it("propose les initiales calculées si elles sont libres", () => {
    expect(suggestInitials("Karim", "Benali", ["MD"])).toBe("KB");
  });

  it("ajoute la lettre suivante du nom en cas de doublon", () => {
    expect(suggestInitials("Karim", "Benali", ["kb"])).toBe("KBe");
    expect(suggestInitials("Karim", "Benali", ["KB", "KBe"])).toBe("KBn");
  });

  it("ajoute un numéro lorsque les lettres sont épuisées", () => {
    expect(suggestInitials("Karim", "Bo", ["KB", "KBo"])).toBe("KB2");
    expect(suggestInitials("Karim", "Bo", ["KB", "KBo", "KB2"])).toBe("KB3");
  });

  it("ne propose rien sans prénom ni nom", () => {
    expect(suggestInitials("", "", [])).toBe("");
  });
});
