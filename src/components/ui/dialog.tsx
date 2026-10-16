import { XIcon } from "lucide-react";
import {
  createContext,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";
import { Button } from "./button";

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

/** Garde de la fenêtre, offerte aux formulaires qu'elle contient. */
interface DialogGuard {
  /** Déclare la saisie modifiée (différente de son état à l'ouverture). */
  setDirty: (dirty: boolean) => void;
  /** Ferme la fenêtre, après confirmation si la saisie a été modifiée. */
  requestClose: (then?: () => void) => void;
  /**
   * Rappelle le focus initial si le focus a quitté la fenêtre ouverte (contenu
   * remplacé, ex. « Ouvrir sa fiche ») : sans lui, Échap n'atteint plus la fenêtre.
   */
  refocus: () => void;
}

const DialogGuardContext = createContext<DialogGuard | null>(null);

/** Champs de saisie, par ordre de préférence pour le focus initial. */
const FIELDS = "input:not([type=hidden]):enabled, select:enabled, textarea:enabled";

/** Champs dont le sélecteur natif (calendrier, horloge) reçoit le premier Échap. */
const PICKER_TYPES = new Set(["date", "time", "datetime-local", "month", "week"]);

function isPickerField(target: EventTarget | null): target is HTMLInputElement {
  return target instanceof HTMLInputElement && PICKER_TYPES.has(target.type);
}

/**
 * Échap en cascade, commun à la fenêtre et au panneau de cours. Renvoie, pour
 * chaque touche, si elle appartient encore au sélecteur natif d'un champ date
 * ou heure : le premier Échap dans un tel champ lui revient (repli retenu, les
 * trois moteurs ne signalant pas l'ouverture du calendrier), le suivant
 * s'adresse à la fenêtre. Toute autre touche réarme la cascade.
 */
export function useEscapeCascade(): (event: {
  key: string;
  target: EventTarget | null;
}) => boolean {
  const armed = useRef<EventTarget | null>(null);
  return useCallback((event) => {
    if (event.key !== "Escape") {
      armed.current = null;
      return false;
    }
    if (isPickerField(event.target) && armed.current !== event.target) {
      armed.current = event.target;
      return true;
    }
    armed.current = null;
    return false;
  }, []);
}

/**
 * Garde « saisie modifiée » commune à la fenêtre et au panneau de cours :
 * `setDirty` déclare l'état de la saisie, `guard(action)` exécute l'action
 * (fermer, ouvrir autre chose) aussitôt si la saisie est intacte, sinon après
 * « Abandonner » dans la confirmation (`confirmation`, à rendre).
 */
export function useDiscardGuard() {
  const dirty = useRef(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const setDirty = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);
  const guard = useCallback((action: () => void) => {
    if (dirty.current) setPending(() => action);
    else action();
  }, []);
  const reset = useCallback(() => {
    dirty.current = false;
    setPending(null);
  }, []);
  const confirmation = (
    <DiscardChangesDialog
      open={pending !== null}
      onContinue={() => setPending(null)}
      onDiscard={() => {
        const action = pending;
        reset();
        action?.();
      }}
    />
  );
  return { setDirty, guard, reset, confirmation };
}

/**
 * Focus initial (B3) : élément marqué `data-autofocus`, sinon premier champ,
 * sinon premier bouton non destructif (pied, puis contenu), sinon la fenêtre.
 */
function focusInitial(dialog: HTMLDialogElement) {
  const body = dialog.querySelector<HTMLElement>("[data-dialog-body]");
  const footer = dialog.querySelector<HTMLElement>("[data-dialog-footer]");
  const safeButton = (root: HTMLElement | null) =>
    root?.querySelector<HTMLElement>(
      "button:enabled:not([aria-disabled=true]):not([data-variant=destructive])",
    );
  const target =
    dialog.querySelector<HTMLElement>("[data-autofocus]") ??
    body?.querySelector<HTMLElement>(FIELDS) ??
    safeButton(footer) ??
    safeButton(body) ??
    dialog;
  target.focus();
}

/**
 * Fenêtre modale, sur l'élément natif `<dialog>` (piège du focus et couche
 * supérieure gérés par le moteur web). Le contenu n'est monté que lorsque la
 * fenêtre est ouverte, ce qui réinitialise les formulaires.
 *
 * Garde commune (spec UX v1.1) : focus initial sur le premier champ ; Échap en
 * cascade (le premier Échap dans un champ date ou heure reste au sélecteur) ;
 * si un formulaire a déclaré sa saisie modifiée (`useDirtyGuard`), toute
 * fermeture (Échap, croix, Annuler) demande « Abandonner les modifications ? ».
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
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const discard = useDiscardGuard();
  const forPicker = useEscapeCascade();
  const { setDirty, guard: guardAction, reset } = discard;

  const guard = useMemo<DialogGuard>(
    () => ({
      setDirty,
      requestClose: (then) => guardAction(then ?? (() => onOpenChangeRef.current(false))),
      refocus: () => {
        // Après les effets du rendu : la fermeture d'une confirmation imbriquée
        // (« Abandonner ») rend d'abord le focus à un élément retiré.
        setTimeout(() => {
          const dialog = ref.current;
          const active = document.activeElement;
          // WebKit rend le focus à la fenêtre elle-même : le premier champ est préféré.
          if (dialog?.open && (active === dialog || !dialog.contains(active))) {
            focusInitial(dialog);
          }
        });
      },
    }),
    [setDirty, guardAction],
  );

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      focusInitial(dialog);
    }
    if (!open && dialog.open) dialog.close();
    if (!open) reset();
  }, [open, reset]);

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    // Une fenêtre imbriquée (confirmation) ou une bulle a déjà traité la touche.
    if (event.key === "Escape" && event.defaultPrevented) return;
    const picker = forPicker(event);
    if (event.key !== "Escape") return;
    // Pas de fermeture native : elle démonterait la saisie sans confirmation.
    event.preventDefault();
    if (!picker) guard.requestClose();
  };

  return (
    <dialog
      ref={ref}
      tabIndex={-1}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onKeyDown={onKeyDown}
      onCancel={(event) => event.preventDefault()}
      // React propage `close` dans l'arbre des composants : seule la fermeture
      // de cette fenêtre compte, pas celle d'une fenêtre imbriquée (confirmation).
      onClose={(event) => event.target === event.currentTarget && open && onOpenChange(false)}
      className={cn(
        "m-auto w-full max-w-lg rounded-xl border bg-background p-0 text-foreground shadow-lg outline-none backdrop:bg-black/50",
        className,
      )}
    >
      {open && (
        <DialogGuardContext.Provider value={guard}>
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
                onClick={() => guard.requestClose()}
                className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Fermer"
              >
                <XIcon className="size-4" aria-hidden />
              </button>
            </div>
            <div data-dialog-body className="overflow-y-auto px-6 py-4">
              {children}
            </div>
            {footer && (
              <div
                data-dialog-footer
                className="flex flex-wrap justify-end gap-2 border-t px-6 py-4"
              >
                {footer}
              </div>
            )}
          </div>
          {discard.confirmation}
        </DialogGuardContext.Provider>
      )}
    </dialog>
  );
}

/**
 * Confirmation « Abandonner les modifications ? » : « Continuer la saisie »
 * a le focus (un Entrée réflexe ne jette rien), Échap y revient aussi.
 */
export function DiscardChangesDialog({
  open,
  onContinue,
  onDiscard,
}: {
  open: boolean;
  onContinue: () => void;
  onDiscard: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => !isOpen && onContinue()}
      title="Abandonner les modifications ?"
      className="max-w-md"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onDiscard}>
            Abandonner
          </Button>
          <Button type="button" data-autofocus onClick={onContinue}>
            Continuer la saisie
          </Button>
        </>
      }
    >
      <p className="text-sm">Les informations saisies dans cette fenêtre seront perdues.</p>
    </Dialog>
  );
}

/**
 * Déclare à la fenêtre qui contient le formulaire que sa saisie est modifiée.
 * Sans fenêtre (fiche affichée dans la page), l'appel est sans effet. Un
 * formulaire monté dans une fenêtre déjà ouverte (contenu remplacé) y
 * rappelle le focus initial.
 */
export function useDirtyGuard(dirty: boolean) {
  const guard = useContext(DialogGuardContext);
  useEffect(() => {
    guard?.refocus();
  }, [guard]);
  useEffect(() => {
    guard?.setDirty(dirty);
  }, [guard, dirty]);
  useEffect(() => () => guard?.setDirty(false), [guard]);
}

/**
 * Bouton « Annuler » d'un formulaire : dans une fenêtre, il passe par la garde
 * (confirmation si la saisie est modifiée) avant d'appeler `onCancel`.
 */
export function useGuardedCancel(onCancel: () => void): () => void;
export function useGuardedCancel(onCancel: (() => void) | undefined): (() => void) | undefined;
export function useGuardedCancel(onCancel: (() => void) | undefined): (() => void) | undefined {
  const guard = useContext(DialogGuardContext);
  if (!onCancel) return undefined;
  return guard ? () => guard.requestClose(onCancel) : onCancel;
}
