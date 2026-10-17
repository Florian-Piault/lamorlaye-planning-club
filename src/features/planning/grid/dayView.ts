/**
 * Lisibilité de la grille (docs/SPECS.md §4.1, spec UX v1.1 « Grille ») : vue
 * « Semaine / Jour », barre des jours, en-têtes de courts et de jours abrégés
 * selon la largeur, nombre de lignes du nom d'un cours.
 *
 * Fonctions pures : la page calcule la largeur disponible et la passe ici.
 */
import { weekdayLabel, weekdayShort } from "@/domain/time";
import { fitColumnWidth, MIN_COLUMN_WIDTH } from "./geometry";

/** Vue de la grille : la semaine entière ou un seul jour. */
export type GridView = { kind: "week" } | { kind: "day"; weekday: number };

export const WEEK_VIEW: GridView = { kind: "week" };

/**
 * Largeur minimale d'un court en vue Jour : le nom d'un groupe (« Galaxie 12 »)
 * tient sur une carte d'une heure ; en deçà, la grille défile horizontalement.
 */
export const MIN_DAY_COLUMN_WIDTH = 88;

/** Jour affiché en vue Jour : celui demandé s'il est affiché, sinon le premier. */
export function focusedWeekday(weekdays: readonly number[], view: GridView): number {
  if (view.kind === "day" && weekdays.includes(view.weekday)) return view.weekday;
  return weekdays[0] ?? 1;
}

/** Jours dessinés dans la grille : tous en vue Semaine, un seul en vue Jour. */
export function gridWeekdays(weekdays: readonly number[], view: GridView): readonly number[] {
  if (view.kind === "week" || weekdays.length === 0) return weekdays;
  return [focusedWeekday(weekdays, view)];
}

/** Jour précédent (`-1`) ou suivant (`+1`) parmi les jours affichés, en boucle. */
export function stepWeekday(weekdays: readonly number[], current: number, delta: -1 | 1): number {
  if (weekdays.length === 0) return current;
  const index = weekdays.indexOf(current);
  if (index < 0) return weekdays[0] as number;
  return weekdays[(index + delta + weekdays.length) % weekdays.length] as number;
}

/** Nombre de cours de chaque jour (séances annulées exclues), pour la barre des jours. */
export function lessonCountByWeekday(
  items: readonly { weekday: number; cancelled?: boolean }[],
): Map<number, number> {
  const counts = new Map<number, number>();
  for (const item of items) {
    if (item.cancelled) continue;
    counts.set(item.weekday, (counts.get(item.weekday) ?? 0) + 1);
  }
  return counts;
}

/** Largeur d'un court : plus large en vue Jour pour que les noms de groupes tiennent. */
export function viewColumnWidth(available: number, columns: number, view: GridView): number {
  return fitColumnWidth(
    available,
    columns,
    view.kind === "day" ? MIN_DAY_COLUMN_WIDTH : MIN_COLUMN_WIDTH,
  );
}

/** Abréviation d'un court : « Terre battue 1 » → « TB1 », « Central » → « Cent. », « Court 2 » → « C2 ». */
export function courtShortName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) {
    const word = words[0] as string;
    return word.length > 5 ? `${word.slice(0, 4)}.` : word;
  }
  return words.map((w) => (/^\d+$/.test(w) ? w : (w[0] ?? "").toUpperCase())).join("");
}

/** Largeur (px) estimée d'un texte de 11 px : un peu plus de 6 px par caractère. */
function textWidth(text: string): number {
  return text.length * 6.2;
}

export interface CourtHeaderLabel {
  /** Texte affiché : nom complet, abrégé, ou ses premières lettres. */
  text: string;
  /** Icône soleil / maison, s'il reste la place. */
  icon: boolean;
}

/** En-tête d'un court : vrai nom s'il tient dans la colonne, sinon abrégé. */
export function courtHeaderLabel(name: string, width: number): CourtHeaderLabel {
  const icon = width >= 32;
  const room = width - (icon ? 18 : 4);
  if (textWidth(name) <= room) return { text: name, icon };
  const short = courtShortName(name);
  if (textWidth(short) <= room) return { text: short, icon };
  // Très étroit : l'icône cède sa place au texte.
  return { text: short.slice(0, Math.max(1, Math.floor((width - 4) / 6.2))), icon: false };
}

/** En-tête d'un jour : « Lundi 02/11 », puis « Lun. 02/11 », puis « Lu » selon la largeur. */
export function dayHeaderLabel(label: string, weekday: number, width: number): string {
  if (textWidth(label) * 1.2 + 8 <= width) return label;
  const short = weekdayShort(weekday);
  const abbreviated = label.replace(weekdayLabel(weekday), `${short}.`);
  if (textWidth(abbreviated) * 1.2 + 8 <= width) return abbreviated;
  return short.slice(0, 2);
}

/** Hauteur (px) d'une ligne de texte d'un cours (11 px, interligne serré). */
const LESSON_LINE_HEIGHT = 14;

/**
 * Lignes du nom d'un cours : deux si la carte peut aussi montrer l'horaire et
 * le moniteur en dessous (quatre lignes en tout, soit une heure et demie ou
 * plus à 48 px par heure), sinon une seule.
 */
export function lessonNameLines(height: number): 1 | 2 {
  return height >= 4 * LESSON_LINE_HEIGHT + 4 ? 2 : 1;
}

/**
 * Jour ouvert par « Jour » depuis la vue Semaine : le dernier jour vu, sinon
 * aujourd'hui s'il est dans la semaine affichée (semaine précise), sinon le
 * premier jour affiché.
 */
export function dayToOpen(
  weekdays: readonly number[],
  lastDay: number | null,
  today: number | null,
): number {
  if (lastDay !== null && weekdays.includes(lastDay)) return lastDay;
  if (today !== null && weekdays.includes(today)) return today;
  return weekdays[0] ?? 1;
}

/** Largeur du menu « Filtres » quand il a la place (34rem). */
export const FILTERS_MENU_WIDTH = 544;
const MENU_MARGIN = 8;

/**
 * Place du menu « Filtres » sous son bouton (`left` relatif au bouton) : il
 * reste dans la zone de contenu `[areaLeft, areaRight]`, décalé vers la gauche
 * puis rétréci si la place manque (fenêtre de 960 px).
 */
export function menuPlacement(
  anchorLeft: number,
  areaLeft: number,
  areaRight: number,
): { left: number; width: number } {
  const width = Math.max(0, Math.min(FILTERS_MENU_WIDTH, areaRight - areaLeft - 2 * MENU_MARGIN));
  const overflow = anchorLeft + width - (areaRight - MENU_MARGIN);
  const left = overflow > 0 ? Math.max(areaLeft + MENU_MARGIN - anchorLeft, -overflow) : 0;
  return { left, width };
}
