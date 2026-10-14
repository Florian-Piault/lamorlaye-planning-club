import type { ReactNode } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router";
import { SeasonProvider } from "@/app/season";
import { AppShell } from "@/components/layout/AppShell";
import { type AppDatabase, openAppDatabase } from "@/db";
import { DatabaseProvider } from "@/db/DatabaseProvider";
import { HoursPage } from "@/features/hours/HoursPage";
import { ImportExportPage } from "@/features/import-export/ImportExportPage";
import { PlanningPage } from "@/features/planning/PlanningPage";
import { CourtsTab } from "@/features/referentiels/courts/CourtsTab";
import { StudentsTab } from "@/features/referentiels/eleves/StudentsTab";
import { ClosuresTab } from "@/features/referentiels/fermetures/ClosuresTab";
import { GroupPage } from "@/features/referentiels/groupes/GroupPage";
import { GroupsTab } from "@/features/referentiels/groupes/GroupsTab";
import { InstructorPage } from "@/features/referentiels/moniteurs/InstructorPage";
import { InstructorsTab } from "@/features/referentiels/moniteurs/InstructorsTab";
import { LevelsTab } from "@/features/referentiels/niveaux/LevelsTab";
import { ReferentielsPage, RequireSeason } from "@/features/referentiels/ReferentielsPage";
import { SeasonTab } from "@/features/referentiels/saison/SeasonTab";
import { ReglagesPage } from "@/features/reglages/ReglagesPage";

const withSeason = (element: ReactNode) => <RequireSeason>{element}</RequireSeason>;

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/planning" replace />} />
        <Route path="planning" element={<PlanningPage />} />
        <Route path="referentiels" element={<ReferentielsPage />}>
          <Route index element={<Navigate to="saison" replace />} />
          <Route path="saison" element={<SeasonTab />} />
          <Route path="courts" element={withSeason(<CourtsTab />)} />
          <Route path="moniteurs" element={withSeason(<InstructorsTab />)} />
          <Route path="moniteurs/:id" element={withSeason(<InstructorPage />)} />
          <Route path="niveaux" element={<LevelsTab />} />
          <Route path="groupes" element={withSeason(<GroupsTab />)} />
          <Route path="groupes/:id" element={withSeason(<GroupPage />)} />
          <Route path="eleves" element={withSeason(<StudentsTab />)} />
          <Route path="fermetures" element={withSeason(<ClosuresTab />)} />
        </Route>
        <Route path="heures" element={<HoursPage />} />
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
      <SeasonProvider>
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </SeasonProvider>
    </DatabaseProvider>
  );
}
