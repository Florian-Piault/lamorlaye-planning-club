import { Plus, TriangleAlert } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useReadOnly, useViewedSeason } from "@/app/season";
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
  createGroup,
  deleteGroup,
  type GroupListItem,
  getGroupUsage,
  listGroups,
  setGroupActive,
} from "@/db/repositories/groups";
import { listLevels } from "@/db/repositories/levels";
import { describeAgeRange } from "@/domain/groups";
import { filterAndSort } from "@/domain/search";
import { useListState } from "@/hooks/useListState";
import { useLoader } from "@/hooks/useLoader";
import { cn } from "@/lib/utils";
import { DeleteAction } from "../components/DeleteAction";
import { StatusBadge } from "../components/StatusBadge";
import { emptyGroupValues, GroupForm } from "./GroupForm";

type SortKey = "name" | "level" | "age" | "size" | "active";

export function GroupsTab() {
  const { db } = useDatabase();
  const season = useViewedSeason();
  const readOnly = useReadOnly();
  const navigate = useNavigate();
  const load = useCallback(
    async () => ({ groups: await listGroups(db, season.id), levels: await listLevels(db) }),
    [db, season.id],
  );
  const { data, reload } = useLoader(load);
  const { query, setQuery, sort, onSort } = useListState<SortKey>({
    key: "name",
    direction: "asc",
  });
  const [creating, setCreating] = useState(false);
  const levelOrder = useMemo(
    () => new Map((data?.levels ?? []).map((l) => [l.id, l.sortOrder])),
    [data],
  );

  const rows = useMemo(
    () =>
      filterAndSort(data?.groups ?? [], {
        query,
        searchFields: (g) => [g.name, g.levelLabel],
        sort,
        sortValue: (g: GroupListItem, key: SortKey) => {
          switch (key) {
            case "name":
              return g.name;
            case "level":
              return g.levelId ? (levelOrder.get(g.levelId) ?? null) : null;
            case "age":
              return g.minAge ?? g.maxAge;
            case "size":
              return g.memberCount;
            case "active":
              return g.active;
          }
        },
      }),
    [data, query, sort, levelOrder],
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <SearchInput value={query} onChange={setQuery} label="Rechercher un groupe" />
        {!readOnly && (
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            Nouveau groupe
          </Button>
        )}
      </div>
      <Table aria-label="Groupes">
        <TableHeader>
          <TableRow>
            <SortableHead sortKey="name" sort={sort} onSort={onSort}>
              Nom
            </SortableHead>
            <SortableHead sortKey="level" sort={sort} onSort={onSort}>
              Niveau
            </SortableHead>
            <SortableHead sortKey="age" sort={sort} onSort={onSort}>
              Âge
            </SortableHead>
            <SortableHead sortKey="size" sort={sort} onSort={onSort}>
              Nombre d'élèves
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
            <EmptyRow colSpan={6}>
              {(data?.groups.length ?? 0) === 0
                ? "Aucun groupe pour le moment."
                : "Aucun résultat."}
            </EmptyRow>
          )}
          {rows.map((group) => {
            const over = group.memberCount > group.maxSize;
            return (
              <TableRow key={group.id}>
                <TableCell className="font-medium">
                  <Link to={group.id} className="hover:underline">
                    {group.name}
                  </Link>
                </TableCell>
                <TableCell>{group.levelLabel ?? "—"}</TableCell>
                <TableCell>{describeAgeRange(group.minAge, group.maxAge)}</TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1",
                      over && "font-medium text-destructive",
                    )}
                  >
                    {over && <TriangleAlert className="size-3.5" aria-label="Groupe trop plein" />}
                    {group.memberCount} / {group.maxSize}
                  </span>
                </TableCell>
                <TableCell>
                  <StatusBadge active={group.active} />
                </TableCell>
                <TableCell>
                  {!readOnly && (
                    <DeleteAction
                      name={group.name}
                      subject={`le groupe « ${group.name} »`}
                      archived={!group.active}
                      warning={
                        group.memberCount > 0
                          ? "Les élèves du groupe sont conservés ; seule leur inscription dans ce groupe est retirée."
                          : undefined
                      }
                      getUsage={() => getGroupUsage(db, group.id)}
                      onDelete={() => deleteGroup(db, group.id)}
                      onArchive={() => setGroupActive(db, group.id, false)}
                      onDone={reload}
                    />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={creating} onOpenChange={setCreating} title="Nouveau groupe">
        <GroupForm
          initialValues={emptyGroupValues}
          levels={data?.levels ?? []}
          submitLabel="Créer le groupe"
          onCancel={() => setCreating(false)}
          onSubmit={async (input) => {
            const id = await createGroup(db, season.id, input);
            setCreating(false);
            navigate(id);
          }}
        />
      </Dialog>
    </section>
  );
}
