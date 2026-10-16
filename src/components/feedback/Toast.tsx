import { CircleAlert, CircleCheck, X } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/** Durée d'affichage d'un succès ; une erreur reste jusqu'à sa fermeture. */
export const SUCCESS_DURATION = 4000;

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface ToastOptions {
  /** Action facultative (« Annuler », « Étape suivante »…) ; elle ferme le toast. */
  action?: ToastAction;
  /** Appelé à la fermeture du toast (par l'utilisatrice, le délai ou un toast suivant). */
  onDismiss?: () => void;
}

interface ToastMessage extends ToastOptions {
  id: number;
  kind: "success" | "error";
  message: string;
}

interface ToastApi {
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  /** Ferme le toast affiché ; avec `id`, seulement s'il est encore celui-là. */
  dismiss: (id?: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/**
 * Fenêtre modale ouverte la plus haute : elle rend le reste du document
 * inerte et le recouvre, les toasts y sont donc rendus (comme les bulles).
 */
function topDialog(): HTMLElement | null {
  const open = document.querySelectorAll<HTMLDialogElement>("dialog[open]");
  return open.length > 0 ? (open[open.length - 1] ?? null) : null;
}

/** Suit l'ouverture et la fermeture des fenêtres modales. */
function useToastContainer(): HTMLElement | null {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const update = () => setContainer(topDialog());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["open"],
    });
    return () => observer.disconnect();
  }, []);
  return container;
}

/**
 * Toast commun à l'application (spec UX v1.1) : en bas à droite, un seul à la
 * fois (le nouveau remplace l'ancien) ; un succès s'efface après ~4 s, en
 * pause tant qu'il est survolé ou focalisé ; une erreur reste jusqu'à sa
 * fermeture. Deux régions `aria-live` toujours présentes : polie pour les
 * succès, assertive pour les erreurs (une seule annonce par message). Quand
 * une fenêtre modale est ouverte, elles sont rendues dans cette fenêtre.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const counter = useRef(0);
  const current = useRef<ToastMessage | null>(null);
  const dialog = useToastContainer();

  const replace = useCallback((next: ToastMessage | null) => {
    const previous = current.current;
    current.current = next;
    setToast(next);
    previous?.onDismiss?.();
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, options) =>
        replace({ ...options, id: ++counter.current, kind: "success", message }),
      error: (message, options) =>
        replace({ ...options, id: ++counter.current, kind: "error", message }),
      dismiss: (id) => {
        if (id === undefined || current.current?.id === id) replace(null);
      },
    }),
    [replace],
  );

  const view = (kind: ToastMessage["kind"]) =>
    toast?.kind === kind && <ToastView key={toast.id} toast={toast} onClose={api.dismiss} />;
  const regions = (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[200] flex max-w-sm flex-col items-end">
      <div aria-live="polite" aria-atomic="true" data-testid="toast-region">
        {view("success")}
      </div>
      <div aria-live="assertive" aria-atomic="true" data-testid="toast-alerts">
        {view("error")}
      </div>
    </div>
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(regions, dialog ?? document.body)}
    </ToastContext.Provider>
  );
}

/** Affiche les toasts ; sans `ToastProvider` (tests isolés), les messages sont ignorés. */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? silent;
}

const silent: ToastApi = { success: () => {}, error: () => {}, dismiss: () => {} };

function ToastView({ toast, onClose }: { toast: ToastMessage; onClose: (id: number) => void }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const error = toast.kind === "error";
  const close = useCallback(() => onClose(toast.id), [onClose, toast.id]);

  useEffect(() => {
    if (error || hovered || focused) return;
    const timer = setTimeout(close, SUCCESS_DURATION);
    return () => clearTimeout(timer);
  }, [error, hovered, focused, close]);

  const Icon = error ? CircleAlert : CircleCheck;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: survol et focus suspendent seulement le délai d'effacement.
    <div
      data-testid="toast"
      data-kind={toast.kind}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
      className={cn(
        "pointer-events-auto flex items-center gap-3 rounded-lg px-3.5 py-2 text-sm shadow-lg",
        error ? "bg-red-700 text-white" : "bg-foreground text-background",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          className={cn(
            "shrink-0 rounded font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            error ? "underline underline-offset-2" : "text-sky-300 dark:text-sky-700",
          )}
          onClick={() => {
            // Fermé d'abord : l'action peut afficher son propre toast (« Annulé : … »).
            close();
            toast.action?.run();
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Masquer le message"
        className="shrink-0 rounded opacity-80 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={close}
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
