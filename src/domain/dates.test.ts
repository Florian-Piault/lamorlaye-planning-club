import { describe, expect, it } from "vitest";
import {
  dateOfWeekday,
  dayLengthMinutes,
  daysBetween,
  dstChangeInWeek,
  dstChangeOn,
  dstPeriod,
  eachDay,
  elapsedMinutes,
  endOfIsoWeek,
  fromParisTime,
  isDateInRange,
  isoWeek,
  isoWeekday,
  isoWeekKey,
  isoWeeksInYear,
  isSameIsoWeek,
  maxDate,
  minDate,
  mondayOfIsoWeek,
  parisOffset,
  shiftWeek,
  startOfIsoWeek,
  todayInParis,
  toParisTime,
  weekDates,
  weekLabel,
} from "./dates";

describe("dates civiles", () => {
  it("donne le jour ISO de la semaine", () => {
    expect(isoWeekday("2026-09-01")).toBe(2); // mardi
    expect(isoWeekday("2026-10-25")).toBe(7); // dimanche
    expect(isoWeekday("2026-10-26")).toBe(1); // lundi
  });

  it("compte et énumère les jours", () => {
    expect(daysBetween("2026-09-01", "2026-09-08")).toBe(7);
    expect(daysBetween("2026-09-08", "2026-09-01")).toBe(-7);
    // Pas d'effet du changement d'heure sur le nombre de jours.
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
    expect(eachDay("2026-12-30", "2027-01-02")).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
    expect(eachDay("2026-09-02", "2026-09-01")).toEqual([]);
  });

  it("teste l'appartenance à une période", () => {
    expect(isDateInRange("2026-09-01", "2026-09-01", "2026-09-30")).toBe(true);
    expect(isDateInRange("2026-09-30", "2026-09-01", "2026-09-30")).toBe(true);
    expect(isDateInRange("2026-10-01", "2026-09-01", "2026-09-30")).toBe(false);
    expect(isDateInRange("2030-01-01", "2026-09-01", null)).toBe(true);
    expect(maxDate("2026-09-01", "2026-10-01")).toBe("2026-10-01");
    expect(minDate("2026-09-01", "2026-10-01")).toBe("2026-09-01");
  });
});

describe("semaines ISO", () => {
  it("donne le lundi, le dimanche et les jours de la semaine", () => {
    expect(startOfIsoWeek("2026-09-01")).toBe("2026-08-31");
    expect(startOfIsoWeek("2026-08-31")).toBe("2026-08-31");
    expect(endOfIsoWeek("2026-09-01")).toBe("2026-09-06");
    expect(startOfIsoWeek("2026-09-06")).toBe("2026-08-31");
    expect(weekDates("2026-10-21")).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ]);
    expect(dateOfWeekday("2026-10-21", 7)).toBe("2026-10-25");
    expect(isSameIsoWeek("2026-10-19", "2026-10-25")).toBe(true);
    expect(isSameIsoWeek("2026-10-25", "2026-10-26")).toBe(false);
    expect(shiftWeek("2026-10-21", 1)).toBe("2026-10-26");
    expect(shiftWeek("2026-10-21", -1)).toBe("2026-10-12");
    expect(weekLabel("2026-11-04")).toBe("Semaine du 02/11/2026");
  });

  it("numérote les semaines, y compris autour du nouvel an", () => {
    expect(isoWeek("2026-10-21")).toEqual({ year: 2026, week: 43 });
    expect(isoWeekKey("2026-01-01")).toBe("2026-W01"); // jeudi
    expect(isoWeekKey("2027-01-01")).toBe("2026-W53"); // vendredi
    expect(isoWeekKey("2027-01-04")).toBe("2027-W01");
    expect(isoWeekKey("2024-12-30")).toBe("2025-W01");
    expect(isoWeeksInYear(2026)).toBe(53);
    expect(isoWeeksInYear(2027)).toBe(52);
  });

  it("retrouve le lundi d'une semaine ISO", () => {
    expect(mondayOfIsoWeek(2026, 1)).toBe("2025-12-29");
    expect(mondayOfIsoWeek(2026, 53)).toBe("2026-12-28");
    expect(mondayOfIsoWeek(2027, 1)).toBe("2027-01-04");
    for (const date of ["2026-09-01", "2027-01-01", "2027-06-30"]) {
      const { year, week } = isoWeek(date);
      expect(mondayOfIsoWeek(year, week)).toBe(startOfIsoWeek(date));
    }
  });
});

