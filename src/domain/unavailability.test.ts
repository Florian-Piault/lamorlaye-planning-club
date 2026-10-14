import { describe, expect, it } from "vitest";
import {
  describeUnavailability,
  isAllDay,
  parseUnavailabilityForm,
  toUnavailabilityForm,
  type UnavailabilityForm,
} from "./unavailability";

const form = (overrides: Partial<UnavailabilityForm>): UnavailabilityForm => ({
  allDay: true,
  startDate: "2026-11-02",
  startTime: "",
  endDate: "",
  endTime: "",
  reason: "",
  ...overrides,
});

describe("indisponibilités datées", () => {
  it("convertit des journées entières (fin exclue au lendemain)", () => {
    expect(parseUnavailabilityForm(form({ endDate: "2026-11-05", reason: " Congé " }))).toEqual({
      ok: true,
      value: { startsAt: "2026-11-02T00:00", endsAt: "2026-11-06T00:00", reason: "Congé" },
    });
  });

  it("prend la date de début comme date de fin si elle est vide", () => {
    expect(parseUnavailabilityForm(form({}))).toEqual({
      ok: true,
      value: { startsAt: "2026-11-02T00:00", endsAt: "2026-11-03T00:00", reason: null },
    });
  });

  it("convertit une plage horaire", () => {
    const result = parseUnavailabilityForm(
      form({ allDay: false, startTime: "08:00", endDate: "2026-11-02", endTime: "12:00" }),
    );
    expect(result).toEqual({
      ok: true,
      value: { startsAt: "2026-11-02T08:00", endsAt: "2026-11-02T12:00", reason: null },
    });
  });

  it("refuse une fin antérieure au début et des valeurs invalides", () => {
    expect(
      parseUnavailabilityForm(form({ allDay: false, startTime: "12:00", endTime: "08:00" })),
    ).toEqual({ ok: false, errors: { endDate: "La fin doit être postérieure au début." } });
    expect(parseUnavailabilityForm(form({ endDate: "2026-11-01" })).ok).toBe(false);

    const invalid = parseUnavailabilityForm(
      form({ startDate: "", allDay: false, startTime: "8h" }),
    );
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.errors.startDate).toBeDefined();
      expect(invalid.errors.startTime).toBeDefined();
      expect(invalid.errors.endTime).toBeDefined();
    }
  });

  it("décrit les indisponibilités", () => {
    expect(
      describeUnavailability({ startsAt: "2026-11-02T00:00", endsAt: "2026-11-03T00:00" }),
    ).toBe("le 02/11/2026");
    expect(
      describeUnavailability({ startsAt: "2026-11-02T00:00", endsAt: "2026-11-06T00:00" }),
    ).toBe("du 02/11/2026 au 05/11/2026");
    expect(
      describeUnavailability({ startsAt: "2026-11-02T08:00", endsAt: "2026-11-02T12:00" }),
    ).toBe("le 02/11/2026 de 08:00 à 12:00");
    expect(
      describeUnavailability({ startsAt: "2026-11-02T18:00", endsAt: "2026-11-03T12:00" }),
    ).toBe("du 02/11/2026 à 18:00 au 03/11/2026 à 12:00");
  });

  it("retrouve les valeurs du formulaire à partir d'une plage enregistrée", () => {
    const allDay = { startsAt: "2026-11-02T00:00", endsAt: "2026-11-06T00:00", reason: "Tournoi" };
    expect(isAllDay(allDay)).toBe(true);
    expect(toUnavailabilityForm(allDay)).toEqual(
      form({ endDate: "2026-11-05", reason: "Tournoi" }),
    );

    const hours = { startsAt: "2026-11-02T08:00", endsAt: "2026-11-02T12:00", reason: null };
    const values = toUnavailabilityForm(hours);
    expect(values).toEqual(
      form({ allDay: false, startTime: "08:00", endDate: "2026-11-02", endTime: "12:00" }),
    );
    expect(parseUnavailabilityForm(values)).toEqual({ ok: true, value: hours });
  });
});
