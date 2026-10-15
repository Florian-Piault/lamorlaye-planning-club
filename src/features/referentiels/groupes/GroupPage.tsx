import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { ArrowLeft, GripVertical, Plus, TriangleAlert, UserMinus } from "lucide-react";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useReadOnly, useViewedSeason } from "@/app/season";
import { SearchInput } from "@/components/data/ListControls";
import { ErrorAlert } from "@/components/form/Field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  addGroupMember,
  deleteGroup,
  getGroup,
  getGroupUsage,
  listGroupMembers,
  removeGroupMember,
  setGroupActive,
  updateGroup,
} from "@/db/repositories/groups";
import { listLevels } from "@/db/repositories/levels";
import { listStudents } from "@/db/repositories/students";
import { ageOn, groupAlerts, isInAgeRange } from "@/domain/groups";
import { filterAndSort } from "@/domain/search";
import { errorMessage, useLoader } from "@/hooks/useLoader";
import { cn } from "@/lib/utils";
import { DeleteAction } from "../components/DeleteAction";
import { StatusBadge } from "../components/StatusBadge";
import { GroupForm, groupValues } from "./GroupForm";

const MAX_RESULTS = 8;

/** Zone de dépôt : la composition du groupe. */
const COMPOSITION_DROP = "composition";

interface CandidateData {
  studentId: string;
  name: string;
}

function dragName(data: unknown): string | null {
  return (data as CandidateData | undefined)?.name ?? null;
}

/**
 * Poignée d'un élève trouvé, à glisser sur la composition (§8). Le bouton
 * « Ajouter » reste l'équivalent au clavier : la poignée est hors de l'ordre
 * de tabulation.
 */
function DragHandle({ studentId, name }: CandidateData) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `eleve:${studentId}`,
    data: { studentId, name } satisfies CandidateData,
  });
  return (
    <button
      type="button"
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      tabIndex={-1}
      aria-label={`Glisser ${name} dans le groupe`}
      title="Glisser sur la composition du groupe"
      className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
    >
      <GripVertical className="size-4" aria-hidden />
    </button>
  );
}

function CompositionDropZone({ dragging, children }: { dragging: boolean; children: ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: COMPOSITION_DROP });
  return (
    <div
      ref={setNodeRef}
      data-testid="composition-drop"
      data-over={isOver || undefined}
      className={cn(
        "rounded-lg",
        dragging && "outline-2 outline-muted-foreground/40 outline-dashed outline-offset-4",
        isOver && "bg-accent/50 outline-primary",
      )}
    >
      {children}
    </div>
  );
}

