import { CalendarClock, ClipboardPaste, Pencil, Plus, ShieldCheck } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { Link } from "react-router";
import { useReadOnly, useViewedSeason } from "@/app/season";
import { EmptyRow, SearchInput, SortableHead } from "@/components/data/ListControls";
import { useToast } from "@/components/feedback/Toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Label, Select } from "@/components/ui/input";
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
  deleteStudent,
  listSeasonStudentAvailabilities,
  listStudentIdentities,
  listStudents,
  type StudentListItem,
} from "@/db/repositories/students";
import type { WeeklySlot } from "@/domain/availability";
import { studentDetails } from "@/domain/duplicates";
import { ageOn } from "@/domain/groups";
import { filterAndSort } from "@/domain/search";
import { formatContactPhone } from "@/domain/students";
import { formatDate } from "@/domain/time";
import { StudentPrivacyDialog } from "@/features/rgpd/StudentPrivacyDialog";
import { useListState } from "@/hooks/useListState";
import { errorMessage, useLoader } from "@/hooks/useLoader";
import { DeleteAction } from "../components/DeleteAction";
import { type AvailabilitySeries, AvailabilitySeriesDialog } from "./AvailabilitySeriesDialog";
import { newStudentEditing, StudentDialog, type StudentEditing } from "./StudentDialog";
import { startSeries } from "./series";

type SortKey = "name" | "age" | "level" | "ranking" | "groups";

