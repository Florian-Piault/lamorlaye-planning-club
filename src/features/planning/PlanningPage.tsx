import { DndContext } from "@dnd-kit/core";
import { LandPlot, Plus, Redo2, Undo2, X } from "lucide-react";
import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router";
import { useSeason } from "@/app/season";
import { ErrorAlert } from "@/components/form/Field";
import { EmptyState, Page } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { useDatabase } from "@/db/DatabaseProvider";
import { createGroup } from "@/db/repositories/groups";
import type { Season } from "@/db/schema";
import {
  type Command,
  changeLessonInstructor,
  createLesson,
  deleteLesson,
  duplicateLesson,
  type LessonPatch,
  moveLesson,
  type PlanningState,
  resizeLesson,
  updateLesson,
} from "@/domain/commands";
import { createConflictIndex, slotFromLesson } from "@/domain/conflicts";
import { todayInParis } from "@/domain/dates";
import { canRedo, canUndo, redoLabel, undoLabel } from "@/domain/history";
import { unavailableIntervals } from "@/domain/instructorAvailability";
import { minutesToTime, timeToMinutes, WEEKDAYS, weekdayLabel } from "@/domain/time";
import type { GroupInput } from "@/domain/validation";
import { RequireSeason } from "@/features/referentiels/ReferentielsPage";
import { errorMessage } from "@/hooks/useLoader";
import { DragFeedback } from "./components/DragFeedback";
import { Filters } from "./components/Filters";
import { Legend, type LegendEntry } from "./components/Legend";
import { type LessonFormValues, LessonPanel } from "./components/LessonPanel";
import { type CandidateLook, type LessonView, PlanningGrid } from "./components/PlanningGrid";
import { type WarningItem, WarningsPanel } from "./components/WarningsPanel";
import {
  AXIS_WIDTH,
  clockLabel,
  fitColumnWidth,
  type GridGeometry,
  HOUR_HEIGHT,
  layoutItems,
} from "./grid/geometry";
import {
  type CandidateLesson,
  candidateWarnings,
  displayedCourts,
  displayedRange,
  displayedWeekdays,
  hasFilters,
  type InstructorLabel,
  matchesFilters,
  minutesByInstructor,
  NEW_LESSON_ID,
  noFilters,
  type PlanningFilters,
  semaineTypeDate,
  totalMinutes,
  warningMessages,
  weekLessons,
  weekWarnings,
} from "./grid/view";
import { hatchedInstructorId, InteractionStore, useInteraction } from "./interaction";
import { loadPlanningReferences, type PlanningReferences } from "./references";
import { PlanningStore, usePlanningSnapshot } from "./store";
import { lessonCandidate, useGridGestures } from "./useGridGestures";

const DESCRIPTION = "Semaine type et semaines datées de la saison.";
const NEUTRAL_COLOR = "#64748B";

export function PlanningPage() {
  const { season } = useSeason();
  if (!season) {
    return (
      <Page title="Planning" description={DESCRIPTION}>
        <RequireSeason>{null}</RequireSeason>
      </Page>
    );
  }
  return <PlanningScreen key={season.id} season={season} />;
}

interface Loaded {
  refs: PlanningReferences;
  store: PlanningStore;
}

/** Charge les référentiels et le planning de la saison, puis affiche la grille. */
function PlanningScreen({ season }: { season: Season }) {
  const { db } = useDatabase();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadPlanningReferences(db, season.id), PlanningStore.load(db, season.id)]).then(
      ([refs, store]) => !cancelled && setLoaded({ refs, store }),
      (e: unknown) => !cancelled && setError(e),
    );
    return () => {
      cancelled = true;
    };
  }, [db, season.id]);

  const reloadReferences = useCallback(async () => {
    const refs = await loadPlanningReferences(db, season.id);
    setLoaded((current) => current && { ...current, refs });
  }, [db, season.id]);

  if (error || !loaded) {
    return (
      <Page title="Planning" description={DESCRIPTION}>
        {error ? (
          <ErrorAlert>Impossible de charger le planning : {errorMessage(error)}</ErrorAlert>
        ) : (
          <p className="text-muted-foreground text-sm">Chargement du planning…</p>
        )}
      </Page>
    );
  }
  return (
    <PlanningWorkspace
      season={season}
      refs={loaded.refs}
      store={loaded.store}
      onReferencesChanged={reloadReferences}
    />
  );
}

