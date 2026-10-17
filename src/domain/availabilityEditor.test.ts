import { describe, expect, it } from "vitest";
import {
  availabilityChange,
  cellStart,
  clickPrefill,
  draggedRange,
  isDragGesture,
  isFullyAvailable,
  minuteAtOffset,
  nearestBoundary,
  overlapsAvailability,
  type WeeklySlot,
} from "./availability";

const h = (hours: number, minutes = 0) => hours * 60 + minutes;
// Frise de 8h à 22h.
const START = h(8);
const END = h(22);

describe("frise des disponibilités : plage glissée (B6)", () => {
  it("finit à la limite de case la plus proche du pointeur", () => {
    // Appui sur le repère « 14h », relâchement sur le repère « 18h ».
    expect(draggedRange(h(14, 1), h(18, 1), START, END)).toEqual({ start: h(14), end: h(18) });
    expect(draggedRange(h(14, 1), h(17, 59), START, END)).toEqual({ start: h(14), end: h(18) });
    // Au milieu de la case 17:45 : la limite la plus proche l'emporte.
    expect(draggedRange(h(14, 1), h(17, 52), START, END)).toEqual({
      start: h(14),
      end: h(17, 45),
    });
    expect(draggedRange(h(14, 1), h(17, 53), START, END)).toEqual({ start: h(14), end: h(18) });
  });

  it("prend aussi la limite la plus proche pour l'appui, dans les deux sens", () => {
    // De droite à gauche : du repère « 18h » au repère « 14h ».
    expect(draggedRange(h(18, 1), h(14), START, END)).toEqual({ start: h(14), end: h(18) });
    expect(draggedRange(h(18, 5), h(14, 2), START, END)).toEqual({ start: h(14), end: h(18) });
    // Appui juste avant le repère « 14h ».
    expect(draggedRange(h(13, 59), h(18), START, END)).toEqual({ start: h(14), end: h(18) });
    expect(draggedRange(h(18, 2), h(13, 58), START, END)).toEqual({ start: h(14), end: h(18) });
  });

  it("fait au moins une case, du côté du glisser", () => {
    expect(draggedRange(h(14, 10), h(14, 12), START, END)).toEqual({
      start: h(14, 15),
      end: h(14, 30),
    });
    expect(draggedRange(h(18, 5), h(18, 1), START, END)).toEqual({
      start: h(17, 45),
      end: h(18),
    });
  });

  it("reste dans l'amplitude de la frise", () => {
    expect(draggedRange(h(21, 50), h(23), START, END)).toEqual({ start: h(21, 45), end: END });
    expect(draggedRange(h(9), h(6), START, END)).toEqual({ start: START, end: h(9) });
    expect(draggedRange(END, END, START, END)).toEqual({ start: h(21, 45), end: END });
    expect(draggedRange(h(8, 5), h(8, 1), START, END)).toEqual({ start: START, end: h(8, 15) });
  });

  it("convertit la position du pointeur en minutes et en cases", () => {
    // Rangée de 560 px pour 14 h : 40 px par heure.
    expect(minuteAtOffset(240, 560, START, END)).toBe(h(14));
    expect(minuteAtOffset(-10, 560, START, END)).toBe(START);
    expect(minuteAtOffset(600, 560, START, END)).toBe(END);
    expect(cellStart(h(14, 14), START, END)).toBe(h(14));
    expect(nearestBoundary(h(14, 8), START, END)).toBe(h(14, 15));
    expect(nearestBoundary(h(14, 7), START, END)).toBe(h(14));
  });
});

describe("frise des disponibilités : clic simple", () => {
  const slots: WeeklySlot[] = [{ weekday: 1, startTime: "14:00", endTime: "18:00" }];

  it("est un clic tant que le pointeur reste sous le seuil", () => {
    expect(isDragGesture(0, 0)).toBe(false);
    expect(isDragGesture(2, 2)).toBe(false);
    expect(isDragGesture(4, 0)).toBe(true);
    expect(isDragGesture(0, -6)).toBe(true);
    expect(isDragGesture(9, 0, 10)).toBe(false);
  });

  it("sur une case vide, propose l'heure cliquée plus une heure", () => {
    expect(clickPrefill(slots, 1, h(10, 20), START, END)).toEqual({
      weekday: 1,
      start: h(10, 15),
      end: h(11, 15),
      existing: false,
    });
    expect(clickPrefill(slots, 2, h(15), START, END)).toMatchObject({
      start: h(15),
      end: h(16),
      existing: false,
    });
    // Bornée à la fin de journée.
    expect(clickPrefill(slots, 1, h(21, 40), START, END)).toMatchObject({
      start: h(21, 30),
      end: END,
    });
  });

  it("sur une case disponible, propose la plage entière", () => {
    expect(clickPrefill(slots, 1, h(16, 40), START, END)).toEqual({
      weekday: 1,
      start: h(14),
      end: h(18),
      existing: true,
    });
    // La fin d'une plage est exclue : 18:00 est une case vide.
    expect(clickPrefill(slots, 1, h(18, 5), START, END).existing).toBe(false);
  });

  it("ne modifie aucune plage", () => {
    const before = structuredClone(slots);
    clickPrefill(slots, 1, h(16), START, END);
    expect(slots).toEqual(before);
  });
});

describe("annonce des changements", () => {
  const slots: WeeklySlot[] = [{ weekday: 1, startTime: "14:00", endTime: "18:00" }];

  it("annonce la plage ajoutée ou retirée", () => {
    expect(availabilityChange([], 1, h(14), h(18), true)).toEqual({
      slots,
      message: "Lundi 14:00–18:00 ajouté",
    });
    expect(availabilityChange(slots, 1, h(16), h(18), false)).toEqual({
      slots: [{ weekday: 1, startTime: "14:00", endTime: "16:00" }],
      message: "Lundi 16:00–18:00 retiré",
    });
  });

  it("décrit ce qui a réellement changé, pas la plage demandée", () => {
    expect(availabilityChange(slots, 1, h(10), h(20), false)?.message).toBe(
      "Lundi 14:00–18:00 retiré",
    );
    expect(availabilityChange(slots, 1, h(12), h(20), true)?.message).toBe(
      "Lundi 12:00–14:00, 18:00–20:00 ajouté",
    );
    expect(availabilityChange(slots, 1, h(17), h(19), true)?.message).toBe(
      "Lundi 18:00–19:00 ajouté",
    );
  });

  it("ne renvoie rien quand rien ne change", () => {
    expect(availabilityChange(slots, 1, h(15), h(17), true)).toBeNull();
    expect(availabilityChange(slots, 1, h(9), h(12), false)).toBeNull();
    expect(availabilityChange(slots, 2, h(14), h(18), false)).toBeNull();
  });

  it("grise « Ajouter » ou « Retirer » quand le bouton serait sans effet", () => {
    expect(isFullyAvailable(slots, 1, h(14), h(18))).toBe(true);
    expect(isFullyAvailable(slots, 1, h(15), h(16))).toBe(true);
    expect(isFullyAvailable(slots, 1, h(13), h(18))).toBe(false);
    expect(isFullyAvailable(slots, 1, h(15), h(15))).toBe(false);
    expect(overlapsAvailability(slots, 1, h(17), h(19))).toBe(true);
    expect(overlapsAvailability(slots, 1, h(18), h(19))).toBe(false);
    expect(overlapsAvailability(slots, 2, h(14), h(18))).toBe(false);
  });
});
