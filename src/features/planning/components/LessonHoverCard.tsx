import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { HoverCardStore, LessonCard } from "../hoverCard";

const WIDTH = 240;
const GAP = 8;

/**
 * Fiche du cours au survol (spec UX v1.1, « Grille »), à la place du `title`
 * natif : nom complet du groupe, jour et horaire, court, moniteur, effectif,
 * avertissements, liseré à la couleur du moniteur. Elle disparaît au clic, au
 * défilement, à la sortie du cours et à Échap. Les lecteurs d'écran ont le
 * même détail par le nom et la description du cours : la fiche leur est masquée.
 */
export function LessonHoverCard({
  store,
  cardOf,
}: {
  store: HoverCardStore;
  cardOf: (id: string) => LessonCard | undefined;
}) {
  const hovered = useSyncExternalStore(store.subscribe, store.get);
  const card = hovered ? cardOf(hovered.id) : undefined;
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  // Grille démontée (changement d'écran) : plus de fiche ni d'écouteurs.
  useEffect(() => () => store.hover(null), [store]);

  useLayoutEffect(() => {
    if (!hovered || !ref.current) {
      setPosition(null);
      return;
    }
    const height = ref.current.getBoundingClientRect().height;
    const { rect } = hovered;
    const right = rect.right + GAP + WIDTH <= window.innerWidth - GAP;
    const left = right ? rect.right + GAP : Math.max(GAP, rect.left - GAP - WIDTH);
    const top = Math.max(GAP, Math.min(rect.top, window.innerHeight - GAP - height));
    setPosition({ top, left });
  }, [hovered]);

  if (!hovered || !card) return null;
  return createPortal(
    <div
      ref={ref}
      aria-hidden
      data-testid="lesson-card"
      data-escape-layer
      className="pointer-events-none fixed z-[250] rounded-md border bg-popover p-2.5 text-popover-foreground text-xs shadow-lg"
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        width: WIDTH,
        borderLeft: `4px solid ${card.color}`,
        visibility: position ? "visible" : "hidden",
      }}
    >
      <p className="mb-1 font-semibold text-sm leading-snug">{card.heading}</p>
      {card.lines.map((line, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: lignes fixes, dans l'ordre, éventuellement identiques.
        <p key={i}>{line}</p>
      ))}
      {card.warnings.map((warning, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: avertissements dans l'ordre, éventuellement identiques.
        <p key={i} className="text-destructive">
          ⚠ {warning}
        </p>
      ))}
    </div>,
    document.body,
  );
}
