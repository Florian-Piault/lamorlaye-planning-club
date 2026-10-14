import { describe, expect, it } from "vitest";
import { ageOn, describeAgeRange, groupAlerts, isInAgeRange, isMinor } from "./groups";

describe("âge", () => {
  it("calcule l'âge en années révolues", () => {
    expect(ageOn("2016-09-01", "2026-09-01")).toBe(10);
    expect(ageOn("2016-09-02", "2026-09-01")).toBe(9);
    expect(ageOn("2016-12-31", "2026-09-01")).toBe(9);
    expect(ageOn("2008-02-29", "2026-02-28")).toBe(17);
    expect(ageOn("2008-02-29", "2026-03-01")).toBe(18);
  });

  it("indique si un élève est mineur", () => {
    expect(isMinor("2010-01-01", "2026-09-01")).toBe(true);
    expect(isMinor("1990-01-01", "2026-09-01")).toBe(false);
    expect(isMinor(null, "2026-09-01")).toBe(false);
  });

  it("vérifie la tranche d'âge (date de naissance inconnue acceptée)", () => {
    const limits = { minAge: 8, maxAge: 10 };
    expect(isInAgeRange(limits, "2017-01-01", "2026-09-01")).toBe(true);
    expect(isInAgeRange(limits, "2019-01-01", "2026-09-01")).toBe(false);
    expect(isInAgeRange(limits, "2014-01-01", "2026-09-01")).toBe(false);
    expect(isInAgeRange(limits, null, "2026-09-01")).toBe(true);
    expect(isInAgeRange({ minAge: null, maxAge: null }, "1950-01-01", "2026-09-01")).toBe(true);
  });

  it("décrit la tranche d'âge", () => {
    expect(describeAgeRange(6, 8)).toBe("6–8 ans");
    expect(describeAgeRange(18, null)).toBe("18 ans et plus");
    expect(describeAgeRange(null, 10)).toBe("jusqu'à 10 ans");
    expect(describeAgeRange(null, null)).toBe("Tous âges");
  });
});

describe("alertes de composition", () => {
  const limits = { maxSize: 2, minAge: 8, maxAge: 10 };

  it("ne signale rien pour un groupe conforme", () => {
    expect(groupAlerts(limits, [{ birthDate: "2017-05-01" }], "2026-09-01")).toEqual({
      size: 1,
      overCapacity: false,
      outOfAgeRange: 0,
      messages: [],
    });
  });

  it("signale un effectif dépassé et les élèves hors tranche d'âge", () => {
    const alerts = groupAlerts(
      limits,
      [{ birthDate: "2017-05-01" }, { birthDate: "2020-01-01" }, { birthDate: null }],
      "2026-09-01",
    );
    expect(alerts.overCapacity).toBe(true);
    expect(alerts.outOfAgeRange).toBe(1);
    expect(alerts.messages).toEqual(["3 / 2 élèves", "1 élève hors tranche d'âge"]);

    const two = groupAlerts(
      { ...limits, maxSize: 8 },
      [{ birthDate: "2020-01-01" }, { birthDate: "2000-01-01" }],
      "2026-09-01",
    );
    expect(two.messages).toEqual(["2 élèves hors tranche d'âge"]);
  });
});
