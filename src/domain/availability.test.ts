import { describe, expect, it } from "vitest";
import {
  isAvailableAt,
  mergeIntervals,
  normalizeSlots,
  setAvailability,
  slotsOfDay,
  subtractInterval,
  totalWeeklyMinutes,
  type WeeklySlot,
} from "./availability";

const slot = (weekday: number, startTime: string, endTime: string): WeeklySlot => ({
  weekday,
  startTime,
  endTime,
});

describe("intervalles", () => {
  it("fusionne les intervalles chevauchants ou contigus et ignore les vides", () => {
    expect(
      mergeIntervals([
        { start: 600, end: 660 },
        { start: 540, end: 600 },
        { start: 700, end: 700 },
        { start: 650, end: 720 },
        { start: 800, end: 900 },
      ]),
    ).toEqual([
      { start: 540, end: 720 },
      { start: 800, end: 900 },
    ]);
  });

  it("retire une plage au milieu, au début, à la fin ou en totalité", () => {
    const day = [{ start: 540, end: 720 }];
    expect(subtractInterval(day, { start: 600, end: 630 })).toEqual([
      { start: 540, end: 600 },
      { start: 630, end: 720 },
    ]);
    expect(subtractInterval(day, { start: 480, end: 600 })).toEqual([{ start: 600, end: 720 }]);
    expect(subtractInterval(day, { start: 700, end: 800 })).toEqual([{ start: 540, end: 700 }]);
    expect(subtractInterval(day, { start: 500, end: 800 })).toEqual([]);
    expect(subtractInterval(day, { start: 800, end: 900 })).toEqual(day);
  });
});

describe("plages hebdomadaires", () => {
  it("ajoute une plage et fusionne avec les plages voisines du même jour", () => {
    const slots = [slot(1, "09:00", "12:00"), slot(1, "14:00", "16:00"), slot(2, "10:00", "11:00")];
    expect(setAvailability(slots, 1, 12 * 60, 14 * 60, true)).toEqual([
      slot(1, "09:00", "16:00"),
      slot(2, "10:00", "11:00"),
    ]);
  });

  it("retire une plage (pinceau « indisponible »)", () => {
    const slots = [slot(3, "09:00", "18:00")];
    expect(setAvailability(slots, 3, 12 * 60, 13 * 60 + 30, false)).toEqual([
      slot(3, "09:00", "12:00"),
      slot(3, "13:30", "18:00"),
    ]);
  });

  it("accepte des bornes inversées (glisser de droite à gauche)", () => {
    expect(setAvailability([], 5, 17 * 60, 15 * 60, true)).toEqual([slot(5, "15:00", "17:00")]);
  });

  it("supprime le jour quand il ne reste plus de plage", () => {
    expect(setAvailability([slot(6, "09:00", "10:00")], 6, 0, 24 * 60 - 1, false)).toEqual([]);
  });

  it("normalise et trie par jour puis par heure", () => {
    expect(
      normalizeSlots([
        slot(2, "14:00", "15:00"),
        slot(1, "10:00", "12:00"),
        slot(1, "08:00", "10:00"),
      ]),
    ).toEqual([slot(1, "08:00", "12:00"), slot(2, "14:00", "15:00")]);
    expect(slotsOfDay([slot(2, "14:00", "15:00"), slot(1, "10:00", "12:00")], 1)).toEqual([
      slot(1, "10:00", "12:00"),
    ]);
  });

  it("indique la disponibilité à une minute donnée (fin exclue)", () => {
    const slots = [slot(1, "09:00", "12:00")];
    expect(isAvailableAt(slots, 1, 9 * 60)).toBe(true);
    expect(isAvailableAt(slots, 1, 11 * 60 + 59)).toBe(true);
    expect(isAvailableAt(slots, 1, 12 * 60)).toBe(false);
    expect(isAvailableAt(slots, 2, 10 * 60)).toBe(false);
  });

  it("calcule le total hebdomadaire sans compter deux fois les chevauchements", () => {
    expect(
      totalWeeklyMinutes([
        slot(1, "09:00", "12:00"),
        slot(1, "11:00", "13:00"),
        slot(4, "17:00", "18:30"),
      ]),
    ).toBe(4 * 60 + 90);
  });
});