type PanelState =
  | { mode: "create"; initial: LessonFormValues; key: number }
  | { mode: "edit"; lessonId: string };

interface Toast {
  key: number;
  message: string;
  undoable: boolean;
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName))
  );
}

function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setWidth(element.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/** Garde la même référence tant que le contenu (sérialisé) ne change pas. */
function useStable<T>(value: T, key: string): T {
  const ref = useRef({ key, value });
  if (ref.current.key !== key) ref.current = { key, value };
  return ref.current.value;
}

interface WorkspaceProps {
  season: Season;
  refs: PlanningReferences;
  store: PlanningStore;
  onReferencesChanged: () => Promise<void>;
}

/** Écran Planning en mode « Semaine type » (§4.1, §4.3, §4.4, §5.1–5.3, §7). */
function PlanningWorkspace({ season, refs, store, onReferencesChanged }: WorkspaceProps) {
  const { db } = useDatabase();
  const snapshot = usePlanningSnapshot(store);
  const interaction = useMemo(() => new InteractionStore(), []);
  const [filters, setFilters] = useState<PlanningFilters>(noFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const scrollerWidth = useElementWidth(scrollerRef);

  // --- Données affichées ----------------------------------------------------
  const referenceDate = useMemo(() => semaineTypeDate(season, todayInParis()), [season]);
  const lessons = useMemo(
    () => weekLessons(snapshot.state.lessons, referenceDate),
    [snapshot.state.lessons, referenceDate],
  );
  const lessonsById = useMemo(() => new Map(lessons.map((l) => [l.id, l])), [lessons]);
  const { start: dayStart, end: dayEnd } = displayedRange(
    { start: timeToMinutes(season.displayStartTime), end: timeToMinutes(season.displayEndTime) },
    lessons,
  );

  const weekdayList = displayedWeekdays(season.displayedDays, lessons);
  const weekdays = useStable(weekdayList, weekdayList.join(","));
  const courtList = displayedCourts(refs.courts, lessons);
  const courts = useStable(courtList, courtList.map((c) => c.id).join(","));
  const courtIds = useMemo(() => courts.map((c) => c.id), [courts]);
  const columnWidth = fitColumnWidth(
    scrollerWidth - AXIS_WIDTH - 2,
    weekdays.length * courtIds.length,
  );
  const geometry: GridGeometry = useMemo(
    () => ({ dayStart, dayEnd, hourHeight: HOUR_HEIGHT, columnWidth, weekdays, courtIds }),
    [dayStart, dayEnd, columnWidth, weekdays, courtIds],
  );

  const groupsById = useMemo(() => new Map(refs.groups.map((g) => [g.id, g])), [refs.groups]);
  const instructorsById = useMemo(
    () => new Map(refs.instructors.map((i) => [i.id, i])),
    [refs.instructors],
  );
  const courtsById = useMemo(() => new Map(refs.courts.map((c) => [c.id, c])), [refs.courts]);
  const labels = useMemo(
    () =>
      new Map<string, InstructorLabel>(
        refs.instructors.map((i) => [
          i.id,
          { id: i.id, firstName: i.firstName, noAvailability: i.availabilities.length === 0 },
        ]),
      ),
    [refs.instructors],
  );
  const conflictIndex = useMemo(
    () =>
      createConflictIndex({
        courts: refs.courts,
        instructors: refs.instructors,
        groups: refs.groups,
        students: refs.students,
        memberships: refs.memberships,
        referenceDate: season.startDate,
      }),
    [refs, season.startDate],
  );
  const slots = useMemo(() => lessons.map(slotFromLesson), [lessons]);
  const warnings = useMemo(
    () => weekWarnings(lessons, conflictIndex, labels),
    [lessons, conflictIndex, labels],
  );
  const boxes = useMemo(
    () =>
      layoutItems(
        geometry,
        lessons.map((l) => {
          const start = timeToMinutes(l.startTime);
          return {
            id: l.id,
            weekday: l.weekday,
            courtId: l.courtId,
            start,
            end: start + l.durationMinutes,
          };
        }),
      ),
    [geometry, lessons],
  );

  const views: LessonView[] = useMemo(() => {
    const filtered = hasFilters(filters);
    return boxes.flatMap((box) => {
      const lesson = lessonsById.get(box.id);
      if (!lesson) return [];
      const group = groupsById.get(lesson.groupId);
      const instructor = instructorsById.get(lesson.instructorId);
      const court = courtsById.get(lesson.courtId);
      const start = timeToMinutes(lesson.startTime);
      const timeLabel = `${clockLabel(start)}–${clockLabel(start + lesson.durationMinutes)}`;
      const size = group ? `${group.memberCount}/${group.maxSize}` : "";
      const groupName = group?.name ?? "Groupe inconnu";
      const instructorName = instructor
        ? `${instructor.firstName} ${instructor.lastName}`
        : "Moniteur inconnu";
      const courtName = court
        ? `${court.name} (${court.kind === "indoor" ? "couvert" : "extérieur"})`
        : "Court inconnu";
      const messages = warningMessages(warnings.get(lesson.id) ?? []);
      const day = weekdayLabel(lesson.weekday);
      return [
        {
          ...box,
          id: lesson.id,
          instructorId: lesson.instructorId,
          color: instructor?.color ?? NEUTRAL_COLOR,
          groupName,
          timeLabel,
          detail: `${instructor?.initials ?? "?"}${size ? ` · ${size}` : ""}`,
          title: [
            groupName,
            `${day} ${timeLabel}`,
            courtName,
            `Moniteur : ${instructorName}`,
            size && `${size} élèves`,
            lesson.note,
            ...messages.map((m) => `⚠ ${m}`),
          ]
            .filter(Boolean)
            .join("\n"),
          ariaLabel: `${groupName}, ${day} ${timeLabel}, ${court?.name ?? "court inconnu"}, ${instructorName}${
            messages.length > 0 ? `, ${messages.length} avertissement(s)` : ""
          }`,
          warning: messages.length > 0,
          dimmed: filtered && !matchesFilters(lesson, filters),
        },
      ];
    });
  }, [boxes, lessonsById, groupsById, instructorsById, courtsById, warnings, filters]);

  const warningItems: WarningItem[] = useMemo(
    () =>
      [...lessons]
        .filter((l) => warnings.has(l.id))
        .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime))
        .map((l) => ({
          lessonId: l.id,
          title: `${WEEKDAYS.find((d) => d.value === l.weekday)?.short ?? ""} ${clockLabel(
            timeToMinutes(l.startTime),
          )} · ${groupsById.get(l.groupId)?.name ?? "Groupe inconnu"}`,
          messages: warningMessages(warnings.get(l.id) ?? []),
        })),
    [lessons, warnings, groupsById],
  );

  const minutes = useMemo(() => minutesByInstructor(lessons), [lessons]);
  const legendEntries: LegendEntry[] = useMemo(
    () =>
      refs.instructors
        .filter((i) => i.active || minutes.has(i.id))
        .map((i) => ({
          id: i.id,
          name: `${i.firstName} ${i.lastName}`,
          firstName: i.firstName,
          color: i.color,
          minutes: minutes.get(i.id) ?? 0,
          noAvailability: i.availabilities.length === 0,
        })),
    [refs.instructors, minutes],
  );
  const weekTotal = useMemo(() => totalMinutes(lessons), [lessons]);

  const filterOptions = useMemo(() => {
    const usedGroups = new Set(lessons.map((l) => l.groupId));
    return {
      instructors: legendEntries.map((e) => ({ id: e.id, name: e.name, color: e.color })),
      courts: courts.map((c) => ({ id: c.id, name: c.name })),
      groups: refs.groups
        .filter((g) => g.active || usedGroups.has(g.id))
        .map((g) => ({ id: g.id, name: g.name })),
    };
  }, [legendEntries, courts, refs.groups, lessons]);

  const unavailableOn = useCallback(
    (instructorId: string, weekday: number) => {
      const instructor = instructorsById.get(instructorId);
      return instructor
        ? unavailableIntervals(instructor, { date: null, weekday }, dayStart, dayEnd)
        : [];
    },
    [instructorsById, dayStart, dayEnd],
  );

  const lookOf = useCallback(
    (candidate: CandidateLesson): CandidateLook => {
      const group = candidate.groupId ? groupsById.get(candidate.groupId) : undefined;
      const instructor = candidate.instructorId
        ? instructorsById.get(candidate.instructorId)
        : undefined;
      return {
        color: instructor?.color ?? NEUTRAL_COLOR,
        groupName: group?.name ?? "Nouveau cours",
        detail: `${instructor?.initials ?? "?"}${group ? ` · ${group.memberCount}/${group.maxSize}` : ""}`,
      };
    },
    [groupsById, instructorsById],
  );

  // --- Actions --------------------------------------------------------------
  const notify = useCallback((message: string, undoable = false) => {
    setToast({ key: Date.now(), message, undoable });
  }, []);
  const hideToast = useCallback(() => setToast(null), []);

  /** Exécute une commande du moteur : mémoire, base, pile d'annulation. */
  const run = useCallback(
    (build: (state: PlanningState) => Command): Command | null => {
      try {
        const command = build(store.getSnapshot().state);
        store.execute(command);
        notify(command.label, true);
        return command;
      } catch (e) {
        notify(errorMessage(e));
        return null;
      }
    },
    [store, notify],
  );

  const closePanel = useCallback(() => {
    setPanel(null);
    interaction.update({ draft: null });
  }, [interaction]);

  const openLesson = useCallback(
    (id: string) => {
      interaction.update({ draft: null });
      setSelectedId(id);
      setPanel({ mode: "edit", lessonId: id });
    },
    [interaction],
  );

  const openNew = useCallback(
    (values?: Partial<LessonFormValues>) => {
      interaction.update({ draft: null });
      setSelectedId(null);
      setPanel({
        mode: "create",
        key: Date.now(),
        initial: {
          groupId: "",
          instructorId: "",
          weekday: weekdays[0] ?? 1,
          start: Math.min(Math.max(17 * 60, dayStart), dayEnd - 60),
          durationMinutes: 60,
          courtId: "",
          note: "",
          ...values,
        },
      });
    },
    [interaction, weekdays, dayStart, dayEnd],
  );

  const undo = useCallback(() => {
    const command = store.undo();
    if (command) notify(`Annulé : ${lowerFirst(command.label)}`);
  }, [store, notify]);

  const redo = useCallback(() => {
    const command = store.redo();
    if (command) notify(`Rétabli : ${lowerFirst(command.label)}`);
  }, [store, notify]);

  const removeLesson = useCallback(
    (id: string) => {
      if (run((state) => deleteLesson(state, id))) {
        setSelectedId(null);
        closePanel();
      }
    },
    [run, closePanel],
  );

  const showLesson = useCallback(
    (id: string) => {
      openLesson(id);
      requestAnimationFrame(() => {
        boardRef.current
          ?.querySelector(`[data-lesson-id="${id}"]`)
          ?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      });
    },
    [openLesson],
  );

  const toInput = (values: LessonFormValues) => ({
    weekday: values.weekday,
    startTime: minutesToTime(values.start),
    durationMinutes: values.durationMinutes,
    courtId: values.courtId,
    groupId: values.groupId,
    instructorId: values.instructorId,
    note: values.note.trim() || null,
  });

  const submitPanel = (values: LessonFormValues) => {
    if (!panel) return;
    if (panel.mode === "create") {
      const command = run((state) =>
        createLesson(state, {
          ...toInput(values),
          seasonId: season.id,
          effectiveFrom: season.startDate,
        }),
      );
      if (command) {
        closePanel();
        const row = command.forward[0];
        if (row?.op === "insert") setSelectedId(row.row.id);
      }
      return;
    }
    const lesson = lessonsById.get(panel.lessonId);
    if (!lesson) return;
    const input: LessonPatch = toInput(values);
    const changed = (Object.keys(input) as (keyof LessonPatch)[]).some(
      (key) => input[key] !== lesson[key],
    );
    if (!changed || run((state) => updateLesson(state, lesson.id, input))) closePanel();
  };

  const createQuickGroup = useCallback(
    async (input: GroupInput) => {
      const id = await createGroup(db, season.id, input);
      await onReferencesChanged();
      return id;
    },
    [db, season.id, onReferencesChanged],
  );

  const onDraftChange = useCallback(
    (values: LessonFormValues) =>
      interaction.update({
        draft: values.courtId
          ? {
              id: NEW_LESSON_ID,
              weekday: values.weekday,
              start: values.start,
              durationMinutes: values.durationMinutes,
              courtId: values.courtId,
              groupId: values.groupId || null,
              instructorId: values.instructorId || null,
            }
          : null,
      }),
    [interaction],
  );

  const panelWarnings = (lessonId: string) => (values: LessonFormValues) =>
    warningMessages(
      candidateWarnings(
        {
          id: lessonId,
          weekday: values.weekday,
          start: values.start,
          durationMinutes: values.durationMinutes,
          courtId: values.courtId || null,
          groupId: values.groupId || null,
          instructorId: values.instructorId || null,
        },
        slots,
        conflictIndex,
        labels,
      ),
    );

  // --- Gestes ---------------------------------------------------------------
  const gestures = useGridGestures({
    interaction,
    boardRef,
    scrollerRef,
    context: { geometry, boxes, lessonsById, slots, index: conflictIndex, labels },
    handlers: {
      onMove: (lessonId, target, duplicate) => {
        const values = {
          weekday: target.weekday,
          startTime: minutesToTime(target.start),
          courtId: target.courtId,
        };
        if (duplicate) {
          const command = run((state) => duplicateLesson(state, lessonId, values));
          const row = command?.forward[0];
          if (row?.op === "insert") setSelectedId(row.row.id);
        } else if (run((state) => moveLesson(state, lessonId, values))) {
          setSelectedId(lessonId);
        }
      },
      onResize: (lessonId, durationMinutes) => {
        if (run((state) => resizeLesson(state, lessonId, durationMinutes))) setSelectedId(lessonId);
      },
      onAssignInstructor: (lessonId, instructorId) => {
        if (run((state) => changeLessonInstructor(state, lessonId, instructorId))) {
          setSelectedId(lessonId);
        }
      },
      onSelectSlot: (candidate) =>
        openNew({
          weekday: candidate.weekday,
          start: candidate.start,
          durationMinutes: candidate.durationMinutes,
          courtId: candidate.courtId ?? "",
        }),
      onBoardClick: () => {
        setSelectedId(null);
        closePanel();
      },
      onCancel: () => notify("Déplacement interrompu"),
    },
  });

  // --- Raccourcis clavier (§11.5) ---------------------------------------------
  const selected = selectedId && lessonsById.has(selectedId) ? selectedId : null;
  const keyboard = useRef({
    undo,
    redo,
    openNew,
    removeLesson,
    closePanel,
    panel,
    selected,
    gestures,
  });
  keyboard.current = { undo, redo, openNew, removeLesson, closePanel, panel, selected, gestures };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const k = keyboard.current;
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "Escape") {
        const drag = interaction.get().drag;
        // Un glisser dnd-kit est interrompu par dnd-kit lui-même (onDragCancel).
        if (drag && drag.kind !== "select") return;
        if (k.gestures.cancelSelection()) return;
        if (k.panel) k.closePanel();
        else if (k.selected) setSelectedId(null);
        return;
      }
      if (isEditable(event.target) || event.altKey) return;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (mod && key === "z") {
        event.preventDefault();
        if (event.shiftKey) k.redo();
        else k.undo();
      } else if (mod && key === "y") {
        event.preventDefault();
        k.redo();
      } else if (key === "n" && !event.shiftKey) {
        event.preventDefault();
        k.openNew();
      } else if ((event.key === "Delete" || event.key === "Backspace") && !mod && k.selected) {
        event.preventDefault();
        k.removeLesson(k.selected);
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [interaction]);

  // --- Rendu ----------------------------------------------------------------
  const editedLesson = panel?.mode === "edit" ? lessonsById.get(panel.lessonId) : undefined;
  const panelOpen = panel?.mode === "create" || editedLesson !== undefined;

  if (courts.length === 0) {
    return (
      <Page title="Planning" description={DESCRIPTION}>
        <EmptyState icon={LandPlot} title="Aucun court">
          <p>Ajoutez au moins un court pour construire la semaine type.</p>
          <Button asChild className="mt-4">
            <Link to="/referentiels/courts">Saisir les courts</Link>
          </Button>
        </EmptyState>
      </Page>
    );
  }

  return (
    <DndContext
      sensors={gestures.sensors}
      onDragStart={gestures.onDragStart}
      onDragEnd={gestures.onDragEnd}
      onDragCancel={gestures.onDragCancel}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Glissez un cours pour le déplacer, son bord inférieur pour changer sa durée, ou une pastille de moniteur sur un cours. Échap interrompt le glisser.",
        },
        announcements: {
          onDragStart: () => "Glisser commencé.",
          onDragOver: () => "",
          onDragMove: () => "",
          onDragEnd: () => "Élément déposé.",
          onDragCancel: () => "Glisser interrompu.",
        },
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-2 border-b bg-card px-4 py-2.5">
          <h1 className="mr-2 font-semibold text-lg tracking-tight">Planning</h1>
          <Button size="sm" onClick={() => openNew()} title="Nouveau cours (Ctrl/⌘ N)">
            <Plus aria-hidden />
            Nouveau cours
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={undo}
            disabled={!canUndo(snapshot.history)}
            title={undoLabel(snapshot.history) ?? "Rien à annuler"}
          >
            <Undo2 aria-hidden />
            Annuler
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={redo}
            disabled={!canRedo(snapshot.history)}
            title={redoLabel(snapshot.history) ?? "Rien à rétablir"}
          >
            <Redo2 aria-hidden />
            Rétablir
          </Button>
          <div className="ml-auto">
            <Legend entries={legendEntries} totalMinutes={weekTotal} interaction={interaction} />
          </div>
        </header>
        <ModeBar
          season={season}
          interaction={interaction}
          names={legendEntries}
          hiddenVersions={snapshot.state.lessons.length - lessons.length}
        />
        <Filters
          filters={filters}
          onChange={setFilters}
          instructors={filterOptions.instructors}
          courts={filterOptions.courts}
          groups={filterOptions.groups}
        />
        {snapshot.error && (
          <div className="flex items-start gap-2 border-b px-4 py-2">
            <div className="flex-1">
              <ErrorAlert>{snapshot.error}</ErrorAlert>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Masquer l'erreur"
              onClick={() => store.dismissError()}
            >
              <X aria-hidden />
            </Button>
          </div>
        )}
        <div className="flex min-h-0 flex-1">
          <PlanningGrid
            geometry={geometry}
            courts={courts}
            lessons={views}
            selectedId={selected}
            interaction={interaction}
            scrollerRef={scrollerRef}
            boardRef={boardRef}
            unavailableOn={unavailableOn}
            lookOf={lookOf}
            onOpenLesson={openLesson}
            onBoardPointerDown={gestures.onBoardPointerDown}
          />
          <aside
            aria-label="Panneau latéral"
            className="w-80 shrink-0 overflow-y-auto border-l bg-card p-4"
          >
            {panelOpen && panel ? (
              <LessonPanel
                key={
                  panel.mode === "create"
                    ? `nouveau-${panel.key}`
                    : `${editedLesson?.id}-${editedLesson?.updatedAt}`
                }
                mode={panel.mode}
                initialValues={
                  panel.mode === "create"
                    ? panel.initial
                    : {
                        ...lessonCandidate(editedLesson as NonNullable<typeof editedLesson>),
                        groupId: editedLesson?.groupId ?? "",
                        instructorId: editedLesson?.instructorId ?? "",
                        courtId: editedLesson?.courtId ?? "",
                        note: editedLesson?.note ?? "",
                      }
                }
                weekdays={weekdays}
                dayStart={dayStart}
                dayEnd={dayEnd}
                courts={courts}
                groups={refs.groups}
                instructors={refs.instructors}
                levels={refs.levels}
                warningsOf={panelWarnings(panel.mode === "create" ? NEW_LESSON_ID : panel.lessonId)}
                onSubmit={submitPanel}
                onClose={closePanel}
                onDelete={editedLesson ? () => removeLesson(editedLesson.id) : undefined}
                onDraftChange={panel.mode === "create" ? onDraftChange : undefined}
                onCreateGroup={createQuickGroup}
              />
            ) : (
              <WarningsPanel items={warningItems} onShow={showLesson} />
            )}
          </aside>
        </div>
      </div>
      <DragFeedback
        interaction={interaction}
        courtName={(id) => (id ? (courtsById.get(id)?.name ?? "Court") : "Court")}
        instructor={(id) => {
          const i = instructorsById.get(id);
          return i ? { name: i.firstName, color: i.color } : null;
        }}
        groupName={(id) => (id ? (groupsById.get(id)?.name ?? "cours") : "cours")}
      />
      {toast && <ToastMessage key={toast.key} toast={toast} onUndo={undo} onClose={hideToast} />}
    </DndContext>
  );
}

