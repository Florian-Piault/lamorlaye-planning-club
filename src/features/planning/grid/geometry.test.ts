import { describe, expect, it } from "vitest";
import {
  assignLanes,
  boardSize,
  clamp,
  clockLabel,
  columnAt,
  columnCount,
  columnIndexOf,
  fitColumnWidth,
  type GridGeometry,
  gridColumns,
  gridLines,
  hatchRects,
  hoursLabel,
  itemAtPoint,
  layoutItems,
  MIN_COLUMN_WIDTH,
  minuteToY,
  moveTarget,
  type PlacedItem,
  resizeDuration,
  selectionRange,
  slotRect,
  snapMinutes,
  yToMinute,
} from "./geometry";

/** Lundi → mercredi, deux courts, 8h–22h, 48 px par heure, colonnes de 70 px. */
const g: GridGeometry = {
  dayStart: 8 * 60,
  dayEnd: 22 * 60,
  hourHeight: 48,
  columnWidth: 70,
  weekdays: [1, 2, 3],
  courtIds: ["c1", "c2"],
};

const item = (id: string, weekday: number, courtId: string, start: number, end: number) =>
  ({ id, weekday, courtId, start, end }) satisfies PlacedItem;

describe("conversion pixels ↔ minutes", () => {
  it("place 8h00 en haut et compte 12 px par quart d'heure", () => {
    expect(minuteToY(g, 8 * 60)).toBe(0);
    expect(minuteToY(g, 8 * 60 + 15)).toBe(12);
    expect(minuteToY(g, 14 * 60 + 30)).toBe(312);
    expect(yToMinute(g, 312)).toBe(14 * 60 + 30);
    expect(yToMinute(g, 0)).toBe(8 * 60);
  });

  it("donne la taille de la zone des cours", () => {
    expect(columnCount(g)).toBe(6);
    expect(boardSize(g)).toEqual({ width: 420, height: 14 * 48 });
  });
});

describe("magnétisme au pas de 15 min", () => {
  it("arrondit au quart d'heure le plus proche par défaut", () => {
    expect(snapMinutes(607)).toBe(600);
    expect(snapMinutes(608)).toBe(615);
    expect(snapMinutes(622.4)).toBe(615);
  });

  it("arrondit vers le bas ou le haut, avec une tolérance d'arrondi des pixels", () => {
    expect(snapMinutes(614, "floor")).toBe(600);
    expect(snapMinutes(601, "ceil")).toBe(615);
    expect(snapMinutes(614.9999999, "floor")).toBe(615);
    expect(snapMinutes(600.0000001, "ceil")).toBe(600);
  });

  it("accepte un autre pas", () => {
    expect(snapMinutes(610, "ceil", 30)).toBe(630);
  });
});

describe("colonnes jour × court", () => {
  it("énumère les sous-colonnes et marque le début de chaque jour", () => {
    const columns = gridColumns(g);
    expect(columns).toHaveLength(6);
    expect(columns[3]).toEqual({
      index: 3,
      weekday: 2,
      courtId: "c2",
      dayIndex: 1,
      courtIndex: 1,
      firstOfDay: false,
    });
    expect(columns.filter((c) => c.firstOfDay).map((c) => c.index)).toEqual([0, 2, 4]);
  });

  it("trouve la colonne d'un jour et d'un court", () => {
    expect(columnIndexOf(g, 3, "c1")).toBe(4);
    expect(columnIndexOf(g, 7, "c1")).toBe(-1);
    expect(columnIndexOf(g, 1, "inconnu")).toBe(-1);
  });

  it("trouve la colonne sous une abscisse, bornée à la grille", () => {
    expect(columnAt(g, 75)).toMatchObject({ weekday: 1, courtId: "c2", index: 1 });
    expect(columnAt(g, 141)).toMatchObject({ weekday: 2, courtId: "c1", firstOfDay: true });
    expect(columnAt(g, -30)).toMatchObject({ index: 0 });
    expect(columnAt(g, 5000)).toMatchObject({ index: 5, weekday: 3, courtId: "c2" });
    expect(columnAt({ ...g, courtIds: [] }, 10)).toBeNull();
  });

  it("élargit les colonnes à la place disponible, sans descendre sous le minimum", () => {
    expect(fitColumnWidth(1000, 10)).toBe(100);
    expect(fitColumnWidth(1005, 10)).toBe(100);
    expect(fitColumnWidth(300, 10)).toBe(MIN_COLUMN_WIDTH);
    expect(fitColumnWidth(300, 0)).toBe(MIN_COLUMN_WIDTH);
  });
});

