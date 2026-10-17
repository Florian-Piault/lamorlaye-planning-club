import { useCallback, useSyncExternalStore } from "react";

/**
 * Menu de l'application réduit aux icônes (spec UX v1.1, « Grille ») : choix
 * propre au poste (`localStorage`), retrouvé au prochain lancement.
 */
const STORAGE_KEY = "kairos.menu-reduit";
const listeners = new Set<() => void>();
/**
 * Dernier choix de la session : il prime sur le stockage, qui peut avoir
 * refusé l'écriture (le choix vaut alors pour la session seulement).
 */
let chosen: boolean | null = null;

export function readSidebarCollapsed(): boolean {
  if (chosen !== null) return chosen;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSidebarCollapsed(collapsed: boolean) {
  chosen = collapsed;
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    // Stockage indisponible : le choix vaut pour la session seulement.
  }
  for (const listener of listeners) listener();
}

/** Oublie le choix de la session (tests) : la valeur stockée fait de nouveau foi. */
export function resetSidebarSession() {
  chosen = null;
}

export function useSidebarCollapsed() {
  const subscribe = useCallback((listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);
  const collapsed = useSyncExternalStore(subscribe, readSidebarCollapsed);
  return [collapsed, setSidebarCollapsed] as const;
}
