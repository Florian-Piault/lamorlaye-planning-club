import { Archive, ChevronsLeft, ChevronsRight, ChevronsUpDown } from "lucide-react";
import { Suspense, useCallback, useLayoutEffect, useSyncExternalStore } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { navigationItems, navigationSections } from "@/app/navigation";
import { useSeason } from "@/app/season";
import { useSidebarCollapsed } from "@/app/sidebar";
import { Loading } from "@/components/layout/Page";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Panneau flottant (barre latérale, contenu) posé sur le fond de l'application. */
const PANEL = "rounded-xl border shadow-panel";

// Écrans qui portent leur propre barre d'outils (Planning) : la barre haute est masquée.
let ownToolbars = 0;
const toolbarListeners = new Set<() => void>();
function notifyToolbar() {
  for (const listener of toolbarListeners) listener();
}

/**
 * Masque la barre haute (fil d'Ariane, saison) tant qu'il est affiché : l'écran
 * qui le rend reprend lui-même le sélecteur de saison dans son en-tête.
 */
export function OwnToolbar() {
  useLayoutEffect(() => {
    ownToolbars += 1;
    notifyToolbar();
    return () => {
      ownToolbars -= 1;
      notifyToolbar();
    };
  }, []);
  return null;
}

function useTopBarHidden(): boolean {
  const subscribe = useCallback((listener: () => void) => {
    toolbarListeners.add(listener);
    return () => toolbarListeners.delete(listener);
  }, []);
  return useSyncExternalStore(subscribe, () => ownToolbars > 0);
}

/**
 * Coque de l'application : barre latérale de navigation (réductible aux
 * icônes, choix mémorisé) et zone de contenu, en panneaux flottants ; la barre
 * haute du contenu porte le fil d'Ariane et le sélecteur de saison, sauf sur
 * un écran qui a sa propre barre d'outils (Planning).
 */
export function AppShell() {
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const topBarHidden = useTopBarHidden();
  const { pathname } = useLocation();
  return (
    <div className="flex h-screen gap-2.5 overflow-hidden bg-background p-2.5">
      <aside
        data-testid="app-sidebar"
        data-collapsed={collapsed || undefined}
        className={cn(
          PANEL,
          "flex shrink-0 flex-col border-sidebar-border bg-sidebar text-sidebar-foreground",
          collapsed ? "w-14" : "w-56",
        )}
      >
        <div className={cn("flex h-14 shrink-0 items-center gap-2.5", collapsed ? "px-3" : "px-4")}>
          <img src="/favicon.svg" alt="" className="size-8 rounded-lg" />
          <div className={cn("leading-tight", collapsed && "sr-only")}>
            <p className="font-semibold text-sm tracking-tight">Kairos</p>
            <p className="text-muted-foreground text-xs">Cours collectifs</p>
          </div>
        </div>
        <nav
          aria-label="Navigation principale"
          className={cn("flex flex-1 flex-col gap-5", collapsed ? "p-1.5" : "p-3")}
        >
          {navigationSections.map(({ label, items }, index) => (
            <div
              key={label}
              className={cn(
                "flex flex-col gap-0.5",
                index === navigationSections.length - 1 && "mt-auto",
              )}
            >
              <p
                className={cn(
                  "px-2.5 pb-1 font-medium text-[11px] text-muted-foreground",
                  collapsed && "sr-only",
                )}
              >
                {label}
              </p>
              {items.map(({ path, label, icon: Icon }) => {
                // Classe calculée ici (et non par NavLink) : la bulle fusionne les classes en texte.
                const active = pathname === path || pathname.startsWith(`${path}/`);
                const link = (
                  <NavLink
                    key={path}
                    to={path}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-2.5 py-2 font-medium text-sm",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                      collapsed && "justify-center",
                      active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                        : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className={cn(collapsed && "sr-only")}>{label}</span>
                  </NavLink>
                );
                // Réduit aux icônes : le libellé reste annoncé et s'affiche en bulle.
                return collapsed ? (
                  <Tooltip key={path} content={label} describe={false}>
                    {link}
                  </Tooltip>
                ) : (
                  link
                );
              })}
            </div>
          ))}
          <CollapseButton collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        </nav>
      </aside>
      <main className={cn(PANEL, "flex min-w-0 flex-1 flex-col overflow-auto bg-card")}>
        {!topBarHidden && (
          <div className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-card/85 px-6 backdrop-blur">
            <Breadcrumb />
            <SeasonSelector />
          </div>
        )}
        <ReadOnlyBanner />
        <Suspense fallback={<Loading className="p-8 text-muted-foreground text-sm" />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

/** Bouton du bas du menu : « Réduire le menu » / « Déplier le menu ». */
function CollapseButton({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const className = cn(
    "-mt-3 flex items-center gap-3 rounded-lg px-2.5 py-2 text-sidebar-foreground/75 text-sm",
    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
    collapsed && "justify-center",
  );
  if (!collapsed) {
    return (
      <button type="button" className={className} onClick={onToggle}>
        <ChevronsLeft className="size-4 shrink-0" aria-hidden />
        Réduire le menu
      </button>
    );
  }
  return (
    <Tooltip content="Déplier le menu" describe={false}>
      <button type="button" aria-label="Déplier le menu" className={className} onClick={onToggle}>
        <ChevronsRight className="size-4 shrink-0" aria-hidden />
      </button>
    </Tooltip>
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
 * Sélecteur de la saison consultée (§8.1) : saison active (« en cours ») ou
 * saison archivée (« terminée »). Compact dans l'en-tête du Planning : le nom
 * seul, la saison complète en bulle.
 * Liste native transparente posée sur une pastille, pour garder le comportement
 * clavier et l'accessibilité du `<select>`.
 */
export function SeasonSelector({ compact = false }: { compact?: boolean }) {
  const { season, seasons, readOnly, selectSeason } = useSeason();
  const navigate = useNavigate();
  const location = useLocation();
  if (seasons.length === 0) return null;
  const status = readOnly ? "terminée" : "en cours";
  const selector = (
    <div className="relative shrink-0">
      <div
        aria-hidden
        className={cn(
          "flex h-8 items-center gap-2 whitespace-nowrap rounded-md border px-2.5 text-xs shadow-xs",
          compact && "@max-[50rem]:px-2",
          readOnly
            ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
            : "bg-card hover:bg-accent",
        )}
      >
        {readOnly ? (
          <Archive className={cn("size-3.5", compact && "@max-[50rem]:hidden")} />
        ) : (
          <span
            className={cn("size-2 rounded-full bg-highlight", compact && "@max-[50rem]:hidden")}
          />
        )}
        {!compact && <span className="text-muted-foreground">Saison</span>}
        <span className="font-semibold">{season?.name}</span>
        {!compact && <span className="text-muted-foreground">{status}</span>}
        <ChevronsUpDown
          className={cn("size-3.5 text-muted-foreground", compact && "@max-[50rem]:hidden")}
        />
      </div>
      <select
        id="season-selector"
        aria-label="Saison affichée"
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
            {s.status === "archived" ? " (terminée)" : " (en cours)"}
          </option>
        ))}
      </select>
    </div>
  );
  return compact ? (
    <Tooltip content={`Saison affichée : ${season?.name ?? ""} (${status})`} describe={false}>
      {selector}
    </Tooltip>
  ) : (
    selector
  );
}

/** Bandeau signalant la consultation d'une saison archivée (terminée), en lecture seule. */
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
        Saison <b>{season.name}</b> : consultation seulement (saison terminée), aucune modification
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
