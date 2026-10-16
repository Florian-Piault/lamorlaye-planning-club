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
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  decideSuggestion,
  pendingOnShow,
  QUEUE_WINDOW,
  SUGGESTION_WINDOW,
  showQueued,
  type ToastClosing,
} from "./suggestion";

/** Durée d'affichage d'un succès ; une erreur reste jusqu'à sa fermeture. */
export const SUCCESS_DURATION = 4000;

/** Durée d'affichage d'un toast portant la suite du guidage (« Étape suivante »). */
export const STEP_DURATION = 8000;

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
  /** Instant d'affichage (ms). */
  shownAt: number;
  /**
   * Porte la suite du guidage : affiché plus longtemps, retiré à l'ouverture
   * d'une fenêtre modale (la suite ferait quitter la saisie).
   */
  step?: boolean;
}

interface Suggestion {
  message: string;
  action: ToastAction;
  until: number;
}

interface ToastApi {
  /** Affiche un succès ; renvoie son identifiant (pour `dismiss`). */
  success: (message: string, options?: ToastOptions) => number;
  /** Affiche une erreur ; renvoie son identifiant (pour `dismiss`). */
  error: (message: string, options?: ToastOptions) => number;
  /** Ferme le toast affiché ; avec `id`, seulement s'il est encore celui-là. */
  dismiss: (id?: number) => void;
  /**
   * Propose une suite (« Étape suivante » du guidage) sans masquer la
   * confirmation de l'écran ni son action : règles de `suggestion.ts`. Rien
   * n'est proposé pendant qu'une fenêtre modale est ouverte.
   */
  suggest: (message: string, action: ToastAction) => void;
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
  /** Suite en attente de la confirmation de l'écran (`defer`). */
  const pending = useRef<(Suggestion & { timer: ReturnType<typeof setTimeout> }) | null>(null);
  /** Suite qui s'affichera après le toast affiché (`queue`). */
  const queued = useRef<Suggestion | null>(null);
  const dialog = useToastContainer();
  /** Fermeture avec sa raison, pour la vue du toast. */
  const closeRef = useRef<(id: number, reason: ToastClosing) => void>(() => {});

  const replace = useCallback((next: ToastMessage | null) => {
    const previous = current.current;
    current.current = next;
    setToast(next);
    previous?.onDismiss?.();
  }, []);

  const api = useMemo<ToastApi>(() => {
    const clearPending = () => {
      if (pending.current) clearTimeout(pending.current.timer);
      pending.current = null;
    };
    const queue = (suggestion: Omit<Suggestion, "until">, now: number) => {
      queued.current = { ...suggestion, until: now + QUEUE_WINDOW };
    };
    const show = (
      kind: ToastMessage["kind"],
      message: string,
      options?: ToastOptions,
      step = false,
    ) => {
      const now = Date.now();
      const id = ++counter.current;
      let action = options?.action;
      const waiting = pending.current;
      const fate = pendingOnShow(waiting?.until ?? null, now, kind, action !== undefined);
      clearPending();
      if (waiting && fate === "take") {
        action = waiting.action;
        step = true;
      } else if (waiting && fate === "queue") {
        queue(waiting, now);
      }
      replace({ ...options, action, id, kind, message, shownAt: now, step });
      return id;
    };
    const close = (id: number | undefined, reason: ToastClosing) => {
      const closing = current.current;
      if (id !== undefined && closing?.id !== id) return;
      replace(null);
      clearPending();
      const next = queued.current;
      queued.current = null;
      // La suite fermée (ou suivie) n'est pas reproposée ; celle en attente
      // derrière un autre toast s'affiche à sa fermeture, après son action
      // (qui peut afficher son propre toast : la suite attend alors encore).
      if (closing?.step || !next) return;
      setTimeout(() => {
        if (current.current) {
          queued.current ??= next;
          return;
        }
        if (showQueued(next.until, Date.now(), topDialog() !== null, reason)) {
          show("success", next.message, { action: next.action }, true);
        }
      });
    };
    closeRef.current = close;
    const dismiss = (id?: number) => close(id, "user");
    return {
      success: (message, options) => show("success", message, options),
      error: (message, options) => show("error", message, options),
      dismiss,
      suggest: (message, action) => {
        const now = Date.now();
        const shown = current.current;
        const decision = decideSuggestion(
          shown && { kind: shown.kind, hasAction: Boolean(shown.action), shownAt: shown.shownAt },
          now,
          topDialog() !== null,
        );
        if (decision === "attach" && shown) {
          // Même toast, complété par l'action.
          current.current = { ...shown, action, step: true };
          setToast(current.current);
        } else if (decision === "show") {
          show("success", message, { action }, true);
        } else if (decision === "queue") {
          queue({ message, action }, now);
        } else if (decision === "defer") {
          clearPending();
          const suggestion = { message, action, until: now + SUGGESTION_WINDOW };
          const timer = setTimeout(() => {
            if (pending.current?.timer !== timer) return;
            pending.current = null;
            if (topDialog()) return;
            if (current.current) queue(suggestion, Date.now());
            else show("success", message, { action }, true);
          }, SUGGESTION_WINDOW);
          pending.current = { ...suggestion, timer };
        }
      },
    };
  }, [replace]);

  // Une fenêtre modale s'ouvre : la suite du guidage ferait quitter la saisie.
  useEffect(() => {
    if (dialog && current.current?.step) {
      queued.current = null;
      replace(null);
    }
  }, [dialog, replace]);

  const closeToast = useCallback(
    (id: number, reason: ToastClosing) => closeRef.current(id, reason),
    [],
  );
  const view = (kind: ToastMessage["kind"]) =>
    toast?.kind === kind && <ToastView key={toast.id} toast={toast} onClose={closeToast} />;
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

const silent: ToastApi = {
  success: () => 0,
  error: () => 0,
  dismiss: () => {},
  suggest: () => {},
};

function ToastView({
  toast,
  onClose,
}: {
  toast: ToastMessage;
  onClose: (id: number, reason: ToastClosing) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const error = toast.kind === "error";
  const close = useCallback(
    (reason: ToastClosing = "user") => onClose(toast.id, reason),
    [onClose, toast.id],
  );

  useEffect(() => {
    if (error || hovered || focused) return;
    const timer = setTimeout(() => close("timeout"), toast.step ? STEP_DURATION : SUCCESS_DURATION);
    return () => clearTimeout(timer);
  }, [error, hovered, focused, close, toast.step]);

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
            close("action");
            toast.action?.run();
          }}
        >
          {toast.action.label}
        </button>
      )}
      <Tooltip content="Masquer le message" describe={false}>
        <button
          type="button"
          aria-label="Masquer le message"
          className="shrink-0 rounded opacity-80 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => close("user")}
        >
          <X className="size-4" aria-hidden />
        </button>
      </Tooltip>
    </div>
  );
}
