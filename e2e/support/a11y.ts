import type { Page } from "@playwright/test";

/**
 * Contrôles d'accessibilité automatiques, exécutés dans la page (aucune
 * dépendance réseau ni bibliothèque externe) :
 * - contraste des textes visibles (WCAG 2.x, 1.4.3 : 4,5:1, ou 3:1 pour les
 *   grands textes), couleurs converties en sRGB par un canevas (oklch compris) ;
 * - contraste des icônes et des indicateurs de focus (1.4.11 : 3:1) ;
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

type Rgba = [number, number, number, number];

/** Outils de couleur installés dans la page (`window.__a11yColors`), partagés par les contrôles. */
interface ColorTools {
  /** Couleur CSS lue par un canevas ; erreur si le canevas ne sait pas la lire. */
  rgba: (color: string) => Rgba;
  blend: (top: Rgba, bottom: Rgba) => Rgba;
  ratio: (a: Rgba, b: Rgba) => number;
  /**
   * Couleur affichée d'un pixel de l'élément : fonds et opacités de tous ses
   * ancêtres, puis `top` (texte, icône, anneau) posé dessus s'il est donné.
   * `null` si un fond est une image ou un dégradé (compté dans `skipped`).
   */
  paint: (element: Element, top?: Rgba) => Rgba | null;
  /** Produit des opacités de l'élément et de ses ancêtres. */
  opacity: (element: Element) => number;
  /** Élément volontairement estompé (`data-faded` : cours filtrés, cours en cours de glisser). */
  faded: (element: Element) => boolean;
  /** Élément ignoré : grisé, option de liste, fenêtre fermée, page sous une fenêtre modale. */
  inert: (element: Element) => boolean;
  describe: (element: Element) => string;
  /** Éléments non mesurés depuis le dernier `reset` (fond en image ou en dégradé). */
  skipped: string[];
}

declare global {
  interface Window {
    __a11yColors?: ColorTools;
  }
}

/** Installe (une fois par document) les outils de couleur dans la page. */
async function installColorTools(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Transitions CSS terminées : un bouton qui vient de changer d'état (grisé → actif)
    // serait mesuré en cours de fondu.
    for (const animation of document.getAnimations()) {
      if (animation instanceof CSSTransition) animation.finish();
    }
    if (window.__a11yColors) {
      window.__a11yColors.skipped = [];
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("canevas indisponible");
    type Color = [number, number, number, number];
    const cache = new Map<string, Color>();
    const rgba = (color: string): Color => {
      const known = cache.get(color);
      if (known) return known;
      // Une couleur que le canevas ne sait pas lire laisse la couleur précédente :
      // lue sur deux couleurs de départ différentes, elle donnerait deux résultats.
      const read = new Set<string>();
      for (const start of ["#000", "#fff"]) {
        ctx.fillStyle = start;
        ctx.fillStyle = color;
        read.add(String(ctx.fillStyle));
      }
      if (read.size > 1) throw new Error(`couleur illisible par le canevas : ${color}`);
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillRect(0, 0, 1, 1);
      const [r = 0, g = 0, b = 0, a = 0] = ctx.getImageData(0, 0, 1, 1).data;
      const value: Color = [r, g, b, a / 255];
      cache.set(color, value);
      return value;
    };
    const blend = (top: Color, bottom: Color): Color => {
      const a = top[3];
      return [
        top[0] * a + bottom[0] * (1 - a),
        top[1] * a + bottom[1] * (1 - a),
        top[2] * a + bottom[2] * (1 - a),
        1,
      ];
    };
    const luminance = ([r, g, b]: Color) => {
      const [lr, lg, lb] = [r, g, b].map((c) => {
        const v = c / 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      }) as [number, number, number];
      return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
    };
    const ratio = (a: Color, b: Color) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
      return (hi + 0.05) / (lo + 0.05);
    };
    const describe = (element: Element) =>
      `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${
        element.getAttribute("data-testid")
          ? `[data-testid=${element.getAttribute("data-testid")}]`
          : ""
      }`;
    const tools: ColorTools = {
      rgba,
      blend,
      ratio,
      describe,
      skipped: [],
      paint: (element, top) => {
        const nodes: Element[] = [];
        for (let node: Element | null = element; node; node = node.parentElement) {
          nodes.unshift(node);
        }
        if (nodes.some((node) => getComputedStyle(node).backgroundImage !== "none")) {
          tools.skipped.push(describe(element));
          return null;
        }
        // Chaque ancêtre est un groupe : son fond, puis son contenu, le tout
        // mêlé à ce qu'il recouvre selon son opacité.
        const at = (i: number, below: Color): Color => {
          const node = nodes[i] as Element;
          const style = getComputedStyle(node);
          let color = blend(rgba(style.backgroundColor), below);
          if (i < nodes.length - 1) color = at(i + 1, color);
          else if (top) color = blend(top, color);
          return blend([color[0], color[1], color[2], Number(style.opacity)], below);
        };
        return at(0, [255, 255, 255, 1]);
      },
      opacity: (element) => {
        let product = 1;
        for (let node: Element | null = element; node; node = node.parentElement) {
          product *= Number(getComputedStyle(node).opacity);
        }
        return product;
      },
      faded: (element) => element.closest("[data-faded]") !== null,
      inert: (element) => {
        if (element.closest("[disabled], [aria-disabled='true'], option, dialog:not([open])")) {
          return true;
        }
        // Sous une fenêtre modale, le reste de la page est inerte et voilé par le fond.
        const modals = document.querySelectorAll("dialog[open]:modal");
        const top = modals[modals.length - 1];
        return top !== undefined && !top.contains(element);
      },
    };
    window.__a11yColors = tools;
  });
}

