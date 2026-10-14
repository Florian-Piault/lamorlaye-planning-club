import { describe, expect, it } from "vitest";
import { describeUsage, joinFrench, moveItem } from "./usage";

describe("utilisation d'un élément", () => {
  it("assemble une liste en français", () => {
    expect(joinFrench([])).toBe("");
    expect(joinFrench(["a"])).toBe("a");
    expect(joinFrench(["a", "b"])).toBe("a et b");
    expect(joinFrench(["a", "b", "c"])).toBe("a, b et c");
  });

  it("décrit l'utilisation avec accord du pluriel", () => {
    expect(
      describeUsage([
        { count: 3, singular: "cours", plural: "cours" },
        { count: 0, singular: "groupe", plural: "groupes" },
        { count: 1, singular: "exception", plural: "exceptions" },
      ]),
    ).toEqual({ total: 4, description: "3 cours et 1 exception" });
    expect(describeUsage([{ count: 0, singular: "groupe", plural: "groupes" }])).toEqual({
      total: 0,
      description: "",
    });
  });
});

describe("réordonnancement", () => {
  it("déplace un élément vers le bas ou vers le haut", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("ignore les positions hors limites", () => {
    expect(moveItem(["a", "b"], 0, 5)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], -1, 0)).toEqual(["a", "b"]);
  });
});
