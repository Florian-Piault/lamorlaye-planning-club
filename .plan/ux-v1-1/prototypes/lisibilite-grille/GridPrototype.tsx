/**
 * PROTOTYPE jetable — ticket « Lisibilité de la grille »
 * (.plan/ux-v1-1/issues/12-lisibilite-grille.md).
 *
 * Trois variantes montées dans la vraie page Planning, commutables par la
 * barre rose en bas (ou Alt+←/→, ou `?variant=A|B|C`) :
 *   A. Tout tient en largeur : plus de défilement horizontal, le contenu des
 *      cours s'adapte à la place (nom complet, abrégé, initiales).
 *   B. Un jour à la fois : bascule « Semaine / Jour » et bande des jours
 *      (avec le nombre de cours) ; un jour affiché en grand.
 *   C. Zoom et accès aux jours : la semaine défile, mais une loupe règle la
 *      taille, une bande des jours amène au jour voulu (dimanche compris) et
 *      le panneau latéral se replie.
 * Commun aux trois : en-têtes de courts au vrai nom (abrégé si étroit), icône
 * soleil expliquée, fiche complète du cours au survol (à la place du `title`).
 *
 * La barre propose « Données denses » (5 courts, 7 jours, ~60 cours ; base en
 * mémoire en navigateur). À retirer une fois la variante choisie.
 */
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  House,
  ListFilter,
  Maximize2,
  Minimize2,
  Minus,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Sun,
} from "lucide-react";
import { type ReactNode, type RefObject, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useSeason } from "@/app/season";
import type { Db } from "@/db";
import { useDatabase } from "@/db/DatabaseProvider";
import { createCourt } from "@/db/repositories/courts";
import { createGroup } from "@/db/repositories/groups";
import { createInstructor, replaceAvailabilities } from "@/db/repositories/instructors";
import type { Court } from "@/db/schema";
import { lessons } from "@/db/schema";
import { weekdayLabel } from "@/domain/time";
import { cn } from "@/lib/utils";
import { seedSeason } from "@/test/fixtures";
import { fitColumnWidth, type GridGeometry } from "../planning/grid/geometry";

// --- État du prototype ------------------------------------------------------

