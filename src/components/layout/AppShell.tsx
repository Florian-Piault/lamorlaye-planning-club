import { Archive } from "lucide-react";
import { Suspense } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { navigationItems } from "@/app/navigation";
import { useSeason } from "@/app/season";
import { Loading } from "@/components/layout/Page";
import { Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Coque de l'application : barre latérale de navigation + zone de contenu. */
export function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-56 shrink-0 flex-col border-sidebar-border border-r bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2 px-4 py-5">
          <img src="/favicon.svg" alt="" className="size-8 rounded-md" />
          <div className="leading-tight">
            <p className="font-semibold text-sm">Planning Club</p>
            <p className="text-muted-foreground text-xs">Cours collectifs</p>
          </div>
        </div>
        <SeasonSelector />
        <nav aria-label="Navigation principale" className="flex flex-col gap-1 px-2">
          {navigationItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 font-medium text-sm transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )
              }
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col overflow-auto">
        <ReadOnlyBanner />
        <Suspense fallback={<Loading className="p-8 text-muted-foreground text-sm" />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

/** Pages de détail propres à une saison : on revient à leur liste en changeant de saison. */
const DETAIL_PAGE = /^\/referentiels\/(moniteurs|groupes)\/.+$/;

/** Sélecteur de la saison consultée (§8.1) : saison active ou saison archivée. */
function SeasonSelector() {
  const { season, seasons, selectSeason } = useSeason();
  const navigate = useNavigate();
  const location = useLocation();
  if (seasons.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 px-4 pb-4">
      <label htmlFor="season-selector" className="text-muted-foreground text-xs">
        Saison consultée
      </label>
      <Select
        id="season-selector"
        className="h-8 bg-background"
        value={season?.id ?? ""}
        onChange={(e) => {
          const chosen = seasons.find((s) => s.id === e.target.value);
          selectSeason(chosen && chosen.status !== "active" ? chosen.id : null);
          const detail = DETAIL_PAGE.exec(location.pathname);
          if (detail) navigate(`/referentiels/${detail[1]}`);
        }}
      >
        {seasons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.status === "archived" ? " (archivée)" : " (active)"}
          </option>
        ))}
      </Select>
    </div>
  );
}

/** Bandeau signalant la consultation d'une saison archivée, en lecture seule. */
function ReadOnlyBanner() {
  const { season, activeSeason, readOnly, selectSeason } = useSeason();
  if (!readOnly || !season) return null;
  return (
    <div
      role="status"
      data-testid="read-only-banner"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-amber-300 border-b bg-amber-50 px-4 py-2 text-amber-900 text-sm dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
    >
      <Archive className="size-4 shrink-0" aria-hidden />
      <span>
        Saison <b>{season.name}</b> archivée : consultation en lecture seule, aucune modification
        possible.
      </span>
      {activeSeason && (
        <button
          type="button"
          className="font-medium underline underline-offset-2"
          onClick={() => selectSeason(null)}
        >
          Revenir à la saison {activeSeason.name}
        </button>
      )}
    </div>
  );
}
