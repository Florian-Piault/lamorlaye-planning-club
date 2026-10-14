import { Pencil, Plus } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { ErrorAlert, Field } from "@/components/form/Field";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Input, Label } from "@/components/ui/input";
import { useDatabase } from "@/db/DatabaseProvider";
import {
  createLevel,
  deleteLevel,
  getLevelUsage,
  listLevels,
  reorderLevels,
  setLevelActive,
  updateLevel,
} from "@/db/repositories/levels";
import type { Level } from "@/db/schema";
import {
  type FieldErrors,
  type LevelFormValues,
  type LevelInput,
  levelSchema,
  validate,
} from "@/domain/validation";
import { errorMessage, useLoader } from "@/hooks/useLoader";
import { DeleteAction } from "../components/DeleteAction";
import { SortableList } from "../components/SortableList";
import { StatusBadge } from "../components/StatusBadge";

type Editing = { mode: "create" } | { mode: "edit"; level: Level } | null;

/** Référentiel des niveaux (§3.5 bis), commun à toutes les saisons. */
export function LevelsTab() {
  const { db } = useDatabase();
  const load = useCallback(() => listLevels(db), [db]);
  const { data, reload } = useLoader(load);
  const [levels, setLevels] = useState<Level[]>([]);
  const [editing, setEditing] = useState<Editing>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) setLevels(data);
  }, [data]);

  const reorder = async (ordered: Level[]) => {
    setLevels(ordered);
    try {
      await reorderLevels(
        db,
        ordered.map((l) => l.id),
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
          Niveaux proposés pour les groupes et les élèves, communs à toutes les saisons. Glissez
          pour changer l'ordre.
        </p>
        <Button onClick={() => setEditing({ mode: "create" })}>
          <Plus aria-hidden />
          Nouveau niveau
        </Button>
      </div>
      <ErrorAlert>{error}</ErrorAlert>
      <SortableList
        label="Niveaux"
        items={levels}
        itemName={(l) => l.label}
        onReorder={reorder}
        renderItem={(level) => (
          <>
            <span className="flex-1 truncate font-medium">{level.label}</span>
            <StatusBadge active={level.active} />
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Modifier ${level.label}`}
              title="Modifier"
              onClick={() => setEditing({ mode: "edit", level })}
            >
              <Pencil aria-hidden />
            </Button>
            <DeleteAction
              name={level.label}
              subject={`le niveau « ${level.label} »`}
              archived={!level.active}
              canDeleteWhenUsed
              warning="En cas de suppression, les groupes et élèves concernés n'auront plus de niveau."
              getUsage={() => getLevelUsage(db, level.id)}
              onDelete={() => deleteLevel(db, level.id)}
              onArchive={() => setLevelActive(db, level.id, false)}
              onDone={reload}
            />
          </>
        )}
      />
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing?.mode === "edit" ? "Modifier le niveau" : "Nouveau niveau"}
      >
        {editing && (
          <LevelForm
            initialValues={
              editing.mode === "edit"
                ? { label: editing.level.label, active: editing.level.active }
                : { label: "", active: true }
            }
            onCancel={() => setEditing(null)}
            onSubmit={async (input) => {
              if (editing.mode === "edit") await updateLevel(db, editing.level.id, input);
              else await createLevel(db, input);
              setEditing(null);
              reload();
            }}
          />
        )}
      </Dialog>
    </section>
  );
}

interface LevelFormProps {
  initialValues: LevelFormValues;
  onSubmit: (input: LevelInput) => Promise<void>;
  onCancel: () => void;
}

function LevelForm({ initialValues, onSubmit, onCancel }: LevelFormProps) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FieldErrors<LevelFormValues>>({});
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = validate(levelSchema, values);
    if (!result.ok) return setErrors(result.errors);
    try {
      await onSubmit(result.data);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <Field label="Libellé" required error={errors.label}>
        {(props) => (
          <Input
            {...props}
            autoFocus
            value={values.label}
            onChange={(e) => setValues({ ...values, label: e.target.value })}
          />
        )}
      </Field>
      <Label className="font-normal">
        <Checkbox
          checked={values.active}
          onChange={(e) => setValues({ ...values, active: e.target.checked })}
        />
        Actif (proposé dans les fiches)
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