export type Variant = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I";
const VARIANTS: readonly Variant[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
const NAMES: Record<Variant, string> = {
  A: "Tout tient en largeur",
  B: "Un jour à la fois",
  C: "Zoom et accès aux jours",
  D: "B + C, tout repliable",
  E: "B + C, une seule barre",
  F: "B + C, plein écran",
  G: "E, navigation dans la barre des jours",
  H: "E, navigation dans le bandeau",
  I: "E, flèches dans le choix du mode",
};

/** Troisième tour (G, H, I) : E, avec la navigation des semaines déplacée. */
const isE = (p: ProtoState) => ["E", "G", "H", "I"].includes(p.variant);

/** Où se place la navigation des semaines datées. */
export function protoWeekNav(p: ProtoState): "header" | "daybar" | "band" | "inline" {
  if (p.variant === "G") return "daybar";
  if (p.variant === "H") return "band";
  if (p.variant === "I") return "inline";
  return "header";
}

/** Deuxième tour (D, E, F) : base « un jour à la fois » de B et panneau repliable de C. */
const isRound2 = (p: ProtoState) => p.variant === "D" || p.variant === "F" || isE(p);

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function initialVariant(): Variant {
  const fromUrl = new URLSearchParams(window.location.hash.split("?")[1] ?? window.location.search)
    .get("variant")
    ?.toUpperCase();
  const v = fromUrl ?? read("proto-grid-variant") ?? "A";
  return (VARIANTS as readonly string[]).includes(v) ? (v as Variant) : "A";
}

interface ProtoState {
  variant: Variant;
  /** B : semaine entière ou un seul jour. */
  dayMode: "week" | "day";
  focusDay: number;
  /** C : niveau de zoom (0 = vue d'ensemble, 1 = normal, 2 = grand). */
  zoom: number;
  /** C : panneau latéral replié. */
  panelFolded: boolean;
  /** D, E : menu de l'application réduit aux icônes. */
  navCollapsed: boolean;
  /** D : ligne des filtres dépliée. */
  filtersOpen: boolean;
  /** F : plein écran de la grille. */
  fullscreen: boolean;
}
let state: ProtoState = {
  variant: initialVariant(),
  dayMode: (read("proto-grid-daymode") as "week" | "day") ?? "week",
  focusDay: 1,
  zoom: 1,
  panelFolded: false,
  navCollapsed: read("proto-grid-nav") === "1",
  filtersOpen: false,
  fullscreen: false,
};
const listeners = new Set<() => void>();
export function setProto(patch: Partial<ProtoState>) {
  state = { ...state, ...patch };
  write("proto-grid-variant", state.variant);
  write("proto-grid-daymode", state.dayMode);
  write("proto-grid-nav", state.navCollapsed ? "1" : "0");
  for (const l of listeners) l();
}
export function useProto() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

// --- Géométrie selon la variante ------------------------------------------

const ZOOMS = [
  { label: "Vue d'ensemble", min: 22, hour: 36 },
  { label: "Normal", min: 64, hour: 48 },
  { label: "Grand", min: 120, hour: 64 },
] as const;

/** Largeur des sous-colonnes selon la variante. */
export function protoColumnWidth(p: ProtoState, available: number, columns: number): number {
  if (p.variant === "A") return fitColumnWidth(available, columns, 8);
  if (p.variant === "C") return fitColumnWidth(available, columns, ZOOMS[p.zoom]?.min ?? 64);
  return fitColumnWidth(available, columns);
}

export function protoHourHeight(p: ProtoState): number {
  return p.variant === "C" ? (ZOOMS[p.zoom]?.hour ?? 48) : 48;
}

/** Jours affichés : B en mode « Jour » n'en garde qu'un. */
export function protoWeekdays(p: ProtoState, weekdays: readonly number[]): readonly number[] {
  if ((p.variant !== "B" && !isRound2(p)) || p.dayMode !== "day") return weekdays;
  return weekdays.includes(p.focusDay) ? [p.focusDay] : weekdays.slice(0, 1);
}

export function protoPanelFolded(p: ProtoState): boolean {
  if (p.variant === "F" && p.fullscreen) return true;
  return (p.variant === "C" || isRound2(p)) && p.panelFolded;
}

/** Menu de l'application : « full » (normal), « icons » (réduit) ou « hidden ». */
export function protoNav(p: ProtoState): "full" | "icons" | "hidden" {
  if (p.variant === "F" && p.fullscreen) return "hidden";
  return isRound2(p) && p.navCollapsed ? "icons" : "full";
}

/** Barre haute (fil d'Ariane, saison) masquée sur le Planning. */
export function protoHideTopBar(p: ProtoState): boolean {
  return isE(p) || (p.variant === "F" && p.fullscreen);
}

/** Ligne des filtres affichée sous l'en-tête. */
export function protoShowFilters(p: ProtoState): boolean {
  if (p.variant === "D") return p.filtersOpen;
  if (isE(p)) return false;
  if (p.variant === "F") return !p.fullscreen;
  return true;
}

/** E : en-tête sur une ligne (titre masqué, boutons en icônes, pastilles réduites). */
export function protoCompact(p: ProtoState): boolean {
  return isE(p);
}

/** Bandeau de mode sur une seule ligne fine. */
export function protoSlimModeBar(p: ProtoState): boolean {
  return isE(p) || (p.variant === "F" && p.fullscreen);
}

/** Rail du panneau replié : retiré pour E et suivantes (le bouton de la barre suffit). */
export function protoShowRail(p: ProtoState): boolean {
  return !isE(p);
}

/** Bouton qui réduit le menu de l'application (bas du menu). */
export function NavCollapseButton({ collapsed }: { collapsed: boolean }) {
  const p = useProto();
  if (!isRound2(p)) return null;
  return (
    <button
      type="button"
      title={collapsed ? "Déplier le menu" : "Réduire le menu"}
      onClick={() => setProto({ navCollapsed: !collapsed })}
      className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-sidebar-foreground/75 text-sm hover:bg-sidebar-accent"
    >
      {collapsed ? (
        <ChevronsRight aria-hidden className="size-4" />
      ) : (
        <ChevronsLeft aria-hidden className="size-4" />
      )}
      {!collapsed && "Réduire le menu"}
    </button>
  );
}

/** E : bouton « Filtres » de l'en-tête, qui ouvre les filtres en menu déroulant. */
export function FiltersPopover({ active, children }: { active: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs hover:bg-muted",
          active > 0 && "border-primary bg-accent",
        )}
      >
        <ListFilter aria-hidden className="size-3.5" />
        Filtres
        {active > 0 && (
          <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
            {active}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute top-full right-0 z-40 mt-1 w-[34rem] max-w-[80vw] rounded-md border bg-card shadow-lg">
          {children}
        </div>
      )}
    </div>
  );
}