describe("gestes", () => {
  it("déplace un cours en gardant l'écart du point saisi, aimanté au quart d'heure", () => {
    // Saisi 15 min sous son début, relâché à 14h20 + 15 min dans la colonne mercredi / c1.
    const y = minuteToY(g, 14 * 60 + 35);
    expect(moveTarget(g, { x: 290, y }, 15, 60)).toEqual({
      weekday: 3,
      courtId: "c1",
      start: 14 * 60 + 15,
      durationMinutes: 60,
    });
  });

  it("garde le cours dans l'amplitude de la saison", () => {
    expect(moveTarget(g, { x: 10, y: -100 }, 0, 60)?.start).toBe(8 * 60);
    expect(moveTarget(g, { x: 10, y: 5000 }, 0, 90)?.start).toBe(22 * 60 - 90);
    expect(moveTarget({ ...g, weekdays: [] }, { x: 10, y: 10 }, 0, 60)).toBeNull();
  });

  it("redimensionne par le bord inférieur, entre 30 min et la fin de l'amplitude", () => {
    const start = 10 * 60;
    expect(resizeDuration(g, minuteToY(g, 12 * 60 + 5), start)).toBe(120);
    expect(resizeDuration(g, minuteToY(g, 10 * 60), start)).toBe(30);
    expect(resizeDuration(g, 5000, start)).toBe(12 * 60);
    expect(resizeDuration(g, 5000, 21 * 60 + 45)).toBe(15);
  });

  it("sélectionne un créneau d'au moins 30 min, dans un sens ou dans l'autre", () => {
    const a = minuteToY(g, 9 * 60 + 2);
    const b = minuteToY(g, 10 * 60 + 28);
    expect(selectionRange(g, a, b)).toEqual({ start: 9 * 60, end: 10 * 60 + 30 });
    expect(selectionRange(g, b, a)).toEqual({ start: 9 * 60, end: 10 * 60 + 30 });
    expect(selectionRange(g, a, a + 1)).toEqual({ start: 9 * 60, end: 9 * 60 + 30 });
    // Un pixel au-dessus de la ligne de 9h00 : la sélection commence bien à 9h00.
    expect(selectionRange(g, minuteToY(g, 9 * 60) - 1, minuteToY(g, 10 * 60) + 1)).toEqual({
      start: 9 * 60,
      end: 10 * 60,
    });
    expect(selectionRange(g, -50, 5000)).toEqual({ start: 8 * 60, end: 22 * 60 });
    expect(selectionRange(g, 5000, 5001)).toEqual({ start: 21 * 60 + 30, end: 22 * 60 });
  });
});

describe("placement des cours", () => {
  it("place un cours dans sa sous-colonne, avec une marge", () => {
    expect(slotRect(g, item("a", 2, "c2", 10 * 60, 11 * 60 + 30))).toEqual({
      left: 3 * 70 + 2,
      top: 96 + 1,
      width: 66,
      height: 72 - 2,
    });
    expect(slotRect(g, item("a", 7, "c2", 600, 660))).toBeNull();
  });

  it("met côte à côte les cours qui se chevauchent sur un même court", () => {
    const lanes = assignLanes([
      item("a", 1, "c1", 600, 660),
      item("b", 1, "c1", 630, 720),
      item("c", 1, "c1", 660, 720),
      item("d", 1, "c1", 720, 780),
      item("e", 1, "c2", 600, 660),
    ]);
    expect(lanes.get("a")).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get("b")).toEqual({ lane: 1, lanes: 2 });
    // « c » commence quand « a » finit : il reprend sa voie.
    expect(lanes.get("c")).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get("d")).toEqual({ lane: 0, lanes: 1 });
    expect(lanes.get("e")).toEqual({ lane: 0, lanes: 1 });
  });

  it("calcule les rectangles en partageant la largeur et ignore les colonnes masquées", () => {
    const boxes = layoutItems(g, [
      item("a", 1, "c1", 600, 660),
      item("b", 1, "c1", 600, 660),
      item("hors", 7, "c1", 600, 660),
    ]);
    expect(boxes.map((b) => b.id)).toEqual(["a", "b"]);
    expect(boxes[0]).toMatchObject({ left: 2, width: 31 });
    expect(boxes[1]).toMatchObject({ left: 37, width: 31 });
  });

  it("trouve le cours sous un point, le dernier dessiné l'emportant", () => {
    const boxes = [
      { id: "a", left: 0, top: 0, width: 50, height: 50 },
      { id: "b", left: 40, top: 40, width: 50, height: 50 },
    ];
    expect(itemAtPoint(boxes, { x: 10, y: 10 })).toBe("a");
    expect(itemAtPoint(boxes, { x: 45, y: 45 })).toBe("b");
    expect(itemAtPoint(boxes, { x: 200, y: 10 })).toBeNull();
  });
});

describe("hachures et graduations", () => {
  it("couvre toute la largeur du jour, bornée à l'amplitude", () => {
    const rects = hatchRects(g, (weekday) =>
      weekday === 2
        ? [
            { start: 0, end: 9 * 60 },
            { start: 12 * 60, end: 13 * 60 },
          ]
        : weekday === 3
          ? [{ start: 23 * 60, end: 24 * 60 }]
          : [],
    );
    expect(rects).toEqual([
      { key: "2-480", left: 140, width: 140, top: 0, height: 48 },
      { key: "2-720", left: 140, width: 140, top: 192, height: 48 },
    ]);
  });

  it("trace les heures pleines et les demi-heures", () => {
    const lines = gridLines({ ...g, dayStart: 8 * 60 + 15, dayEnd: 10 * 60 });
    expect(lines.map((l) => [l.minute, l.half])).toEqual([
      [510, true],
      [540, false],
      [570, true],
      [600, false],
    ]);
  });
});

describe("libellés", () => {
  it("affiche les heures et les totaux", () => {
    expect(clockLabel(9 * 60)).toBe("9h00");
    expect(clockLabel(14 * 60 + 5)).toBe("14h05");
    expect(hoursLabel(0)).toBe("0h");
    expect(hoursLabel(90)).toBe("1h30");
    expect(hoursLabel(600)).toBe("10h");
  });

  it("borne une valeur", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});
