import { type ComponentType, type LazyExoticComponent, lazy, type ReactNode } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router";
import { SeasonProvider } from "@/app/season";
import { ToastProvider } from "@/components/feedback/Toast";
import { AppShell } from "@/components/layout/AppShell";
import { type AppDatabase, openAppDatabase } from "@/db";
import { DatabaseProvider } from "@/db/DatabaseProvider";
import { ReferentielsPage, RequireSeason } from "@/features/referentiels/ReferentielsPage";

/**
 * Écran chargé à la demande (découpage du bundle par route) : le premier
 * affichage ne charge que la coque et l'écran ouvert.
 */
function lazyScreen<K extends string>(
  load: () => Promise<Record<K, ComponentType>>,
  name: K,
): LazyExoticComponent<ComponentType> {
  return lazy<ComponentType>(() => load().then((module) => ({ default: module[name] })));
}

const PlanningPage = lazyScreen(() => import("@/features/planning/PlanningPage"), "PlanningPage");
const HoursPage = lazyScreen(() => import("@/features/hours/HoursPage"), "HoursPage");
const ImportExportPage = lazyScreen(
  () => import("@/features/import-export/ImportExportPage"),
  "ImportExportPage",
);
const ReglagesPage = lazyScreen(() => import("@/features/reglages/ReglagesPage"), "ReglagesPage");
const AboutPage = lazyScreen(() => import("@/features/about/AboutPage"), "AboutPage");
const SeasonTab = lazyScreen(() => import("@/features/referentiels/saison/SeasonTab"), "SeasonTab");
const CourtsTab = lazyScreen(() => import("@/features/referentiels/courts/CourtsTab"), "CourtsTab");
const InstructorsTab = lazyScreen(
  () => import("@/features/referentiels/moniteurs/InstructorsTab"),
  "InstructorsTab",
);
const InstructorPage = lazyScreen(
  () => import("@/features/referentiels/moniteurs/InstructorPage"),
  "InstructorPage",
);
const LevelsTab = lazyScreen(
  () => import("@/features/referentiels/niveaux/LevelsTab"),
  "LevelsTab",
);
const GroupsTab = lazyScreen(
  () => import("@/features/referentiels/groupes/GroupsTab"),
  "GroupsTab",
);
const GroupPage = lazyScreen(
  () => import("@/features/referentiels/groupes/GroupPage"),
  "GroupPage",
);
const StudentsTab = lazyScreen(
  () => import("@/features/referentiels/eleves/StudentsTab"),
  "StudentsTab",
);
const ClosuresTab = lazyScreen(
  () => import("@/features/referentiels/fermetures/ClosuresTab"),
  "ClosuresTab",
);

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
        <Route path="a-propos" element={<AboutPage />} />
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
        <ToastProvider>
          <HashRouter>
            <AppRoutes />
          </HashRouter>
        </ToastProvider>
      </SeasonProvider>
    </DatabaseProvider>
  );
}
