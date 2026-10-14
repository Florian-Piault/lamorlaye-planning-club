/**
 * Couleurs des moniteurs (SPECS.md §6).
 *
 * Palette de 16 couleurs nettement distinctes, toutes lisibles avec un texte
 * blanc (contraste ≥ 4,5:1, vérifié par les tests).
 */

export interface PaletteColor {
  /** Couleur au format `#RRGGBB` (majuscules). */
  value: string;
  /** Nom affiché dans le sélecteur. */
  name: string;
}

export const INSTRUCTOR_PALETTE: readonly PaletteColor[] = [
  { value: "#1D4ED8", name: "Bleu" },
  { value: "#B91C1C", name: "Rouge" },
  { value: "#15803D", name: "Vert" },
  { value: "#7E22CE", name: "Violet" },
  { value: "#C2410C", name: "Orange" },
  { value: "#0E7490", name: "Cyan" },
  { value: "#BE185D", name: "Rose" },
  { value: "#4D7C0F", name: "Olive" },
  { value: "#A16207", name: "Ocre" },
  { value: "#4338CA", name: "Indigo" },
  { value: "#0F766E", name: "Sarcelle" },
  { value: "#9F1239", name: "Bordeaux" },
  { value: "#A21CAF", name: "Fuchsia" },
  { value: "#475569", name: "Ardoise" },
  { value: "#1E3A8A", name: "Marine" },
  { value: "#78350F", name: "Brun" },
];

export const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export function normalizeColor(color: string): string {
  return color.trim().toUpperCase();
}

/** Nom de la couleur de la palette, ou la valeur elle-même si elle n'en fait pas partie. */
export function colorName(color: string): string {
  const normalized = normalizeColor(color);
  return INSTRUCTOR_PALETTE.find((c) => c.value === normalized)?.name ?? normalized;
}

/**
 * Couleur à attribuer à un nouveau moniteur : la première couleur de la
 * palette non utilisée ; si toutes le sont, la moins utilisée (à égalité,
 * la première dans l'ordre de la palette).
 */
export function pickInstructorColor(usedColors: readonly string[]): string {
  const usage = new Map<string, number>();
  for (const color of usedColors) {
    const key = normalizeColor(color);
    usage.set(key, (usage.get(key) ?? 0) + 1);
  }
  let best = INSTRUCTOR_PALETTE[0] as PaletteColor;
  let bestCount = Number.POSITIVE_INFINITY;
  for (const color of INSTRUCTOR_PALETTE) {
    const count = usage.get(color.value) ?? 0;
    if (count === 0) return color.value;
    if (count < bestCount) {
      best = color;
      bestCount = count;
    }
  }
  return best.value;
}

/** Luminance relative WCAG 2.x d'une couleur `#RRGGBB`. */
export function relativeLuminance(color: string): number {
  if (!HEX_COLOR.test(color)) throw new Error(`Couleur invalide : ${color}`);
  const channels = [1, 3, 5].map((i) => Number.parseInt(color.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

/** Rapport de contraste WCAG entre deux couleurs (de 1 à 21). */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}
