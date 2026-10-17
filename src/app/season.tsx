import { createContext, type ReactNode, useCallback, useContext, useState } from "react";
import { useDatabase } from "@/db/DatabaseProvider";
import { listSeasons } from "@/db/repositories/seasons";
import type { Season } from "@/db/schema";
import { useLoader } from "@/hooks/useLoader";

interface SeasonContextValue {
  /**
   * Saison consultée : la saison active, sauf si une saison archivée a été
   * choisie dans le sélecteur ; `null` si aucune saison n'a encore été créée.
   */
  season: Season | null;
  /** Saison active (une seule à la fois). */
  activeSeason: Season | null;
  /** Toutes les saisons, de la plus récente à la plus ancienne. */
  seasons: Season[];
  /**
   * La saison consultée est archivée : elle est en lecture seule (§8.1) et
   * les écrans n'y proposent aucune modification.
   */
  readOnly: boolean;
  loading: boolean;
  /** Relit les saisons ; résolu une fois la liste à jour. */
  reload: () => Promise<void>;
  /** Consulte une saison ; `null` revient à la saison active. */
  selectSeason: (id: string | null) => void;
}

const SeasonContext = createContext<SeasonContextValue | null>(null);

/** Charge les saisons et la saison consultée, partagées par tous les écrans. */
export function SeasonProvider({ children }: { children: ReactNode }) {
  const { db } = useDatabase();
  const load = useCallback(() => listSeasons(db), [db]);
  const { data, loading, reload } = useLoader(load);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const seasons = data ?? [];
  const activeSeason = seasons.find((s) => s.status === "active") ?? null;
  const season = seasons.find((s) => s.id === selectedId) ?? activeSeason;
  const selectSeason = useCallback((id: string | null) => setSelectedId(id), []);
  return (
    <SeasonContext.Provider
      value={{
        season,
        activeSeason,
        seasons,
        readOnly: season?.status === "archived",
        loading: loading && !data,
        reload,
        selectSeason,
      }}
    >
      {children}
    </SeasonContext.Provider>
  );
}

export function useSeason(): SeasonContextValue {
  const value = useContext(SeasonContext);
  if (!value) throw new Error("useSeason doit être utilisé dans un <SeasonProvider>.");
  return value;
}

/**
 * Saison consultée, pour les écrans qui ne s'affichent qu'une fois une saison
 * créée. Elle peut être archivée : voir `useReadOnly`.
 */
export function useViewedSeason(): Season {
  const { season } = useSeason();
  if (!season) throw new Error("Aucune saison.");
  return season;
}

/** La saison consultée est-elle archivée (lecture seule) ? */
export function useReadOnly(): boolean {
  return useSeason().readOnly;
}
