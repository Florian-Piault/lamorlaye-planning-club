import { createContext, type ReactNode, useCallback, useContext } from "react";
import { useDatabase } from "@/db/DatabaseProvider";
import { getActiveSeason } from "@/db/repositories/seasons";
import type { Season } from "@/db/schema";
import { useLoader } from "@/hooks/useLoader";

interface SeasonContextValue {
  /** Saison active ; `null` si aucune saison n'a encore été créée. */
  season: Season | null;
  loading: boolean;
  reload: () => void;
}

const SeasonContext = createContext<SeasonContextValue | null>(null);

/** Charge la saison active, partagée par tous les écrans. */
export function SeasonProvider({ children }: { children: ReactNode }) {
  const { db } = useDatabase();
  const load = useCallback(async () => (await getActiveSeason(db)) ?? null, [db]);
  const { data, loading, reload } = useLoader(load);
  return (
    <SeasonContext.Provider value={{ season: data ?? null, loading: loading && !data, reload }}>
      {children}
    </SeasonContext.Provider>
  );
}

export function useSeason(): SeasonContextValue {
  const value = useContext(SeasonContext);
  if (!value) throw new Error("useSeason doit être utilisé dans un <SeasonProvider>.");
  return value;
}

/** Saison active, pour les écrans qui ne s'affichent qu'une fois la saison créée. */
export function useActiveSeason(): Season {
  const { season } = useSeason();
  if (!season) throw new Error("Aucune saison active.");
  return season;
}
