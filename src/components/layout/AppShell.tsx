import { NavLink, Outlet } from "react-router";
import { navigationItems } from "@/app/navigation";
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
        <Outlet />
      </main>
    </div>
  );
}
