import { Page } from "@/components/layout/Page";
import { RequireSeason } from "@/features/referentiels/ReferentielsPage";
import { Outputs } from "./Outputs";
import { StudentImport } from "./StudentImport";

export function ImportExportPage() {
  return (
    <Page
      title="Import/Export"
      description="Import d'élèves (CSV, Excel), documents PDF à imprimer et exports CSV / Excel."
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
