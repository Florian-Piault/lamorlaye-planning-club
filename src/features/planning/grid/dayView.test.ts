import { describe, expect, it } from "vitest";
import {
  courtHeaderLabel,
  courtShortName,
  dayHeaderLabel,
  dayToOpen,
  FILTERS_MENU_WIDTH,
  focusedWeekday,
  gridWeekdays,
  lessonCountByWeekday,
  lessonNameLines,
  MIN_DAY_COLUMN_WIDTH,
  menuPlacement,
  stepWeekday,
  viewColumnWidth,
  WEEK_VIEW,
} from "./dayView";
import { HOUR_HEIGHT, MIN_COLUMN_WIDTH } from "./geometry";

const days = [1, 2, 3, 4, 5, 6, 7];

describe("vue Semaine / Jour", () => {
  it("dessine tous les jours en vue Semaine, un seul en vue Jour", () => {
    expect(gridWeekdays(days, WEEK_VIEW)).toBe(days);
    expect(gridWeekdays(days, { kind: "day", weekday: 7 })).toEqual([7]);
  });

  it("se rabat sur le premier jour si le jour demandé n'est pas affiché", () => {
    expect(focusedWeekday([1, 2, 3], { kind: "day", weekday: 7 })).toBe(1);
    expect(gridWeekdays([2, 3], { kind: "day", weekday: 7 })).toEqual([2]);
    expect(focusedWeekday([3, 4], WEEK_VIEW)).toBe(3);
    expect(gridWeekdays([], { kind: "day", weekday: 1 })).toEqual([]);
  });

  it("passe au jour précédent ou suivant, en boucle : le dimanche reste atteignable", () => {
    expect(stepWeekday(days, 6, 1)).toBe(7);
    expect(stepWeekday(days, 7, 1)).toBe(1);
    expect(stepWeekday(days, 1, -1)).toBe(7);
    // Jours affichés non consécutifs (saison sans jeudi).
    expect(stepWeekday([1, 2, 3, 5], 3, 1)).toBe(5);
    expect(stepWeekday([1, 2], 4, 1)).toBe(1);
    expect(stepWeekday([], 4, 1)).toBe(4);
  });

  it("compte les cours de chaque jour, sans les séances annulées", () => {
    const counts = lessonCountByWeekday([
      { weekday: 1 },
      { weekday: 1 },
      { weekday: 3, cancelled: true },
      { weekday: 3 },
      { weekday: 7 },
    ]);
    expect([...counts]).toEqual([
      [1, 2],
      [3, 1],
      [7, 1],
    ]);
    expect(counts.get(2)).toBeUndefined();
  });

  it("élargit les courts en vue Jour, quitte à faire défiler", () => {
    // 10 courts dans 820 px : 82 px en vue Semaine, 88 px au moins en vue Jour.
    expect(viewColumnWidth(820, 10, WEEK_VIEW)).toBe(82);
    expect(viewColumnWidth(820, 10, { kind: "day", weekday: 1 })).toBe(MIN_DAY_COLUMN_WIDTH);
    expect(viewColumnWidth(1200, 10, { kind: "day", weekday: 1 })).toBe(120);
    expect(viewColumnWidth(300, 60, WEEK_VIEW)).toBe(MIN_COLUMN_WIDTH);
  });
});

describe("en-têtes de courts", () => {
  it("abrège le nom d'un court", () => {
    expect(courtShortName("Terre battue 1")).toBe("TB1");
    expect(courtShortName("Central")).toBe("Cent.");
    expect(courtShortName("Court 2")).toBe("C2");
    expect(courtShortName("Pista")).toBe("Pista");
    expect(courtShortName("  ")).toBe("");
  });

  it("garde le vrai nom s'il tient, l'abrège sinon", () => {
    expect(courtHeaderLabel("Court 1", 120)).toEqual({ text: "Court 1", icon: true });
    expect(courtHeaderLabel("Terre battue 1", 64)).toEqual({ text: "TB1", icon: true });
    expect(courtHeaderLabel("Central", 64)).toEqual({ text: "Central", icon: true });
    expect(courtHeaderLabel("Terre battue 2", 50)).toEqual({ text: "TB2", icon: true });
    // Très étroit : l'icône disparaît.
    expect(courtHeaderLabel("Terre battue 1", 20)).toEqual({ text: "TB", icon: false });
  });
});

describe("en-têtes de jours", () => {
  it("raccourcit le nom du jour quand la colonne est étroite", () => {
    expect(dayHeaderLabel("Mercredi 11/11", 3, 400)).toBe("Mercredi 11/11");
    expect(dayHeaderLabel("Mercredi 11/11", 3, 90)).toBe("Mer. 11/11");
    expect(dayHeaderLabel("Mercredi", 3, 40)).toBe("Mer.");
    expect(dayHeaderLabel("Mercredi", 3, 30)).toBe("Me");
  });
});

describe("nom d'un cours", () => {
  it("passe sur deux lignes à partir d'une heure et demie", () => {
    // Hauteur d'une carte : la durée moins 2 px de marge.
    const card = (minutes: number) => (HOUR_HEIGHT * minutes) / 60 - 2;
    expect(lessonNameLines(card(60))).toBe(1);
    // Une heure et quart : pas encore la place d'une quatrième ligne.
    expect(lessonNameLines(card(75))).toBe(1);
    expect(lessonNameLines(card(90))).toBe(2);
    expect(lessonNameLines(card(120))).toBe(2);
  });
});

describe("jour ouvert par « Jour »", () => {
  it("reprend le dernier jour vu, sinon aujourd'hui, sinon le premier jour", () => {
    expect(dayToOpen(days, 3, 5)).toBe(3);
    expect(dayToOpen(days, null, 5)).toBe(5);
    expect(dayToOpen(days, null, null)).toBe(1);
    // Jours qui ne sont plus affichés : ignorés.
    expect(dayToOpen([1, 2, 3], 7, 6)).toBe(1);
    expect(dayToOpen([1, 2, 3], 7, 2)).toBe(2);
  });
});

describe("menu « Filtres »", () => {
  it("s'ouvre sous son bouton quand il a la place", () => {
    expect(menuPlacement(300, 0, 1366)).toEqual({ left: 0, width: FILTERS_MENU_WIDTH });
  });

  it("se décale vers la gauche pour rester dans la zone de contenu", () => {
    // Zone 246 → 950 (960 px, menu déplié), bouton à 750 : 544 px tiennent en se décalant.
    const { left, width } = menuPlacement(750, 246, 950);
    expect(width).toBe(FILTERS_MENU_WIDTH);
    expect(750 + left + width).toBe(942);
    expect(750 + left).toBeGreaterThanOrEqual(254);
  });

  it("se rétrécit si la zone est plus étroite que lui", () => {
    const { left, width } = menuPlacement(400, 300, 700);
    expect(width).toBe(384);
    expect(400 + left).toBe(308);
  });
});
