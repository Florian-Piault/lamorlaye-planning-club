/**
 * PROTOTYPE — itération 1 : trois variantes de thème + barre latérale.
 * Se branche à la place de AppShell.prototype.tsx de iteration-2.patch
 * (ShellA/B/C au lieu de ShellD/E/F dans AppShell.tsx).
 */
import { Archive, ChevronsUpDown, type LucideIcon } from "lucide-react";
import { type ReactNode, Suspense } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { navigationItems } from "@/app/navigation";
import { useSeason } from "@/app/season";
import { Loading } from "@/components/layout/Page";
import { cn } from "@/lib/utils";
import "./AppShell.prototype.css";

export const SHELL_VARIANTS = [
  { key: "0", name: "Actuel" },
  { key: "A", name: "Club house — sidebar vert gazon" },
  { key: "B", name: "Terre battue — panneaux flottants" },
  { key: "C", name: "Court central — rail + barre haute" },
] as const;
export type ShellVariant = (typeof SHELL_VARIANTS)[number]["key"];

const DETAIL_PAGE = /^\/referentiels\/(moniteurs|groupes)\/.+$/;

const SECTIONS: { label: string; paths: string[] }[] = [
  { label: "Planifier", paths: ["/planning", "/heures"] },
  { label: "Gérer", paths: ["/referentiels", "/import-export"] },
  { label: "Application", paths: ["/reglages", "/a-propos"] },
];
const itemsFor = (paths: string[]) => navigationItems.filter((i) => paths.includes(i.path));

function useSeasonSelect() {
  const { season, seasons, activeSeason, readOnly, selectSeason } = useSeason();
  const navigate = useNavigate();
  const location = useLocation();
  const onChange = (id: string) => {
    const chosen = seasons.find((s) => s.id === id);
    selectSeason(chosen && chosen.status !== "active" ? chosen.id : null);
    const detail = DETAIL_PAGE.exec(location.pathname);
    if (detail) navigate(`/referentiels/${detail[1]}`);
  };
  return { season, seasons, activeSeason, readOnly, onChange };
}

function SeasonPicker({ className, children }: { className?: string; children: ReactNode }) {
  const { season, seasons, onChange } = useSeasonSelect();
  if (seasons.length === 0) return null;
  return (
    <div className={cn("relative", className)}>
      {children}
      <select
        aria-label="Saison consultée"
        className="absolute inset-0 cursor-pointer opacity-0"
        value={season?.id ?? ""}
        onChange={(e) => onChange(e.target.value)}
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

function Content({ banner }: { banner: ReactNode }) {
  return (
    <>
      {banner}
      <Suspense fallback={<Loading className="p-8 text-muted-foreground text-sm" />}>
        <Outlet />
      </Suspense>
    </>
  );
}

/** A — Club house : sidebar pleine hauteur vert gazon, repère terre battue, saison en bas. */
export function ShellA({ banner }: { banner: ReactNode }) {
  const { season, readOnly } = useSeasonSelect();
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="proto-a-sidebar relative flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-3 px-5 pt-6 pb-7">
          <img
            src="/favicon.svg"
            alt=""
            className="size-10 rounded-xl shadow-black/30 shadow-lg ring-1 ring-white/15"
          />
          <div className="leading-tight">
            <p className="proto-serif font-semibold text-[17px] tracking-tight">Planning Club</p>
            <p className="text-[11px] text-sidebar-foreground/60 uppercase tracking-[0.14em]">
              TC Lamorlaye
            </p>
          </div>
        </div>
        <nav aria-label="Navigation principale" className="flex flex-1 flex-col gap-6 px-3">
          {SECTIONS.map((section, i) => (
            <div key={section.label} className={cn("flex flex-col gap-0.5", i === 2 && "mt-auto")}>
              <p className="px-3 pb-1.5 font-semibold text-[10px] text-sidebar-foreground/45 uppercase tracking-[0.16em]">
                {section.label}
              </p>
              {itemsFor(section.paths).map((item) => (
                <NavItemA key={item.path} {...item} />
              ))}
            </div>
          ))}
        </nav>
        <SeasonPicker className="m-3 mt-5">
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.07] px-3 py-2.5 ring-1 ring-white/10 transition hover:bg-white/[0.11]">
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-lg font-bold text-[11px]",
                readOnly
                  ? "bg-amber-400/20 text-amber-200"
                  : "bg-sidebar-primary text-sidebar-primary-foreground",
              )}
            >
              {readOnly ? <Archive className="size-4" /> : season?.name.slice(2, 4)}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-[10px] text-sidebar-foreground/55 uppercase tracking-wider">
                Saison {readOnly ? "archivée" : "active"}
              </p>
              <p className="truncate font-medium text-sm">{season?.name}</p>
            </div>
            <ChevronsUpDown className="size-4 text-sidebar-foreground/50" />
          </div>
        </SeasonPicker>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col overflow-auto">
        <Content banner={banner} />
      </main>
    </div>
  );
}

function NavItemA({ path, label, icon: Icon }: { path: string; label: string; icon: LucideIcon }) {
  return (
    <NavLink
      to={path}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-3 rounded-lg px-3 py-2 font-medium text-[13.5px] transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              "absolute top-1.5 bottom-1.5 -left-3 w-1 rounded-r-full bg-sidebar-primary transition-opacity",
              isActive ? "opacity-100" : "opacity-0",
            )}
          />
          <Icon
            className={cn("size-[18px]", isActive && "text-sidebar-primary")}
            strokeWidth={isActive ? 2.2 : 1.8}
            aria-hidden
          />
          {label}
        </>
      )}
    </NavLink>
  );
}

