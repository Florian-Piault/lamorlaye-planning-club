import type { Page } from "@playwright/test";

/**
 * Contrôles d'accessibilité automatiques, exécutés dans la page (aucune
 * dépendance réseau ni bibliothèque externe) :
 * - contraste des textes visibles (WCAG 2.x, 1.4.3 : 4,5:1, ou 3:1 pour les
 *   grands textes), couleurs converties en sRGB par un canevas (oklch compris) ;
 * - nom accessible des éléments interactifs (4.1.2) ;
 * - indicateur de focus visible au clavier (2.4.7).
 */

export interface ContrastIssue {
  text: string;
  ratio: number;
  required: number;
  color: string;
  background: string;
  element: string;
}

/** Textes visibles dont le contraste avec leur fond est insuffisant. */
export function contrastIssues(page: Page): Promise<ContrastIssue[]> {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("canevas indisponible");
    type Rgba = [number, number, number, number];
    const cache = new Map<string, Rgba>();
    const rgba = (color: string): Rgba => {
      const known = cache.get(color);
      if (known) return known;
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000";
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      const [r = 0, g = 0, b = 0, a = 0] = ctx.getImageData(0, 0, 1, 1).data;
      const value: Rgba = [r, g, b, a / 255];
      cache.set(color, value);
      return value;
    };
    const blend = (top: Rgba, bottom: Rgba): Rgba => {
      const a = top[3];
      return [
        top[0] * a + bottom[0] * (1 - a),
        top[1] * a + bottom[1] * (1 - a),
        top[2] * a + bottom[2] * (1 - a),
        1,
      ];
    };
    const luminance = ([r, g, b]: Rgba) => {
      const [lr, lg, lb] = [r, g, b].map((c) => {
        const v = c / 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      }) as [number, number, number];
      return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
    };
    const ratio = (a: Rgba, b: Rgba) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
      return (hi + 0.05) / (lo + 0.05);
    };
    /** Fond effectif sous un élément, ou `null` s'il est indéterminable (image, dégradé). */
    const backgroundOf = (element: Element): Rgba | null => {
      const layers: Rgba[] = [];
      for (let node: Element | null = element; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.backgroundImage !== "none") return null;
        const color = rgba(style.backgroundColor);
        if (color[3] > 0) layers.push(color);
        if (color[3] >= 1) break;
      }
      let result: Rgba = [255, 255, 255, 1];
      for (const layer of layers.reverse()) result = blend(layer, result);
      return result;
    };
    const describe = (element: Element) =>
      `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${
        element.getAttribute("data-testid")
          ? `[data-testid=${element.getAttribute("data-testid")}]`
          : ""
      }`;

    const issues: ContrastIssue[] = [];
    for (const element of document.querySelectorAll("body *")) {
      const ownText = [...element.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? "")
        .join("")
        .trim();
      if (!ownText) continue;
      const box = element.getBoundingClientRect();
      if (box.width <= 1 || box.height <= 1) continue; // texte réservé aux lecteurs d'écran
      const style = getComputedStyle(element);
      if (style.visibility !== "visible" || style.display === "none") continue;
      if (element.closest("[disabled], [aria-disabled='true'], option, dialog:not([open])"))
        continue;
      // Éléments volontairement estompés (cours filtrés, contrôles inactifs).
      let faded = false;
      for (let node: Element | null = element; node; node = node.parentElement) {
        if (Number(getComputedStyle(node).opacity) < 1) faded = true;
      }
      if (faded) continue;
      const background = backgroundOf(element);
      if (!background) continue;
      const color = blend(rgba(style.color), background);
      const size = Number.parseFloat(style.fontSize);
      const bold = Number(style.fontWeight) >= 700;
      const required = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
      const value = ratio(color, background);
      if (value + 0.005 < required) {
        issues.push({
          text: ownText.slice(0, 60),
          ratio: Math.round(value * 100) / 100,
          required,
          color: style.color,
          background: `rgb(${background.slice(0, 3).map(Math.round).join(", ")})`,
          element: describe(element),
        });
      }
    }
    return issues;
  });
}

/** Éléments interactifs visibles sans nom accessible. */
export function unnamedControls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const selector =
      "button, a[href], input:not([type=hidden]), select, textarea, [role=button], [tabindex]:not([tabindex='-1'])";
    const textOf = (ids: string) =>
      ids
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? "")
        .join(" ")
        .trim();
    const problems: string[] = [];
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      const box = element.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) continue;
      if (element.closest("[aria-hidden='true'], dialog:not([open])")) continue;
      const labels =
        "labels" in element
          ? [...((element as HTMLInputElement).labels ?? [])].map((l) => l.textContent ?? "")
          : [];
      const name = [
        element.getAttribute("aria-label"),
        element.getAttribute("aria-labelledby") &&
          textOf(element.getAttribute("aria-labelledby") ?? ""),
        ...labels,
        element.getAttribute("title"),
        element.getAttribute("placeholder"),
        element.tagName === "INPUT" ? null : element.textContent,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (!name) problems.push(element.outerHTML.slice(0, 120));
    }
    return problems;
  });
}

export interface FocusStop {
  element: string;
  visible: boolean;
}

/**
 * Parcourt `count` arrêts de tabulation et indique, pour chacun, si un
 * indicateur de focus est visible (contour ou anneau `box-shadow`).
 */
export async function tabStops(page: Page, count: number): Promise<FocusStop[]> {
  const stops: FocusStop[] = [];
  for (let i = 0; i < count; i++) {
    await page.keyboard.press("Tab");
    stops.push(
      await page.evaluate(() => {
        const element = document.activeElement;
        if (!(element instanceof HTMLElement) || element === document.body) {
          return { element: "body", visible: true };
        }
        const look = () => {
          const style = getComputedStyle(element);
          return {
            outline:
              style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth || "0") > 0,
            shadow: style.boxShadow,
            border: style.borderColor,
            background: style.backgroundColor,
          };
        };
        const focused = look();
        // Comparaison avec l'état sans focus : une ombre permanente n'est pas un indicateur.
        element.blur();
        const unfocused = look();
        element.focus();
        const visible =
          focused.outline ||
          focused.shadow !== unfocused.shadow ||
          focused.border !== unfocused.border ||
          focused.background !== unfocused.background;
        const name =
          element.getAttribute("aria-label") ??
          element.textContent?.trim().slice(0, 40) ??
          element.tagName;
        return { element: `${element.tagName.toLowerCase()} « ${name} »`, visible };
      }),
    );
  }
  return stops;
}
