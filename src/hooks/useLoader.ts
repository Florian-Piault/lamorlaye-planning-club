import { useCallback, useEffect, useState } from "react";

export interface Loader<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  /** Relance le chargement (après une modification). */
  reload: () => void;
}

/**
 * Charge des données de façon asynchrone. `load` doit être stable
 * (`useCallback`) : il est rappelé à chaque changement, et sur `reload()`.
 * Les données précédentes restent affichées pendant un rechargement.
 */
export function useLoader<T>(load: () => Promise<T>): Loader<T> {
  const [state, setState] = useState<{ data?: T; error?: unknown; loading: boolean }>({
    loading: true,
  });
  const [version, setVersion] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` déclenche le rechargement.
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    load().then(
      (data) => !cancelled && setState({ data, loading: false }),
      (error: unknown) => !cancelled && setState((s) => ({ ...s, error, loading: false })),
    );
    return () => {
      cancelled = true;
    };
  }, [load, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data: state.data, error: state.error, loading: state.loading, reload };
}

/** Message lisible d'une erreur (base de données, commande Tauri…). */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
