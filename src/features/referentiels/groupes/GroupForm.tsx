import { type FormEvent, useState } from "react";
import { MessageZone } from "@/components/feedback/MessageZone";
import { errorMessages } from "@/components/feedback/messages";
import { Field } from "@/components/form/Field";
import { sameValues } from "@/components/form/formState";
import { useFormErrors } from "@/components/form/useFormErrors";
import { Button } from "@/components/ui/button";
import { useDirtyGuard, useGuardedCancel } from "@/components/ui/dialog";
import { Checkbox, Input, Select } from "@/components/ui/input";
import type { Group, Level } from "@/db/schema";
import { type GroupFormValues, type GroupInput, groupSchema, validate } from "@/domain/validation";
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

/**
 * Fiche groupe (§3.4) : nom, niveau, tranche d'âge et effectif maximum. La
 * confirmation de l'enregistrement est un toast, émis par l'écran appelant.
 */
export function GroupForm({
  initialValues,
  levels,
  submitLabel,
  onSubmit,
  onCancel,
  readOnly = false,
}: GroupFormProps) {
  const [values, setValues] = useState(initialValues);
  const { errors, setErrors, error, setError, changed } = useFormErrors<GroupFormValues>();
  useDirtyGuard(!sameValues(values, initialValues));
  const cancel = useGuardedCancel(onCancel);
  const set = (patch: Partial<GroupFormValues>) => {
    changed(patch);
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
          <Field label="Élèves au maximum" required error={errors.maxSize}>
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
        <Checkbox
          label="Actif (proposé dans le planning)"
          checked={values.active}
          onChange={(e) => set({ active: e.target.checked })}
        />
      </fieldset>
      {!readOnly && (
        <>
          <MessageZone label="Messages" messages={errorMessages(error)} />
          <div className="flex items-center gap-2">
            <Button type="submit">{submitLabel}</Button>
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
