import { describe, expect, it } from "vitest";
import {
  colorName,
  contrastRatio,
  INSTRUCTOR_PALETTE,
  pickInstructorColor,
  relativeLuminance,
} from "./colors";

const values = INSTRUCTOR_PALETTE.map((c) => c.value);

describe("palette des moniteurs", () => {
  it("contient 16 couleurs distinctes au format #RRGGBB", () => {
    expect(values).toHaveLength(16);
    expect(new Set(values).size).toBe(16);
    for (const value of values) expect(value).toMatch(/^#[0-9A-F]{6}$/);
    expect(new Set(INSTRUCTOR_PALETTE.map((c) => c.name)).size).toBe(16);
  });

  it.each(values)("%s est lisible avec un texte blanc (contraste ≥ 4,5:1)", (value) => {
    expect(contrastRatio(value, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });

  it("calcule la luminance et le contraste WCAG", () => {
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1);
    expect(relativeLuminance("#000000")).toBeCloseTo(0);
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21);
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21);
    expect(() => relativeLuminance("rouge")).toThrow();
  });

  it("donne le nom d'une couleur de la palette", () => {
    expect(colorName("#1d4ed8")).toBe("Bleu");
    expect(colorName("#123456")).toBe("#123456");
  });
});

describe("attribution automatique d'une couleur", () => {
  it("attribue la première couleur si aucune n'est utilisée", () => {
    expect(pickInstructorColor([])).toBe(values[0]);
  });

  it("attribue la première couleur non utilisée, sans tenir compte de la casse", () => {
    expect(pickInstructorColor([values[0] as string, (values[1] as string).toLowerCase()])).toBe(
      values[2],
    );
    expect(pickInstructorColor([values[1] as string])).toBe(values[0]);
  });

  it("ignore les couleurs hors palette", () => {
    expect(pickInstructorColor(["#123456"])).toBe(values[0]);
  });

  it("attribue la couleur la moins utilisée quand toutes le sont", () => {
    const allTwiceButFifth = values.flatMap((v, i) => (i === 4 ? [v] : [v, v]));
    expect(pickInstructorColor(allTwiceButFifth)).toBe(values[4]);
    expect(pickInstructorColor(values)).toBe(values[0]);
  });
});
