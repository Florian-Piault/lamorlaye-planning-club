import { describe, expect, it } from "vitest";
import {
  addDays,
  formatDate,
  formatDuration,
  isValidDate,
  isValidTime,
  minutesToTime,
  timeToMinutes,
  todayIso,
  weekdayLabel,
  weekdayShort,
} from "./time";

describe("heures et dates", () => {
  it("convertit les heures en minutes et inversement", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("09:30")).toBe(570);
    expect(minutesToTime(570)).toBe("09:30");
    expect(minutesToTime(22 * 60)).toBe("22:00");
    expect(() => timeToMinutes("9h30")).toThrow();
  });

  it("valide les heures", () => {
    expect(isValidTime("23:59")).toBe(true);
    expect(isValidTime("24:00")).toBe(false);
    expect(isValidTime("7:00")).toBe(false);
  });

  it("valide les dates réelles", () => {
    expect(isValidDate("2027-02-28")).toBe(true);
    expect(isValidDate("2028-02-29")).toBe(true);
    expect(isValidDate("2027-02-29")).toBe(false);
    expect(isValidDate("2027-13-01")).toBe(false);
    expect(isValidDate("01/09/2026")).toBe(false);
  });

  it("ajoute des jours, y compris en changeant de mois ou d'année", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2026-10-25", 1)).toBe("2026-10-26");
  });

  it("formate dates, durées et jours", () => {
    expect(formatDate("2026-09-01")).toBe("01/09/2026");
    expect(formatDate(null)).toBe("");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(120)).toBe("2 h");
    expect(formatDuration(90)).toBe("1 h 30");
    expect(weekdayLabel(3)).toBe("Mercredi");
    expect(weekdayLabel(9)).toBe("Jour 9");
    expect(weekdayShort(7)).toBe("Dim");
    expect(weekdayShort(9)).toBe("");
    expect(todayIso(new Date(2026, 9, 4, 23, 30))).toBe("2026-10-04");
  });
});
