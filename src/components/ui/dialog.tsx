import { XIcon } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";

import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Boutons d'action, alignés à droite. */
  footer?: ReactNode;
  className?: string;
}

/**
 * Fenêtre modale, sur l'élément natif `<dialog>` (piège du focus, touche
 * Échap et couche supérieure gérés par le moteur web). Le contenu n'est monté
 * que lorsque la fenêtre est ouverte, ce qui réinitialise les formulaires.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={() => onOpenChange(false)}
      className={cn(
        "m-auto w-full max-w-lg rounded-xl border bg-background p-0 text-foreground shadow-lg backdrop:bg-black/50",
        className,
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b px-6 py-4">
            <div className="space-y-1">
              <h2 id={titleId} className="font-semibold text-lg leading-none">
                {title}
              </h2>
              {description && (
                <div id={descriptionId} className="text-muted-foreground text-sm">
                  {description}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Fermer"
            >
              <XIcon className="size-4" aria-hidden />
            </button>
          </div>
          <div className="overflow-y-auto px-6 py-4">{children}</div>
          {footer && (
            <div className="flex flex-wrap justify-end gap-2 border-t px-6 py-4">{footer}</div>
          )}
        </div>
      )}
    </dialog>
  );
}
