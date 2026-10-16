import { describe, expect, it } from "vitest";
import {
  contactPhone,
  formatContactPhone,
  hasContactPhone,
  splitFullName,
  suggestLevel,
} from "./students";

describe("téléphone de l'élève ou du responsable légal", () => {
  it("exige au moins un des deux numéros", () => {
    expect(hasContactPhone({ phone: "0611223344", guardianPhone: null })).toBe(true);
    expect(hasContactPhone({ phone: null, guardianPhone: "0699887766" })).toBe(true);
    expect(hasContactPhone({ phone: " ", guardianPhone: "" })).toBe(false);
    expect(hasContactPhone({ phone: null, guardianPhone: undefined })).toBe(false);
  });

  it("affiche le numéro de l'élève, sinon celui du responsable suivi de « (resp.) »", () => {
    const both = { phone: "06 11 22 33 44", guardianPhone: "06 99 88 77 66" };
    expect(contactPhone(both)).toEqual({ number: "06 11 22 33 44", guardian: false });
    expect(formatContactPhone(both)).toBe("06 11 22 33 44");
    expect(formatContactPhone({ phone: null, guardianPhone: " 06 99 88 77 66 " })).toBe(
      "06 99 88 77 66 (resp.)",
    );
    expect(formatContactPhone({ phone: "", guardianPhone: null })).toBe("—");
    expect(contactPhone({ phone: "", guardianPhone: null })).toBeNull();
  });
});

describe("niveau proposé depuis les groupes", () => {
  const groups = [
    { id: "g1", levelId: null },
    { id: "g2", levelId: "l-vert" },
    { id: "g3", levelId: "l-rouge" },
  ];

  it("prend le niveau du premier groupe coché qui en a un", () => {
    expect(suggestLevel(["g3", "g2"], groups)).toBe("l-rouge");
    expect(suggestLevel(["g1", "g2"], groups)).toBe("l-vert");
    expect(suggestLevel(["g1"], groups)).toBeNull();
    expect(suggestLevel([], groups)).toBeNull();
    expect(suggestLevel(["inconnu"], groups)).toBeNull();
  });
});

describe("prénom et nom d'une recherche", () => {
  it("découpe « Prénom Nom »", () => {
    expect(splitFullName("Léa Martin")).toEqual({ firstName: "Léa", lastName: "Martin" });
    expect(splitFullName("  Léa   De la Tour ")).toEqual({
      firstName: "Léa",
      lastName: "De la Tour",
    });
    expect(splitFullName("Léa")).toEqual({ firstName: "Léa", lastName: "" });
    expect(splitFullName("  ")).toEqual({ firstName: "", lastName: "" });
  });
});
