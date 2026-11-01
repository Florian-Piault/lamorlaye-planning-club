import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  ArrowLeft,
  ClipboardPaste,
  GripVertical,
  Plus,
  TriangleAlert,
  UserMinus,
  UserPlus,
} from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { useReadOnly, useViewedSeason } from "@/app/season";
import { SearchInput } from "@/components/data/ListControls";
import { MessageZone } from "@/components/feedback/MessageZone";
import { errorMessages, warnings } from "@/components/feedback/messages";
import { useToast } from "@/components/feedback/Toast";
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
import { Tooltip } from "@/components/ui/tooltip";
import { useDatabase } from "@/db/DatabaseProvider";
import {
  addGroupMember,
  deleteGroup,
  getGroup,
  getGroupUsage,
  listGroupLessons,
  listGroupMembers,
  listGroups,
  removeGroupMember,
  setGroupActive,
  updateGroup,
} from "@/db/repositories/groups";
import { listLevels } from "@/db/repositories/levels";
import {
  listSeasonStudentAvailabilities,
  listStudentIdentities,
  listStudents,
  type StudentListItem,
} from "@/db/repositories/students";
import type { WeeklySlot } from "@/domain/availability";
import { todayInParis } from "@/domain/dates";
import { homonymKeys, nameKey, studentDetails } from "@/domain/duplicates";
import { ageOn, groupAlerts, isInAgeRange } from "@/domain/groups";
import { filterAndSort } from "@/domain/search";
import { formatContactPhone, splitFullName } from "@/domain/students";
import { errorMessage, useLoader } from "@/hooks/useLoader";
import { cn } from "@/lib/utils";
import { DeleteAction } from "../components/DeleteAction";
import { StatusBadge } from "../components/StatusBadge";
import { newStudentEditing, StudentDialog, type StudentEditing } from "../eleves/StudentDialog";
import {
  blockingLessons,
  blockingSummary,
  blockingText,
  groupLessonRanges,
  rankCandidates,
  unavailableMembersMessage,
} from "./composition";
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
 * Élève trouvé, option de la liste déroulante du champ « Ajouter un élève » :
 * un clic (ou Entrée sur l'option en surbrillance) l'ajoute ; il se glisse
 * aussi sur la liste des élèves du groupe (§8). Le focus reste dans le champ.
 */
function CandidateOption({
  optionId,
  studentId,
  name,
  label,
  selected,
  onPick,
  children,
}: CandidateData & {
  optionId: string;
  label: string;
  selected: boolean;
  onPick: () => void;
  children: ReactNode;
}) {
  // Seuls les écouteurs du glisser sont repris : l'option garde son rôle et reste hors tabulation.
  const { listeners, setNodeRef } = useDraggable({
    id: `eleve:${studentId}`,
    data: { studentId, name } satisfies CandidateData,
  });
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: le clavier passe par le champ (↑/↓, Entrée, aria-activedescendant).
    <div
      id={optionId}
      ref={setNodeRef}
      role="option"
      tabIndex={-1}
      aria-selected={selected}
      aria-label={label}
      {...listeners}
      // Le focus reste dans le champ de recherche.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPick}
      className={cn(
        "flex cursor-pointer touch-none items-center gap-3 px-3 py-1.5 text-sm hover:bg-accent/60",
        selected && "bg-accent text-accent-foreground",
      )}
    >
      <GripVertical className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      {children}
      <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </div>
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
  const location = useLocation();
  const toast = useToast();
  const load = useCallback(async () => {
    const [group, members, students, levels, groups, identities, lessons, slots] =
      await Promise.all([
        getGroup(db, id),
        listGroupMembers(db, id),
        listStudents(db, season.id),
        listLevels(db),
        listGroups(db, season.id),
        listStudentIdentities(db),
        listGroupLessons(db, id),
        listSeasonStudentAvailabilities(db, season.id),
      ]);
    const availabilities = new Map<string, WeeklySlot[]>();
    for (const slot of slots) {
      const list = availabilities.get(slot.studentId) ?? [];
      list.push(slot);
      availabilities.set(slot.studentId, list);
    }
    return { group, members, students, levels, groups, identities, lessons, availabilities };
  }, [db, id, season.id]);
  const { data, loading, reload } = useLoader(load);
  const [query, setQuery] = useState("");
  const [resultsOpen, setResultsOpen] = useState(false);
  /** Option en surbrillance (↑/↓), choisie par Entrée ; -1 : aucune. */
  const [highlight, setHighlight] = useState(-1);
  /** Fiche élève ouverte depuis la recherche (« Créer « Léa Martin » », « Ouvrir sa fiche »). */
  const [editing, setEditing] = useState<StudentEditing>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const hintId = useId();
  const focusTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const focusSearch = useCallback(() => {
    // Après le rendu : l'élément cliqué (option, fenêtre) a pu disparaître.
    clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => inputRef.current?.focus());
  }, []);
  useEffect(() => () => clearTimeout(focusTimer.current), []);
  // Arrivée depuis le toast « Ajouter des élèves » : champ d'ajout prêt.
  const addStudents = (location.state as { addStudents?: boolean } | null)?.addStudents === true;
  const ready = data?.group !== undefined;
  useEffect(() => {
    if (addStudents && ready) inputRef.current?.focus();
  }, [addStudents, ready]);
  const [error, setError] = useState<string | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);

  // Résultats superposés : refermés par un clic en dehors (ou Échap), sans décaler la composition.
  useEffect(() => {
    if (!resultsOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setResultsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [resultsOpen]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const memberIds = useMemo(() => new Set(data?.members.map((m) => m.id)), [data]);
  // Compatibilité avec les cours du groupe, au planning habituel (§8) : cours qui coincent par élève.
  const blocking = useMemo(() => {
    const ranges = groupLessonRanges(data?.lessons ?? [], season, todayInParis());
    const result = new Map<string, string[]>();
    for (const [studentId, slots] of data?.availabilities ?? []) {
      const lessons = blockingLessons(slots, ranges);
      if (lessons.length > 0) result.set(studentId, lessons);
    }
    return result;
  }, [data, season]);
  // Homonymes de la saison : désignés avec leur date de naissance et leurs groupes.
  const homonyms = useMemo(() => homonymKeys(data?.students ?? []), [data]);
  const search = useCallback(
    (list: readonly StudentListItem[]) =>
      query.trim() === ""
        ? []
        : filterAndSort(list, {
            query,
            searchFields: (s) => [s.lastName, s.firstName, s.phone, s.guardianPhone, s.levelLabel],
            sort: { key: "name", direction: "asc" },
            sortValue: (s) => `${s.lastName} ${s.firstName}`,
          }),
    [query],
  );
  const candidates = useMemo(
    () => search((data?.students ?? []).filter((s) => !memberIds.has(s.id))),
    [data, memberIds, search],
  );
  // Proposés : compatibles en tête (ordre alphabétique gardé dans chaque catégorie), puis coupés.
  const shown = useMemo(
    () => rankCandidates(candidates, (s) => !blocking.has(s.id), MAX_RESULTS),
    [candidates, blocking],
  );
  // Sans résultat : l'élève est peut-être déjà dans le groupe (pas de création proposée).
  const alreadyMember = useMemo(
    () =>
      candidates.length === 0
        ? search((data?.students ?? []).filter((s) => memberIds.has(s.id)))[0]
        : undefined,
    [candidates, data, memberIds, search],
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

  const typed = splitFullName(query);
  const typedName = `${typed.firstName} ${typed.lastName}`.trim();
  const createStudentFromQuery = () => {
    if (!data?.group) return;
    setEditing(newStudentEditing([data.group.id], data.groups, data.levels, typed));
  };
  /** Ajout depuis la recherche : champ vidé, focus conservé pour l'élève suivant. */
  const add = (studentId: string) => {
    setQuery("");
    setHighlight(-1);
    focusSearch();
    return run(() => addGroupMember(db, id, studentId));
  };
  type SearchOption = { id: string; label: string; pick: () => void };
  const options: SearchOption[] =
    candidates.length > 0
      ? shown.map((student) => ({
          id: `${listId}-${student.id}`,
          label: `${student.lastName} ${student.firstName}`,
          pick: () => add(student.id),
        }))
      : query.trim() !== "" && !alreadyMember
        ? [
            {
              id: `${listId}-create`,
              label: `Créer « ${typedName} »`,
              pick: createStudentFromQuery,
            },
          ]
        : [];
  /** Option choisie par Entrée : celle en surbrillance, sinon l'option unique. */
  const enterTarget = options[highlight] ?? (options.length === 1 ? options[0] : undefined);
  const listOpen = resultsOpen && query.trim() !== "";

  // Annonce de la liste, après une courte pause de frappe (pas à chaque touche).
  const [announcement, setAnnouncement] = useState("");
  const summary =
    query.trim() === ""
      ? ""
      : alreadyMember
        ? `${alreadyMember.lastName} ${alreadyMember.firstName} est déjà dans le groupe.`
        : candidates.length === 0
          ? `Aucun élève trouvé : Entrée pour créer ${typedName}.`
          : candidates.length === 1
            ? "1 élève trouvé : Entrée pour l'ajouter."
            : `${candidates.length} élèves trouvés : flèches pour choisir, Entrée pour ajouter.`;
  useEffect(() => {
    const timer = setTimeout(() => setAnnouncement(summary), 600);
    return () => clearTimeout(timer);
  }, [summary]);

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (options.length === 0) return;
      event.preventDefault();
      setResultsOpen(true);
      // En boucle : ↓ après la dernière revient à la première, ↑ avant la première va à la dernière.
      const down = event.key === "ArrowDown";
      const count = options.length;
      setHighlight((h) => (down ? (h + 1) % count : h <= 0 ? count - 1 : h - 1));
    } else if (event.key === "Enter") {
      if (query.trim() === "") return;
      event.preventDefault();
      enterTarget?.pick();
    }
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
  const unavailableMembers = unavailableMembersMessage(members.filter((m) => blocking.has(m.id)));
  const alertMessages = unavailableMembers
    ? [...alerts.messages, unavailableMembers]
    : alerts.messages;

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
                await reload();
                toast.success("Modifications enregistrées.");
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              Élèves du groupe
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
            <MessageZone
              label="Alertes"
              messages={[...errorMessages(error), ...warnings(alertMessages)]}
            />

            <DndContext
              sensors={sensors}
              accessibility={{
                screenReaderInstructions: {
                  draggable:
                    "Glissez l'élève dans la liste des élèves du groupe pour l'y ajouter, ou choisissez-le dans la liste avec les flèches et Entrée.",
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
                <div className="flex flex-wrap items-start gap-3">
                  {/* biome-ignore lint/a11y/noStaticElementInteractions: ouverture et Échap de la liste superposée des résultats. */}
                  <div
                    ref={searchRef}
                    className="relative w-full max-w-md"
                    onFocus={() => setResultsOpen(true)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape" && resultsOpen) {
                        event.preventDefault();
                        setResultsOpen(false);
                      }
                    }}
                  >
                    <SearchInput
                      value={query}
                      onChange={(value) => {
                        setQuery(value);
                        setHighlight(-1);
                        setResultsOpen(true);
                      }}
                      label="Ajouter un élève (nom, prénom, téléphone)"
                      className="max-w-md"
                      inputProps={{
                        ref: inputRef,
                        role: "combobox",
                        "aria-expanded": listOpen,
                        "aria-controls": listId,
                        "aria-autocomplete": "list",
                        "aria-activedescendant": listOpen ? enterTarget?.id : undefined,
                        onKeyDown: onSearchKeyDown,
                        "aria-describedby": hintId,
                      }}
                    />
                    <span id={hintId} className="sr-only">
                      Flèches pour choisir un élève, Entrée pour l'ajouter.
                    </span>
                    <span className="sr-only" aria-live="polite">
                      {announcement}
                    </span>
                    {listOpen && (
                      <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg">
                        {alreadyMember && (
                          <p className="px-3 py-2 text-muted-foreground text-sm">
                            {alreadyMember.lastName} {alreadyMember.firstName} : déjà dans le
                            groupe.
                          </p>
                        )}
                        {!alreadyMember && candidates.length === 0 && (
                          <p className="px-3 pt-2 text-muted-foreground text-sm">
                            Aucun élève trouvé.
                          </p>
                        )}
                        <div
                          id={listId}
                          role="listbox"
                          aria-label="Élèves trouvés"
                          className="max-h-80 divide-y overflow-y-auto"
                        >
                          {candidates.length === 0 &&
                            options.map((option) => (
                              // biome-ignore lint/a11y/useKeyWithClickEvents: le clavier passe par le champ (Entrée).
                              <div
                                key={option.id}
                                id={option.id}
                                role="option"
                                tabIndex={-1}
                                aria-selected={option === enterTarget}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={option.pick}
                                className={cn(
                                  "flex cursor-pointer items-center gap-2 px-3 py-1.5 font-medium text-sm hover:bg-accent/60",
                                  option === enterTarget && "bg-accent text-accent-foreground",
                                )}
                              >
                                <UserPlus className="size-4" aria-hidden />
                                {option.label}
                              </div>
                            ))}
                          {shown.map((student, index) => {
                            const name = `${student.lastName} ${student.firstName}`;
                            const details = homonyms.has(nameKey(student))
                              ? studentDetails({
                                  birthDate: student.birthDate,
                                  groups: student.groups.map((g) => g.name),
                                })
                              : "";
                            const option = options[index];
                            const lessons = blocking.get(student.id);
                            const unavailable = lessons ? blockingText(lessons) : "";
                            const label = details ? `${name} (${details})` : name;
                            return (
                              <CandidateOption
                                key={student.id}
                                optionId={option?.id ?? student.id}
                                studentId={student.id}
                                name={name}
                                label={
                                  unavailable ? `${label}, ${unavailable.toLowerCase()}` : label
                                }
                                selected={option !== undefined && option === enterTarget}
                                onPick={() => add(student.id)}
                              >
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
                                  {details && (
                                    <span className="block text-muted-foreground text-xs">
                                      {details}
                                    </span>
                                  )}
                                  {/* Toujours affiché : lisible aussi en parcourant la liste au clavier (↑/↓), sans survol. */}
                                  {lessons && (
                                    <span
                                      data-testid="blocking-lessons"
                                      className="block text-amber-800 text-xs dark:text-amber-300"
                                    >
                                      Cours en cause : {blockingSummary(lessons)}
                                    </span>
                                  )}
                                </span>
                                {unavailable && (
                                  // Bulle déjà lue dans le nom de l'option : pas de double annonce.
                                  <Tooltip content={unavailable} describe={false}>
                                    <Badge
                                      variant="outline"
                                      data-testid="unavailable-badge"
                                      className="shrink-0 border-amber-600/40 text-amber-800 dark:text-amber-300"
                                    >
                                      hors disponibilités
                                    </Badge>
                                  </Tooltip>
                                )}
                              </CandidateOption>
                            );
                          })}
                        </div>
                        {candidates.length > MAX_RESULTS && (
                          <p className="border-t px-3 py-2 text-muted-foreground text-xs">
                            {candidates.length - MAX_RESULTS} autres résultats : précisez la
                            recherche.
                          </p>
                        )}
                        {candidates.length > 0 && (
                          <p className="border-t px-3 py-1.5 text-muted-foreground text-xs">
                            Cliquez sur un élève, ou faites-le glisser dans la liste du groupe.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <Button asChild variant="outline">
                    <Link to={`/import-export?import&groupe=${id}`}>
                      <ClipboardPaste aria-hidden />
                      Importer ou coller une liste
                    </Link>
                  </Button>
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
                          <TableCell className="whitespace-nowrap">
                            {formatContactPhone(student)}
                          </TableCell>
                          <TableCell>
                            {!readOnly && (
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label={`Retirer ${name} du groupe`}
                                tooltip="Retirer du groupe (l'élève reste inscrit au club)"
                                onClick={() => run(() => removeGroupMember(db, id, student.id))}
                              >
                                <UserMinus aria-hidden />
                                Retirer
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

      <StudentDialog
        editing={editing}
        onEditingChange={setEditing}
        season={season}
        students={data.students}
        identities={data.identities}
        groups={data.groups}
        levels={data.levels}
        onSaved={async () => {
          setQuery("");
          setHighlight(-1);
          await reload();
        }}
        // Retour à la fiche du groupe, prête pour l'élève suivant.
        onClosed={focusSearch}
      />
    </div>
  );
}
