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
        // Sans transition, le style lu est l'état final (l'anneau des boutons s'anime :
        // lu en cours d'animation sur une machine chargée, il semblait absent).
        const transition = element.style.transition;
        element.style.transition = "none";
        const focused = look();
        // Comparaison avec l'état sans focus : une ombre permanente n'est pas un indicateur.
        element.blur();
        const unfocused = look();
        element.focus();
        element.style.transition = transition;
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

export interface IconButton {
  /** Nom accessible (`aria-label` ou `aria-labelledby`). */
  name: string;
  /** Texte de la bulle commune affichée au focus clavier, ou `null`. */
  tooltip: string | null;
  /** Bulle native (`title`), à remplacer par la bulle commune. */
  title: string | null;
}

/**
 * Parcourt au plus `count` arrêts de tabulation (`Tab` ou `Shift+Tab`) et
 * relève chaque bouton icône (bouton sans texte visible) : son nom accessible
 * et la bulle commune qui s'affiche au focus clavier. S'arrête au premier
 * élément déjà rencontré (tour complet).
 */
export async function iconButtonsByKeyboard(
  page: Page,
  count: number,
  key: "Tab" | "Shift+Tab" = "Tab",
): Promise<IconButton[]> {
  const found: IconButton[] = [];
  // Sous WebKit (macOS), Tab seul ne s'arrête que sur les champs : ⌥ Tab parcourt aussi les boutons.
  const webkit = page.context().browser()?.browserType().name() === "webkit";
  const press = webkit ? key.replace("Tab", "Alt+Tab") : key;
  let seen = 0;
  for (let i = 0; i < count; i++) {
    await page.keyboard.press(press);
    const focused = await page.evaluate(() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement) || element === document.body) return "body";
      if (element.dataset.e2eVisited) return "seen";
      element.dataset.e2eVisited = "1";
      if (!element.matches("button, [role=button]") || element.innerText.trim() !== "") {
        return "other";
      }
      const labelledBy = element.getAttribute("aria-labelledby");
      const name =
        element.getAttribute("aria-label") ??
        (labelledBy
          ? labelledBy
              .split(/\s+/)
              .map((id) => document.getElementById(id)?.textContent ?? "")
              .join(" ")
          : "");
      return { name: name.trim(), title: element.getAttribute("title") };
    });
    // Tour complet ; un champ date garde le focus le temps de ses segments (jour, mois, année).
    seen = focused === "seen" ? seen + 1 : 0;
    if (seen > 4) break;
    if (typeof focused === "string") continue;
    // Au clavier, la bulle s'affiche aussitôt : courte attente, le temps que
    // le défilement jusqu'au bouton et le placement de la bulle se terminent.
    let tooltip: string | null = null;
    for (let attempt = 0; attempt < 10 && tooltip === null; attempt++) {
      tooltip = await bubbleOfFocused(page);
      if (tooltip === null) await page.waitForTimeout(100);
    }
    found.push({ ...focused, tooltip });
  }
  await page.evaluate(() => {
    for (const element of document.querySelectorAll<HTMLElement>("[data-e2e-visited]")) {
      delete element.dataset.e2eVisited;
    }
  });
  return found;
}

/**
 * Texte de la bulle affichée, à condition qu'elle soit bien celle de l'élément
 * focalisé : collée à lui (juste dessous ou juste dessus) et dans son axe.
 */
function bubbleOfFocused(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const element = document.activeElement;
    const bubble = document.querySelector<HTMLElement>("[role=tooltip]");
    if (!(element instanceof HTMLElement) || !bubble) return null;
    const a = element.getBoundingClientRect();
    const b = bubble.getBoundingClientRect();
    const touching = Math.abs(b.top - a.bottom) < 12 || Math.abs(a.top - b.bottom) < 12;
    const aligned = b.left <= a.right && b.right >= a.left;
    return touching && aligned ? bubble.innerText : null;
  });
}

/** Texte visible de la page (sections repliées exclues). */
export function visibleText(page: Page): Promise<string> {
  return page.evaluate(() => document.body.innerText);
}

/**
 * Avance au clavier (⌥ Tab sous WebKit) jusqu'à l'élément dont le nom
 * accessible (`aria-label`) correspond, et le renvoie.
 */
export async function focusByKeyboard(page: Page, name: RegExp, count: number) {
  const webkit = page.context().browser()?.browserType().name() === "webkit";
  for (let i = 0; i < count; i++) {
    await page.keyboard.press(webkit ? "Alt+Tab" : "Tab");
    const label = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
    if (label && name.test(label)) return page.getByRole("button", { name: label, exact: true });
  }
  throw new Error(`${name} introuvable au clavier`);
}
