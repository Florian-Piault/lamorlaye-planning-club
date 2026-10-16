import { Check } from "lucide-react";
import { type FormEvent, useState } from "react";
import { MessageZone } from "@/components/feedback/MessageZone";
import { errorMessages } from "@/components/feedback/messages";
import { Field } from "@/components/form/Field";
import { sameValues } from "@/components/form/formState";
import { useFormErrors } from "@/components/form/useFormErrors";
import { Button } from "@/components/ui/button";
import { useDirtyGuard, useGuardedCancel } from "@/components/ui/dialog";
import { Checkbox, Input } from "@/components/ui/input";
import type { Instructor } from "@/db/schema";
import { INSTRUCTOR_PALETTE, normalizeColor } from "@/domain/colors";
import { suggestInitials } from "@/domain/initials";
import {
  type InstructorFormValues,
  type InstructorInput,
  instructorSchema,
  validate,
} from "@/domain/validation";
import { errorMessage } from "@/hooks/useLoader";
import { cn } from "@/lib/utils";

/** Autre moniteur de la saison (couleur et initiales déjà prises). */
export interface OtherInstructor {
  id: string;
  color: string;
  initials: string;
  firstName: string;
  lastName: string;
}

export function instructorValues(instructor: Instructor): InstructorFormValues {
  return {
    lastName: instructor.lastName,
    firstName: instructor.firstName,
    phone: instructor.phone ?? "",
    email: instructor.email ?? "",
    color: instructor.color,
    initials: instructor.initials,
    active: instructor.active,
  };
}

interface InstructorFormProps {
  initialValues: InstructorFormValues;
  others: readonly OtherInstructor[];
  submitLabel: string;
  onSubmit: (input: InstructorInput) => Promise<void>;
  onCancel?: () => void;
  /** Consultation seule (saison archivée) : champs désactivés, sans bouton d'enregistrement. */
  readOnly?: boolean;
}

/**
 * Fiche moniteur (§3.3) : identité, couleur de la palette (§6) et initiales,
 * calculées à partir du nom tant qu'elles n'ont pas été modifiées à la main.
 */
export function InstructorForm({
  initialValues,
  others,
  submitLabel,
  onSubmit,
  onCancel,
  readOnly = false,
}: InstructorFormProps) {
  const [values, setValues] = useState(initialValues);
  const [initialsEdited, setInitialsEdited] = useState(initialValues.initials !== "");
  const { errors, setErrors, error, setError, changed } = useFormErrors<InstructorFormValues>();
  const [busy, setBusy] = useState(false);
  const takenInitials = others.map((o) => o.initials);
  useDirtyGuard(!sameValues(values, initialValues));
  const cancel = useGuardedCancel(onCancel);

  const update = (patch: Partial<InstructorFormValues>) => {
    // Les initiales suggérées changent avec le nom : leur erreur s'efface aussi.
    changed(
      !initialsEdited && ("firstName" in patch || "lastName" in patch)
        ? { ...patch, initials: "" }
        : patch,
    );
    setValues((current) => {
      const next = { ...current, ...patch };
      if (!initialsEdited && ("firstName" in patch || "lastName" in patch)) {
        next.initials = suggestInitials(next.firstName, next.lastName, takenInitials);
      }
      return next;
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = validate(instructorSchema, values);
    if (!result.ok) return setErrors(result.errors);
    setErrors({});
    setError(null);
    setBusy(true);
    try {
      await onSubmit(result.data);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const initialsTaken = takenInitials.some(
    (t) => t.toUpperCase() === values.initials.trim().toUpperCase(),
  );

  return (
    <form onSubmit={submit} noValidate className="grid gap-4" aria-label="Fiche moniteur">
      <fieldset disabled={readOnly} className="contents">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Prénom" required error={errors.firstName}>
            {(props) => (
              <Input
                {...props}
                value={values.firstName}
                onChange={(e) => update({ firstName: e.target.value })}
              />
            )}
          </Field>
          <Field label="Nom" required error={errors.lastName}>
            {(props) => (
              <Input
                {...props}
                value={values.lastName}
                onChange={(e) => update({ lastName: e.target.value })}
              />
            )}
          </Field>
          <Field label="Téléphone" error={errors.phone}>
            {(props) => (
              <Input
                {...props}
                type="tel"
                value={values.phone}
                onChange={(e) => update({ phone: e.target.value })}
              />
            )}
          </Field>
          <Field label="E-mail" error={errors.email}>
            {(props) => (
              <Input
                {...props}
                type="email"
                value={values.email}
                onChange={(e) => update({ email: e.target.value })}
              />
            )}
          </Field>
        </div>
        <Field
          label="Initiales"
          required
          error={errors.initials}
          hint={
            initialsTaken
              ? "Ces initiales sont déjà utilisées par un autre moniteur."
              : "Toujours affichées sur les cours (impression en noir et blanc, daltonisme)."
          }
          className="max-w-48"
        >
          {(props) => (
            <Input
              {...props}
              value={values.initials}
              maxLength={4}
              onChange={(e) => {
                setInitialsEdited(true);
                update({ initials: e.target.value });
              }}
            />
          )}
        </Field>
        <ColorPicker
          value={values.color}
          others={others}
          error={errors.color}
          onChange={(color) => update({ color })}
          initials={values.initials}
        />
        <Checkbox
          label="Actif (proposé dans le planning)"
          checked={values.active}
          onChange={(e) => update({ active: e.target.checked })}
        />
      </fieldset>
      {!readOnly && (
        <>
          <MessageZone label="Messages" messages={errorMessages(error)} />
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={busy}>
              {submitLabel}
            </Button>
            {cancel && (
              <Button type="button" variant="outline" onClick={cancel}>
                Annuler
              </Button>
            )}
          </div>
        </>
      )}
    </form>
  );
}

interface ColorPickerProps {
  value: string;
  others: readonly OtherInstructor[];
  error?: string;
  initials: string;
  onChange: (color: string) => void;
}

/** Palette de 16 couleurs ; les couleurs prises portent les initiales de leur moniteur. */
function ColorPicker({ value, others, error, initials, onChange }: ColorPickerProps) {
  const selected = normalizeColor(value);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-medium text-sm">Couleur</legend>
      <div role="radiogroup" aria-label="Couleur" className="flex flex-wrap gap-2">
        {INSTRUCTOR_PALETTE.map((color) => {
          const owners = others.filter((o) => normalizeColor(o.color) === color.value);
          const isSelected = color.value === selected;
          const ownersLabel = owners.map((o) => `${o.firstName} ${o.lastName}`).join(", ");
          return (
            // biome-ignore lint/a11y/useSemanticElements: nuancier en boutons radio (ARIA).
            <button
              key={color.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={
                owners.length > 0 ? `${color.name} (utilisée par ${ownersLabel})` : color.name
              }
              title={owners.length > 0 ? `${color.name} — ${ownersLabel}` : color.name}
              onClick={() => onChange(color.value)}
              className={cn(
                "flex size-9 items-center justify-center rounded-md font-semibold text-white text-xs ring-offset-2 ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected && "ring-2 ring-foreground",
              )}
              style={{ backgroundColor: color.value }}
            >
              {isSelected ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <span aria-hidden className="opacity-90">
                  {owners[0]?.initials ?? ""}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        Aperçu :
        <span
          className="rounded px-2 py-0.5 font-semibold text-white"
          style={{ backgroundColor: selected }}
        >
          {initials || "?"}
        </span>
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </fieldset>
  );
}
