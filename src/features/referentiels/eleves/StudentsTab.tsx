import { Pencil, Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useActiveSeason } from "@/app/season";
import { EmptyRow, SearchInput, SortableHead } from "@/components/data/ListControls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDatabase } from "@/db/DatabaseProvider";
import { listGroups } from "@/db/repositories/groups";
import { listLevels } from "@/db/repositories/levels";
import {
  createStudent,
  deleteStudent,
  listStudents,
  type StudentListItem,
  updateStudent,
} from "@/db/repositories/students";
import { ageOn } from "@/domain/groups";
import { filterAndSort } from "@/domain/search";
import { formatDate } from "@/domain/time";
import { useListState } from "@/hooks/useListState";
import { useLoader } from "@/hooks/useLoader";
import { DeleteAction } from "../components/DeleteAction";
import { emptyStudentValues, StudentForm, studentValues } from "./StudentForm";

type SortKey = "name" | "age" | "level" | "ranking" | "groups";

type Editing = { mode: "create" } | { mode: "edit"; student: StudentListItem } | null;

export function StudentsTab() {
  const { db } = useDatabase();
  const season = useActiveSeason();
  const load = useCallback(async () => {
    const [students, groups, levels] = await Promise.all([
      listStudents(db, season.id),
      listGroups(db, season.id),
      listLevels(db),
    ]);
    return { students, groups, levels };
  }, [db, season.id]);
  const { data, reload } = useLoader(load);
  const { query, setQuery, sort, onSort } = useListState<SortKey>({
    key: "name",
    direction: "asc",
  });
  const [editing, setEditing] = useState<Editing>(null);
  const levelOrder = useMemo(
    () => new Map((data?.levels ?? []).map((l) => [l.id, l.sortOrder])),
    [data],
  );

  const students = data?.students ?? [];
  const rows = useMemo(
    () =>
      filterAndSort(data?.students ?? [], {
        query,
        searchFields: (s) => [
          s.lastName,
          s.firstName,
          s.phone,
          s.email,
          s.levelLabel,
          s.fftRanking,
          s.guardianName,
          ...s.groups.map((g) => g.name),
        ],
        sort,
        sortValue: (s: StudentListItem, key: SortKey) => {
          switch (key) {
            case "name":
              return `${s.lastName} ${s.firstName}`;
            case "age":
              // Tri par âge : du plus jeune au plus âgé.
              return s.birthDate ? -Date.parse(s.birthDate) : null;
            case "level":
              return s.levelId ? (levelOrder.get(s.levelId) ?? null) : null;
            case "ranking":
              return s.fftRanking;
            case "groups":
              return s.groups.map((g) => g.name).join(", ");
          }
        },
      }),
    [data, query, sort, levelOrder],
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <SearchInput value={query} onChange={setQuery} label="Rechercher un élève" />
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground text-sm" data-testid="student-count">
            {rows.length === students.length
              ? `${students.length} élève${students.length > 1 ? "s" : ""}`
              : `${rows.length} sur ${students.length}`}
          </span>
          <Button onClick={() => setEditing({ mode: "create" })}>
            <Plus aria-hidden />
            Nouvel élève
          </Button>
        </div>
      </div>
      <Table aria-label="Élèves">
        <TableHeader>
          <TableRow>
            <SortableHead sortKey="name" sort={sort} onSort={onSort}>
              Nom
            </SortableHead>
            <SortableHead sortKey="age" sort={sort} onSort={onSort}>
              Naissance
            </SortableHead>
            <SortableHead sortKey="level" sort={sort} onSort={onSort}>
              Niveau
            </SortableHead>
            <SortableHead sortKey="ranking" sort={sort} onSort={onSort}>
              Classement
            </SortableHead>
            <TableHead>Téléphone</TableHead>
            <SortableHead sortKey="groups" sort={sort} onSort={onSort}>
              Groupes
            </SortableHead>
            <TableHead className="w-24">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <EmptyRow colSpan={7}>
              {students.length === 0 ? "Aucun élève pour le moment." : "Aucun résultat."}
            </EmptyRow>
          )}
          {rows.map((student) => {
            const name = `${student.lastName} ${student.firstName}`;
            return (
              <TableRow key={student.id}>
                <TableCell className="font-medium">
                  <button
                    type="button"
                    className="text-left hover:underline"
                    onClick={() => setEditing({ mode: "edit", student })}
                  >
                    {name}
                  </button>
                </TableCell>
                <TableCell>
                  {student.birthDate
                    ? `${formatDate(student.birthDate)} (${ageOn(student.birthDate, season.startDate)} ans)`
                    : "—"}
                </TableCell>
                <TableCell>{student.levelLabel ?? "—"}</TableCell>
                <TableCell>{student.fftRanking ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{student.phone}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {student.groups.map((g) => (
                      <Badge key={g.id} variant="outline">
                        {g.name}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Modifier ${name}`}
                      title="Modifier"
                      onClick={() => setEditing({ mode: "edit", student })}
                    >
                      <Pencil aria-hidden />
                    </Button>
                    <DeleteAction
                      name={name}
                      subject={`l'élève « ${name} »`}
                      warning={
                        student.groups.length > 0
                          ? `Il sera retiré de ${student.groups.length > 1 ? `ses ${student.groups.length} groupes` : "son groupe"}.`
                          : undefined
                      }
                      onDelete={() => deleteStudent(db, student.id)}
                      onDone={reload}
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing?.mode === "edit" ? "Modifier l'élève" : "Nouvel élève"}
        className="max-w-2xl"
      >
        {editing && (
          <StudentForm
            initialValues={
              editing.mode === "edit" ? studentValues(editing.student) : emptyStudentValues
            }
            initialGroupIds={editing.mode === "edit" ? editing.student.groups.map((g) => g.id) : []}
            levels={data?.levels ?? []}
            groups={data?.groups ?? []}
            submitLabel={editing.mode === "edit" ? "Enregistrer" : "Créer l'élève"}
            onCancel={() => setEditing(null)}
            onSubmit={async (input, groupIds) => {
              if (editing.mode === "edit")
                await updateStudent(db, editing.student.id, input, groupIds);
              else await createStudent(db, season.id, input, groupIds);
              setEditing(null);
              reload();
            }}
          />
        )}
      </Dialog>
    </section>
  );
}