function ModeBar({
  season,
  interaction,
  names,
  hiddenVersions,
}: {
  season: Season;
  interaction: InteractionStore;
  names: readonly LegendEntry[];
  hiddenVersions: number;
}) {
  const hatched = useInteraction(interaction, hatchedInstructorId);
  const entry = hatched ? names.find((n) => n.id === hatched) : undefined;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-sky-700 px-4 py-1 text-white text-xs dark:bg-sky-800">
      <span>
        ● Mode <b>Semaine type</b> — saison {season.name} (les modifications s'appliquent à toute la
        saison)
      </span>
      {hiddenVersions > 0 && (
        <span className="opacity-90">
          {hiddenVersions} version(s) de cours hors vigueur à ce jour non affichée(s)
        </span>
      )}
      <span data-testid="hatch-info" className="ml-auto opacity-95">
        {entry &&
          (entry.noAvailability
            ? `Hachuré : ${entry.name} n'a saisi aucune disponibilité (indisponible partout)`
            : `Hachuré : indisponibilités de ${entry.name}`)}
      </span>
    </div>
  );
}

function ToastMessage({
  toast,
  onUndo,
  onClose,
}: {
  toast: Toast;
  onUndo: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);
  return (
    <div
      role="status"
      data-testid="toast"
      className="-translate-x-1/2 fixed bottom-5 left-1/2 z-[200] flex items-center gap-3 rounded-lg bg-foreground px-3.5 py-2 text-background text-sm shadow-lg"
    >
      <span>{toast.message}</span>
      {toast.undoable && (
        <button
          type="button"
          className="font-semibold text-sky-300 dark:text-sky-700"
          onClick={onUndo}
        >
          Annuler cette action
        </button>
      )}
    </div>
  );
}
