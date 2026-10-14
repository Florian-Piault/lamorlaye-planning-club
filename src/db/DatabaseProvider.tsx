import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { type AppDatabase, openAppDatabase } from "./index";

const DatabaseContext = createContext<AppDatabase | null>(null);

type State =
  | { status: "loading" }
  | { status: "ready"; database: AppDatabase }
  | { status: "error"; error: unknown };

interface DatabaseProviderProps {
  children: ReactNode;
  /** Ouverture de la base, remplaçable dans les tests. */
  open?: () => Promise<AppDatabase>;
}

/** Ouvre la base (et applique les migrations) avant d'afficher l'application. */
export function DatabaseProvider({ children, open = openAppDatabase }: DatabaseProviderProps) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    open().then(
      (database) => !cancelled && setState({ status: "ready", database }),
      (error: unknown) => !cancelled && setState({ status: "error", error }),
    );
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (state.status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground text-sm">
        Ouverture de la base de données…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div role="alert" className="flex h-screen flex-col items-center justify-center gap-2 p-8">
        <p className="font-semibold">Impossible d'ouvrir la base de données.</p>
        <pre className="max-w-2xl whitespace-pre-wrap text-muted-foreground text-xs">
          {String(state.error)}
        </pre>
      </div>
    );
  }

  return <DatabaseContext.Provider value={state.database}>{children}</DatabaseContext.Provider>;
}

export function useDatabase(): AppDatabase {
  const database = useContext(DatabaseContext);
  if (!database) throw new Error("useDatabase doit être utilisé dans un <DatabaseProvider>.");
  return database;
}