describe("fuseau Europe/Paris", () => {
  it("connaît les dates de changement d'heure", () => {
    expect(dstPeriod(2026)).toMatchObject({ startDate: "2026-03-29", endDate: "2026-10-25" });
    expect(dstPeriod(2027)).toMatchObject({ startDate: "2027-03-28", endDate: "2027-10-31" });
    expect(dstPeriod(2026).start.toISOString()).toBe("2026-03-29T01:00:00.000Z");
    expect(dstPeriod(2026).end.toISOString()).toBe("2026-10-25T01:00:00.000Z");
  });

  it("donne le décalage avec UTC", () => {
    expect(parisOffset(new Date("2026-07-01T12:00:00Z"))).toBe(120);
    expect(parisOffset(new Date("2026-12-01T12:00:00Z"))).toBe(60);
    expect(parisOffset(new Date("2026-10-25T00:59:59Z"))).toBe(120);
    expect(parisOffset(new Date("2026-10-25T01:00:00Z"))).toBe(60);
  });

  it("convertit un instant en heure de Paris, comme Intl", () => {
    const format = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const start = Date.UTC(2020, 0, 1);
    // Un instant toutes les 7 h 13 sur dix ans, plus les bascules exactes.
    const instants: Date[] = [];
    for (let t = start; t < Date.UTC(2030, 0, 1); t += (7 * 60 + 13) * 60_000) {
      instants.push(new Date(t));
    }
    for (let year = 2020; year < 2030; year++) {
      const { start: s, end: e } = dstPeriod(year);
      for (const edge of [s, e]) {
        instants.push(new Date(edge.getTime() - 60_000), edge, new Date(edge.getTime() + 60_000));
      }
    }
    for (const instant of instants) {
      const parts = Object.fromEntries(format.formatToParts(instant).map((p) => [p.type, p.value]));
      expect(toParisTime(instant)).toEqual({
        date: `${parts.year}-${parts.month}-${parts.day}`,
        time: `${parts.hour}:${parts.minute}`,
      });
    }
  });

  it("convertit une heure murale en instant (heures inexistantes et ambiguës)", () => {
    expect(fromParisTime("2026-12-01", "10:00").toISOString()).toBe("2026-12-01T09:00:00.000Z");
    expect(fromParisTime("2026-07-01", "10:00").toISOString()).toBe("2026-07-01T08:00:00.000Z");
    // 02:30 n'existe pas le 29/03/2026 : décalée à 03:30 (heure d'été).
    expect(fromParisTime("2026-03-29", "02:30").toISOString()).toBe("2026-03-29T01:30:00.000Z");
    // 02:30 existe deux fois le 25/10/2026 : la première (heure d'été) est retenue.
    expect(fromParisTime("2026-10-25", "02:30").toISOString()).toBe("2026-10-25T00:30:00.000Z");
    expect(fromParisTime("2026-10-25", "03:00").toISOString()).toBe("2026-10-25T02:00:00.000Z");
  });

  it("calcule les durées réelles autour des changements d'heure", () => {
    expect(dayLengthMinutes("2026-03-29")).toBe(23 * 60);
    expect(dayLengthMinutes("2026-10-25")).toBe(25 * 60);
    expect(dayLengthMinutes("2026-10-26")).toBe(24 * 60);
    // Un cours de 10h00 à 11h00 le jour du changement dure bien une heure.
    expect(
      elapsedMinutes({ date: "2026-10-25", time: "10:00" }, { date: "2026-10-25", time: "11:00" }),
    ).toBe(60);
    expect(
      elapsedMinutes({ date: "2026-10-25", time: "01:00" }, { date: "2026-10-25", time: "04:00" }),
    ).toBe(240);
  });

  it("signale les jours et semaines de changement d'heure", () => {
    expect(dstChangeOn("2026-10-25")).toBe("winter");
    expect(dstChangeOn("2027-03-28")).toBe("summer");
    expect(dstChangeOn("2026-10-24")).toBeNull();
    expect(dstChangeInWeek("2026-10-19")).toBe("winter");
    expect(dstChangeInWeek("2027-03-24")).toBe("summer");
    expect(dstChangeInWeek("2026-10-26")).toBeNull();
  });

  it("donne la date du jour à Paris", () => {
    // 23h30 UTC le 31/12 : déjà le 1er janvier à Paris.
    expect(todayInParis(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
    expect(todayInParis(new Date("2026-07-01T21:59:00Z"))).toBe("2026-07-01");
    expect(todayInParis(new Date("2026-07-01T22:00:00Z"))).toBe("2026-07-02");
    expect(todayInParis()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
