import { Page } from "@/components/layout/Page";
import { RequireSeason } from "@/features/referentiels/ReferentielsPage";
import { StudentImport } from "./StudentImport";

export function ImportExportPage() {
  return (
    <Page
      title="Import/Export"
      description="Import d'élèves (CSV, Excel). Les exports et documents PDF arriveront dans une prochaine version."
    >
      <RequireSeason>
        <StudentImport />
      </RequireSeason>
    </Page>
  );
}
