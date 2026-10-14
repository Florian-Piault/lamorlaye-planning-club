import { type FormEvent, useState } from "react";
import { ErrorAlert, Field } from "@/components/form/Field";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, Select } from "@/components/ui/input";
import type { Group, Level } from "@/db/schema";
import {
  type FieldErrors,
  type GroupFormValues,
  type GroupInput,
  groupSchema,
  validate,
} from "@/domain/validation";
import { errorMessage } from "@/hooks/useLoader";

export const emptyGroupValues: GroupFormValues = {
  name: "",
  levelId: "",
  minAge: "",
  maxAge: "",
  maxSize: "8",
  active: true,
};

export function groupValues(group: Group): GroupFormValues {
  return {
    name: group.name,
    levelId: group.levelId ?? "",
    minAge: group.minAge?.toString() ?? "",
    maxAge: group.maxAge?.toString() ?? "",
    maxSize: group.maxSize.toString(),
    active: group.active,
  };
}

interface GroupFormProps {
  initialValues: GroupFormValues;
  levels: readonly Level[];
  submitLabel: string;
  onSubmit: (input: GroupInput) => Promise<void>;
  onCancel?: () => void;
  /** Consultation seule (saison archivée) : champs désactivés, sans bouton d'enregistrement. */
  readOnly?: boolean;
}

/** Fiche groupe (§3.4) : nom, niveau, tranche d'âge et effectif maximum. */
export function GroupForm({
  initialValues,
  levels,
  submitLabel,
  onSubmit,
  onCancel,
  readOnly = false,
}: GroupFormProps) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FieldErrors<GroupFormValues>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const set = (patch: Partial<GroupFormValues>) => {
    setSaved(false);
    setValues((v) => ({ ...v, ...patch }));
  };

  // Niveaux proposés : les actifs, plus le niveau actuel s'il est archivé.
  const options = levels.filter((l) => l.active || l.id === initialValues.levelId);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = validate(groupSchema, values);
    if (!result.ok) return setErrors(result.errors);
    setErrors({});
    setError(null);
    try {
      await onSubmit(result.data);
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-4" aria-label="Fiche groupe">
      <fieldset disabled={readOnly} className="contents">
        <Field label="Nom" required error={errors.name}>
          {(props) => (
            <Input {...props} value={values.name} onChange={(e) => set({ name: e.target.value })} />
          )}
        </Field>
        <Field label="Niveau" error={errors.levelId}>
          {(props) => (
            <Select
              {...props}
              value={values.levelId}
              onChange={(e) => set({ levelId: e.target.value })}
            >
              <option value="">— Aucun —</option>
              {options.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Âge minimum" error={errors.minAge}>
            {(props) => (
              <Input
                {...props}
                inputMode="numeric"
                value={values.minAge}
                onChange={(e) => set({ minAge: e.target.value })}
              />
            )}
          </Field>
          <Field label="Âge maximum" error={errors.maxAge}>
            {(props) => (
              <Input
                {...props}
                inputMode="numeric"
                value={values.maxAge}
                onChange={(e) => set({ maxAge: e.target.value })}
              />
            )}
          </Field>
          <Field label="Effectif maximum" required error={errors.maxSize}>
            {(props) => (
              <Input
                {...props}
                inputMode="numeric"
                value={values.maxSize}
                onChange={(e) => set({ maxSize: e.target.value })}
              />
            )}
          </Field>
        </div>
        <Label className="font-normal">
          <Checkbox checked={values.active} onChange={(e) => set({ active: e.target.checked })} />
          Actif (proposé dans le planning)
        </Label>
      </fieldset>
      <ErrorAlert>{error}</ErrorAlert>
      {!readOnly && (
        <div className="flex items-center gap-2">
          <Button type="submit">{submitLabel}</Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Annuler
            </Button>
          )}
          {saved && (
            <output className="text-muted-foreground text-sm">Modifications enregistrées.</output>
          )}
        </div>
      )}
    </form>
  );
}
