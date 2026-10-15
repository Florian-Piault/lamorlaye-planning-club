import { Archive, ChevronsUpDown } from "lucide-react";
import { Suspense } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { navigationItems, navigationSections } from "@/app/navigation";
import { useSeason } from "@/app/season";
import { Loading } from "@/components/layout/Page";
import { cn } from "@/lib/utils";

/** Panneau flottant (barre latérale, contenu) posé sur le fond de l'application. */
const PANEL = "rounded-xl border shadow-panel";

/**
 * Coque de l'application : barre latérale de navigation et zone de contenu,
 * en panneaux flottants ; la barre haute du contenu porte le fil d'Ariane et
 * le sélecteur de saison.
 */
export function AppShell() {
  return (
    <div className="flex h-screen gap-2.5 overflow-hidden bg-background p-2.5">
      <aside
        className={cn(
          PANEL,
          "flex w-56 shrink-0 flex-col border-sidebar-border bg-sidebar text-sidebar-foreground",
        )}
      >
        <div className="flex h-14 shrink-0 items-center gap-2.5 px-4">
          <img src="/favicon.svg" alt="" className="size-8 rounded-lg" />
          <div className="leading-tight">
            <p className="font-semibold text-sm tracking-tight">Kairos</p>
            <p className="text-muted-foreground text-xs">Cours collectifs</p>
          </div>
        </div>
        <nav aria-label="Navigation principale" className="flex flex-1 flex-col gap-5 p-3">
          {navigationSections.map(({ label, items }, index) => (
            <div
              key={label}
              className={cn(
                "flex flex-col gap-0.5",
                index === navigationSections.length - 1 && "mt-auto",
              )}
            >
              <p className="px-2.5 pb-1 font-medium text-[11px] text-muted-foreground">{label}</p>
              {items.map(({ path, label, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-2.5 py-2 font-medium text-sm",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                        : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )
                  }
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <main className={cn(PANEL, "flex min-w-0 flex-1 flex-col overflow-auto bg-card")}>
        <div className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-card/85 px-6 backdrop-blur">
          <Breadcrumb />
          <SeasonSelector />
        </div>
        <ReadOnlyBanner />
        <Suspense fallback={<Loading className="p-8 text-muted-foreground text-sm" />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

/** Fil d'Ariane de la barre haute : application / écran courant. */
function Breadcrumb() {
  const { pathname } = useLocation();
  const current = navigationItems.find((item) => pathname.startsWith(item.path));
  return (
    <p className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Kairos</span>
      <span className="text-muted-foreground" aria-hidden>
        /
      </span>
      <span className="font-medium">{current?.label}</span>
    </p>
  );
}

/** Pages de détail propres à une saison : on revient à leur liste en changeant de saison. */
const DETAIL_PAGE = /^\/referentiels\/(moniteurs|groupes)\/.+$/;

/**
 * Sélecteur de la saison consultée (§8.1) : saison active ou saison archivée.
 * Liste native transparente posée sur une pastille, pour garder le comportement
 * clavier et l'accessibilité du `<select>`.
 */
function SeasonSelector() {
  const { season, seasons, readOnly, selectSeason } = useSeason();
  const navigate = useNavigate();
  const location = useLocation();
  if (seasons.length === 0) return null;
  return (
    <div className="relative">
      <div
        aria-hidden
        className={cn(
          "flex h-8 items-center gap-2 rounded-md border px-2.5 text-xs shadow-xs",
          readOnly
            ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
            : "bg-card hover:bg-accent",
        )}
      >
        {readOnly ? (
          <Archive className="size-3.5" />
        ) : (
          <span className="size-2 rounded-full bg-highlight" />
        )}
        <span className="text-muted-foreground">Saison</span>
        <span className="font-semibold">{season?.name}</span>
        <span className="text-muted-foreground">{readOnly ? "archivée" : "active"}</span>
        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
      </div>
      <select
        id="season-selector"
        aria-label="Saison consultée"
        className="absolute inset-0 cursor-pointer opacity-0"
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
      </select>
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
