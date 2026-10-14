import { DatabaseBackup, Download, RotateCcw, Upload } from "lucide-react";
import { useCallback, useState } from "react";
import { ErrorAlert } from "@/components/form/Field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  backupsLocation,
  chooseBackupFile,
  createBackup,
  exportBackup,
  listBackups,
  restoreBackup,
} from "@/db/backup";
import { useDatabase } from "@/db/DatabaseProvider";
import {
  BACKUPS_KEPT,
  describeBackupReason,
  formatDateTime,
  formatFileSize,
  sortBackups,
} from "@/domain/backup";
import { errorMessage, useLoader } from "@/hooks/useLoader";

/** Sauvegardes (§11.3) : copies automatiques, export manuel et restauration. */
export function BackupCard() {
  const { driver } = useDatabase();
  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Sauvegardes</CardTitle>
        <CardDescription>
          Une copie de la base est enregistrée automatiquement à chaque fermeture de l'application ;
          les {BACKUPS_KEPT} dernières sont conservées. Exportez régulièrement une sauvegarde vers
          une clé USB.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {driver.kind === "tauri" ? (
          <DesktopBackups />
        ) : (
          <p className="text-muted-foreground text-sm" data-testid="backups-unavailable">
            Les sauvegardes sont disponibles dans l'application de bureau uniquement.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function DesktopBackups() {
  const load = useCallback(async () => {
    const [location, backups] = await Promise.all([backupsLocation(), listBackups()]);
    return { location, backups: sortBackups(backups) };
  }, []);
  const { data, reload } = useLoader(load);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState<{ path: string; label: string } | null>(null);

  const run = async (action: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      setMessage(await action());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      reload();
    }
  };

  const chooseFile = async () => {
    setError(null);
    try {
      const path = await chooseBackupFile();
      if (path) setRestoring({ path, label: `le fichier ${path}` });
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() =>
            run(async () => {
              const path = await exportBackup();
              return path ? `Sauvegarde exportée : ${path}` : null;
            })
          }
          disabled={busy}
        >
          <Download aria-hidden />
          Exporter une sauvegarde…
        </Button>
        <Button variant="outline" onClick={chooseFile} disabled={busy}>
          <Upload aria-hidden />
          Restaurer une sauvegarde…
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            run(async () => {
              await createBackup();
              return "Sauvegarde enregistrée.";
            })
          }
          disabled={busy}
        >
          <DatabaseBackup aria-hidden />
          Sauvegarder maintenant
        </Button>
      </div>
      {message && <output className="text-muted-foreground text-sm">{message}</output>}
      <ErrorAlert>{error}</ErrorAlert>

      <div className="flex flex-col gap-2">
        <h3 className="font-medium text-sm">Sauvegardes automatiques</h3>
        {data && (
          <p className="break-all font-mono text-muted-foreground text-xs">{data.location}</p>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Motif</TableHead>
              <TableHead>Taille</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.backups.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  Aucune sauvegarde pour le moment.
                </TableCell>
              </TableRow>
            )}
            {data?.backups.map((backup) => {
              const date = formatDateTime(backup.createdAt);
              return (
                <TableRow key={backup.path}>
                  <TableCell>{date}</TableCell>
                  <TableCell>{describeBackupReason(backup.reason)}</TableCell>
                  <TableCell>{formatFileSize(backup.size)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Restaurer la sauvegarde du ${date}`}
                      title="Restaurer"
                      onClick={() =>
                        setRestoring({ path: backup.path, label: `la sauvegarde du ${date}` })
                      }
                    >
                      <RotateCcw aria-hidden />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={restoring !== null}
        onOpenChange={(open) => !open && setRestoring(null)}
        title="Restaurer une sauvegarde ?"
        footer={
          <>
            <Button variant="outline" onClick={() => setRestoring(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                const path = restoring?.path;
                setRestoring(null);
                if (path) {
                  run(async () => {
                    await restoreBackup(path);
                    return null;
                  });
                }
              }}
            >
              Restaurer
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-sm">
          <p className="break-all">
            Les données actuelles seront remplacées par {restoring?.label}.
          </p>
          <p className="text-muted-foreground">
            Une copie de l'état actuel est d'abord enregistrée dans les sauvegardes automatiques.
          </p>
        </div>
      </Dialog>
    </div>
  );
}