// --- En-têtes -------------------------------------------------------------

const SHORT_DAYS = ["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."];

/** « Terre battue 1 » → « TB1 », « Central » → « Cent. », « Court 2 » → « C2 ». */
function courtShort(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return name.length > 5 ? `${name.slice(0, 4)}.` : name;
  return words.map((w) => (/^\d+$/.test(w) ? w : (w[0] ?? "").toUpperCase())).join("");
}

export function CourtHeader({ court, width }: { court: Court | undefined; width: number }) {
  const name = court?.name ?? "Court";
  const outdoor = court?.kind === "outdoor";
  const label = width >= 34 + name.length * 6 ? name : courtShort(name);
  const kind = outdoor ? "court extérieur (en plein air)" : "court couvert";
  const Icon = outdoor ? Sun : House;
  return (
    <div
      title={`${name} — ${kind}`}
      className="flex items-center justify-center gap-0.5 overflow-hidden px-0.5 pb-1 text-[11px] text-muted-foreground"
      style={{ width }}
    >
      {width >= 30 && (
        <Icon
          aria-hidden
          className={cn("size-3 shrink-0", outdoor ? "text-amber-500" : "opacity-60")}
        />
      )}
      <span className={cn("truncate", width < 26 && "text-[10px] tracking-tighter")}>
        {width >= 26 ? label : courtShort(name).slice(0, width >= 16 ? 3 : 1)}
      </span>
      <span className="sr-only">({kind})</span>
    </div>
  );
}

/** Libellé de jour raccourci si la colonne est étroite ; cliquable en B. */
export function DayHeading({
  weekday,
  label,
  width,
}: {
  weekday: number;
  label: string;
  width: number;
}) {
  const p = useProto();
  const short =
    width < 130 ? label.replace(weekdayLabel(weekday), SHORT_DAYS[weekday - 1] ?? "") : label;
  const text = width < 46 ? (SHORT_DAYS[weekday - 1] ?? "").slice(0, 2) : short;
  if ((p.variant === "B" || isRound2(p)) && p.dayMode === "week") {
    return (
      <button
        type="button"
        title={`Afficher le ${weekdayLabel(weekday).toLowerCase()} seul`}
        onClick={() => setProto({ dayMode: "day", focusDay: weekday })}
        className="w-full truncate rounded hover:bg-muted hover:underline"
      >
        {text}
      </button>
    );
  }
  return <span title={label}>{text}</span>;
}

/** Légende des icônes de court, affichée sous les filtres. */
function CourtKindLegend() {
  return (
    <span className="flex items-center gap-2 text-muted-foreground text-xs">
      <span className="flex items-center gap-1">
        <House aria-hidden className="size-3 opacity-60" /> couvert
      </span>
      <span className="flex items-center gap-1">
        <Sun aria-hidden className="size-3 text-amber-500" /> extérieur
      </span>
    </span>
  );
}

// --- Contenu des cours ----------------------------------------------------

function groupInitials(name: string): string {
  return name
    .split(/[\s-]+/)
    .filter((w) => /^[\p{L}\d]/u.test(w))
    .map((w) => (/^\d/.test(w) ? w : (w[0] ?? "").toUpperCase()))
    .join("")
    .slice(0, 3);
}

/**
 * Contenu d'un cours. En A (et en C « vue d'ensemble »), il s'adapte à la
 * largeur : nom sur deux lignes puis heure de début, ou initiales seules.
 */
