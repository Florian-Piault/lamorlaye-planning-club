import { Page } from "@/components/layout/Page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TechnicalDetails } from "@/components/ui/technical-details";
import { useDatabase } from "@/db/DatabaseProvider";
import { PrivacyCard } from "@/features/rgpd/PrivacyCard";
import { AppearanceCard } from "./AppearanceCard";
import { BackupCard } from "./BackupCard";

export function ReglagesPage() {
  const { driver, appliedMigrations } = useDatabase();
  const desktop = driver.kind === "tauri";

  return (
    <Page title="Réglages" description="Paramètres de l'application.">
      <div className="flex flex-col gap-6">
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Données</CardTitle>
            <CardDescription>
              Les données restent sur cet ordinateur : l'application ne se connecte jamais à
              internet.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm" data-testid="storage-kind">
              {desktop
                ? "Données enregistrées sur cet ordinateur"
                : "Données gardées en mémoire, effacées à la fermeture (hors application)"}
            </p>
            <TechnicalDetails>
              <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1">
                <dt>Stockage</dt>
                <dd>{desktop ? "Fichier SQLite local" : "Base SQLite en mémoire (sql.js)"}</dd>
                <dt>Emplacement</dt>
                <dd className="break-all font-mono">{driver.location}</dd>
                <dt>Migrations appliquées au démarrage</dt>
                <dd>{appliedMigrations.length > 0 ? appliedMigrations.join(", ") : "aucune"}</dd>
              </dl>
            </TechnicalDetails>
          </CardContent>
        </Card>
        <AppearanceCard />
        <BackupCard />
        <PrivacyCard />
      </div>
    </Page>
  );
}
