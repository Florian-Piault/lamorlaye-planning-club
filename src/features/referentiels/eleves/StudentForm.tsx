import { type FormEvent, useMemo, useState } from "react";
import { ErrorAlert, Field } from "@/components/form/Field";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, Select } from "@/components/ui/input";
import type { GroupListItem } from "@/db/repositories/groups";
import type { Level, Student } from "@/db/schema";
import { isMinor } from "@/domain/groups";
import { matchesSearch } from "@/domain/search";
import { isValidDate, todayIso } from "@/domain/time";
import {
  type FieldErrors,
  type StudentFormValues,
  type StudentInput,
  studentSchema,
  validate,
} from "@/domain/validation";
import { errorMessage } from "@/hooks/useLoader";

export const emptyStudentValues: StudentFormValues = {
  lastName: "",
  firstName: "",
  phone: "",
  birthDate: "",
  levelId: "",
  fftRanking: "",
  email: "",
  guardianName: "",
  guardianPhone: "",
};

export function studentValues(student: Student): StudentFormValues {
  return {
    lastName: student.lastName,
    firstName: student.firstName,
    phone: student.phone,
    birthDate: student.birthDate ?? "",
    levelId: student.levelId ?? "",
    fftRanking: student.fftRanking ?? "",
    email: student.email ?? "",
    guardianName: student.guardianName ?? "",
    guardianPhone: student.guardianPhone ?? "",
  };
}

interface StudentFormProps {
  initialValues: StudentFormValues;
  initialGroupIds: readonly string[];
  levels: readonly Level[];
  groups: readonly GroupListItem[];
  submitLabel: string;
  onSubmit: (input: StudentInput, groupIds: string[]) => Promise<void>;
  onCancel: () => void;
  /** Consultation seule (saison archivée) : champs désactivés, bouton « Fermer » seul. */
  readOnly?: boolean;
}

/** Fiche élève complète (§3.5), avec ses groupes. */
export function StudentForm({
  initialValues,
  initialGroupIds,
  levels,
  groups,
  submitLabel,
  onSubmit,
  onCancel,
  readOnly = false,
}: StudentFormProps) {
  const [values, setValues] = useState(initialValues);
  const [groupIds, setGroupIds] = useState<string[]>([...initialGroupIds]);
  const [groupQuery, setGroupQuery] = useState("");
  const [errors, setErrors] = useState<FieldErrors<StudentFormValues>>({});
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<StudentFormValues>) => setValues((v) => ({ ...v, ...patch }));

  const levelOptions = levels.filter((l) => l.active || l.id === initialValues.levelId);
  const groupOptions = useMemo(
    () =>
      groups.filter(
        (g) =>
          (g.active || initialGroupIds.includes(g.id)) &&
          matchesSearch([g.name, g.levelLabel], groupQuery),
      ),
    [groups, initialGroupIds, groupQuery],
  );
  const minor = isValidDate(values.birthDate) && isMinor(values.birthDate, todayIso());

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = validate(studentSchema, values);
    if (!result.ok) return setErrors(result.errors);
    setErrors({});
    setError(null);
    try {
      await onSubmit(result.data, groupIds);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const text = (key: keyof StudentFormValues, label: string, required = false, type = "text") => (
    <Field label={label} required={required} error={errors[key]}>
      {(props) => (
        <Input
          {...props}
          type={type}
          value={values[key]}
          onChange={(e) => set({ [key]: e.target.value })}
        />
      )}
    </Field>
  );

  return (
    <form onSubmit={submit} noValidate className="grid gap-4" aria-label="Fiche élève">
      <fieldset disabled={readOnly} className="contents">
        <div className="grid grid-cols-2 gap-4">
          {text("lastName", "Nom", true)}
          {text("firstName", "Prénom", true)}
          {text("phone", "Téléphone", true, "tel")}
          {text("email", "E-mail", false, "email")}
          {text("birthDate", "Date de naissance", false, "date")}
          <Field label="Niveau" error={errors.levelId}>
            {(props) => (
              <Select
                {...props}
                value={values.levelId}
                onChange={(e) => set({ levelId: e.target.value })}
              >
                <option value="">— Aucun —</option>
                {levelOptions.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {text("fftRanking", "Classement FFT")}
        </div>
        <fieldset className="grid gap-3 rounded-lg border p-3">
          <legend className="px-1 font-medium text-sm">Responsable légal</legend>
          {minor && (
            <p className="text-muted-foreground text-xs">
              Élève mineur : renseignez le nom et le téléphone du responsable légal.
            </p>
          )}
          <div className="grid grid-cols-2 gap-4">
            {text("guardianName", "Nom du responsable")}
            {text("guardianPhone", "Téléphone du responsable", false, "tel")}
          </div>
        </fieldset>
        <fieldset className="grid gap-2">
          <legend className="mb-2 font-medium text-sm">
            Groupes{groupIds.length > 0 && ` (${groupIds.length})`}
          </legend>
          {groups.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucun groupe dans la saison.</p>
          ) : (
            <>
              {groups.length > 6 && (
                <Input
                  type="search"
                  aria-label="Filtrer les groupes"
                  placeholder="Filtrer les groupes"
                  value={groupQuery}
                  onChange={(e) => setGroupQuery(e.target.value)}
                  className="max-w-xs"
                />
              )}
              <div className="grid max-h-40 grid-cols-2 gap-x-4 gap-y-1.5 overflow-y-auto">
                {groupOptions.map((group) => (
                  <Label key={group.id} className="font-normal">
                    <Checkbox
                      checked={groupIds.includes(group.id)}
                      onChange={(e) =>
                        setGroupIds((ids) =>
                          e.target.checked ? [...ids, group.id] : ids.filter((i) => i !== group.id),
                        )
                      }
                    />
                    <span className="truncate">{group.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {group.memberCount}/{group.maxSize}
                    </span>
                  </Label>
                ))}
              </div>
            </>
          )}
        </fieldset>
      </fieldset>
      <ErrorAlert>{error}</ErrorAlert>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {readOnly ? "Fermer" : "Annuler"}
        </Button>
        {!readOnly && <Button type="submit">{submitLabel}</Button>}
      </div>
    </form>
  );
}
