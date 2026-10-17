/**
 * Touches selon le système (spec UX v1.1) : ⌘, ⌥, ⇧ et ⌫ sur macOS ; Ctrl,
 * Alt, Maj et Suppr ailleurs. Une seule aide pour les bulles, l'astuce et le
 * mode d'emploi, afin que les raccourcis annoncés soient ceux du clavier.
 */

export type Platform = "mac" | "other";

/** Touches nommées ; toute autre touche est affichée telle quelle (en capitale). */
export type NamedKey = "mod" | "alt" | "shift" | "delete" | "escape" | "enter";

const NAMES: Record<Platform, Record<NamedKey, string>> = {
  mac: { mod: "⌘", alt: "⌥", shift: "⇧", delete: "⌫", escape: "Échap", enter: "↩" },
  other: {
    mod: "Ctrl",
    alt: "Alt",
    shift: "Maj",
    delete: "Suppr",
    escape: "Échap",
    enter: "Entrée",
  },
};

/** Système du poste, d'après le navigateur (WebKit sous macOS dans l'application). */
export function detectPlatform(
  nav: { platform?: string; userAgent?: string } | undefined = globalThis.navigator,
): Platform {
  const hint = `${nav?.platform ?? ""} ${nav?.userAgent ?? ""}`;
  return /Mac|iPhone|iPad/i.test(hint) ? "mac" : "other";
}

/** Nom affiché d'une touche. */
export function keyLabel(key: string, platform: Platform = detectPlatform()): string {
  const named = NAMES[platform][key.toLowerCase() as NamedKey];
  if (named) return named;
  return key.length === 1 ? key.toUpperCase() : key;
}

/** Raccourci affiché : « mod+shift+z » → « ⌘ ⇧ Z » (macOS) ou « Ctrl+Maj+Z ». */
export function shortcutLabel(shortcut: string, platform: Platform = detectPlatform()): string {
  const keys = shortcut.split("+").map((key) => keyLabel(key, platform));
  return keys.join(platform === "mac" ? " " : "+");
}

const ARIA_NAMES: Record<string, string> = {
  alt: "Alt",
  shift: "Shift",
  delete: "Delete",
  escape: "Escape",
  enter: "Enter",
  "←": "ArrowLeft",
  "→": "ArrowRight",
  "↑": "ArrowUp",
  "↓": "ArrowDown",
};

/**
 * Valeur de `aria-keyshortcuts` (noms de touches du DOM) : « mod+shift+z » →
 * « Meta+Shift+Z » sous macOS, « Control+Shift+Z » ailleurs. Le raccourci est
 * ainsi annoncé par le lecteur d'écran sans répéter la bulle comme description.
 */
export function ariaShortcut(shortcut: string, platform: Platform = detectPlatform()): string {
  return shortcut
    .split("+")
    .map((key) => {
      const k = key.toLowerCase();
      if (k === "mod") return platform === "mac" ? "Meta" : "Control";
      return ARIA_NAMES[k] ?? (key.length === 1 ? key.toUpperCase() : key);
    })
    .join("+");
}
