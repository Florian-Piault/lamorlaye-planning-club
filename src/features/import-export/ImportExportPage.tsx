import { ArrowLeftRight } from "lucide-react";
import { EmptyState, Page } from "@/components/layout/Page";

export function ImportExportPage() {
  return (
    <Page
      title="Import/Export"
      description="Import d'élèves (CSV, Excel), exports et documents PDF."
    >
      <EmptyState icon={ArrowLeftRight} title="Rien à importer ni à exporter pour le moment">
        L'assistant d'import et les exports seront ajoutés dans une prochaine version.
      </EmptyState>
    </Page>
  );
}