/** Fiche d'un groupe et sa composition (§3.4, §8). */
export function GroupPage() {
  const { id = "" } = useParams();
  const { db } = useDatabase();
  const season = useViewedSeason();
  const readOnly = useReadOnly();
  const navigate = useNavigate();
  const load = useCallback(async () => {
    const [group, members, students, levels] = await Promise.all([
      getGroup(db, id),
      listGroupMembers(db, id),
      listStudents(db, season.id),
      listLevels(db),
    ]);
    return { group, members, students, levels };
  }, [db, id, season.id]);
  const { data, loading, reload } = useLoader(load);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const memberIds = useMemo(() => new Set(data?.members.map((m) => m.id)), [data]);
  const candidates = useMemo(
    () =>
      query.trim() === ""
        ? []
        : filterAndSort(
            (data?.students ?? []).filter((s) => !memberIds.has(s.id)),
            {
              query,
              searchFields: (s) => [s.lastName, s.firstName, s.phone, s.levelLabel],
              sort: { key: "name", direction: "asc" },
              sortValue: (s) => `${s.lastName} ${s.firstName}`,
            },
          ),
    [data, memberIds, query],
  );

  const run = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    }
    reload();
  };

  const group = data?.group;
  if (!group) {
    return loading ? (
      <p className="text-muted-foreground text-sm">Chargement…</p>
    ) : (
      <p className="text-sm">
        Groupe introuvable.{" "}
        <Link to="/referentiels/groupes" className="underline">
          Retour à la liste
        </Link>
      </p>
    );
  }

  const members = data.members;
  const alerts = groupAlerts(group, members, season.startDate);

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/referentiels/groupes"
        className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Groupes
      </Link>
      <div className="flex items-center gap-3">
        <h2 className="font-semibold text-lg">{group.name}</h2>
        <StatusBadge active={group.active} />
        {!readOnly && (
          <div className="ml-auto">
            <DeleteAction
              showLabel
              name={group.name}
              subject={`le groupe « ${group.name} »`}
              archived={!group.active}
              getUsage={() => getGroupUsage(db, id)}
              onDelete={async () => {
                await deleteGroup(db, id);
                navigate("/referentiels/groupes");
              }}
              onArchive={() => setGroupActive(db, id, false)}
              onDone={reload}
            />
          </div>
        )}
      </div>
      <ErrorAlert>{error}</ErrorAlert>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Fiche</CardTitle>
          </CardHeader>
          <CardContent>
            <GroupForm
              key={group.id}
              initialValues={groupValues(group)}
              levels={data.levels}
              submitLabel="Enregistrer"
              readOnly={readOnly}
              onSubmit={async (input) => {
                await updateGroup(db, id, input);
                reload();
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              Composition
              <Badge
                variant={alerts.overCapacity ? "destructive" : "secondary"}
                data-testid="group-size"
              >
                {members.length} / {group.maxSize}
              </Badge>
            </CardTitle>
            <CardDescription>Âges calculés au début de la saison.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {alerts.messages.length > 0 && (
              <ul aria-label="Alertes" className="flex flex-wrap gap-2">
                {alerts.messages.map((message) => (
                  <li key={message}>
                    <Badge variant="warning">
                      <TriangleAlert aria-hidden />
                      {message}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}

            <DndContext
              sensors={sensors}
              accessibility={{
                screenReaderInstructions: {
                  draggable:
                    "Glissez l'élève sur la composition du groupe pour l'y ajouter, ou utilisez le bouton « Ajouter ».",
                },
                announcements: {
                  onDragStart: () => "Élève saisi.",
                  onDragOver: () => undefined,
                  onDragMove: () => undefined,
                  onDragEnd: ({ over }) =>
                    over ? "Élève ajouté au groupe." : "Élève relâché hors du groupe.",
                  onDragCancel: () => "Glisser annulé.",
                },
              }}
              onDragStart={(event) => setDragged(dragName(event.active.data.current))}
              onDragCancel={() => setDragged(null)}
              onDragEnd={(event) => {
                setDragged(null);
                const data = event.active.data.current as CandidateData | undefined;
                if (event.over?.id === COMPOSITION_DROP && data) {
                  run(() => addGroupMember(db, id, data.studentId));
                }
              }}
            >
              {!readOnly && (
                <div className="flex flex-col gap-2">
                  <SearchInput
                    value={query}
                    onChange={setQuery}
                    label="Ajouter un élève (nom, prénom, téléphone)"
                    className="max-w-md"
                  />
                  {query.trim() !== "" && (
                    <ul aria-label="Élèves trouvés" className="divide-y rounded-lg border">
                      {candidates.length === 0 && (
                        <li className="px-3 py-2 text-muted-foreground text-sm">
                          Aucun élève trouvé.
                        </li>
                      )}
                      {candidates.slice(0, MAX_RESULTS).map((student) => {
                        const name = `${student.lastName} ${student.firstName}`;
                        return (
                          <li
                            key={student.id}
                            className="flex items-center gap-3 px-3 py-1.5 text-sm"
                          >
                            <DragHandle studentId={student.id} name={name} />
                            <span className="flex-1">
                              <span className="font-medium">{name}</span>
                              {student.birthDate && (
                                <span className="text-muted-foreground">
                                  {" "}
                                  — {ageOn(student.birthDate, season.startDate)} ans
                                </span>
                              )}
                              {student.levelLabel && (
                                <span className="text-muted-foreground">
                                  {" "}
                                  — {student.levelLabel}
                                </span>
                              )}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              aria-label={`Ajouter ${name}`}
                              onClick={() => run(() => addGroupMember(db, id, student.id))}
                            >
                              <Plus aria-hidden />
                              Ajouter
                            </Button>
                          </li>
                        );
                      })}
                      {candidates.length > MAX_RESULTS && (
                        <li className="px-3 py-2 text-muted-foreground text-xs">
                          {candidates.length - MAX_RESULTS} autres résultats : précisez la
                          recherche.
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              )}

              <CompositionDropZone dragging={dragged !== null}>
                <Table aria-label="Élèves du groupe">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Âge</TableHead>
                      <TableHead>Téléphone</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                          Aucun élève dans ce groupe.
                        </TableCell>
                      </TableRow>
                    )}
                    {members.map((student) => {
                      const name = `${student.lastName} ${student.firstName}`;
                      const inRange = isInAgeRange(group, student.birthDate, season.startDate);
                      return (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">{name}</TableCell>
                          <TableCell>
                            {student.birthDate ? (
                              <span className="inline-flex items-center gap-1">
                                {ageOn(student.birthDate, season.startDate)} ans
                                {!inRange && (
                                  <TriangleAlert
                                    className="size-3.5 text-amber-600"
                                    aria-label="Hors tranche d'âge"
                                  />
                                )}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>{student.phone}</TableCell>
                          <TableCell>
                            {!readOnly && (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Retirer ${name} du groupe`}
                                title="Retirer du groupe"
                                onClick={() => run(() => removeGroupMember(db, id, student.id))}
                              >
                                <UserMinus aria-hidden />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CompositionDropZone>
              <DragOverlay>
                {dragged && (
                  <div className="w-fit rounded-md border bg-card px-3 py-1.5 font-medium text-sm shadow-lg">
                    {dragged}
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
