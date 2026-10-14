import { HashRouter, Navigate, Route, Routes } from "react-router";
import { AppShell } from "@/components/layout/AppShell";
import { type AppDatabase, openAppDatabase } from "@/db";
import { DatabaseProvider } from "@/db/DatabaseProvider";
import { ImportExportPage } from "@/features/import-export/ImportExportPage";
import { PlanningPage } from "@/features/planning/PlanningPage";
import { ReferentielsPage } from "@/features/referentiels/ReferentielsPage";
import { ReglagesPage } from "@/features/reglages/ReglagesPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/planning" replace />} />
        <Route path="planning" element={<PlanningPage />} />
        <Route path="referentiels" element={<ReferentielsPage />} />
        <Route path="import-export" element={<ImportExportPage />} />
        <Route path="reglages" element={<ReglagesPage />} />
        <Route path="*" element={<Navigate to="/planning" replace />} />
      </Route>
    </Routes>
  );
}

interface AppProps {
  openDatabase?: () => Promise<AppDatabase>;
}

export function App({ openDatabase = openAppDatabase }: AppProps) {
  return (
    <DatabaseProvider open={openDatabase}>
      {/* Routage par fragment : fonctionne avec le protocole interne de Tauri. */}
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </DatabaseProvider>
  );
}
