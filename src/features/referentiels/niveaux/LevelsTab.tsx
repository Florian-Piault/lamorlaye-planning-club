import { Pencil, Plus } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useReadOnly } from "@/app/season";
import { MessageZone } from "@/components/feedback/MessageZone";
import { errorMessages } from "@/components/feedback/messages";
import { ErrorAlert, Field } from "@/components/form/Field";
import { sameValues } from "@/components/form/formState";
import { useFormErrors } from "@/components/form/useFormErrors";
import { Button } from "@/components/ui/button";
import { Dialog, useDirtyGuard, useGuardedCancel } from "@/components/ui/dialog";
import { Checkbox, Input } from "@/components/ui/input";
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
import { type LevelFormValues, type LevelInput, levelSchema, validate } from "@/domain/validation";
import { errorMessage, useLoader } from "@/hooks/useLoader";
import { DeleteAction } from "../components/DeleteAction";
import { SortableList } from "../components/SortableList";
import { StatusBadge } from "../components/StatusBadge";

type Editing = { mode: "create" } | { mode: "edit"; level: Level } | null;

/** Référentiel des niveaux (§3.5 bis), commun à toutes les saisons. */
export function LevelsTab() {
  const { db } = useDatabase();
  // Pendant la consultation d'une saison archivée, tous les écrans sont en lecture seule.
  const readOnly = useReadOnly();
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
          Niveaux proposés pour les groupes et les élèves, communs à toutes les saisons.
          {readOnly ? " Modifiables depuis la saison en cours." : " Glissez pour changer l'ordre."}
        </p>
        {!readOnly && (
          <Button onClick={() => setEditing({ mode: "create" })}>
            <Plus aria-hidden />
            Nouveau niveau
          </Button>
        )}
      </div>
      <ErrorAlert>{error}</ErrorAlert>
      <SortableList
        label="Niveaux"
        items={levels}
        itemName={(l) => l.label}
        onReorder={reorder}
        readOnly={readOnly}
        renderItem={(level) => (
          <>
            <span className="flex-1 truncate font-medium">{level.label}</span>
            <StatusBadge active={level.active} />
            {!readOnly && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Modifier ${level.label}`}
                  tooltip="Modifier"
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
  const { errors, setErrors, error, setError, changed } = useFormErrors<LevelFormValues>();
  useDirtyGuard(!sameValues(values, initialValues));
  const cancel = useGuardedCancel(onCancel);
  const set = (patch: Partial<LevelFormValues>) => {
    changed(patch);
    setValues((v) => ({ ...v, ...patch }));
  };

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
          <Input {...props} value={values.label} onChange={(e) => set({ label: e.target.value })} />
        )}
      </Field>
      <Checkbox
        label="Actif (proposé dans les fiches)"
        checked={values.active}
        onChange={(e) => set({ active: e.target.checked })}
      />
      <MessageZone label="Messages" messages={errorMessages(error)} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={cancel}>
          Annuler
        </Button>
        <Button type="submit">Enregistrer</Button>
      </div>
    </form>
  );
}
