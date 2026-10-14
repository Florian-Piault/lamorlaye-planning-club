import { Pencil, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { ErrorAlert, Field } from "@/components/form/Field";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Input, Label } from "@/components/ui/input";
import type { UnavailabilityInput } from "@/db/repositories/instructors";
import type { InstructorUnavailability } from "@/db/schema";
import {
  describeUnavailability,
  parseUnavailabilityForm,
  toUnavailabilityForm,
  type UnavailabilityErrors,
  type UnavailabilityForm,
} from "@/domain/unavailability";
import { errorMessage } from "@/hooks/useLoader";

interface UnavailabilitySectionProps {
  unavailabilities: readonly InstructorUnavailability[];
  onAdd: (input: UnavailabilityInput) => Promise<void>;
  onUpdate: (id: string, input: UnavailabilityInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const emptyForm: UnavailabilityForm = {
  allDay: true,
  startDate: "",
  startTime: "08:00",
  endDate: "",
  endTime: "12:00",
  reason: "",
};

/** Heures proposées si l'utilisateur décoche « Journées entières ». */
const withDefaultTimes = (form: UnavailabilityForm): UnavailabilityForm => ({
  ...form,
  startTime: form.startTime || emptyForm.startTime,
  endTime: form.endTime || emptyForm.endTime,
});

/** Indisponibilités datées d'un moniteur (congé, maladie, tournoi…). */
export function UnavailabilitySection({
  unavailabilities,
  onAdd,
  onUpdate,
  onDelete,
}: UnavailabilitySectionProps) {
  const [editing, setEditing] = useState<InstructorUnavailability | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {unavailabilities.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucune indisponibilité.</p>
      ) : (
        <ul aria-label="Indisponibilités" className="divide-y rounded-lg border">
          {unavailabilities.map((u) => {
            const period = describeUnavailability(u);
            return (
              <li key={u.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="flex-1">
                  <span className="font-medium">
                    {period.charAt(0).toUpperCase() + period.slice(1)}
                  </span>
                  {u.reason && <span className="text-muted-foreground"> — {u.reason}</span>}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Modifier l'indisponibilité ${period}`}
                  onClick={() => setEditing(u)}
                >
                  <Pencil aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Supprimer l'indisponibilité ${period}`}
                  onClick={async () => {
                    try {
                      await onDelete(u.id);
                    } catch (e) {
                      setError(errorMessage(e));
                    }
                  }}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <ErrorAlert>{error}</ErrorAlert>
      <UnavailabilityFormView
        key={unavailabilities.length}
        initialValues={emptyForm}
        submitLabel="Ajouter l'indisponibilité"
        onSubmit={onAdd}
      />
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="Modifier l'indisponibilité"
      >
        {editing && (
          <UnavailabilityFormView
            initialValues={withDefaultTimes(toUnavailabilityForm(editing))}
            submitLabel="Enregistrer"
            onSubmit={async (input) => {
              await onUpdate(editing.id, input);
              setEditing(null);
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

function UnavailabilityFormView({
  initialValues,
  submitLabel,
  onSubmit,
}: {
  initialValues: UnavailabilityForm;
  submitLabel: string;
  onSubmit: (input: UnavailabilityInput) => Promise<void>;
}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<UnavailabilityErrors>({});
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<UnavailabilityForm>) => setValues((v) => ({ ...v, ...patch }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = parseUnavailabilityForm(values);
    if (!result.ok) return setErrors(result.errors);
    setErrors({});
    setError(null);
    try {
      await onSubmit(result.value);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label={submitLabel}
      className="grid gap-3 rounded-lg border border-dashed p-3"
    >
      <Label className="font-normal">
        <Checkbox checked={values.allDay} onChange={(e) => set({ allDay: e.target.checked })} />
        Journées entières
      </Label>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Field label="Du" required error={errors.startDate}>
          {(props) => (
            <Input
              {...props}
              type="date"
              value={values.startDate}
              onChange={(e) => set({ startDate: e.target.value })}
            />
          )}
        </Field>
        {!values.allDay && (
          <Field label="À partir de" error={errors.startTime}>
            {(props) => (
              <Input
                {...props}
                type="time"
                step={900}
                value={values.startTime}
                onChange={(e) => set({ startTime: e.target.value })}
              />
            )}
          </Field>
        )}
        <Field
          label="Au"
          error={errors.endDate}
          hint={values.allDay ? "Inclus ; vide = un seul jour." : undefined}
        >
          {(props) => (
            <Input
              {...props}
              type="date"
              value={values.endDate}
              onChange={(e) => set({ endDate: e.target.value })}
            />
          )}
        </Field>
        {!values.allDay && (
          <Field label="Jusqu'à" error={errors.endTime}>
            {(props) => (
              <Input
                {...props}
                type="time"
                step={900}
                value={values.endTime}
                onChange={(e) => set({ endTime: e.target.value })}
              />
            )}
          </Field>
        )}
      </div>
      <Field label="Motif" hint="Congé, maladie, tournoi…">
        {(props) => (
          <Input
            {...props}
            value={values.reason}
            onChange={(e) => set({ reason: e.target.value })}
          />
        )}
      </Field>
      <ErrorAlert>{error}</ErrorAlert>
      <div>
        <Button type="submit" variant="outline">
          <Plus aria-hidden />
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
