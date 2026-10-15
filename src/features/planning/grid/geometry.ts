/**
 * Géométrie de la grille semaine (SPECS.md §4.1, §5.1–5.2) : conversion entre
 * pixels et minutes, magnétisme au pas de 15 min, colonnes jour × court,
 * placement des cours et des hachures.
 *
 * Fonctions pures, sans dépendance au DOM : les coordonnées sont relatives au
 * coin supérieur gauche de la zone des cours (hors en-têtes et axe horaire).
 */
import type { Interval } from "@/domain/availability";

/** Hauteur d'une heure, en pixels. */
export const HOUR_HEIGHT = 48;
/** Pas du magnétisme (et des durées, §3.6). */
export const SNAP_MINUTES = 15;
/** Durée minimale d'un cours créé ou redimensionné à la souris. */
export const MIN_GESTURE_MINUTES = 30;
/** Largeur minimale d'une sous-colonne (court) : en deçà, la grille défile horizontalement. */
export const MIN_COLUMN_WIDTH = 64;
/** Largeur de l'axe horaire. */
export const AXIS_WIDTH = 48;
/** Marge intérieure d'un cours dans sa colonne. */
export const BLOCK_GAP = 2;

export interface GridGeometry {
  /** Amplitude affichée, en minutes depuis minuit. */
  dayStart: number;
  dayEnd: number;
  hourHeight: number;
  columnWidth: number;
  /** Jours affichés (ISO, 1 = lundi), dans l'ordre. */
  weekdays: readonly number[];
  /** Courts affichés, dans l'ordre. */
  courtIds: readonly string[];
}

