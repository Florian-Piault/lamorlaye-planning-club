import { DatabaseBackup, Download, Lock, RotateCcw, Upload } from "lucide-react";
import { useCallback, useState } from "react";
import { useToast } from "@/components/feedback/Toast";
import { ErrorAlert, Field } from "@/components/form/Field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Input } from "@/components/ui/input";
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
  isEncryptedBackup,
  listBackups,
  restoreBackup,
} from "@/db/backup";
import { useDatabase } from "@/db/DatabaseProvider";
import {
  BACKUPS_KEPT,
  backupPasswordProblem,
  describeBackupReason,
  formatDateTime,
  formatFileSize,
  MIN_PASSWORD_LENGTH,
  sortBackups,
} from "@/domain/backup";
import { errorMessage, useLoader } from "@/hooks/useLoader";

/** Sauvegardes (§11.3) : copies automatiques, export manuel (chiffré ou non) et restauration. */
export function BackupCard() {
  const { driver } = useDatabase();
  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Sauvegardes</CardTitle>
        <CardDescription>
          Une copie de la base est enregistrée automatiquement à chaque fermeture de l'application ;
          les {BACKUPS_KEPT} dernières sont conservées. Exportez régulièrement une sauvegarde vers
          une clé USB, de préférence chiffrée par un mot de passe : elle contient les données
          personnelles des élèves.
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

interface Restoring {
  path: string;
  label: string;
  encrypted: boolean;
}

function DesktopBackups() {
  const load = useCallback(async () => {
    const [location, backups] = await Promise.all([backupsLocation(), listBackups()]);
    return { location, backups: sortBackups(backups) };
  }, []);
  const { data, reload } = useLoader(load);
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState<Restoring | null>(null);

  const run = async (action: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    try {
      const message = await action();
      if (message) toast.success(message);
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
      if (path) {
        setRestoring({
          path,
          label: `le fichier ${path}`,
          encrypted: await isEncryptedBackup(path),
        });
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setExporting(true)} disabled={busy}>
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
                        setRestoring({
                          path: backup.path,
                          label: `la sauvegarde du ${date}`,
                          encrypted: false,
                        })
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
        open={exporting}
        onOpenChange={setExporting}
        title="Exporter une sauvegarde"
        description="Copie complète de la base dans un fichier unique, par exemple sur une clé USB."
      >
        <ExportForm
          onCancel={() => setExporting(false)}
          onExport={(password) => {
            setExporting(false);
            run(async () => {
              const path = await exportBackup(password);
              if (!path) return null;
              return password
                ? `Sauvegarde chiffrée exportée : ${path}`
                : `Sauvegarde exportée : ${path}`;
            });
          }}
        />
      </Dialog>

      <Dialog
        open={restoring !== null}
        onOpenChange={(open) => !open && setRestoring(null)}
        title="Restaurer une sauvegarde ?"
      >
        {restoring && <RestoreForm restoring={restoring} onCancel={() => setRestoring(null)} />}
      </Dialog>
    </div>
  );
}

/** Choix du chiffrement d'un export : mot de passe saisi deux fois. */
function ExportForm({
  onExport,
  onCancel,
}: {
  onExport: (password: string | null) => void;
  onCancel: () => void;
}) {
  const [encrypt, setEncrypt] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <form
      noValidate
      aria-label="Export de la sauvegarde"
      className="flex flex-col gap-4 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        if (!encrypt) return onExport(null);
        const issue = backupPasswordProblem(password, confirmation);
        setProblem(issue);
        if (!issue) onExport(password);
      }}
    >
      <Checkbox
        label="Chiffrer la sauvegarde par un mot de passe (recommandé)"
        checked={encrypt}
        onChange={(e) => setEncrypt(e.target.checked)}
      />
      {encrypt && (
        <div className="grid gap-3">
          <Field label="Mot de passe" hint={`${MIN_PASSWORD_LENGTH} caractères au minimum.`}>
            {(props) => (
              <Input
                {...props}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>
          <Field label="Confirmation du mot de passe">
            {(props) => (
              <Input
                {...props}
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            )}
          </Field>
          <p className="text-muted-foreground text-xs">
            Chiffrement AES-256 ; sans ce mot de passe, la sauvegarde ne pourra pas être restaurée.
            Conservez-le en lieu sûr : il ne peut pas être retrouvé.
          </p>
        </div>
      )}
      <ErrorAlert>{problem}</ErrorAlert>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit">
          {encrypt ? <Lock aria-hidden /> : <Download aria-hidden />}
          Choisir l'emplacement…
        </Button>
      </div>
    </form>
  );
}

/** Confirmation d'une restauration ; mot de passe demandé pour une sauvegarde chiffrée. */
function RestoreForm({ restoring, onCancel }: { restoring: Restoring; onCancel: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      noValidate
      aria-label="Restauration de la sauvegarde"
      className="space-y-3 text-sm"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await restoreBackup(restoring.path, restoring.encrypted ? password : null);
        } catch (e) {
          setError(errorMessage(e));
          setBusy(false);
        }
      }}
    >
      <p className="break-all">Les données actuelles seront remplacées par {restoring.label}.</p>
      <p className="text-muted-foreground">
        Une copie de l'état actuel est d'abord enregistrée dans les sauvegardes automatiques.
      </p>
      {restoring.encrypted && (
        <Field label="Mot de passe de la sauvegarde" hint="Cette sauvegarde est chiffrée.">
          {(props) => (
            <Input
              {...props}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
      )}
      <ErrorAlert>{error}</ErrorAlert>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          type="submit"
          variant="destructive"
          disabled={busy || (restoring.encrypted && password === "")}
        >
          Restaurer
        </Button>
      </div>
    </form>
  );
}