export function ProtoLessonContent({
  groupName,
  timeLabel,
  detail,
  warning,
  marker,
  width,
  height,
}: {
  groupName: string;
  timeLabel: string;
  detail: string;
  warning: boolean;
  marker: string | null;
  width: number;
  height: number;
}) {
  const p = useProto();
  const adaptive = p.variant === "A" || (p.variant === "C" && p.zoom === 0);
  const badges = (warning || marker) && (
    <span className="absolute top-0.5 right-1 flex gap-0.5 text-xs no-underline" aria-hidden>
      {marker && <span data-testid="lesson-marker">{marker}</span>}
      {warning && <span>⚠</span>}
    </span>
  );
  const start = timeLabel.split("–")[0] ?? timeLabel;
  if (!adaptive || width >= 78) {
    return (
      <>
        <div className={cn("pr-3 font-semibold", height >= 52 ? "line-clamp-2" : "truncate")}>
          {groupName}
        </div>
        <div className="truncate">{timeLabel}</div>
        <div className="truncate">{detail}</div>
        {badges}
      </>
    );
  }
  if (width >= 40) {
    return (
      <>
        <div className="line-clamp-2 break-words font-semibold text-[10px] leading-[1.15]">
          {groupName}
        </div>
        <div className="truncate text-[10px]">{start}</div>
        {badges}
      </>
    );
  }
  if (width < 20) {
    // Trop étroit pour du texte : la couleur seule, le détail au survol.
    return warning ? (
      <span aria-hidden className="-mx-1 block text-center text-[9px]">
        ⚠
      </span>
    ) : null;
  }
  return (
    <div className="-mx-1 flex flex-col items-center text-[10px] leading-tight">
      <span className="font-semibold">{groupInitials(groupName)}</span>
      {height >= 40 && <span className="opacity-80">{start.replace(":00", "h")}</span>}
      {warning && <span aria-hidden>⚠</span>}
    </div>
  );
}

// --- Fiche au survol (commune) --------------------------------------------

let hover: { title: string; color: string; rect: DOMRect } | null = null;
const hoverListeners = new Set<() => void>();
let hoverTimer: ReturnType<typeof setTimeout> | undefined;
function setHover(next: typeof hover) {
  hover = next;
  for (const l of hoverListeners) l();
}

export function lessonHoverHandlers(title: string, color: string) {
  return {
    onMouseEnter: (e: { currentTarget: HTMLElement }) => {
      const el = e.currentTarget;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(
        () => setHover({ title, color, rect: el.getBoundingClientRect() }),
        350,
      );
    },
    onMouseLeave: () => {
      clearTimeout(hoverTimer);
      setHover(null);
    },
  };
}

export function LessonHoverCard() {
  const h = useSyncExternalStore(
    (l) => {
      hoverListeners.add(l);
      return () => hoverListeners.delete(l);
    },
    () => hover,
  );
  useEffect(() => {
    const hide = () => {
      clearTimeout(hoverTimer);
      setHover(null);
    };
    window.addEventListener("pointerdown", hide, { capture: true });
    window.addEventListener("wheel", hide, { capture: true, passive: true });
    return () => {
      window.removeEventListener("pointerdown", hide, { capture: true });
      window.removeEventListener("wheel", hide, { capture: true });
    };
  }, []);
  if (!h) return null;
  const [first, ...rest] = h.title.split("\n");
  const width = 240;
  const right = h.rect.right + 8 + width < window.innerWidth;
  const left = right ? h.rect.right + 8 : Math.max(8, h.rect.left - 8 - width);
  const top = Math.min(h.rect.top, window.innerHeight - 160);
  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[60] rounded-md border bg-popover p-2.5 text-popover-foreground text-xs shadow-lg"
      style={{ left, top, width, borderLeft: `4px solid ${h.color}` }}
    >
      <div className="mb-1 font-semibold text-sm">{first}</div>
      {rest.map((line) => (
        <div key={line} className={cn(line.startsWith("⚠") && "text-destructive")}>
          {line}
        </div>
      ))}
    </div>,
    document.body,
  );
}

// --- Barre au-dessus de la grille (B et C) --------------------------------

