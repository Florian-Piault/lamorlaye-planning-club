import { Archive, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { ErrorAlert } from "@/components/form/Field";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { Usage } from "@/domain/usage";
import { errorMessage } from "@/hooks/useLoader";

interface DeleteActionProps {
  /** Nom de l'élément, ex. « Court 1 ». */
  name: string;
  /** Désignation dans les phrases, ex. « le court « Court 1 » ». */
  subject: string;
  /** Utilisation de l'élément (cours, groupes…), vérifiée avant la suppression. */
  getUsage?: () => Promise<Usage>;
  onDelete: () => Promise<void>;
  /** Archivage proposé si l'élément est utilisé. */
  onArchive?: () => Promise<void>;
  /** La suppression reste possible malgré l'utilisation (ex. un niveau). */
  canDeleteWhenUsed?: boolean;
  /** L'élément est déjà archivé. */
  archived?: boolean;
  /** Précision affichée dans la confirmation. */
  warning?: ReactNode;
  onDone: () => void;
  /** Bouton complet (fiche) plutôt qu'une icône (liste). */
  showLabel?: boolean;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Suppression avec confirmation (SPECS.md §8). Si l'élément est utilisé, on
 * propose de l'archiver (inactif) plutôt que de le supprimer.
 */
export function DeleteAction({
  name,
  subject,
  getUsage,
  onDelete,
  onArchive,
  canDeleteWhenUsed = false,
  archived = false,
  warning,
  onDone,
  showLabel = false,
}: DeleteActionProps) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setError(null);
    setBusy(true);
    try {
      setUsage(getUsage ? await getUsage() : { total: 0, description: "" });
    } catch (e) {
      setError(errorMessage(e));
      setUsage({ total: 0, description: "" });
    } finally {
      setBusy(false);
    }
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setUsage(null);
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const used = (usage?.total ?? 0) > 0;
  const canArchive = used && Boolean(onArchive) && !archived;
  const canDelete = !used || canDeleteWhenUsed;

  return (
    <>
      <Button
        type="button"
        variant={showLabel ? "outline" : "ghost"}
        size={showLabel ? "default" : "icon"}
        onClick={start}
        disabled={busy}
        aria-label={`Supprimer ${name}`}
        title={showLabel ? undefined : "Supprimer"}
      >
        <Trash2 aria-hidden />
        {showLabel && "Supprimer"}
      </Button>
      <Dialog
        open={usage !== null}
        onOpenChange={(open) => !open && setUsage(null)}
        title={`Supprimer ${name} ?`}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setUsage(null)}>
              Annuler
            </Button>
            {canArchive && onArchive && (
              <Button type="button" onClick={() => run(onArchive)} disabled={busy}>
                <Archive aria-hidden />
                Archiver
              </Button>
            )}
            {canDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => run(onDelete)}
                disabled={busy}
              >
                <Trash2 aria-hidden />
                {used ? "Supprimer quand même" : "Supprimer"}
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-3 text-sm">
          {used ? (
            <>
              <p>
                {capitalize(subject)} est utilisé par {usage?.description}.
              </p>
              {canArchive && (
                <p>
                  Plutôt que de le supprimer, vous pouvez l'archiver : il ne sera plus proposé dans
                  les listes de choix, mais les données existantes seront conservées.
                </p>
              )}
              {!canDelete && <p>Il ne peut pas être supprimé tant qu'il est utilisé.</p>}
            </>
          ) : (
            <p>Supprimer {subject} ? Cette action est définitive.</p>
          )}
          {warning && <p className="text-muted-foreground">{warning}</p>}
          <ErrorAlert>{error}</ErrorAlert>
        </div>
      </Dialog>
    </>
  );
}
