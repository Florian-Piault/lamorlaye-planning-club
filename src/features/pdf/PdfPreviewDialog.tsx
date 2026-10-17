import { Download } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { ErrorAlert } from "@/components/form/Field";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SaveStatus, useSaveOutput } from "@/features/outputs/useSaveOutput";
import { errorMessage } from "@/hooks/useLoader";
import { countPdfPages } from "./render";

/** Document à prévisualiser : il est produit à l'ouverture de l'aperçu. */
export interface PdfJob {
  /** Titre de la fenêtre d'aperçu. */
  title: string;
  /** Nom de fichier proposé (avec l'extension `.pdf`). */
  fileName: string;
  render: () => Promise<Uint8Array>;
}

type Preview =
  | { status: "loading" }
  | { status: "ready"; bytes: Uint8Array; url: string; pages: number }
  | { status: "error"; message: string };

/**
 * Aperçu d'un PDF dans l'application, avant enregistrement (§9.2) : le
 * document est affiché dans un cadre, puis enregistré via le dialogue
 * « Enregistrer » et ouvert dans le lecteur PDF du système (application de
 * bureau) ou téléchargé (navigateur). `options` (format du papier…) régénère
 * l'aperçu quand le travail change.
 */
export function PdfPreviewDialog({
  job,
  onClose,
  options,
}: {
  job: PdfJob | null;
  onClose: () => void;
  options?: ReactNode;
}) {
  const [preview, setPreview] = useState<Preview>({ status: "loading" });
  const { state, save, open, reset } = useSaveOutput();

  useEffect(() => {
    if (!job) return;
    let cancelled = false;
    let url: string | null = null;
    setPreview({ status: "loading" });
    reset();
    job.render().then(
      (bytes) => {
        if (cancelled) return;
        url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
        setPreview({ status: "ready", bytes, url, pages: countPdfPages(bytes) });
      },
      (e: unknown) => !cancelled && setPreview({ status: "error", message: errorMessage(e) }),
    );
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [job, reset]);

  const saveAndOpen = async () => {
    if (preview.status !== "ready" || !job) return;
    const saved = await save({ name: job.fileName, kind: "pdf", bytes: preview.bytes });
    // Ouverture dans le lecteur PDF du système, pour imprimer.
    if (saved?.canOpen) await open();
  };

  return (
    <Dialog
      open={job !== null}
      onOpenChange={(isOpen) => !isOpen && onClose()}
      title={job?.title ?? "Aperçu du PDF"}
      className="max-w-6xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Fermer l'aperçu
          </Button>
          <Button
            onClick={saveAndOpen}
            disabled={preview.status !== "ready" || state.busy}
            disabledReason={
              preview.status === "error"
                ? "Le PDF n'a pas pu être produit"
                : state.busy
                  ? "Enregistrement en cours…"
                  : "PDF en préparation…"
            }
            reasonSide="start"
          >
            <Download aria-hidden />
            Enregistrer le PDF…
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {options}
        {preview.status === "loading" && (
          <p className="text-muted-foreground text-sm" role="status">
            Préparation du PDF…
          </p>
        )}
        {preview.status === "error" && (
          <ErrorAlert>Impossible de produire le PDF : {preview.message}</ErrorAlert>
        )}
        {preview.status === "ready" && (
          <>
            <p className="text-muted-foreground text-sm" data-testid="pdf-info">
              {job?.fileName} — {preview.pages} page{preview.pages > 1 ? "s" : ""}
            </p>
            <iframe
              title="Aperçu du PDF"
              src={preview.url}
              className="h-[60vh] w-full rounded-md border bg-muted"
            />
          </>
        )}
        <SaveStatus state={state} onOpen={open} />
      </div>
    </Dialog>
  );
}
