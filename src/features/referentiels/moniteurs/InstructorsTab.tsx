import { Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useActiveSeason } from "@/app/season";
import { EmptyRow, SearchInput, SortableHead } from "@/components/data/ListControls";
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
import {
  createInstructor,
  deleteInstructor,
  getInstructorUsage,
  type InstructorWithAvailability,
  listInstructors,
  setInstructorActive,
} from "@/db/repositories/instructors";
import { totalWeeklyMinutes } from "@/domain/availability";
import { pickInstructorColor } from "@/domain/colors";
import { filterAndSort } from "@/domain/search";
import { formatDuration } from "@/domain/time";
import { useListState } from "@/hooks/useListState";
import { useLoader } from "@/hooks/useLoader";
import { DeleteAction } from "../components/DeleteAction";
import { StatusBadge } from "../components/StatusBadge";
import { InstructorForm } from "./InstructorForm";

type SortKey = "name" | "initials" | "phone" | "availability" | "active";

const fullName = (i: { firstName: string; lastName: string }) => `${i.firstName} ${i.lastName}`;

export function InstructorsTab() {
  const { db } = useDatabase();
  const season = useActiveSeason();
  const navigate = useNavigate();
  const load = useCallback(() => listInstructors(db, season.id), [db, season.id]);
  const { data, reload } = useLoader(load);
  const { query, setQuery, sort, onSort } = useListState<SortKey>({
    key: "name",
    direction: "asc",
  });
  const [creating, setCreating] = useState(false);
  const instructors = data ?? [];

  const rows = useMemo(
    () =>
      filterAndSort(data ?? [], {
        query,
        searchFields: (i) => [i.firstName, i.lastName, i.initials, i.phone, i.email],
        sort,
        sortValue: (i: InstructorWithAvailability, key: SortKey) => {
          switch (key) {
            case "name":
              return `${i.lastName} ${i.firstName}`;
            case "initials":
              return i.initials;
            case "phone":
              return i.phone;
            case "availability":
              return totalWeeklyMinutes(i.availabilities);
            case "active":
              return i.active;
          }
        },
      }),
    [data, query, sort],
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <SearchInput value={query} onChange={setQuery} label="Rechercher un moniteur" />
        <Button onClick={() => setCreating(true)}>
          <Plus aria-hidden />
          Nouveau moniteur
        </Button>
      </div>
      <Table aria-label="Moniteurs">
        <TableHeader>
          <TableRow>
            <SortableHead sortKey="initials" sort={sort} onSort={onSort} className="w-24">
              Initiales
            </SortableHead>
            <SortableHead sortKey="name" sort={sort} onSort={onSort}>
              Nom
            </SortableHead>
            <SortableHead sortKey="phone" sort={sort} onSort={onSort}>
              Téléphone
            </SortableHead>
            <TableHead>E-mail</TableHead>
            <SortableHead sortKey="availability" sort={sort} onSort={onSort}>
              Disponibilités
            </SortableHead>
            <SortableHead sortKey="active" sort={sort} onSort={onSort}>
              Statut
            </SortableHead>
            <TableHead className="w-12">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <EmptyRow colSpan={7}>
              {instructors.length === 0 ? "Aucun moniteur pour le moment." : "Aucun résultat."}
            </EmptyRow>
          )}
          {rows.map((instructor) => (
            <TableRow key={instructor.id}>
              <TableCell>
                <span
                  className="inline-flex min-w-9 justify-center rounded px-2 py-0.5 font-semibold text-white text-xs"
                  style={{ backgroundColor: instructor.color }}
                  data-testid="instructor-color"
                >
                  {instructor.initials}
                </span>
              </TableCell>
              <TableCell className="font-medium">
                <Link
                  to={instructor.id}
                  className="hover:underline focus-visible:underline focus-visible:outline-none"
                >
                  {instructor.lastName} {instructor.firstName}
                </Link>
              </TableCell>
              <TableCell>{instructor.phone}</TableCell>
              <TableCell>{instructor.email}</TableCell>
              <TableCell>
                {instructor.availabilities.length > 0
                  ? `${formatDuration(totalWeeklyMinutes(instructor.availabilities))} / sem.`
                  : "—"}
              </TableCell>
              <TableCell>
                <StatusBadge active={instructor.active} />
              </TableCell>
              <TableCell>
                <DeleteAction
                  name={fullName(instructor)}
                  subject={`le moniteur « ${fullName(instructor)} »`}
                  archived={!instructor.active}
                  getUsage={() => getInstructorUsage(db, instructor.id)}
                  onDelete={() => deleteInstructor(db, instructor.id)}
                  onArchive={() => setInstructorActive(db, instructor.id, false)}
                  onDone={reload}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog
        open={creating}
        onOpenChange={setCreating}
        title="Nouveau moniteur"
        description="Une couleur non utilisée est attribuée automatiquement."
        className="max-w-xl"
      >
        <InstructorForm
          initialValues={{
            firstName: "",
            lastName: "",
            phone: "",
            email: "",
            color: pickInstructorColor(instructors.map((i) => i.color)),
            initials: "",
            active: true,
          }}
          others={instructors}
          submitLabel="Créer le moniteur"
          onCancel={() => setCreating(false)}
          onSubmit={async (input) => {
            const id = await createInstructor(db, season.id, input);
            setCreating(false);
            navigate(id);
          }}
        />
      </Dialog>
    </section>
  );
}
