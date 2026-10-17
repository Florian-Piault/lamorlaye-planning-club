import { Page } from "@/components/layout/Page";
import { RequireSeason } from "@/features/referentiels/ReferentielsPage";
import { Outputs } from "./Outputs";
import { StudentImport } from "./StudentImport";

export function ImportExportPage() {
  return (
    <Page
      title="Import/Export"
      description="Importer des élèves, imprimer le planning et les feuilles d'appel, exporter vers Excel."
    >
      <RequireSeason>
        <div className="flex flex-col gap-8">
          <Outputs />
          <StudentImport />
        </div>
      </RequireSeason>
    </Page>
  );
}
