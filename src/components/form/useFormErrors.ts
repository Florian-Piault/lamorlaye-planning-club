import { useCallback, useState } from "react";
import type { FieldErrors } from "@/domain/validation";
import { clearFieldErrors } from "./formState";

/**
 * Erreurs d'un formulaire : erreurs de champ posées à la validation et erreur
 * générale (échec de l'enregistrement). `changed` est à appeler à chaque
 * modification de la saisie : l'erreur des champs modifiés et l'erreur
 * générale disparaissent aussitôt (B10).
 */
export function useFormErrors<T>() {
  const [errors, setErrors] = useState<FieldErrors<T>>({});
  const [error, setError] = useState<string | null>(null);
  const changed = useCallback((patch: Partial<T>) => {
    setErrors((current) => clearFieldErrors(current, patch));
    setError(null);
  }, []);
  return { errors, setErrors, error, setError, changed };
}
