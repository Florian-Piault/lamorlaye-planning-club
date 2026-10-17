import { type ReactNode, Suspense, useId } from "react";
import { NavLink, Outlet } from "react-router";
import { useSeason } from "@/app/season";
import { Loading, Page } from "@/components/layout/Page";
import { guidanceOf } from "@/domain/guidance";
import { useGuidance } from "@/features/guidance/GuidanceProvider";
import { GuidanceWelcome, stepMarkOf } from "@/features/guidance/GuidanceWelcome";
import { cn } from "@/lib/utils";

/** Onglets des référentiels (« Le club » à l'écran), dans l'ordre de saisie conseillé. */
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
  // Guidage : pastille d'étape sur les onglets Saison à Élèves (spec UX v1.1).
  const guidance = useGuidance();
  const descriptionId = useId();
  return (
    <Page
      title="Le club"
      description={
        season
          ? `Saison ${season.name} : courts, moniteurs, niveaux, groupes, élèves et fermetures.`
          : "Saisons, courts, moniteurs, niveaux, groupes, élèves et fermetures."
      }
    >
      <nav aria-label="Fiches du club" className="-mt-2 mb-6 flex gap-1 border-b">
        {referentielTabs.map(({ path, label }) => {
          const mark = stepMarkOf(guidance, path);
          return (
            <NavLink
              key={path}
              to={path}
              aria-describedby={mark ? `${descriptionId}-${path}` : undefined}
              className={({ isActive }) =>
                cn(
                  "-mb-px inline-flex items-center border-b-2 px-3 py-2 font-medium text-sm transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )
              }
            >
              {label}
              {mark && (
                <>
                  {mark.badge}
                  <span id={`${descriptionId}-${path}`} hidden>
                    {mark.description}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
      <Suspense fallback={<Loading />}>
        <Outlet />
      </Suspense>
    </Page>
  );
}

/**
 * N'affiche son contenu qu'une fois une saison créée ; avant, l'accueil
 * « Avant de construire le planning » mène à la création de la saison.
 */
export function RequireSeason({ children }: { children: ReactNode }) {
  const { season, loading } = useSeason();
  if (loading) return <Loading />;
  // Accueil du guidage à la place de l'état vide « Aucune saison ».
  if (!season) return <GuidanceWelcome guidance={guidanceOf(null, null)} />;
  return children;
}
