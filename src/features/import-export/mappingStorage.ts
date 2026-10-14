import type { DuplicateMode, ImportFieldKey, SavedMapping } from "@/domain/studentImport";

/**
 * Mémorisation de la correspondance des colonnes et du traitement des
 * doublons d'un import à l'autre (préférence de l'écran, propre au poste :
 * stockage local de la vue web, sans incidence sur les données du club).
 */

const KEY = "planning-club.import-eleves";

export interface ImportPreferences {
  mapping: SavedMapping;
  duplicates: DuplicateMode;
}

export function loadImportPreferences(): ImportPreferences | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<ImportPreferences>;
    if (typeof value !== "object" || value === null) return null;
    const mapping: SavedMapping = {};
    for (const [key, header] of Object.entries(value.mapping ?? {})) {
      if (typeof header === "string" || header === null) {
        mapping[key as ImportFieldKey] = header;
      }
    }
    return { mapping, duplicates: value.duplicates === "update" ? "update" : "ignore" };
  } catch {
    return null;
  }
}

export function saveImportPreferences(preferences: ImportPreferences): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(preferences));
  } catch {
    // Stockage indisponible : la correspondance sera simplement redemandée.
  }
}
