/**
 * Validation des fiches des référentiels (SPECS.md §3, §8).
 *
 * Les schémas Zod prennent les valeurs brutes des formulaires (chaînes,
 * booléens) et produisent les valeurs à enregistrer : textes nettoyés, champs
 * vides convertis en `null`, nombres convertis.
 */
import { z } from "zod";
import { HEX_COLOR, normalizeColor } from "./colors";
import { isValidDate, isValidTime } from "./time";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Chiffres, espaces, points, tirets, parenthèses et « + » initial ; au moins 6 chiffres. */
const PHONE = /^\+?[\d\s.\-()]+$/;

const isPhone = (value: string) => PHONE.test(value) && value.replace(/\D/g, "").length >= 6;

const requiredText = (message: string) => z.string().trim().min(1, message);

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v));

const optionalEmail = z
  .string()
  .trim()
  .refine((v) => v === "" || EMAIL.test(v), "Adresse e-mail invalide.")
  .transform((v) => (v === "" ? null : v));

const optionalPhone = z
  .string()
  .trim()
  .refine((v) => v === "" || isPhone(v), "Numéro de téléphone invalide.")
  .transform((v) => (v === "" ? null : v));

const requiredPhone = z
  .string()
  .trim()
  .min(1, "Le téléphone est obligatoire.")
  .refine(isPhone, "Numéro de téléphone invalide.");

const date = (message: string) => z.string().refine(isValidDate, message);

const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidDate(v), "Date invalide.")
  .transform((v) => (v === "" ? null : v));

const time = (message: string) => z.string().refine(isValidTime, message);

/** Entier optionnel saisi dans un champ texte. */
const optionalInteger = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= min && Number(v) <= max), message)
    .transform((v) => (v === "" ? null : Number(v)));

const optionalId = z.string().transform((v) => (v === "" ? null : v));

export const seasonSchema = z
  .object({
    name: requiredText("Le nom de la saison est obligatoire."),
    startDate: date("Date de début invalide."),
    endDate: date("Date de fin invalide."),
    displayStartTime: time("Heure de début invalide."),
    displayEndTime: time("Heure de fin invalide."),
    displayedDays: z
      .array(z.number().int().min(1).max(7))
      .min(1, "Choisissez au moins un jour affiché.")
      .transform((days) => [...new Set(days)].sort((a, b) => a - b)),
  })
  .superRefine((value, ctx) => {
    if (value.startDate > value.endDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "La date de fin doit suivre la date de début.",
      });
    }
    if (value.displayStartTime >= value.displayEndTime) {
      ctx.addIssue({
        code: "custom",
        path: ["displayEndTime"],
        message: "L'heure de fin doit suivre l'heure de début.",
      });
    }
  });

export const courtSchema = z.object({
  name: requiredText("Le nom du court est obligatoire."),
  kind: z.enum(["indoor", "outdoor"]),
  active: z.boolean(),
});

export const instructorSchema = z.object({
  lastName: requiredText("Le nom est obligatoire."),
  firstName: requiredText("Le prénom est obligatoire."),
  phone: optionalPhone,
  email: optionalEmail,
  color: z
    .string()
    .refine((v) => HEX_COLOR.test(v.trim()), "Choisissez une couleur.")
    .transform(normalizeColor),
  initials: z
    .string()
    .trim()
    .min(1, "Les initiales sont obligatoires.")
    .max(4, "4 caractères au maximum."),
  active: z.boolean(),
});

export const levelSchema = z.object({
  label: requiredText("Le libellé est obligatoire."),
  active: z.boolean(),
});

export const groupSchema = z
  .object({
    name: requiredText("Le nom du groupe est obligatoire."),
    levelId: optionalId,
    minAge: optionalInteger(0, 99, "Âge invalide."),
    maxAge: optionalInteger(0, 99, "Âge invalide."),
    maxSize: z
      .string()
      .trim()
      .refine(
        (v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 99,
        "Nombre d'élèves invalide.",
      )
      .transform(Number),
    active: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.minAge !== null && value.maxAge !== null && value.minAge > value.maxAge) {
      ctx.addIssue({
        code: "custom",
        path: ["maxAge"],
        message: "L'âge maximum doit être supérieur à l'âge minimum.",
      });
    }
  });

export const studentSchema = z.object({
  lastName: requiredText("Le nom est obligatoire."),
  firstName: requiredText("Le prénom est obligatoire."),
  phone: requiredPhone,
  birthDate: optionalDate,
  levelId: optionalId,
  fftRanking: optionalText,
  email: optionalEmail,
  guardianName: optionalText,
  guardianPhone: optionalPhone,
});

export type SeasonFormValues = z.input<typeof seasonSchema>;
export type SeasonInput = z.output<typeof seasonSchema>;
export type CourtFormValues = z.input<typeof courtSchema>;
export type CourtInput = z.output<typeof courtSchema>;
export type InstructorFormValues = z.input<typeof instructorSchema>;
export type InstructorInput = z.output<typeof instructorSchema>;
export type LevelFormValues = z.input<typeof levelSchema>;
export type LevelInput = z.output<typeof levelSchema>;
export type GroupFormValues = z.input<typeof groupSchema>;
export type GroupInput = z.output<typeof groupSchema>;
export type StudentFormValues = z.input<typeof studentSchema>;
export type StudentInput = z.output<typeof studentSchema>;

export type FieldErrors<T> = Partial<Record<keyof T & string, string>>;

export type ValidationResult<In, Out> =
  | { ok: true; data: Out }
  | { ok: false; errors: FieldErrors<In> };

/** Valide des valeurs de formulaire ; renvoie le premier message d'erreur de chaque champ. */
export function validate<S extends z.ZodType>(
  schema: S,
  values: z.input<S>,
): ValidationResult<z.input<S>, z.output<S>> {
  const result = schema.safeParse(values);
  if (result.success) return { ok: true, data: result.data };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? "");
    errors[field] ??= issue.message;
  }
  return { ok: false, errors: errors as FieldErrors<z.input<S>> };
}
