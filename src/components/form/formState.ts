import type { FieldErrors } from "@/domain/validation";

/**
 * Erreurs restantes après une modification : l'erreur d'un champ disparaît dès
 * que ce champ change (B10), les autres restent jusqu'à la prochaine validation.
 */
export function clearFieldErrors<T>(errors: FieldErrors<T>, changed: Partial<T>): FieldErrors<T> {
  const keys = Object.keys(changed).filter((key) => key in errors);
  if (keys.length === 0) return errors;
  const next = { ...errors } as Record<string, string | undefined>;
  for (const key of keys) delete next[key];
  return next as FieldErrors<T>;
}

/**
 * Égalité de deux saisies (valeurs simples, tableaux et objets) : une fenêtre
 * dont la saisie est revenue à son état d'ouverture n'est pas « modifiée ».
 */
export function sameValues(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((value, i) => sameValues(value, b[i]));
  }
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every((key) => key in right && sameValues(left[key], right[key]));
}
