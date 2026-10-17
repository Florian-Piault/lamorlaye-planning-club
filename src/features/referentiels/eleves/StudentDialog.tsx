import { useToast } from "@/components/feedback/Toast";
import { Dialog } from "@/components/ui/dialog";
import { useDatabase } from "@/db/DatabaseProvider";
import type { GroupListItem } from "@/db/repositories/groups";
import {
  createStudent,
  type StudentIdentity,
  type StudentListItem,
  updateStudent,
} from "@/db/repositories/students";
import type { Level } from "@/db/schema";
import type { StudentFormValues } from "@/domain/validation";
import { emptyStudentValues, newStudentValues, StudentForm, studentValues } from "./StudentForm";

/**
 * Fiche élève ouverte. En création, `round` numérote les fiches d'une saisie
 * en série (« Enregistrer et ajouter un autre ») : chacune repart vide, avec
 * les groupes, le niveau et l'état « niveau choisi » de la précédente.
 */
export type StudentEditing =
  | {
      mode: "create";
      round: number;
      values: StudentFormValues;
      groupIds: string[];
      /** Niveau choisi par l'utilisatrice (sinon proposé depuis les groupes). */
      levelChosen: boolean;
    }
  | { mode: "edit"; student: StudentListItem }
  | null;

/**
 * Nouvelle fiche : groupes cochés et valeurs pré-remplies (« Créer « Léa
 * Martin » ») ; le niveau est proposé depuis les groupes.
 */
export function newStudentEditing(
  groupIds: string[],
  groups: readonly GroupListItem[],
  levels: readonly Level[],
  values: Partial<StudentFormValues> = {},
): StudentEditing {
  return {
    mode: "create",
    round: 0,
    values: newStudentValues(groupIds, groups, levels, values),
    groupIds,
    levelChosen: false,
  };
}

interface StudentDialogProps {
  editing: StudentEditing;
  onEditingChange: (editing: StudentEditing) => void;
  season: { id: string; startDate: string };
  readOnly?: boolean;
  /** Élèves de la saison (« Ouvrir sa fiche »), de toutes les saisons (doublons), groupes et niveaux. */
  students: readonly StudentListItem[];
  identities: readonly StudentIdentity[];
  groups: readonly GroupListItem[];
  levels: readonly Level[];
  /** Propose « Enregistrer et ajouter un autre » en création. */
  series?: boolean;
  /** Après chaque enregistrement : relecture des listes (résolue une fois relues). */
  onSaved: () => Promise<void>;
  /** Fenêtre fermée (annulée ou enregistrée). */
  onClosed?: () => void;
}

/**
 * Fenêtre de la fiche élève, commune à l'onglet Élèves et à la fiche groupe :
 * création (toast « Léa Martin ajouté(e) »), modification, « Ouvrir sa
 * fiche » et saisie en série.
 */
export function StudentDialog({
  editing,
  onEditingChange,
  season,
  readOnly = false,
  students,
  identities,
  groups,
  levels,
  series = false,
  onSaved,
  onClosed,
}: StudentDialogProps) {
  const { db } = useDatabase();
  const toast = useToast();
  const close = () => {
    onEditingChange(null);
    onClosed?.();
  };
  const added = (input: { firstName: string; lastName: string }) =>
    toast.success(`${input.firstName} ${input.lastName} ajouté(e)`);

  return (
    <Dialog
      open={editing !== null}
      onOpenChange={(open) => !open && close()}
      title={
        readOnly ? "Fiche élève" : editing?.mode === "edit" ? "Modifier l'élève" : "Nouvel élève"
      }
      className="max-w-2xl"
    >
      {editing && (
        <StudentForm
          // Nouvelle saisie à chaque fiche (« Ouvrir sa fiche », fiche suivante d'une série).
          key={editing.mode === "edit" ? editing.student.id : `create-${editing.round}`}
          readOnly={readOnly}
          season={season}
          studentId={editing.mode === "edit" ? editing.student.id : null}
          identities={identities}
          onOpenStudent={(id) => {
            const student = students.find((s) => s.id === id);
            if (student) onEditingChange({ mode: "edit", student });
          }}
          initialValues={editing.mode === "edit" ? studentValues(editing.student) : editing.values}
          initialGroupIds={
            editing.mode === "edit" ? editing.student.groups.map((g) => g.id) : editing.groupIds
          }
          initialLevelChosen={editing.mode === "edit" ? true : editing.levelChosen}
          levels={levels}
          groups={groups}
          submitLabel={editing.mode === "edit" ? "Enregistrer" : "Créer l'élève"}
          onCancel={close}
          onSubmit={async (input, groupIds) => {
            if (editing.mode === "edit") {
              await updateStudent(db, editing.student.id, input, groupIds);
            } else {
              await createStudent(db, season.id, input, groupIds);
              added(input);
            }
            close();
            await onSaved();
          }}
          onSubmitAndAddAnother={
            series && editing.mode === "create"
              ? async (input, groupIds, levelChosen) => {
                  await createStudent(db, season.id, input, groupIds);
                  // Doublons et effectifs à jour avant la fiche suivante.
                  await onSaved();
                  added(input);
                  onEditingChange({
                    mode: "create",
                    round: editing.round + 1,
                    values: { ...emptyStudentValues, levelId: input.levelId ?? "" },
                    groupIds,
                    levelChosen,
                  });
                }
              : undefined
          }
        />
      )}
    </Dialog>
  );
}
