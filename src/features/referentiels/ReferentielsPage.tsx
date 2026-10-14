import { CalendarPlus } from "lucide-react";
import type { ReactNode } from "react";
import { Link, NavLink, Outlet } from "react-router";
import { useSeason } from "@/app/season";
import { EmptyState, Page } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Onglets des référentiels, dans l'ordre de saisie conseillé. */
export const referentielTabs = [
  { path: "saison", label: "Saison" },
  { path: "courts", label: "Courts" },
  { path: "moniteurs", label: "Moniteurs" },
  { path: "niveaux", label: "Niveaux" },
  { path: "groupes", label: "Groupes" },
  { path: "eleves", label: "Élèves" },
  { path: "fermetures", label: "Fermetures" },
] as const;

export function ReferentielsPage() {
  const { season } = useSeason();
  return (
    <Page
      title="Référentiels"
      description={
        season
          ? `Saison ${season.name} : courts, moniteurs, niveaux, groupes, élèves et fermetures.`
          : "Saisons, courts, moniteurs, niveaux, groupes, élèves et fermetures."
      }
    >
      <nav aria-label="Référentiels" className="-mt-2 mb-6 flex gap-1 border-b">
        {referentielTabs.map(({ path, label }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              cn(
                "-mb-px border-b-2 px-3 py-2 font-medium text-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </Page>
  );
}

/** N'affiche son contenu qu'une fois une saison créée. */
export function RequireSeason({ children }: { children: ReactNode }) {
  const { season, loading } = useSeason();
  if (loading) return <p className="text-muted-foreground text-sm">Chargement…</p>;
  if (!season) {
    return (
      <EmptyState icon={CalendarPlus} title="Aucune saison">
        <p>Créez d'abord la saison : courts, moniteurs, groupes et élèves lui sont rattachés.</p>
        <Button asChild className="mt-4">
          <Link to="/referentiels/saison">Créer la saison</Link>
        </Button>
      </EmptyState>
    );
  }
  return children;
}