export function GridProtoBar({
  allWeekdays,
  itemWeekdays,
  dayHeading,
  geometry,
  scrollerRef,
  filterCount = 0,
  weekNav,
}: {
  filterCount?: number;
  weekNav?: ReactNode;
  allWeekdays: readonly number[];
  itemWeekdays: readonly number[];
  dayHeading: (weekday: number) => string;
  geometry: GridGeometry;
  scrollerRef: RefObject<HTMLDivElement | null>;
}) {
  const p = useProto();
  const visible = useVisibleDays(geometry, scrollerRef);
  const counts = new Map<number, number>();
  for (const w of itemWeekdays) counts.set(w, (counts.get(w) ?? 0) + 1);

  if (p.variant === "A") {
    return (
      <div className="flex h-8 items-center gap-3 border-b px-4">
        <CourtKindLegend />
        <span className="text-muted-foreground text-xs">
          · survolez un cours pour voir son détail complet
        </span>
      </div>
    );
  }

  if (p.variant === "B" || isRound2(p)) {
    const focus = allWeekdays.includes(p.focusDay) ? p.focusDay : (allWeekdays[0] ?? 1);
    const index = allWeekdays.indexOf(focus);
    const go = (d: number) =>
      setProto({
        dayMode: "day",
        focusDay: allWeekdays[(index + d + allWeekdays.length) % allWeekdays.length] ?? focus,
      });
    return (
      <div className="flex min-h-10 flex-wrap items-center gap-x-2 gap-y-1 border-b px-4 py-1">
        {weekNav}
        {weekNav && <span className="mx-1 h-5 border-l" aria-hidden />}
        <div className="flex rounded-md border p-0.5 text-xs">
          {(["week", "day"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setProto({ dayMode: m, focusDay: focus })}
              className={cn(
                "rounded px-2 py-0.5",
                p.dayMode === m ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {m === "week" ? "Semaine" : "Jour"}
            </button>
          ))}
        </div>
        {p.dayMode === "day" && (
          <button type="button" aria-label="Jour précédent" onClick={() => go(-1)}>
            <ChevronLeft className="size-4" />
          </button>
        )}
        <div className="flex gap-1">
          {allWeekdays.map((w) => {
            const active = p.dayMode === "day" && w === focus;
            return (
              <button
                key={w}
                type="button"
                onClick={() => setProto({ dayMode: "day", focusDay: w })}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
                  active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {SHORT_DAYS[w - 1]}
                <span
                  className={cn(
                    "rounded-full px-1 text-[10px]",
                    active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground",
                  )}
                >
                  {counts.get(w) ?? 0}
                </span>
              </button>
            );
          })}
        </div>
        {p.dayMode === "day" && (
          <button type="button" aria-label="Jour suivant" onClick={() => go(1)}>
            <ChevronRight className="size-4" />
          </button>
        )}
        {p.dayMode === "day" && <span className="font-semibold text-sm">{dayHeading(focus)}</span>}
        <span className="ml-auto flex items-center gap-2">
          <CourtKindLegend />
          {p.variant === "D" && (
            <button
              type="button"
              aria-expanded={p.filtersOpen}
              onClick={() => setProto({ filtersOpen: !p.filtersOpen })}
              className={cn(
                "flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs hover:bg-muted",
                filterCount > 0 && "border-primary bg-accent",
              )}
            >
              <ListFilter aria-hidden className="size-3.5" />
              Filtres
              {filterCount > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                  {filterCount}
                </span>
              )}
            </button>
          )}
          {p.variant === "F" && (
            <button
              type="button"
              onClick={() => setProto({ fullscreen: !p.fullscreen })}
              className="flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs hover:bg-muted"
            >
              {p.fullscreen ? (
                <Minimize2 aria-hidden className="size-3.5" />
              ) : (
                <Maximize2 aria-hidden className="size-3.5" />
              )}
              {p.fullscreen ? "Quitter le plein écran" : "Plein écran"}
            </button>
          )}
          {isRound2(p) && !(p.variant === "F" && p.fullscreen) && <PanelFoldButton />}
        </span>
      </div>
    );
  }

  // C
  const dayWidth = geometry.courtIds.length * geometry.columnWidth;
  const goTo = (w: number) => {
    const i = geometry.weekdays.indexOf(w);
    scrollerRef.current?.scrollTo({ left: i * dayWidth, behavior: "smooth" });
  };
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-x-2 gap-y-1 border-b px-4 py-1">
      <CalendarDays aria-hidden className="size-4 text-muted-foreground" />
      <div className="flex gap-1">
        {allWeekdays.map((w) => {
          const seen = visible.has(w);
          return (
            <button
              key={w}
              type="button"
              onClick={() => goTo(w)}
              title={seen ? "Visible à l'écran" : "Hors de l'écran : cliquer pour y aller"}
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs",
                seen
                  ? "border-primary/40 bg-primary/10 font-medium"
                  : "border-dashed opacity-70 hover:bg-muted",
              )}
            >
              {SHORT_DAYS[w - 1]}
              {!seen && " →"}
            </button>
          );
        })}
      </div>
      <div className="ml-3 flex items-center gap-1 rounded-md border px-1 text-xs">
        <button
          type="button"
          aria-label="Réduire"
          disabled={p.zoom === 0}
          onClick={() => setProto({ zoom: p.zoom - 1 })}
          className="p-1 disabled:opacity-30"
        >
          <Minus className="size-3.5" />
        </button>
        <span className="w-24 text-center">{ZOOMS[p.zoom]?.label}</span>
        <button
          type="button"
          aria-label="Agrandir"
          disabled={p.zoom === ZOOMS.length - 1}
          onClick={() => setProto({ zoom: p.zoom + 1 })}
          className="p-1 disabled:opacity-30"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      <span className="ml-auto flex items-center gap-3">
        <CourtKindLegend />
        <PanelFoldButton />
      </span>
    </div>
  );
}

