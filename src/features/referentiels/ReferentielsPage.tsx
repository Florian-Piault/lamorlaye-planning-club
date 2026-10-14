import { Users } from "lucide-react";
import { EmptyState, Page } from "@/components/layout/Page";

export function ReferentielsPage() {
  return (
    <Page
      title="Référentiels"
      description="Saisons, courts, moniteurs, niveaux, groupes, élèves et périodes de fermeture."
    >
      <EmptyState icon={Users} title="Aucune donnée saisie">
        Les écrans de saisie des référentiels arrivent prochainement.
      </EmptyState>
    </Page>
  );
}
