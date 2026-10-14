import { describe, expect, it } from "vitest";
import { isAvailableDuring, uncoveredIntervals, type WeeklySlot } from "./availability";
import {
  checkInstructorAvailability,
  isInstructorAvailable,
  sortByAvailability,
  unavailableIntervals,
} from "./instructorAvailability";
import { localDateTime, overlappingUnavailabilities, unavailableMinutesOn } from "./unavailability";

const h = (hours: number, minutes = 0) => hours * 60 + minutes;

// Mercredi 9h–12h et 13h30–19h ; samedi 9h–13h.
const slots: WeeklySlot[] = [
  { weekday: 3, startTime: "09:00", endTime: "12:00" },
  { weekday: 3, startTime: "13:30", endTime: "16:00" },
  { weekday: 3, startTime: "16:00", endTime: "19:00" },
  { weekday: 6, startTime: "09:00", endTime: "13:00" },
];

describe("plages récurrentes", () => {
  it("vérifie qu'un créneau est entièrement couvert (plages contiguës fusionnées)", () => {
    expect(isAvailableDuring(slots, 3, h(9), h(10))).toBe(true);
    expect(isAvailableDuring(slots, 3, h(15), h(17))).toBe(true);
    expect(isAvailableDuring(slots, 3, h(11, 30), h(12, 30))).toBe(false);
    expect(isAvailableDuring(slots, 3, h(18), h(19, 15))).toBe(false);
    expect(isAvailableDuring(slots, 2, h(10), h(11))).toBe(false);
  });

  it("calcule les créneaux non couverts d'un jour", () => {
    expect(uncoveredIntervals(slots, 3, h(8), h(22))).toEqual([
      { start: h(8), end: h(9) },
      { start: h(12), end: h(13, 30) },
      { start: h(19), end: h(22) },
    ]);
    expect(uncoveredIntervals(slots, 1, h(8), h(22))).toEqual([{ start: h(8), end: h(22) }]);
    expect(uncoveredIntervals(slots, 1, h(22), h(8))).toEqual([]);
  });
});

describe("indisponibilités datées", () => {
  const ranges = [
    { startsAt: "2026-11-04T10:00", endsAt: "2026-11-04T12:00" },
    { startsAt: "2026-11-06T00:00", endsAt: "2026-11-09T00:00" },
  ];

  it("forme des date-heures locales", () => {
    expect(localDateTime("2026-11-04", h(14, 5))).toBe("2026-11-04T14:05");
    expect(localDateTime("2026-11-04", 24 * 60)).toBe("2026-11-05T00:00");
    expect(localDateTime("2026-11-04", 0)).toBe("2026-11-04T00:00");
  });

  it("trouve les plages qui chevauchent un créneau (fin exclue)", () => {
    expect(
      overlappingUnavailabilities(ranges, "2026-11-04T11:00", "2026-11-04T13:00"),
    ).toHaveLength(1);
    expect(overlappingUnavailabilities(ranges, "2026-11-04T12:00", "2026-11-04T13:00")).toEqual([]);
    expect(overlappingUnavailabilities(ranges, "2026-11-04T09:00", "2026-11-04T10:00")).toEqual([]);
  });

  it("découpe les plages par jour", () => {
    expect(unavailableMinutesOn(ranges, "2026-11-04")).toEqual([{ start: h(10), end: h(12) }]);
    expect(unavailableMinutesOn(ranges, "2026-11-07")).toEqual([{ start: 0, end: 24 * 60 }]);
    expect(unavailableMinutesOn(ranges, "2026-11-09")).toEqual([]);
    expect(
      unavailableMinutesOn(
        [{ startsAt: "2026-11-04T18:00", endsAt: "2026-11-05T09:30" }],
        "2026-11-05",
      ),
    ).toEqual([{ start: 0, end: h(9, 30) }]);
  });
});

describe("disponibilité d'un moniteur sur un créneau", () => {
  const marc = {
    name: "Marc",
    availabilities: slots,
    unavailabilities: [{ startsAt: "2026-11-04T10:00", endsAt: "2026-11-04T12:00" }],
  };
  const karim = {
    name: "Karim",
    availabilities: [{ weekday: 3, startTime: "08:00", endTime: "20:00" }],
    unavailabilities: [],
  };

  it("est disponible dans ses plages, hors indisponibilités", () => {
    expect(
      checkInstructorAvailability(marc, {
        date: "2026-11-11",
        weekday: 3,
        start: h(9),
        end: h(10),
      }),
    ).toEqual({ available: true, outsideWeeklySlots: false, unavailabilities: [] });
  });

  it("est indisponible pendant une indisponibilité datée", () => {
    const check = checkInstructorAvailability(marc, {
      date: "2026-11-04",
      weekday: 3,
      start: h(11),
      end: h(12),
    });
    expect(check.available).toBe(false);
    expect(check.outsideWeeklySlots).toBe(false);
    expect(check.unavailabilities).toHaveLength(1);
  });

  it("ignore les indisponibilités datées en semaine type", () => {
    expect(isInstructorAvailable(marc, { date: null, weekday: 3, start: h(11), end: h(12) })).toBe(
      true,
    );
  });

  it("est indisponible hors de ses plages, ou sans aucune plage saisie", () => {
    expect(isInstructorAvailable(marc, { date: null, weekday: 3, start: h(12), end: h(13) })).toBe(
      false,
    );
    const none = { availabilities: [], unavailabilities: [] };
    expect(isInstructorAvailable(none, { date: null, weekday: 3, start: h(9), end: h(10) })).toBe(
      false,
    );
  });

  it("calcule les hachures d'une journée", () => {
    expect(unavailableIntervals(marc, { date: "2026-11-04", weekday: 3 }, h(8), h(22))).toEqual([
      { start: h(8), end: h(9) },
      { start: h(10), end: h(13, 30) },
      { start: h(19), end: h(22) },
    ]);
    expect(unavailableIntervals(marc, { date: null, weekday: 3 }, h(8), h(22))).toHaveLength(3);
    const allDay = {
      availabilities: slots,
      unavailabilities: [{ startsAt: "2026-11-04T00:00", endsAt: "2026-11-05T00:00" }],
    };
    expect(unavailableIntervals(allDay, { date: "2026-11-04", weekday: 3 }, h(8), h(22))).toEqual([
      { start: h(8), end: h(22) },
    ]);
  });

  it("propose les moniteurs disponibles en premier", () => {
    const sorted = sortByAvailability([marc, karim], {
      date: "2026-11-04",
      weekday: 3,
      start: h(11),
      end: h(12),
    });
    expect(sorted.map((s) => [s.instructor.name, s.available])).toEqual([
      ["Karim", true],
      ["Marc", false],
    ]);
  });
});
