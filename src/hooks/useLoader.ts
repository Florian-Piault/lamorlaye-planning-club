import { useCallback, useEffect, useRef, useState } from "react";
import { readOnlyErrorOf } from "@/db/readOnly";

export interface Loader<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  /** Relance le chargement (après une modification) ; résolu une fois les données relues. */
  reload: () => Promise<void>;
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
  /** Rechargements en attente : résolus à la fin du prochain chargement abouti. */
  const waiting = useRef<(() => void)[]>([]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` déclenche le rechargement.
  useEffect(() => {
    let cancelled = false;
    const settle = () => {
      for (const resolve of waiting.current.splice(0)) resolve();
    };
    setState((s) => ({ ...s, loading: true }));
    load().then(
      (data) => {
        if (cancelled) return;
        setState({ data, loading: false });
        settle();
      },
      (error: unknown) => {
        if (cancelled) return;
        setState((s) => ({ ...s, error, loading: false }));
        settle();
      },
    );
    return () => {
      cancelled = true;
    };
  }, [load, version]);

  const reload = useCallback(
    () =>
      new Promise<void>((resolve) => {
        waiting.current.push(resolve);
        setVersion((v) => v + 1);
      }),
    [],
  );
  return { data: state.data, error: state.error, loading: state.loading, reload };
}

/** Message lisible d'une erreur (base de données, commande Tauri…). */
export function errorMessage(error: unknown): string {
  const readOnly = readOnlyErrorOf(error);
  if (readOnly) return readOnly.message;
  if (error instanceof Error) return error.message;
  return String(error);
}