function PanelFoldButton() {
  const p = useProto();
  return (
    <button
      type="button"
      onClick={() => setProto({ panelFolded: !p.panelFolded })}
      title={p.panelFolded ? "Afficher le panneau" : "Replier le panneau"}
      className="flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs hover:bg-muted"
    >
      {p.panelFolded ? (
        <PanelRightOpen aria-hidden className="size-3.5" />
      ) : (
        <PanelRightClose aria-hidden className="size-3.5" />
      )}
      <span className={cn(isE(p) && "sr-only")}>
        {p.panelFolded ? "Afficher le panneau" : "Replier le panneau"}
      </span>
    </button>
  );
}

/** Jours dont au moins la moitié est visible dans la zone qui défile. */
function useVisibleDays(geometry: GridGeometry, scrollerRef: RefObject<HTMLDivElement | null>) {
  const [range, setRange] = useState({ left: 0, width: 0 });
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => setRange({ left: el.scrollLeft, width: el.clientWidth - 48 });
    measure();
    const frame = requestAnimationFrame(measure);
    el.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [scrollerRef, geometry.columnWidth]);
  const dayWidth = geometry.courtIds.length * geometry.columnWidth;
  const set = new Set<number>();
  geometry.weekdays.forEach((w, i) => {
    const mid = i * dayWidth + dayWidth / 2;
    if (mid >= range.left && mid <= range.left + range.width) set.add(w);
  });
  return set;
}

/** Rail du panneau replié (C). */
export function FoldedPanelRail() {
  return (
    <aside
      aria-label="Panneau latéral replié"
      className="flex w-9 shrink-0 flex-col items-center border-l bg-card pt-2"
    >
      <button
        type="button"
        title="Afficher le panneau"
        onClick={() => setProto({ panelFolded: false, fullscreen: false })}
        className="rounded p-1 hover:bg-muted"
      >
        <PanelRightOpen className="size-4" />
      </button>
    </aside>
  );
}

// --- Barre rose -----------------------------------------------------------

export function PrototypeSwitcher() {
  const { variant } = useProto();
  const { db } = useDatabase();
  const { reload, activeSeason } = useSeason();
  const [seeding, setSeeding] = useState(false);
  const cycle = (d: number) => {
    const i = VARIANTS.indexOf(variant);
    setProto({ variant: VARIANTS[(i + d + VARIANTS.length) % VARIANTS.length] });
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
      e.preventDefault();
      e.stopPropagation();
      cycle(e.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  });
  if (import.meta.env.PROD) return null;
  const seed = async () => {
    setSeeding(true);
    const season = await seedSeason(db);
    await seedDense(db, season.id);
    reload();
    setSeeding(false);
  };
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-pink-600 px-3 py-1.5 text-white text-xs shadow-lg">
      <button type="button" aria-label="Variante précédente" onClick={() => cycle(-1)}>
        <ChevronLeft className="size-4" />
      </button>
      <span className="font-semibold">
        {variant} · {NAMES[variant]}
      </span>
      <button type="button" aria-label="Variante suivante" onClick={() => cycle(1)}>
        <ChevronRight className="size-4" />
      </button>
      {!activeSeason && (
        <>
          <span className="opacity-50">|</span>
          <button type="button" onClick={seed} disabled={seeding} className="underline">
            Données denses
          </button>
        </>
      )}
      <span className="opacity-50">|</span>
      <span className="opacity-80">{window.innerWidth} px</span>
    </div>
  );
}

