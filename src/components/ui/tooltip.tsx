import { Slot } from "@radix-ui/react-slot";
import {
  type FocusEvent,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

/** Délai avant l'apparition au survol ; au clavier, la bulle s'affiche aussitôt. */
export const TOOLTIP_DELAY = 300;

interface TooltipProps {
  /** Texte de la bulle ; rien n'est affiché s'il est vide. */
  content: ReactNode;
  /** Élément déclencheur, unique (il reçoit les gestionnaires de survol et de focus). */
  children: ReactElement;
  /**
   * Relie la bulle au déclencheur (`aria-describedby`). À désactiver quand le
   * même texte est déjà annoncé autrement (raison d'un bouton grisé).
   */
  describe?: boolean;
}

interface Position {
  top: number;
  left: number;
}

const GAP = 6;
const MARGIN = 8;

/**
 * Bulle d'aide commune : au survol après ~300 ms et au focus clavier, fermée
 * par Échap, la sortie du pointeur ou la perte du focus. Rendue dans la
 * fenêtre modale qui contient le déclencheur (couche supérieure), sinon dans
 * le document, en position fixe sous le déclencheur.
 */
export function Tooltip({ content, children, describe = true }: TooltipProps) {
  const id = useId();
  const triggerRef = useRef<HTMLElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  /** Ouverte au clavier : elle suit son déclencheur au défilement au lieu de se fermer. */
  const viaFocus = useRef(false);
  const [scrolled, setScrolled] = useState(0);
  const empty = content === null || content === undefined || content === "" || content === false;

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    viaFocus.current = false;
    setOpen(false);
    setPosition(null);
  }, []);

  const show = useCallback(
    (immediately: boolean) => {
      clearTimeout(timer.current);
      if (empty) return;
      if (immediately) setOpen(true);
      else timer.current = setTimeout(() => setOpen(true), TOOLTIP_DELAY);
    },
    [empty],
  );

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (empty) hide();
  }, [empty, hide]);

  // Échap ferme la bulle (WCAG 1.4.13) et seulement elle : la fenêtre ou le
  // panneau qui la contient ignorent une touche déjà traitée (`defaultPrevented`).
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      hide();
    };
    // Un focus clavier fait souvent défiler la page jusqu'au déclencheur : la
    // bulle le suit alors ; ouverte au survol, elle se ferme au défilement.
    const onScroll = () => {
      if (viaFocus.current) setScrolled((n) => n + 1);
      else hide();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, hide]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: position recalculée à chaque défilement suivi (`scrolled`).
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current?.getBoundingClientRect();
    const bubble = bubbleRef.current?.getBoundingClientRect();
    if (!trigger || !bubble) return;
    const below = trigger.bottom + GAP;
    const top =
      below + bubble.height > window.innerHeight - MARGIN
        ? Math.max(MARGIN, trigger.top - GAP - bubble.height)
        : below;
    const centered = trigger.left + trigger.width / 2 - bubble.width / 2;
    const left = Math.min(
      Math.max(MARGIN, centered),
      Math.max(MARGIN, window.innerWidth - MARGIN - bubble.width),
    );
    setPosition({ top, left });
  }, [open, scrolled]);

  const onFocus = (event: FocusEvent<HTMLElement>) => {
    // Au clavier seulement : un clic qui donne le focus ne fait pas surgir la bulle.
    if (empty || !event.currentTarget.matches(":focus-visible")) return;
    viaFocus.current = true;
    show(true);
  };

  const container = triggerRef.current?.closest("dialog") ?? document.body;

  return (
    <>
      <Slot
        ref={triggerRef}
        onPointerEnter={() => show(false)}
        onPointerLeave={hide}
        onPointerDown={hide}
        onFocus={onFocus}
        onBlur={hide}
        aria-describedby={describe && !empty ? `${id}-description` : undefined}
      >
        {children}
      </Slot>
      {/* Description permanente : annoncée au focus, même avant l'apparition de la bulle. */}
      {describe && !empty && (
        <span id={`${id}-description`} className="sr-only">
          {content}
        </span>
      )}
      {open &&
        !empty &&
        createPortal(
          <div
            ref={bubbleRef}
            role="tooltip"
            id={id}
            data-testid="tooltip"
            style={{
              position: "fixed",
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              visibility: position ? "visible" : "hidden",
            }}
            className="pointer-events-none z-[300] max-w-xs whitespace-normal rounded-md bg-foreground px-2 py-1 text-background text-xs shadow-md"
          >
            {content}
          </div>,
          container,
        )}
    </>
  );
}
