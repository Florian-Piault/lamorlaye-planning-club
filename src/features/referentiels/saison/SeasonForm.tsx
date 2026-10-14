import { type FormEvent, useState } from "react";
import { ErrorAlert, Field } from "@/components/form/Field";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, Select } from "@/components/ui/input";
import type { Season } from "@/db/schema";
import { minutesToTime, WEEKDAYS } from "@/domain/time";
import {
  type FieldErrors,
  type SeasonFormValues,
  type SeasonInput,
  seasonSchema,
  validate,
} from "@/domain/validation";
import { errorMessage } from "@/hooks/useLoader";

/** Heures proposées pour l'amplitude, par demi-heure (06:00 → 23:30). */
const TIME_OPTIONS = Array.from({ length: 36 }, (_, i) => minutesToTime(6 * 60 + i * 30));

/** Valeurs par défaut : saison sportive de septembre à juin. */
export function defaultSeasonValues(today: Date = new Date()): SeasonFormValues {
  const year = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
  return {
    name: `${year}-${year + 1}`,
    startDate: `${year}-09-01`,
    endDate: `${year + 1}-06-30`,
    displayStartTime: "08:00",
    displayEndTime: "22:00",
    displayedDays: [1, 2, 3, 4, 5, 6, 7],
  };
}

export function seasonValues(season: Season): SeasonFormValues {
  return {
    name: season.name,
    startDate: season.startDate,
    endDate: season.endDate,
    displayStartTime: season.displayStartTime,
    displayEndTime: season.displayEndTime,
    displayedDays: season.displayedDays,
  };
}

interface SeasonFormProps {
  initialValues: SeasonFormValues;
  submitLabel: string;
  onSubmit: (input: SeasonInput) => Promise<void>;
  onCancel?: () => void;
}

/** Fiche saison : nom, dates, amplitude horaire et jours affichés (§3.1). */
export function SeasonForm({ initialValues, submitLabel, onSubmit, onCancel }: SeasonFormProps) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FieldErrors<SeasonFormValues>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof SeasonFormValues>(key: K, value: SeasonFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
  };

  const toggleDay = (day: number, checked: boolean) =>
    set(
      "displayedDays",
      checked ? [...values.displayedDays, day] : values.displayedDays.filter((d) => d !== day),
    );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = validate(seasonSchema, values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setError(null);
    setBusy(true);
    try {
      await onSubmit(result.data);
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid max-w-2xl gap-4" aria-label="Saison">
      <Field label="Nom" required error={errors.name}>
        {(props) => (
          <Input {...props} value={values.name} onChange={(e) => set("name", e.target.value)} />
        )}
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Date de début" required error={errors.startDate}>
          {(props) => (
            <Input
              {...props}
              type="date"
              value={values.startDate}
              onChange={(e) => set("startDate", e.target.value)}
            />
          )}
        </Field>
        <Field label="Date de fin" required error={errors.endDate}>
          {(props) => (
            <Input
              {...props}
              type="date"
              value={values.endDate}
              onChange={(e) => set("endDate", e.target.value)}
            />
          )}
        </Field>
        <Field label="Heure de début de la grille" error={errors.displayStartTime}>
          {(props) => (
            <Select
              {...props}
              value={values.displayStartTime}
              onChange={(e) => set("displayStartTime", e.target.value)}
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Heure de fin de la grille" error={errors.displayEndTime}>
          {(props) => (
            <Select
              {...props}
              value={values.displayEndTime}
              onChange={(e) => set("displayEndTime", e.target.value)}
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium text-sm">Jours affichés</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {WEEKDAYS.map((day) => (
            <Label key={day.value} className="font-normal">
              <Checkbox
                checked={values.displayedDays.includes(day.value)}
                onChange={(e) => toggleDay(day.value, e.target.checked)}
              />
              {day.label}
            </Label>
          ))}
        </div>
        {errors.displayedDays && <p className="text-destructive text-xs">{errors.displayedDays}</p>}
      </fieldset>
      <ErrorAlert>{error}</ErrorAlert>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
        )}
        {saved && (
          <output className="text-muted-foreground text-sm">Modifications enregistrées.</output>
        )}
      </div>
    </form>
  );
}