export function StudentsTab() {
  const { db } = useDatabase();
  const season = useViewedSeason();
  const readOnly = useReadOnly();
  const [privacy, setPrivacy] = useState<string | null>(null);
  const toast = useToast();
  const load = useCallback(async () => {
    const [students, groups, levels, identities] = await Promise.all([
      listStudents(db, season.id),
      listGroups(db, season.id),
      listLevels(db),
      listStudentIdentities(db),
    ]);
    return { students, groups, levels, identities };
  }, [db, season.id]);
  const { data, reload } = useLoader(load);
  const { query, setQuery, sort, onSort } = useListState<SortKey>({
    key: "name",
    direction: "asc",
  });
  const [editing, setEditing] = useState<StudentEditing>(null);
  /** Filtre « Disponibilités non renseignées », combiné à la recherche. */
  const [missingOnly, setMissingOnly] = useState(false);
  /** Filtre « Groupe » : identifiant du groupe, ou "" pour tous. */
  const [groupId, setGroupId] = useState("");
  /** Lecture des plages avant l'ouverture de la série (bouton grisé, pas de double lancement). */
  const [launching, setLaunching] = useState(false);
  const [availabilitySeries, setAvailabilitySeries] = useState<AvailabilitySeries | null>(null);
  const levelOrder = useMemo(
    () => new Map((data?.levels ?? []).map((l) => [l.id, l.sortOrder])),
    [data],
  );

  // Rappels stables : les lignes (mémoïsées) ne sont redessinées que si leur élève change.
  const edit = useCallback((student: StudentListItem) => setEditing({ mode: "edit", student }), []);
  const showPrivacy = useCallback((id: string) => setPrivacy(id), []);
  const remove = useCallback((id: string) => deleteStudent(db, id), [db]);

  const students = data?.students ?? [];
  const rows = useMemo(
    () =>
      filterAndSort(
        (data?.students ?? []).filter(
          (s) =>
            (!missingOnly || !s.hasAvailabilities) &&
            (groupId === "" || s.groups.some((g) => g.id === groupId)),
        ),
        {
          query,
          searchFields: (s) => [
            s.lastName,
            s.firstName,
            s.phone,
            s.guardianPhone,
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
        },
      ),
    [data, query, sort, levelOrder, missingOnly, groupId],
  );

  /** Saisie en série sur la liste telle qu'elle est filtrée et triée à cet instant. */
  const startAvailabilitySeries = async () => {
    const series = startSeries(rows);
    if (!series || launching) return;
    setLaunching(true);
    try {
      const slots = new Map<string, WeeklySlot[]>();
      for (const slot of await listSeasonStudentAvailabilities(db, season.id)) {
        slots.set(slot.studentId, [...(slots.get(slot.studentId) ?? []), slot]);
      }
      setAvailabilitySeries({ series, slots });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLaunching(false);
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <SearchInput value={query} onChange={setQuery} label="Rechercher un élève" />
          <Label className="font-normal">
            Groupe
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">Tous les groupes</option>
              {(data?.groups ?? []).map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </Select>
          </Label>
          <Checkbox
            label="Disponibilités non renseignées"
            checked={missingOnly}
            onChange={(e) => setMissingOnly(e.target.checked)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-muted-foreground text-sm" data-testid="student-count">
            {rows.length === students.length
              ? `${students.length} élève${students.length > 1 ? "s" : ""}`
              : `${rows.length} sur ${students.length}`}
          </span>
          {!readOnly && (
            <>
              <Button
                variant="outline"
                disabled={rows.length === 0 || launching}
                disabledReason={
                  launching ? "Lecture des disponibilités…" : "Aucun élève dans la liste"
                }
                reasonSide="none"
                tooltip="Un élève après l'autre, dans l'ordre de la liste affichée"
                onClick={() => void startAvailabilitySeries()}
              >
                <CalendarClock aria-hidden />
                Saisir les disponibilités en série
              </Button>
              <Button asChild variant="outline">
                <Link to="/import-export?import">
                  <ClipboardPaste aria-hidden />
                  Importer ou coller une liste
                </Link>
              </Button>
              <Button
                onClick={() =>
                  setEditing(newStudentEditing([], data?.groups ?? [], data?.levels ?? []))
                }
              >
                <Plus aria-hidden />
                Nouvel élève
              </Button>
            </>
          )}
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
            <TableHead>Disponibilités</TableHead>
            <TableHead className="w-24">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <EmptyRow colSpan={8}>
              {students.length === 0 ? "Aucun élève pour le moment." : "Aucun résultat."}
            </EmptyRow>
          )}
          {rows.map((student) => (
            <StudentRow
              key={student.id}
              student={student}
              seasonStart={season.startDate}
              readOnly={readOnly}
              onEdit={edit}
              onPrivacy={showPrivacy}
              onDelete={remove}
              onDeleted={reload}
            />
          ))}
        </TableBody>
      </Table>

      <StudentDialog
        editing={editing}
        onEditingChange={setEditing}
        season={season}
        readOnly={readOnly}
        students={data?.students ?? []}
        identities={data?.identities ?? []}
        groups={data?.groups ?? []}
        levels={data?.levels ?? []}
        series
        onSaved={reload}
      />
      <AvailabilitySeriesDialog
        run={availabilitySeries}
        onRunChange={setAvailabilitySeries}
        onSaved={reload}
      />
      <StudentPrivacyDialog
        studentId={privacy}
        allowErase={!readOnly}
        onClose={() => setPrivacy(null)}
        onErased={(count) => {
          setPrivacy(null);
          toast.success(
            `Données de l'élève supprimées définitivement (${count} ${count > 1 ? "fiches" : "fiche"}).`,
          );
          reload();
        }}
      />
    </section>
  );
}

interface StudentRowProps {
  student: StudentListItem;
  seasonStart: string;
  readOnly: boolean;
  onEdit: (student: StudentListItem) => void;
  onPrivacy: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onDeleted: () => void;
}

/** Précisions de la confirmation de suppression : toujours naissance et groupes (homonymes). */
function details(student: StudentListItem): string {
  const text = studentDetails({ ...student, groups: student.groups.map((g) => g.name) });
  return text ? ` (${text})` : "";
}

/**
 * Ligne de la liste des élèves, mémoïsée : une recherche ou un tri parmi
 * 500 élèves (§11.5) ne redessine pas les lignes inchangées.
 */
const StudentRow = memo(function StudentRow({
  student,
  seasonStart,
  readOnly,
  onEdit,
  onPrivacy,
  onDelete,
  onDeleted,
}: StudentRowProps) {
  const name = `${student.lastName} ${student.firstName}`;
  return (
    <TableRow>
      <TableCell className="font-medium">
        <button type="button" className="text-left hover:underline" onClick={() => onEdit(student)}>
          {name}
        </button>
      </TableCell>
      <TableCell>
        {student.birthDate
          ? `${formatDate(student.birthDate)} (${ageOn(student.birthDate, seasonStart)} ans)`
          : "—"}
      </TableCell>
      <TableCell>{student.levelLabel ?? "—"}</TableCell>
      <TableCell>{student.fftRanking ?? "—"}</TableCell>
      <TableCell className="whitespace-nowrap">{formatContactPhone(student)}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {student.groups.map((g) => (
            <Badge key={g.id} variant="outline">
              {g.name}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {student.hasAvailabilities ? (
          "Renseignées"
        ) : (
          <span className="text-muted-foreground">Non renseignées</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex">
          {!readOnly && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Modifier ${name}`}
              tooltip="Modifier"
              onClick={() => onEdit(student)}
            >
              <Pencil aria-hidden />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            aria-label={`Données personnelles de ${name}`}
            tooltip="Consulter, exporter ou effacer ses données (RGPD)"
            onClick={() => onPrivacy(student.id)}
          >
            <ShieldCheck aria-hidden />
            Données personnelles
          </Button>
          {!readOnly && (
            <DeleteAction
              name={name}
              subject={`l'élève « ${name} »${details(student)}`}
              warning={
                student.groups.length > 0
                  ? `Il sera retiré de ${student.groups.length > 1 ? `ses ${student.groups.length} groupes` : "son groupe"} de cette saison. Pour effacer ses données de toutes les saisons, utilisez « Données personnelles ».`
                  : "Pour effacer ses données de toutes les saisons, utilisez « Données personnelles »."
              }
              onDelete={() => onDelete(student.id)}
              onDone={onDeleted}
            />
          )}
        </div>
      </TableCell>
    </TableRow>
  );
});