/** B — Terre battue : fond sable, sidebar et contenu en panneaux flottants arrondis. */
export function ShellB({ banner }: { banner: ReactNode }) {
  const { season, readOnly } = useSeasonSelect();
  return (
    <div className="flex h-screen gap-3 overflow-hidden bg-background p-3">
      <aside className="flex w-60 shrink-0 flex-col rounded-2xl bg-sidebar text-sidebar-foreground shadow-[0_1px_2px_rgb(60_30_10/0.06),0_8px_24px_-8px_rgb(60_30_10/0.12)] ring-1 ring-sidebar-border">
        <div className="px-4 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="size-9 rounded-[10px]" />
            <div className="leading-tight">
              <p className="font-bold text-[15px] tracking-tight">Planning Club</p>
              <p className="text-muted-foreground text-xs">Cours collectifs</p>
            </div>
          </div>
          <SeasonPicker className="mt-4">
            <div
              className={cn(
                "flex items-center justify-between rounded-full border px-3 py-1.5 text-xs transition",
                readOnly
                  ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
                  : "border-sidebar-border bg-background/60 hover:bg-background",
              )}
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    readOnly
                      ? "bg-amber-500"
                      : "bg-emerald-500 shadow-[0_0_0_3px] shadow-emerald-500/20",
                  )}
                />
                <span className="font-semibold">{season?.name}</span>
                <span className="text-muted-foreground">{readOnly ? "archivée" : "en cours"}</span>
              </span>
              <ChevronsUpDown className="size-3.5 opacity-50" />
            </div>
          </SeasonPicker>
        </div>
        <div className="mx-4 border-sidebar-border border-t border-dashed" />
        <nav aria-label="Navigation principale" className="flex flex-1 flex-col gap-4 p-3">
          {SECTIONS.map((section, i) => (
            <div key={section.label} className={cn("flex flex-col gap-1", i === 2 && "mt-auto")}>
              <p className="px-2.5 pb-0.5 font-medium text-[11px] text-muted-foreground">
                {section.label}
              </p>
              {itemsFor(section.paths).map(({ path, label, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl px-2.5 py-2 font-medium text-sm transition-all",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_4px_12px_-4px] shadow-sidebar-primary/60"
                        : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          "flex size-7 items-center justify-center rounded-lg",
                          isActive ? "bg-white/20" : "bg-sidebar-accent",
                        )}
                      >
                        <Icon className="size-4" aria-hidden />
                      </span>
                      {label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <main className="proto-b-main flex min-w-0 flex-1 flex-col overflow-auto rounded-2xl bg-card shadow-[0_1px_2px_rgb(60_30_10/0.06),0_8px_24px_-8px_rgb(60_30_10/0.12)] ring-1 ring-border">
        <Content banner={banner} />
      </main>
    </div>
  );
}

/** C — Court central : rail d'icônes bleu nuit, repère balle de tennis, barre haute. */
export function ShellC({ banner }: { banner: ReactNode }) {
  const { season, readOnly } = useSeasonSelect();
  const location = useLocation();
  const current = navigationItems.find((i) => location.pathname.startsWith(i.path));
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="proto-c-rail flex w-[76px] shrink-0 flex-col items-center bg-sidebar py-3 text-sidebar-foreground">
        <img src="/favicon.svg" alt="" className="mb-4 size-10 rounded-xl" />
        <nav aria-label="Navigation principale" className="flex flex-1 flex-col items-center gap-1">
          {navigationItems.map(({ path, label, icon: Icon }, i) => (
            <NavLink
              key={path}
              to={path}
              title={label}
              className={({ isActive }) =>
                cn(
                  "group flex w-16 flex-col items-center gap-1 rounded-lg py-2 font-medium text-[10.5px] transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  i === 4 && "mt-auto",
                  isActive
                    ? "text-sidebar-foreground"
                    : "text-sidebar-foreground/55 hover:text-sidebar-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "flex h-8 w-11 items-center justify-center rounded-full transition-colors",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "group-hover:bg-sidebar-accent",
                    )}
                  >
                    <Icon className="size-[18px]" strokeWidth={2} aria-hidden />
                  </span>
                  <span className="max-w-full truncate px-0.5">{label.split("/")[0]}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col overflow-auto">
        <div className="proto-c-topbar sticky top-0 z-20 flex h-12 shrink-0 items-center justify-between gap-4 border-b bg-background/80 px-6 backdrop-blur">
          <p className="flex items-center gap-2 text-sm">
            <span className="font-bold tracking-tight">Planning Club</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground">{current?.label}</span>
          </p>
          <SeasonPicker>
            <div className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1 text-xs shadow-xs hover:bg-accent">
              <span className="text-muted-foreground">Saison</span>
              <span className="font-semibold">{season?.name}</span>
              {readOnly ? (
                <span className="rounded bg-amber-100 px-1.5 py-px font-medium text-[10px] text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
                  ARCHIVÉE
                </span>
              ) : (
                <span className="rounded bg-primary/10 px-1.5 py-px font-medium text-[10px] text-primary">
                  ACTIVE
                </span>
              )}
              <ChevronsUpDown className="size-3.5 text-muted-foreground" />
            </div>
          </SeasonPicker>
        </div>
        <Content banner={banner} />
      </main>
    </div>
  );
}
