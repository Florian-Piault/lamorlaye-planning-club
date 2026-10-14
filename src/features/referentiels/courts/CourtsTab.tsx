import { Pencil, Plus } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useReadOnly, useViewedSeason } from "@/app/season";
import { ErrorAlert, Field } from "@/components/form/Field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Input, Label, Select } from "@/components/ui/input";
import { useDatabase } from "@/db/DatabaseProvider";
import {
  createCourt,
  deleteCourt,
  getCourtUsage,
  listCourts,
  reorderCourts,
  setCourtActive,
  updateCourt,
} from "@/db/repositories/courts";
import type { Court } from "@/db/schema";
import {
  type CourtFormValues,
  type CourtInput,
  courtSchema,
  type FieldErrors,
  validate,
} from "@/domain/validation";
import { errorMessage, useLoader } from "@/hooks/useLoader";
import { DeleteAction } from "../components/DeleteAction";
import { SortableList } from "../components/SortableList";
import { StatusBadge } from "../components/StatusBadge";

const KIND_LABELS = { indoor: "Couvert", outdoor: "Extérieur" } as const;

type Editing = { mode: "create" } | { mode: "edit"; court: Court } | null;

export function CourtsTab() {
  const { db } = useDatabase();
  const season = useViewedSeason();
  const readOnly = useReadOnly();
  const load = useCallback(() => listCourts(db, season.id), [db, season.id]);
  const { data, reload } = useLoader(load);
  const [courts, setCourts] = useState<Court[]>([]);
  const [editing, setEditing] = useState<Editing>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) setCourts(data);
  }, [data]);

  const reorder = async (ordered: Court[]) => {
    setCourts(ordered);
    try {
      await reorderCourts(
        db,
        ordered.map((c) => c.id),
      );
    } catch (e) {
      setError(errorMessage(e));
    }
    reload();
  };

  return (
    <section className="flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-sm">
          {readOnly
            ? "Courts de la saison, dans leur ordre d'affichage dans le planning."
            : "Glissez les courts pour choisir leur ordre d'affichage dans le planning."}
        </p>
        {!readOnly && (
          <Button onClick={() => setEditing({ mode: "create" })}>
            <Plus aria-hidden />
            Nouveau court
          </Button>
        )}
      </div>
      <ErrorAlert>{error}</ErrorAlert>
      {courts.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
          Aucun court pour le moment.
        </p>
      ) : (
        <SortableList
          label="Courts"
          items={courts}
          itemName={(c) => c.name}
          onReorder={reorder}
          readOnly={readOnly}
          renderItem={(court) => (
            <>
              <span className="flex-1 truncate font-medium">{court.name}</span>
              <Badge variant="outline">{KIND_LABELS[court.kind]}</Badge>
              <StatusBadge active={court.active} />
              {!readOnly && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Modifier ${court.name}`}
                    title="Modifier"
                    onClick={() => setEditing({ mode: "edit", court })}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <DeleteAction
                    name={court.name}
                    subject={`le court « ${court.name} »`}
                    archived={!court.active}
                    getUsage={() => getCourtUsage(db, court.id)}
                    onDelete={() => deleteCourt(db, court.id)}
                    onArchive={() => setCourtActive(db, court.id, false)}
                    onDone={reload}
                  />
                </>
              )}
            </>
          )}
        />
      )}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing?.mode === "edit" ? "Modifier le court" : "Nouveau court"}
      >
        {editing && (
          <CourtForm
            initialValues={
              editing.mode === "edit"
                ? {
                    name: editing.court.name,
                    kind: editing.court.kind,
                    active: editing.court.active,
                  }
                : { name: `Court ${courts.length + 1}`, kind: "outdoor", active: true }
            }
            onCancel={() => setEditing(null)}
            onSubmit={async (input) => {
              if (editing.mode === "edit") await updateCourt(db, editing.court.id, input);
              else await createCourt(db, season.id, input);
              setEditing(null);
              reload();
            }}
          />
        )}
      </Dialog>
    </section>
  );
}

interface CourtFormProps {
  initialValues: CourtFormValues;
  onSubmit: (input: CourtInput) => Promise<void>;
  onCancel: () => void;
}

function CourtForm({ initialValues, onSubmit, onCancel }: CourtFormProps) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FieldErrors<CourtFormValues>>({});
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = validate(courtSchema, values);
    if (!result.ok) return setErrors(result.errors);
    try {
      await onSubmit(result.data);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <Field label="Nom" required error={errors.name}>
        {(props) => (
          <Input
            {...props}
            autoFocus
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
          />
        )}
      </Field>
      <Field label="Type" error={errors.kind}>
        {(props) => (
          <Select
            {...props}
            value={values.kind}
            onChange={(e) =>
              setValues({ ...values, kind: e.target.value as CourtFormValues["kind"] })
            }
          >
            <option value="outdoor">Extérieur</option>
            <option value="indoor">Couvert</option>
          </Select>
        )}
      </Field>
      <Label className="font-normal">
        <Checkbox
          checked={values.active}
          onChange={(e) => setValues({ ...values, active: e.target.checked })}
        />
        Actif (proposé dans le planning)
      </Label>
      <ErrorAlert>{error}</ErrorAlert>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit">Enregistrer</Button>
      </div>
    </form>
  );
}
