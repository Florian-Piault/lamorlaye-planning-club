import { describe, expect, it } from "vitest";
import { clearFieldErrors, sameValues } from "./formState";

interface Values {
  name: string;
  phone: string;
  days: number[];
}

describe("effacement des erreurs de champ (B10)", () => {
  it("efface l'erreur du champ modifié et garde les autres", () => {
    const errors = { name: "Obligatoire", phone: "Numéro invalide" };
    expect(clearFieldErrors<Values>(errors, { name: "Léa" })).toEqual({
      phone: "Numéro invalide",
    });
  });

  it("renvoie les mêmes erreurs si le champ modifié n'en avait pas", () => {
    const errors = { phone: "Numéro invalide" };
    expect(clearFieldErrors<Values>(errors, { name: "Léa" })).toBe(errors);
  });

  it("efface plusieurs champs modifiés ensemble", () => {
    expect(
      clearFieldErrors<Values>({ name: "a", phone: "b", days: "c" }, { name: "", days: [] }),
    ).toEqual({ phone: "b" });
  });
});

describe("saisie modifiée", () => {
  it("compare valeurs simples, tableaux et objets", () => {
    expect(sameValues({ name: "Léa", days: [1, 2] }, { name: "Léa", days: [1, 2] })).toBe(true);
    expect(sameValues({ name: "Léa" }, { name: "Lea" })).toBe(false);
    expect(sameValues({ days: [1, 2] }, { days: [2, 1] })).toBe(false);
    expect(sameValues({ days: [1] }, { days: [1, 2] })).toBe(false);
    expect(sameValues({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(sameValues({ a: 1, c: undefined }, { a: 1, b: undefined })).toBe(false);
    expect(sameValues(null, {})).toBe(false);
    expect(sameValues([1], { 0: 1 })).toBe(false);
    expect(sameValues(true, true)).toBe(true);
  });

  it("considère une saisie revenue à son état d'ouverture comme intacte", () => {
    const initial = { active: true, name: "Court 1" };
    const edited = { ...initial, name: "Court 12" };
    expect(sameValues(edited, initial)).toBe(false);
    expect(sameValues({ ...edited, name: "Court 1" }, initial)).toBe(true);
  });
});