// --- Données denses -------------------------------------------------------

async function seedDense(db: Db, seasonId: string) {
  const courtIds: string[] = [];
  for (const [name, kind] of [
    ["Central", "indoor"],
    ["Court 2", "indoor"],
    ["Court 3", "outdoor"],
    ["Terre battue 1", "outdoor"],
    ["Terre battue 2", "outdoor"],
  ] as const) {
    courtIds.push(await createCourt(db, seasonId, { name, kind, active: true }));
  }
  const people = [
    ["Julie", "Martin", "#1D4ED8"],
    ["Karim", "Benali", "#C2410C"],
    ["Sophie", "Leroy", "#15803D"],
    ["Marc", "Durand", "#7E22CE"],
  ] as const;
  const instructorIds: string[] = [];
  for (const [firstName, lastName, color] of people) {
    instructorIds.push(
      await createInstructor(db, seasonId, {
        firstName,
        lastName,
        phone: "0600000000",
        email: null,
        color,
        initials: `${firstName[0]}${lastName[0]}`,
        active: true,
      }),
    );
  }
  for (const id of instructorIds) {
    await replaceAvailabilities(
      db,
      id,
      [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, startTime: "08:00", endTime: "22:00" })),
    );
  }
  const groupNames = [
    "Galaxie violet (5-6 ans)",
    "Galaxie rouge",
    "Galaxie orange",
    "Galaxie vert",
    "Ados loisir 11-14",
    "Ados compétition",
    "Adultes débutants",
    "Adultes perfectionnement",
    "Dames du mardi matin",
    "Seniors loisir",
    "Compétition jeunes 15/16",
    "Mini-tennis parents-enfants",
    "Gala de fin d'année",
  ];
  const groupIds: string[] = [];
  for (const name of groupNames) {
    groupIds.push(
      await createGroup(db, seasonId, {
        name,
        levelId: null,
        minAge: null,
        maxAge: null,
        maxSize: 8,
        active: true,
      } as Parameters<typeof createGroup>[2]),
    );
  }
  // Créneaux (jour, début, durée) : soirs de semaine pleins, mercredi et
  // samedi chargés, deux cours le dimanche matin.
  const slots: [number, string, number][] = [];
  for (const day of [1, 2, 4, 5]) {
    slots.push([day, "17:00", 60], [day, "18:00", 90], [day, "19:30", 90]);
  }
  slots.push(
    [3, "09:30", 60],
    [3, "10:30", 90],
    [3, "13:30", 60],
    [3, "14:30", 60],
    [3, "15:30", 90],
  );
  slots.push([6, "09:00", 60], [6, "10:00", 60], [6, "11:00", 90], [6, "14:00", 120]);
  slots.push([7, "10:00", 90]);
  const rows: (typeof lessons.$inferInsert)[] = [];
  slots.forEach(([weekday, startTime, durationMinutes], s) => {
    // 4 moniteurs : 4 cours au plus en même temps ; le samedi occupe les courts 2 à 5.
    const used = weekday === 7 ? [0, 1] : weekday === 6 ? [1, 2, 3, 4] : [0, 1, 2, 3];
    used.forEach((c, k) => {
      rows.push({
        id: crypto.randomUUID(),
        seasonId,
        weekday,
        startTime,
        durationMinutes,
        courtId: courtIds[c] as string,
        groupId: groupIds[(s * 5 + c) % groupIds.length] as string,
        instructorId: instructorIds[(k + s) % instructorIds.length] as string,
        effectiveFrom: "2026-09-01",
        effectiveTo: null,
        previousLessonId: null,
        note: null,
      });
    });
  });
  await db.insert(lessons).values(rows);
}
