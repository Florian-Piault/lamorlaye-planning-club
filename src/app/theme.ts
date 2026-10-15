import { useCallback, useSyncExternalStore } from "react";

/**
 * Thème de l'interface : clair, sombre ou celui du système. Le choix est
 * propre au poste (`localStorage`) ; le thème résolu est posé sur `<html>`
 * (`data-theme`), qui pilote les variables de couleur et la variante `dark:`.
 */
export type ThemePreference = "light" | "dark" | "system";

export const THEME_PREFERENCES: readonly ThemePreference[] = ["light", "dark", "system"];

const STORAGE_KEY = "kairos.theme";
const listeners = new Set<() => void>();

function isPreference(value: unknown): value is ThemePreference {
  return THEME_PREFERENCES.includes(value as ThemePreference);
}

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isPreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function systemQuery(): MediaQueryList | null {
  return typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;
}

export function resolveTheme(preference: ThemePreference): "light" | "dark" {
  if (preference !== "system") return preference;
  return systemQuery()?.matches ? "dark" : "light";
}

function applyTheme() {
  document.documentElement.dataset.theme = resolveTheme(readThemePreference());
}

export function setThemePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Stockage indisponible : le choix vaut pour la session seulement.
  }
  applyTheme();
  for (const listener of listeners) listener();
}

/** Applique le thème au démarrage et suit les changements du système. */
export function initTheme() {
  applyTheme();
  systemQuery()?.addEventListener("change", applyTheme);
}

export function useThemePreference() {
  const subscribe = useCallback((listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);
  const preference = useSyncExternalStore(subscribe, readThemePreference);
  return [preference, setThemePreference] as const;
}
