import { FileJson, ShieldAlert, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { ErrorAlert } from "@/components/form/Field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Label } from "@/components/ui/input";
import { useDatabase } from "@/db/DatabaseProvider";
import { eraseStudents, findStudentRecords } from "@/db/repositories/rgpd";
import { studentExportBytes, studentExportFileName } from "@/domain/rgpd";
import { formatDate } from "@/domain/time";
import { importHistory } from "@/features/import-export/importHistory";
import { SaveStatus, useSaveOutput } from "@/features/outputs/useSaveOutput";
import { errorMessage, useLoader } from "@/hooks/useLoader";

interface StudentPrivacyDialogProps {
  /** Une fiche de l'élève (toutes ses fiches sont retrouvées) ; `null` : fermé. */
  studentId: string | null;
  onClose: () => void;
  /** Suppression définitive proposée (pas pendant la consultation d'une saison archivée). */
  allowErase: boolean;
  onErased: (count: number) => void;
}

/**
 * Données personnelles d'un élève (RGPD, §11.6) : fiches de toutes les saisons,
 * export de ses données (JSON) et suppression définitive.
 */
export function StudentPrivacyDialog({ studentId, ...props }: StudentPrivacyDialogProps) {
  return (
    <Dialog
      open={studentId !== null}
      onOpenChange={(open) => !open && props.onClose()}
      title="Données personnelles"
      description="Droits d'accès et d'effacement (RGPD) : toutes les fiches de l'élève, saisons archivées comprises."
      className="max-w-2xl"
    >
      {studentId && <PrivacyContent studentId={studentId} {...props} />}
    </Dialog>
  );
}

function PrivacyContent({
  studentId,
  onClose,
  allowErase,
  onErased,
}: Omit<StudentPrivacyDialogProps, "studentId"> & { studentId: string }) {
  const { db } = useDatabase();
  const load = useCallback(() => findStudentRecords(db, studentId), [db, studentId]);
  const { data: records, error: loadError } = useLoader(load);
  const output = useSaveOutput();
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loadError) return <ErrorAlert>{errorMessage(loadError)}</ErrorAlert>;
  if (!records) return <p className="text-muted-foreground text-sm">Chargement…</p>;
  const person = records.at(-1)?.student;
  if (!person) return <p className="text-sm">Élève introuvable.</p>;
  const name = `${person.firstName} ${person.lastName}`;

  const exportData = () =>
    output.save({
      name: studentExportFileName(person),
      kind: "json",
      bytes: studentExportBytes(records, new Date().toISOString()),
    });

  const erase = async () => {
    setBusy(true);
    setError(null);
    try {
      const count = await eraseStudents(
        db,
        records.map((r) => r.student.id),
      );
      // Les imports de la session contiennent peut-être l'élève : plus d'annulation possible.
      importHistory.reset();
      onErased(count);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 text-sm">
      <section className="flex flex-col gap-2">
        <h3 className="font-medium">
          {name}
          {person.birthDate && (
            <span className="font-normal text-muted-foreground">
              {" "}
              — né(e) le {formatDate(person.birthDate)}
            </span>
          )}
        </h3>
        <ul aria-label="Fiches de l'élève" className="divide-y rounded-lg border">
          {records.map(({ student, season, groups }) => (
            <li key={student.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="font-medium">Saison {season.name}</span>
              {season.status === "archived" ? (
                <Badge variant="outline">Archivée</Badge>
              ) : (
                <Badge>Active</Badge>
              )}
              <span className="text-muted-foreground">
                {groups.length > 0
                  ? `Groupes : ${groups.map((g) => g.name).join(", ")}`
                  : "Aucun groupe"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-medium">Exporter ses données</h3>
        <p className="text-muted-foreground">
          Fichier JSON lisible : fiche complète de chaque saison (coordonnées, responsable légal,
          niveau, classement) et groupes.
        </p>
        <div>
          <Button variant="outline" onClick={exportData} disabled={output.state.busy}>
            <FileJson aria-hidden />
            Exporter ses données
          </Button>
        </div>
        <SaveStatus state={output.state} onOpen={output.open} />
      </section>

      {allowErase && (
        <section className="flex flex-col gap-2 rounded-lg border border-destructive/40 p-3">
          <h3 className="flex items-center gap-2 font-medium text-destructive">
            <ShieldAlert className="size-4" aria-hidden />
            Supprimer définitivement
          </h3>
          <p className="text-muted-foreground">
            Efface toutes les fiches de l'élève ({records.length}{" "}
            {records.length > 1 ? "saisons" : "saison"}, archivées comprises) et le retire de tous
            ses groupes. Cette action ne peut pas être annulée ; seule une sauvegarde antérieure
            contient encore ses données.
          </p>
          {confirming ? (
            <div className="flex flex-col gap-2">
              <Label className="font-normal">
                <Checkbox checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                Je confirme la suppression définitive des données de {name}
              </Label>
              <div className="flex gap-2">
                <Button variant="destructive" disabled={!confirmed || busy} onClick={erase}>
                  <Trash2 aria-hidden />
                  Supprimer définitivement
                </Button>
                <Button variant="outline" onClick={() => setConfirming(false)}>
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <Button
                variant="outline"
                className="text-destructive"
                onClick={() => setConfirming(true)}
              >
                <Trash2 aria-hidden />
                Supprimer définitivement…
              </Button>
            </div>
          )}
          <ErrorAlert>{error}</ErrorAlert>
        </section>
      )}

      <div className="flex justify-end">
        <Button variant="outline" onClick={onClose}>
          Fermer
        </Button>
      </div>
    </div>
  );
}
