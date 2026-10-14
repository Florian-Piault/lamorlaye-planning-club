import { describe, expect, it } from "vitest";
import { compareValues, filterAndSort, matchesSearch, normalizeText, toggleSort } from "./search";

interface Row {
  name: string;
  city: string | null;
  age: number | null;
}

const rows: Row[] = [
  { name: "Émile Zola", city: "Paris", age: 12 },
  { name: "anne martin", city: null, age: 30 },
  { name: "Bruno Éluard", city: "Chantilly", age: null },
  { name: "Anaïs Durand", city: "Lamorlaye", age: 9 },
];

const options = {
  searchFields: (r: Row) => [r.name, r.city],
  sortValue: (r: Row, key: "name" | "age") => r[key],
};

describe("recherche", () => {
  it("normalise la casse, les accents et les espaces", () => {
    expect(normalizeText("  Élodie   ÇA  va ")).toBe("elodie ca va");
  });

  it("exige que chaque mot apparaisse dans l'un des champs", () => {
    expect(matchesSearch(["Émile Zola", "Paris"], "emile")).toBe(true);
    expect(matchesSearch(["Émile Zola", "Paris"], "zola paris")).toBe(true);
    expect(matchesSearch(["Émile Zola", "Paris"], "zola lyon")).toBe(false);
    expect(matchesSearch(["Émile Zola", null], "")).toBe(true);
    expect(matchesSearch([null, undefined], "x")).toBe(false);
  });

  it("filtre une liste", () => {
    expect(filterAndSort(rows, { ...options, query: "an" }).map((r) => r.name)).toEqual([
      "anne martin",
      "Bruno Éluard",
      "Anaïs Durand",
    ]);
  });
});

describe("tri", () => {
  it("trie dans l'ordre alphabétique français, sans tenir compte de la casse", () => {
    const sorted = filterAndSort(rows, {
      ...options,
      query: "",
      sort: { key: "name", direction: "asc" },
    });
    expect(sorted.map((r) => r.name)).toEqual([
      "Anaïs Durand",
      "anne martin",
      "Bruno Éluard",
      "Émile Zola",
    ]);
  });

  it("place les valeurs vides en fin de liste, dans les deux sens", () => {
    const asc = filterAndSort(rows, {
      ...options,
      query: "",
      sort: { key: "age", direction: "asc" },
    });
    expect(asc.map((r) => r.age)).toEqual([9, 12, 30, null]);
    const desc = filterAndSort(rows, {
      ...options,
      query: "",
      sort: { key: "age", direction: "desc" },
    });
    expect(desc.map((r) => r.age)).toEqual([30, 12, 9, null]);
  });

  it("compare nombres, textes numériques et booléens", () => {
    expect(compareValues(2, 10)).toBeLessThan(0);
    expect(compareValues("Court 2", "Court 10")).toBeLessThan(0);
    expect(compareValues(true, false)).toBeLessThan(0);
    expect(compareValues(null, "a")).toBeGreaterThan(0);
    expect(compareValues("", "")).toBe(0);
  });

  it("inverse le sens au second clic sur la même colonne", () => {
    expect(toggleSort(undefined, "name")).toEqual({ key: "name", direction: "asc" });
    expect(toggleSort({ key: "name", direction: "asc" }, "name")).toEqual({
      key: "name",
      direction: "desc",
    });
    expect(toggleSort({ key: "name", direction: "desc" }, "age")).toEqual({
      key: "age",
      direction: "asc",
    });
  });
});
