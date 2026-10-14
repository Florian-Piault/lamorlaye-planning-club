import { Page } from "@/components/layout/Page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDatabase } from "@/db/DatabaseProvider";
import { BackupCard } from "./BackupCard";

export function ReglagesPage() {
  const { driver, appliedMigrations } = useDatabase();
  const storage =
    driver.kind === "tauri" ? "Fichier SQLite local" : "Base en mémoire (hors application)";

  return (
    <Page title="Réglages" description="Paramètres de l'application.">
      <div className="flex flex-col gap-6">
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Données</CardTitle>
            <CardDescription>
              Les données restent sur ce poste : l'application ne se connecte jamais à internet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Stockage</dt>
              <dd data-testid="storage-kind">{storage}</dd>
              <dt className="text-muted-foreground">Emplacement</dt>
              <dd className="break-all font-mono text-xs">{driver.location}</dd>
              <dt className="text-muted-foreground">Migrations appliquées au démarrage</dt>
              <dd>{appliedMigrations.length > 0 ? appliedMigrations.join(", ") : "aucune"}</dd>
            </dl>
          </CardContent>
        </Card>
        <BackupCard />
      </div>
    </Page>
  );
}