export interface GridColumn {
  index: number;
  weekday: number;
  courtId: string;
  dayIndex: number;
  courtIndex: number;
  /** Première sous-colonne d'un jour (séparateur marqué). */
  firstOfDay: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function columnCount(g: GridGeometry): number {
  return g.weekdays.length * g.courtIds.length;
}

/** Largeur des sous-colonnes pour une largeur disponible (sans l'axe horaire). */
export function fitColumnWidth(
  available: number,
  columns: number,
  min: number = MIN_COLUMN_WIDTH,
): number {
  if (columns <= 0) return min;
  return Math.max(min, Math.floor(available / columns));
}

export function boardSize(g: GridGeometry): { width: number; height: number } {
  return {
    width: columnCount(g) * g.columnWidth,
    height: ((g.dayEnd - g.dayStart) * g.hourHeight) / 60,
  };
}

export function gridColumns(g: GridGeometry): GridColumn[] {
  return g.weekdays.flatMap((weekday, dayIndex) =>
    g.courtIds.map((courtId, courtIndex) => ({
      index: dayIndex * g.courtIds.length + courtIndex,
      weekday,
      courtId,
      dayIndex,
      courtIndex,
      firstOfDay: courtIndex === 0,
    })),
  );
}

/** Indice de la sous-colonne d'un jour et d'un court (-1 s'ils ne sont pas affichés). */
export function columnIndexOf(g: GridGeometry, weekday: number, courtId: string): number {
  const day = g.weekdays.indexOf(weekday);
  const court = g.courtIds.indexOf(courtId);
  return day < 0 || court < 0 ? -1 : day * g.courtIds.length + court;
}

/** Sous-colonne sous l'abscisse `x` (bornée aux colonnes existantes), ou `null` sans colonne. */
export function columnAt(g: GridGeometry, x: number): GridColumn | null {
  const count = columnCount(g);
  if (count === 0) return null;
  const index = clamp(Math.floor(x / g.columnWidth), 0, count - 1);
  const dayIndex = Math.floor(index / g.courtIds.length);
  const courtIndex = index % g.courtIds.length;
  return {
    index,
    weekday: g.weekdays[dayIndex] as number,
    courtId: g.courtIds[courtIndex] as string,
    dayIndex,
    courtIndex,
    firstOfDay: courtIndex === 0,
  };
}

/** Ordonnée d'une heure (minutes depuis minuit). */
export function minuteToY(g: GridGeometry, minute: number): number {
  return ((minute - g.dayStart) * g.hourHeight) / 60;
}

/** Heure (minutes depuis minuit, non arrondie) d'une ordonnée. */
export function yToMinute(g: GridGeometry, y: number): number {
  return g.dayStart + (y * 60) / g.hourHeight;
}

export type SnapMode = "round" | "floor" | "ceil";

/** Magnétisme au pas de 15 min. */
export function snapMinutes(
  minute: number,
  mode: SnapMode = "round",
  step: number = SNAP_MINUTES,
): number {
  // Petite tolérance : 59,9999 min (erreur d'arrondi des pixels) reste 60.
  const ratio = minute / step;
  const value =
    mode === "floor"
      ? Math.floor(ratio + 1e-6)
      : mode === "ceil"
        ? Math.ceil(ratio - 1e-6)
        : Math.round(ratio);
  return value * step;
}

export interface SlotTarget {
  weekday: number;
  courtId: string;
  /** Début, en minutes depuis minuit. */
  start: number;
  durationMinutes: number;
}

/**
 * Déplacement d'un cours : `grabOffset` est l'écart (minutes) entre le point
 * saisi et le début du cours. Le début est aimanté et borné à l'amplitude.
 */
export function moveTarget(
  g: GridGeometry,
  pointer: Point,
  grabOffset: number,
  durationMinutes: number,
): SlotTarget | null {
  const column = columnAt(g, pointer.x);
  if (!column) return null;
  const latest = Math.max(g.dayStart, g.dayEnd - durationMinutes);
  const start = clamp(snapMinutes(yToMinute(g, pointer.y) - grabOffset), g.dayStart, latest);
  return { weekday: column.weekday, courtId: column.courtId, start, durationMinutes };
}

/** Direction d'un déplacement au clavier (flèches). */
export type KeyboardDirection = "up" | "down" | "left" | "right";

const ARROW_KEYS: Record<string, KeyboardDirection> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

/** Direction associée à une touche (`event.key`), ou `null` si ce n'est pas une flèche. */
export function arrowDirection(key: string): KeyboardDirection | null {
  return ARROW_KEYS[key] ?? null;
}

/**
 * Déplacement d'un cours au clavier (accessibilité, §12.1 dnd-kit) :
 * - haut / bas : 15 min plus tôt / plus tard (1 h avec `large`) ;
 * - gauche / droite : court précédent / suivant, en passant d'un jour à
 *   l'autre après le dernier court ; avec `large`, jour précédent / suivant
 *   sur le même court.
 * Le créneau reste dans l'amplitude et dans les colonnes affichées.
 */
export function keyboardMoveTarget(
  g: GridGeometry,
  slot: SlotTarget,
  direction: KeyboardDirection,
  large = false,
): SlotTarget {
  const sign = direction === "up" || direction === "left" ? -1 : 1;
  if (direction === "up" || direction === "down") {
    const latest = Math.max(g.dayStart, g.dayEnd - slot.durationMinutes);
    const step = large ? 60 : SNAP_MINUTES;
    const start = clamp(snapMinutes(slot.start + sign * step), g.dayStart, latest);
    return { ...slot, start };
  }
  const index = columnIndexOf(g, slot.weekday, slot.courtId);
  const next = index + sign * (large ? g.courtIds.length : 1);
  if (index < 0 || next < 0 || next >= columnCount(g)) return slot;
  const column = columnAt(g, next * g.columnWidth) as GridColumn;
  return { ...slot, weekday: column.weekday, courtId: column.courtId };
}

/** Redimensionnement par le bord inférieur : nouvelle durée aimantée et bornée. */
export function resizeDuration(g: GridGeometry, y: number, start: number): number {
  const end = clamp(
    snapMinutes(yToMinute(g, y)),
    Math.min(start + MIN_GESTURE_MINUTES, g.dayEnd),
    g.dayEnd,
  );
  return Math.max(SNAP_MINUTES, end - start);
}

const SELECTION_TOLERANCE = 3;

/** Sélection verticale (création) entre deux ordonnées : créneau aimanté d'au moins 30 min. */
export function selectionRange(
  g: GridGeometry,
  anchorY: number,
  currentY: number,
): { start: number; end: number } {
  const a = yToMinute(g, Math.min(anchorY, currentY));
  const b = yToMinute(g, Math.max(anchorY, currentY));
  // Tolérance de quelques minutes (2 à 3 px) : partir « sur » la ligne de 9h00
  // à un pixel près ne doit pas commencer à 8h45.
  const start = clamp(
    snapMinutes(a + SELECTION_TOLERANCE, "floor"),
    g.dayStart,
    g.dayEnd - MIN_GESTURE_MINUTES,
  );
  const end = clamp(
    snapMinutes(b - SELECTION_TOLERANCE, "ceil"),
    start + MIN_GESTURE_MINUTES,
    g.dayEnd,
  );
  return { start, end };
}

// ---------------------------------------------------------------------------
// Placement des cours
// ---------------------------------------------------------------------------

export interface PlacedItem {
  id: string;
  weekday: number;
  courtId: string;
  start: number;
  end: number;
}

export interface Lane {
  lane: number;
  lanes: number;
}

/**
 * Répartit côte à côte les cours qui se chevauchent dans une même sous-colonne
 * (court occupé deux fois, signalé en conflit) pour qu'aucun ne soit masqué.
 */
export function assignLanes(items: readonly PlacedItem[]): Map<string, Lane> {
  const result = new Map<string, Lane>();
  const byColumn = new Map<string, PlacedItem[]>();
  for (const item of items) {
    const key = `${item.weekday}|${item.courtId}`;
    const list = byColumn.get(key) ?? [];
    list.push(item);
    byColumn.set(key, list);
  }
  for (const list of byColumn.values()) {
    list.sort((a, b) => a.start - b.start || b.end - a.end || a.id.localeCompare(b.id));
    // Groupes de cours qui se chevauchent de proche en proche.
    let cluster: { item: PlacedItem; lane: number }[] = [];
    let clusterEnd = -Infinity;
    const flush = () => {
      const lanes = Math.max(0, ...cluster.map((c) => c.lane)) + 1;
      for (const c of cluster) result.set(c.item.id, { lane: c.lane, lanes });
      cluster = [];
    };
    for (const item of list) {
      if (item.start >= clusterEnd && cluster.length > 0) flush();
      const laneEnds: number[] = [];
      for (const c of cluster) {
        laneEnds[c.lane] = Math.max(laneEnds[c.lane] ?? -Infinity, c.item.end);
      }
      let lane = laneEnds.findIndex((end) => end <= item.start);
      if (lane < 0) lane = laneEnds.length;
      cluster.push({ item, lane });
      clusterEnd = Math.max(clusterEnd, item.end);
    }
    if (cluster.length > 0) flush();
  }
  return result;
}

/** Rectangle d'un créneau dans la grille (`null` si sa colonne n'est pas affichée). */
export function slotRect(
  g: GridGeometry,
  slot: Pick<PlacedItem, "weekday" | "courtId" | "start" | "end">,
  lane: Lane = { lane: 0, lanes: 1 },
): Rect | null {
  const column = columnIndexOf(g, slot.weekday, slot.courtId);
  if (column < 0) return null;
  const laneWidth = g.columnWidth / lane.lanes;
  const top = minuteToY(g, slot.start);
  return {
    left: column * g.columnWidth + lane.lane * laneWidth + BLOCK_GAP,
    top: top + 1,
    width: Math.max(4, laneWidth - 2 * BLOCK_GAP),
    height: Math.max(6, minuteToY(g, slot.end) - top - 2),
  };
}

export interface PlacedBox extends Rect {
  id: string;
}

/** Rectangles des cours affichés, avec répartition des chevauchements. */
export function layoutItems(g: GridGeometry, items: readonly PlacedItem[]): PlacedBox[] {
  const lanes = assignLanes(items);
  const boxes: PlacedBox[] = [];
  for (const item of items) {
    const rect = slotRect(g, item, lanes.get(item.id));
    if (rect) boxes.push({ id: item.id, ...rect });
  }
  return boxes;
}

/** Cours sous un point (le dernier dessiné l'emporte), ou `null`. */
export function itemAtPoint(boxes: readonly PlacedBox[], point: Point): string | null {
  for (let i = boxes.length - 1; i >= 0; i--) {
    const box = boxes[i] as PlacedBox;
    if (
      point.x >= box.left &&
      point.x <= box.left + box.width &&
      point.y >= box.top &&
      point.y <= box.top + box.height
    ) {
      return box.id;
    }
  }
  return null;
}

/**
 * Bandes hachurées des indisponibilités d'un moniteur : une bande par
 * intervalle, sur toute la largeur du jour (tous les courts).
 */
export function hatchRects(
  g: GridGeometry,
  intervalsOfWeekday: (weekday: number) => readonly Interval[],
): (Rect & { key: string })[] {
  const dayWidth = g.courtIds.length * g.columnWidth;
  return g.weekdays.flatMap((weekday, dayIndex) =>
    intervalsOfWeekday(weekday)
      .map((i) => ({ start: Math.max(i.start, g.dayStart), end: Math.min(i.end, g.dayEnd) }))
      .filter((i) => i.end > i.start)
      .map((i) => ({
        key: `${weekday}-${i.start}`,
        left: dayIndex * dayWidth,
        width: dayWidth,
        top: minuteToY(g, i.start),
        height: minuteToY(g, i.end) - minuteToY(g, i.start),
      })),
  );
}

/** Graduations de l'axe : heures pleines et demi-heures. */
export function gridLines(g: GridGeometry): { minute: number; y: number; half: boolean }[] {
  const lines: { minute: number; y: number; half: boolean }[] = [];
  const first = snapMinutes(g.dayStart, "ceil", 30);
  for (let minute = first; minute <= g.dayEnd; minute += 30) {
    lines.push({ minute, y: minuteToY(g, minute), half: minute % 60 !== 0 });
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Libellés
// ---------------------------------------------------------------------------

/** 870 → « 14h30 ». */
export function clockLabel(minutes: number): string {
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
}

/** Total d'heures compact : 90 → « 1h30 », 120 → « 2h », 0 → « 0h ». */
export function hoursLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}
