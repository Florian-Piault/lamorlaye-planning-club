import { useCallback } from "react";
import { ErrorAlert } from "@/components/form/Field";
import { Page } from "@/components/layout/Page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDatabase } from "@/db/DatabaseProvider";
import { errorMessage, useLoader } from "@/hooks/useLoader";
import { loadAppInfo, systemLabel, THIRD_PARTY_COMPONENTS } from "./appInfo";

/** Écran « À propos » (lot L8) : version, emplacement des données et des sauvegardes, licences. */
export function AboutPage() {
  const { driver } = useDatabase();
  const load = useCallback(() => loadAppInfo(driver), [driver]);
  const { data: info, error } = useLoader(load);
  const system = info ? systemLabel(info) : null;

  return (
    <Page title="À propos" description="Version de l'application et emplacement de vos données.">
      <div className="flex flex-col gap-6">
        {error !== undefined && (
          <ErrorAlert>Informations indisponibles : {errorMessage(error)}</ErrorAlert>
        )}
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Kairos</CardTitle>
            <CardDescription>
              Planning des cours collectifs du club de tennis. Application de bureau entièrement
              hors ligne : aucune donnée ne quitte ce poste, aucune mise à jour automatique.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Version</dt>
              <dd data-testid="app-version">{info ? info.version : "…"}</dd>
              {info?.tauriVersion && (
                <>
                  <dt className="text-muted-foreground">Tauri</dt>
                  <dd>{info.tauriVersion}</dd>
                </>
              )}
              {system && (
                <>
                  <dt className="text-muted-foreground">Système</dt>
                  <dd>{system}</dd>
                </>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Emplacement des données</CardTitle>
            <CardDescription>
              Pensez à exporter régulièrement une sauvegarde (écran Réglages) vers une clé USB. Pour
              désinstaller l'application sans perdre vos données, conservez ce dossier.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
              {info?.dataDir && (
                <>
                  <dt className="text-muted-foreground">Dossier de données</dt>
                  <dd className="break-all font-mono text-xs" data-testid="data-dir">
                    {info.dataDir}
                  </dd>
                </>
              )}
              <dt className="text-muted-foreground">Base de données</dt>
              <dd className="break-all font-mono text-xs" data-testid="database-location">
                {info ? info.database : "…"}
              </dd>
              <dt className="text-muted-foreground">Sauvegardes automatiques</dt>
              <dd className="break-all font-mono text-xs" data-testid="backups-location">
                {info
                  ? (info.backupsDir ?? "Disponibles dans l'application de bureau uniquement")
                  : "…"}
              </dd>
            </dl>
          </CardContent>
        </Card>

        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Composants libres</CardTitle>
            <CardDescription>
              L'application s'appuie sur des logiciels libres, utilisés selon leurs licences.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table aria-label="Composants libres">
              <TableHeader>
                <TableRow>
                  <TableHead>Composant</TableHead>
                  <TableHead>Utilisation</TableHead>
                  <TableHead>Licence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {THIRD_PARTY_COMPONENTS.map((component) => (
                  <TableRow key={component.name}>
                    <TableCell className="font-medium">{component.name}</TableCell>
                    <TableCell>{component.usage}</TableCell>
                    <TableCell>{component.license}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
