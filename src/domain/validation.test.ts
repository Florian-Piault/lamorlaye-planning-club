import { describe, expect, it } from "vitest";
import {
  courtSchema,
  groupSchema,
  instructorSchema,
  levelSchema,
  seasonSchema,
  studentSchema,
  validate,
} from "./validation";

const season = {
  name: " 2026-2027 ",
  startDate: "2026-09-01",
  endDate: "2027-06-30",
  displayStartTime: "08:00",
  displayEndTime: "22:00",
  displayedDays: [6, 1, 2, 3, 4, 5, 1],
};

const student = {
  lastName: "Martin",
  firstName: "Léa",
  phone: "06 12 34 56 78",
  birthDate: "",
  levelId: "",
  fftRanking: "",
  email: "",
  guardianName: "",
  guardianPhone: "",
};

describe("validation des fiches", () => {
  it("nettoie et convertit une saison valide", () => {
    expect(validate(seasonSchema, season)).toEqual({
      ok: true,
      data: { ...season, name: "2026-2027", displayedDays: [1, 2, 3, 4, 5, 6] },
    });
  });

  it("refuse une saison incohérente", () => {
    const result = validate(seasonSchema, {
      ...season,
      name: "  ",
      endDate: "2026-08-31",
      displayEndTime: "07:00",
      displayedDays: [],
    });
    expect(result).toEqual({
      ok: false,
      errors: {
        name: "Le nom de la saison est obligatoire.",
        displayedDays: "Choisissez au moins un jour affiché.",
        endDate: "La date de fin doit suivre la date de début.",
        displayEndTime: "L'heure de fin doit suivre l'heure de début.",
      },
    });
    expect(validate(seasonSchema, { ...season, endDate: "2026-08-31" })).toEqual({
      ok: false,
      errors: { endDate: "La date de fin doit suivre la date de début." },
    });
    expect(validate(seasonSchema, { ...season, displayEndTime: "07:00" })).toEqual({
      ok: false,
      errors: { displayEndTime: "L'heure de fin doit suivre l'heure de début." },
    });
  });

  it("valide un court et un niveau", () => {
    expect(validate(courtSchema, { name: "Court 1", kind: "indoor", active: true }).ok).toBe(true);
    expect(validate(courtSchema, { name: "", kind: "outdoor", active: true })).toEqual({
      ok: false,
      errors: { name: "Le nom du court est obligatoire." },
    });
    expect(validate(levelSchema, { label: " Galaxie vert ", active: true })).toEqual({
      ok: true,
      data: { label: "Galaxie vert", active: true },
    });
  });

  it("valide un moniteur (couleur normalisée, champs optionnels vides → null)", () => {
    expect(
      validate(instructorSchema, {
        lastName: "Benali",
        firstName: "Karim",
        phone: "",
        email: "",
        color: "#1d4ed8",
        initials: " KB ",
        active: true,
      }),
    ).toEqual({
      ok: true,
      data: {
        lastName: "Benali",
        firstName: "Karim",
        phone: null,
        email: null,
        color: "#1D4ED8",
        initials: "KB",
        active: true,
      },
    });
    const invalid = validate(instructorSchema, {
      lastName: "Benali",
      firstName: "Karim",
      phone: "abc",
      email: "karim@",
      color: "bleu",
      initials: "ABCDE",
      active: true,
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(Object.keys(invalid.errors).sort()).toEqual(["color", "email", "initials", "phone"]);
    }
  });

  it("valide un groupe (nombres convertis, tranche d'âge cohérente)", () => {
    expect(
      validate(groupSchema, {
        name: "Galaxie vert 1",
        levelId: "",
        minAge: "8",
        maxAge: "",
        maxSize: "6",
        active: true,
      }),
    ).toEqual({
      ok: true,
      data: {
        name: "Galaxie vert 1",
        levelId: null,
        minAge: 8,
        maxAge: null,
        maxSize: 6,
        active: true,
      },
    });
    expect(
      validate(groupSchema, {
        name: "G",
        levelId: "x",
        minAge: "12",
        maxAge: "10",
        maxSize: "6",
        active: true,
      }),
    ).toEqual({
      ok: false,
      errors: { maxAge: "L'âge maximum doit être supérieur à l'âge minimum." },
    });
    expect(
      validate(groupSchema, {
        name: "G",
        levelId: "",
        minAge: "",
        maxAge: "",
        maxSize: "0",
        active: true,
      }),
    ).toEqual({ ok: false, errors: { maxSize: "Nombre d'élèves invalide." } });
  });

  it("valide un élève (téléphone obligatoire)", () => {
    const result = validate(studentSchema, {
      ...student,
      birthDate: "2015-03-12",
      email: "lea@exemple.fr",
    });
    expect(result).toEqual({
      ok: true,
      data: {
        lastName: "Martin",
        firstName: "Léa",
        phone: "06 12 34 56 78",
        birthDate: "2015-03-12",
        levelId: null,
        fftRanking: null,
        email: "lea@exemple.fr",
        guardianName: null,
        guardianPhone: null,
      },
    });
    expect(validate(studentSchema, { ...student, phone: "" })).toEqual({
      ok: false,
      errors: { phone: "Le téléphone est obligatoire." },
    });
    expect(validate(studentSchema, { ...student, birthDate: "2015-02-30" })).toEqual({
      ok: false,
      errors: { birthDate: "Date invalide." },
    });
  });
});