/**
 * Éléments que le dernier contrôle de contraste n'a pas pu mesurer (fond en
 * image ou en dégradé) : à vérifier à l'œil, ou à rendre mesurables.
 */
export function unmeasured(page: Page): Promise<string[]> {
  return page.evaluate(() => [...new Set(window.__a11yColors?.skipped ?? [])]);
}

/**
 * Textes visibles dont le contraste avec leur fond est insuffisant. Les
 * opacités de l'élément et de ses ancêtres sont comptées ; seuls les
 * éléments estompés exprès (`data-faded`) ou inertes sont ignorés.
 */
export async function contrastIssues(page: Page): Promise<ContrastIssue[]> {
  await installColorTools(page);
  return page.evaluate(() => {
    const tools = window.__a11yColors;
    if (!tools) throw new Error("outils de couleur absents");
    const { rgba, ratio, paint, opacity, faded, inert, describe } = tools;
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
      if (inert(element) || faded(element) || opacity(element) === 0) continue;
      const background = paint(element);
      const color = paint(element, rgba(style.color));
      if (!background || !color) continue;
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

/**
 * Icônes visibles (SVG de lucide, en `currentColor`) dont le contraste avec
 * leur fond est inférieur à 3:1 (WCAG 1.4.11, éléments graphiques). Les
 * opacités de l'icône et de ses ancêtres sont comptées, comme pour les textes.
 */
export async function iconContrastIssues(page: Page): Promise<ContrastIssue[]> {
  await installColorTools(page);
  return page.evaluate(() => {
    const tools = window.__a11yColors;
    if (!tools) throw new Error("outils de couleur absents");
    const { rgba, ratio, paint, opacity, faded, inert, describe } = tools;
    const issues: ContrastIssue[] = [];
    for (const icon of document.querySelectorAll<SVGElement>("svg.lucide")) {
      const box = icon.getBoundingClientRect();
      if (box.width <= 1 || box.height <= 1) continue;
      const style = getComputedStyle(icon);
      if (style.visibility !== "visible" || style.display === "none") continue;
      const parent = icon.parentElement;
      if (!parent || inert(icon) || faded(icon) || opacity(icon) === 0) continue;
      const background = paint(icon);
      const color = paint(icon, rgba(style.color));
      if (!background || !color) continue;
      const value = ratio(color, background);
      if (value + 0.005 < 3) {
        issues.push({
          text: `icône ${icon.getAttribute("class")?.match(/lucide-([\w-]+)/)?.[1] ?? "?"} (${
            parent.textContent?.trim().slice(0, 40) ?? ""
          })`,
          ratio: Math.round(value * 100) / 100,
          required: 3,
          color: style.color,
          background: `rgb(${background.slice(0, 3).map(Math.round).join(", ")})`,
          element: describe(parent),
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
  /**
   * Meilleur contraste de l'indicateur de focus avec ce qui l'entoure (WCAG
   * 1.4.11, 3:1) : contour, anneau ou bordure contre le fond du parent, ou
   * fond focalisé contre le fond sans focus ; `null` sans indicateur mesurable.
   */
  contrast: number | null;
}

/**
 * Parcourt `count` arrêts de tabulation et indique, pour chacun, si un
 * indicateur de focus est visible (contour ou anneau `box-shadow`) et son
 * contraste. Avec `allControls`, ⌥ Tab est utilisé sous WebKit (macOS), où
 * Tab seul ne s'arrête que sur les champs.
 */
export async function tabStops(
  page: Page,
  count: number,
  { allControls = false }: { allControls?: boolean } = {},
): Promise<FocusStop[]> {
  await installColorTools(page);
  const webkit = page.context().browser()?.browserType().name() === "webkit";
  const key = allControls && webkit ? "Alt+Tab" : "Tab";
  const stops: FocusStop[] = [];
  for (let i = 0; i < count; i++) {
    await page.keyboard.press(key);
    stops.push(
      await page.evaluate(() => {
        const element = document.activeElement;
        if (!(element instanceof HTMLElement) || element === document.body) {
          return { element: "body", visible: true, contrast: null };
        }
        // Bouton du calendrier d'un champ date (Chromium) : contrôle natif du navigateur,
        // qui dessine son propre focus ; le champ lui-même n'est alors pas `:focus`.
        if (!element.matches(":focus")) return { element: "body", visible: true, contrast: null };
        const tools = window.__a11yColors;
        if (!tools) throw new Error("outils de couleur absents");
        // Contrôle transparent posé sur un rendu visible (sélecteur de saison, bouton
        // radio masqué) : l'indicateur est dessiné par son parent ou ses voisins.
        const box = element.getBoundingClientRect();
        const proxied = tools.opacity(element) === 0 || box.width <= 1 || box.height <= 1;
        const parent = element.parentElement ?? element;
        const nodes: Element[] = proxied
          ? [parent, ...parent.querySelectorAll("*")].filter((node) => node !== element)
          : [element];
        const look = (node: Element) => {
          const style = getComputedStyle(node);
          return {
            outline:
              style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth || "0") > 0,
            outlineColor: style.outlineColor,
            shadow: style.boxShadow,
            border: style.borderColor,
            borderWidth: Number.parseFloat(style.borderTopWidth || "0"),
            background: style.backgroundColor,
          };
        };
        // Sans transition, le style lu est l'état final (l'anneau des boutons s'anime :
        // lu en cours d'animation sur une machine chargée, il semblait absent ; WebKit
        // garde la valeur en cours de transition, d'où les animations terminées).
        const transitions = nodes.map((node) => {
          const style = (node as HTMLElement).style;
          const before = style?.transition ?? "";
          if (style) style.transition = "none";
          return before;
        });
        const settle = () => {
          for (const node of nodes)
            for (const animation of node.getAnimations()) animation.finish();
        };
        settle();
        const focused = nodes.map(look);
        // Opacités lues dans l'état focalisé (un bouton grisé reprend son opacité au focus).
        const strengths = nodes.map((node) => tools.opacity(node));
        // Comparaison avec l'état sans focus : une ombre permanente n'est pas un indicateur.
        // Le focus passe à un repère voisin (dans une fenêtre modale, WebKit ignore `blur()`).
        // Un champ date ou heure de WebKit revient à son premier segment quand il reprend
        // le focus (la tabulation y tournerait en rond) : il n'est pas comparé.
        const segmented = element.matches(
          "input[type=date], input[type=time], input[type=datetime-local], input[type=month]",
        );
        let unfocused = focused.map((f) => ({ ...f, outline: false, shadow: "none", border: "" }));
        if (!segmented) {
          const sentinel = document.createElement("span");
          sentinel.tabIndex = -1;
          (element.closest("dialog") ?? document.body).append(sentinel);
          sentinel.focus();
          settle();
          unfocused = nodes.map(look);
          element.focus();
          sentinel.remove();
        }
        nodes.forEach((node, i) => {
          const style = (node as HTMLElement).style;
          if (style) style.transition = transitions[i] ?? "";
        });

        let visible = false;
        const ratios: number[] = [];
        nodes.forEach((node, i) => {
          const on = focused[i];
          const off = unfocused[i];
          if (!on || !off) return;
          const changed =
            on.outline ||
            on.shadow !== off.shadow ||
            on.border !== off.border ||
            on.background !== off.background;
          if (!changed) return;
          visible = true;
          // Couleurs de l'indicateur, posées sur le fond qui entoure le nœud et
          // atténuées par l'opacité du nœud et de ses ancêtres.
          const around = tools.paint(node.parentElement ?? node);
          const strength = strengths[i] ?? 1;
          if (around) {
            const against = (color: string) => {
              const value = tools.rgba(color);
              if (value[3] === 0) return;
              const drawn = tools.blend(value, around);
              ratios.push(
                tools.ratio(tools.blend([drawn[0], drawn[1], drawn[2], strength], around), around),
              );
            };
            if (on.outline) against(on.outlineColor);
            if (on.shadow !== off.shadow && on.shadow !== "none") {
              const before = new Set(
                (off.shadow.match(/(?:rgba?|oklab|oklch|lab|lch|color)\([^)]*\)/g) ?? []).map(
                  String,
                ),
              );
              // Ombres ajoutées au focus, d'épaisseur non nulle (anneau `ring`).
              for (const part of on.shadow.split(/,(?![^(]*\))/)) {
                const color = part.match(/(?:rgba?|oklab|oklch|lab|lch|color)\([^)]*\)/)?.[0];
                const lengths = [...part.matchAll(/(-?[\d.]+)px/g)].map((m) => Number(m[1]));
                const spread = lengths[3] ?? 0;
                const blur = lengths[2] ?? 0;
                if (color && !before.has(color) && (spread > 0 || blur > 0)) against(color);
              }
            }
            if (on.border !== off.border && on.borderWidth > 0) against(on.border);
          }
          if (on.background !== off.background) {
            const base = around ?? [255, 255, 255, 1];
            const lit = tools.blend(tools.rgba(on.background), base);
            const unlit = tools.blend(tools.rgba(off.background), base);
            ratios.push(tools.ratio(lit, unlit));
          }
        });
        const contrast = ratios.length > 0 ? Math.round(Math.max(...ratios) * 100) / 100 : null;
        const name =
          element.getAttribute("aria-label") ??
          element.textContent?.trim().slice(0, 40) ??
          element.tagName;
        return { element: `${element.tagName.toLowerCase()} « ${name} »`, visible, contrast };
      }),
    );
  }
  return stops;
}

/** Arrêts dont l'indicateur de focus est absent ou de contraste inférieur à 3:1. */
export function weakFocus(stops: FocusStop[]): string[] {
  return stops
    .filter((s) => s.element !== "body" && (!s.visible || (s.contrast ?? 0) + 0.005 < 3))
    .map((s) => `${s.element} (${s.visible ? `${s.contrast ?? "?"}:1` : "invisible"})`);
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
