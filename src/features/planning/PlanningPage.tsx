import { CalendarDays } from "lucide-react";
import { EmptyState, Page } from "@/components/layout/Page";

export function PlanningPage() {
  return (
    <Page title="Planning" description="Semaine type et semaines datées de la saison.">
      <EmptyState icon={CalendarDays} title="Aucun cours pour le moment">
        La grille de la semaine type sera disponible une fois les référentiels saisis.
      </EmptyState>
    </Page>
  );
}
