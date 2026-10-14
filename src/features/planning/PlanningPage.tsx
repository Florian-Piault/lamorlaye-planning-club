import { DndContext } from "@dnd-kit/core";
import { FileDown, LandPlot, Plus, Redo2, Undo2, X } from "lucide-react";
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
import { Label, Select } from "@/components/ui/input";
import { useDatabase } from "@/db/DatabaseProvider";
import { createGroup } from "@/db/repositories/groups";
import type { Season } from "@/db/schema";
import type { Command, PlanningState } from "@/domain/commands";
import { createConflictIndex } from "@/domain/conflicts";
import { todayInParis } from "@/domain/dates";
import { canRedo, canUndo, redoLabel, undoLabel } from "@/domain/history";
import { unavailableIntervals } from "@/domain/instructorAvailability";
import { weekOccurrences } from "@/domain/occurrences";
import { formatDate, timeToMinutes, WEEKDAYS, weekdayLabel } from "@/domain/time";
import type { GroupInput } from "@/domain/validation";
import { weekPdfJob } from "@/features/pdf/jobs";
import { PAPER_SIZES, type PaperSize } from "@/features/pdf/model";
import { PdfPreviewDialog } from "@/features/pdf/PdfPreviewDialog";
import { RequireSeason } from "@/features/referentiels/ReferentielsPage";
import { errorMessage } from "@/hooks/useLoader";
import { DragFeedback } from "./components/DragFeedback";
import { Filters } from "./components/Filters";
import { Legend, type LegendEntry } from "./components/Legend";
import { type LessonFormValues, LessonPanel } from "./components/LessonPanel";
import { OccurrenceActions } from "./components/OccurrenceActions";
import { type CandidateLook, type LessonView, PlanningGrid } from "./components/PlanningGrid";
import { type WarningItem, WarningsPanel } from "./components/WarningsPanel";
import { WeekNavigator } from "./components/WeekNavigator";
import {
  type ActionContext,
  applyItemFromWeek,
  assignInstructor,
  cancelItem,
  cancellationLabel,
  createdItemId,
  duplicateItemOnFollowingDays,
  moveItem,
  removeItem,
  replaceItem,
  resizeItem,
  restoreItem,
  saveItem,
} from "./grid/actions";
import {
  AXIS_WIDTH,
  clockLabel,
  fitColumnWidth,
  type GridGeometry,
  HOUR_HEIGHT,
  layoutItems,
} from "./grid/geometry";
import {
  activeItems,
  clampWeek,
  closedDays,
  datedItems,
  dateOfMode,
  dayHeading,
  type GridItem,
  itemSlot,
  lessonItem,
  type PlanningMode,
  shortDate,
  TYPE_MODE,
  toCandidate,
  weekNeighbours,
} from "./grid/items";
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
  slotWarnings,
  totalMinutes,
  warningMessages,
  weekLessons,
} from "./grid/view";
import { hatchedInstructorId, InteractionStore, useInteraction } from "./interaction";
import { loadPlanningReferences, type PlanningReferences } from "./references";
import { PlanningStore, usePlanningSnapshot } from "./store";
import { useGridGestures } from "./useGridGestures";

const DESCRIPTION = "Semaine type et semaines datées de la saison.";
const NEUTRAL_COLOR = "#64748B";

/** Dernier mode affiché, par saison : on le retrouve en revenant sur l'écran. */
const rememberedModes = new Map<string, PlanningMode>();
/** Dernier format de papier choisi pour le PDF de la semaine. */
let rememberedPaper: PaperSize = "A4";

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
  | { mode: "edit"; itemId: string };

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

/** Clé d'un élément qui change avec ses valeurs (réinitialise le panneau). */
function itemStamp(item: GridItem): string {
  return [
    item.id,
    item.weekday,
    item.start,
    item.durationMinutes,
    item.courtId,
    item.groupId,
    item.instructorId,
    item.note,
    item.cancelled,
  ].join("|");
}

interface WorkspaceProps {
  season: Season;
  refs: PlanningReferences;
  store: PlanningStore;
  onReferencesChanged: () => Promise<void>;
}

/**
 * Écran Planning (§4–§7) : semaine type ou semaine datée, selon le mode.
 * En semaine type, les modifications portent sur les cours (toute la saison) ;
 * en semaine datée, elles créent des exceptions pour la seule semaine affichée.
 */
function PlanningWorkspace({ season, refs, store, onReferencesChanged }: WorkspaceProps) {
  const { db } = useDatabase();
  const snapshot = usePlanningSnapshot(store);
  const interaction = useMemo(() => new InteractionStore(), []);
  const [filters, setFilters] = useState<PlanningFilters>(noFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [paper, setPaper] = useState<PaperSize>(rememberedPaper);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const scrollerWidth = useElementWidth(scrollerRef);

  // --- Mode et semaine affichée (§4.2) ---------------------------------------
  const seasonRange = useMemo(
    () => ({ startDate: season.startDate, endDate: season.endDate }),
    [season.startDate, season.endDate],
  );
  const today = todayInParis();
  // Semaine type : versions des cours en vigueur aujourd'hui, ramené dans la saison.
  const referenceDate = semaineTypeDate(season, today);
  const todayMonday = clampWeek(seasonRange, today);
  const [mode, setModeState] = useState<PlanningMode>(
    () => rememberedModes.get(season.id) ?? TYPE_MODE,
  );
  const [datedMonday, setDatedMonday] = useState(() =>
    mode.kind === "dated" ? mode.monday : todayMonday,
  );
  const changeMode = useCallback(
    (next: PlanningMode) => {
      rememberedModes.set(season.id, next);
      setModeState(next);
      if (next.kind === "dated") setDatedMonday(next.monday);
      setSelectedId(null);
      setPanel(null);
      interaction.update({ draft: null });
    },
    [season.id, interaction],
  );
  const dateOf = useMemo(() => dateOfMode(mode), [mode]);
  const ctx: ActionContext = useMemo(
    () => ({ mode, seasonId: season.id, season: seasonRange }),
    [mode, season.id, seasonRange],
  );

  // --- Données affichées ----------------------------------------------------
  const { lessons, exceptions, closures } = snapshot.state;
  const items: GridItem[] = useMemo(() => {
    if (mode.kind === "type") return weekLessons(lessons, referenceDate).map(lessonItem);
    return datedItems(
      weekOccurrences({ lessons, exceptions, closures, season: seasonRange }, mode.monday),
    );
  }, [mode, lessons, exceptions, closures, referenceDate, seasonRange]);
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const active = useMemo(() => activeItems(items), [items]);
  const { start: dayStart, end: dayEnd } = displayedRange(
    { start: timeToMinutes(season.displayStartTime), end: timeToMinutes(season.displayEndTime) },
    items,
  );

  const weekdayList = displayedWeekdays(season.displayedDays, items);
  const weekdays = useStable(weekdayList, weekdayList.join(","));
  const courtList = displayedCourts(refs.courts, items);
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
  const closedDayList = useMemo(
    () => closedDays(mode, weekdays, closures),
    [mode, weekdays, closures],
  );
  const headingOf = useCallback((weekday: number) => dayHeading(mode, weekday), [mode]);

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
  // Seules les séances actives comptent (contrôles, heures) : les annulées sont exclues.
  const slots = useMemo(() => active.map(itemSlot), [active]);
  const warnings = useMemo(
    () => slotWarnings(slots, conflictIndex, labels),
    [slots, conflictIndex, labels],
  );
  const boxes = useMemo(
    () =>
      layoutItems(
        geometry,
        items.map((i) => ({
          id: i.id,
          weekday: i.weekday,
          courtId: i.courtId ?? "",
          start: i.start,
          end: i.start + i.durationMinutes,
        })),
      ),
    [geometry, items],
  );

  const instructorName = useCallback(
    (id: string | null) => {
      const instructor = id ? instructorsById.get(id) : undefined;
      return instructor ? `${instructor.firstName} ${instructor.lastName}` : "Moniteur inconnu";
    },
    [instructorsById],
  );

  const views: LessonView[] = useMemo(() => {
    const filtered = hasFilters(filters);
    return boxes.flatMap((box) => {
      const item = itemsById.get(box.id);
      if (!item) return [];
      const occurrence = item.occurrence;
      const group = item.groupId ? groupsById.get(item.groupId) : undefined;
      const instructor = item.instructorId ? instructorsById.get(item.instructorId) : undefined;
      const court = item.courtId ? courtsById.get(item.courtId) : undefined;
      const timeLabel = `${clockLabel(item.start)}–${clockLabel(item.start + item.durationMinutes)}`;
      const size = group ? `${group.memberCount}/${group.maxSize}` : "";
      const groupName =
        group?.name ?? (item.kind === "one_off" ? "Cours ponctuel" : "Groupe inconnu");
      const courtName = court
        ? `${court.name} (${court.kind === "indoor" ? "couvert" : "extérieur"})`
        : "Court inconnu";
      const messages = warningMessages(warnings.get(item.id) ?? []);
      const day = item.date
        ? `${weekdayLabel(item.weekday)} ${formatDate(item.date)}`
        : weekdayLabel(item.weekday);
      const status = [
        occurrence?.cancellation &&
          `Annulée : ${cancellationLabel(occurrence.cancellation.reason, occurrence.cancellation.note)}`,
        occurrence?.replaced &&
          `Remplacement : ${instructorName(occurrence.instructorId)} au lieu de ${instructorName(
            occurrence.originalInstructorId,
          )}`,
        occurrence?.modified && "Modifiée pour cette semaine",
        item.kind === "one_off" && "Cours ponctuel",
      ].filter((s): s is string => Boolean(s));
      return [
        {
          ...box,
          id: item.id,
          instructorId: item.instructorId,
          color: instructor?.color ?? NEUTRAL_COLOR,
          groupName,
          timeLabel,
          detail: `${instructor?.initials ?? "?"}${size ? ` · ${size}` : ""}`,
          title: [
            groupName,
            `${day} ${timeLabel}`,
            courtName,
            `Moniteur : ${instructorName(item.instructorId)}`,
            size && `${size} élèves`,
            ...status,
            item.note,
            ...messages.map((m) => `⚠ ${m}`),
          ]
            .filter(Boolean)
            .join("\n"),
          ariaLabel: `${groupName}, ${day} ${timeLabel}, ${court?.name ?? "court inconnu"}, ${instructorName(
            item.instructorId,
          )}${status.length > 0 ? `, ${status.join(", ").toLowerCase()}` : ""}${
            messages.length > 0 ? `, ${messages.length} avertissement(s)` : ""
          }`,
          warning: messages.length > 0,
          dimmed: filtered && !matchesFilters(item, filters),
          cancelled: item.cancelled,
          replaced: occurrence?.replaced ?? false,
          modified: occurrence?.modified ?? false,
          oneOff: item.kind === "one_off",
        },
      ];
    });
  }, [
    boxes,
    itemsById,
    groupsById,
    instructorsById,
    courtsById,
    warnings,
    filters,
    instructorName,
  ]);

  const warningItems: WarningItem[] = useMemo(
    () =>
      [...active]
        .filter((i) => warnings.has(i.id))
        .sort((a, b) => a.weekday - b.weekday || a.start - b.start)
        .map((i) => ({
          lessonId: i.id,
          title: `${WEEKDAYS.find((d) => d.value === i.weekday)?.short ?? ""}${
            i.date ? ` ${shortDate(i.date)}` : ""
          } ${clockLabel(i.start)} · ${
            (i.groupId && groupsById.get(i.groupId)?.name) ||
            (i.kind === "one_off" ? "Cours ponctuel" : "Groupe inconnu")
          }`,
          messages: warningMessages(warnings.get(i.id) ?? []),
        })),
    [active, warnings, groupsById],
  );

  const minutes = useMemo(() => minutesByInstructor(active), [active]);
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
  const weekTotal = useMemo(() => totalMinutes(active), [active]);

  // PDF de la semaine affichée (§9.2, Ctrl/Cmd+P).
  const pdfJob = useMemo(
    () =>
      pdfOpen
        ? weekPdfJob(
            {
              season,
              state: { lessons, exceptions, closures },
              refs: { courts: refs.courts, instructors: refs.instructors, groups: refs.groups },
              mode,
              today,
            },
            paper,
          )
        : null,
    [pdfOpen, season, lessons, exceptions, closures, refs, mode, today, paper],
  );
  const changePaper = useCallback((value: PaperSize) => {
    rememberedPaper = value;
    setPaper(value);
  }, []);
  const openPdf = useCallback(() => setPdfOpen(true), []);

  const filterOptions = useMemo(() => {
    const usedGroups = new Set(items.map((i) => i.groupId));
    return {
      instructors: legendEntries.map((e) => ({ id: e.id, name: e.name, color: e.color })),
      courts: courts.map((c) => ({ id: c.id, name: c.name })),
      groups: refs.groups
        .filter((g) => g.active || usedGroups.has(g.id))
        .map((g) => ({ id: g.id, name: g.name })),
    };
  }, [legendEntries, courts, refs.groups, items]);

  // Hachures (§4.4) : plages récurrentes, plus indisponibilités datées en semaine datée.
  const unavailableOn = useCallback(
    (instructorId: string, weekday: number) => {
      const instructor = instructorsById.get(instructorId);
      return instructor
        ? unavailableIntervals(instructor, { date: dateOf(weekday), weekday }, dayStart, dayEnd)
        : [];
    },
    [instructorsById, dayStart, dayEnd, dateOf],
  );

  const lookOf = useCallback(
    (candidate: CandidateLesson): CandidateLook => {
      const group = candidate.groupId ? groupsById.get(candidate.groupId) : undefined;
      const instructor = candidate.instructorId
        ? instructorsById.get(candidate.instructorId)
        : undefined;
      return {
        color: instructor?.color ?? NEUTRAL_COLOR,
        groupName: group?.name ?? (mode.kind === "dated" ? "Cours ponctuel" : "Nouveau cours"),
        detail: `${instructor?.initials ?? "?"}${group ? ` · ${group.memberCount}/${group.maxSize}` : ""}`,
      };
    },
    [groupsById, instructorsById, mode.kind],
  );

  // --- Actions --------------------------------------------------------------
  const notify = useCallback((message: string, undoable = false) => {
    setToast({ key: Date.now(), message, undoable });
  }, []);
  const hideToast = useCallback(() => setToast(null), []);

  /**
   * Exécute une commande du moteur : mémoire, base, pile d'annulation.
   * Renvoie la commande, `null` s'il n'y avait rien à faire, `false` en cas d'erreur.
   */
  const run = useCallback(
    (build: (state: PlanningState) => Command | null): Command | null | false => {
      try {
        const command = build(store.getSnapshot().state);
        if (!command) return null;
        store.execute(command);
        notify(command.label, true);
        return command;
      } catch (e) {
        notify(errorMessage(e));
        return false;
      }
    },
    [store, notify],
  );

  /** Sélectionne l'élément créé par une commande, sinon l'élément d'origine. */
  const selectAfter = useCallback(
    (command: Command | null | false, fallback: string | null) => {
      if (command === false) return;
      setSelectedId((command && createdItemId(mode, command)) ?? fallback);
    },
    [mode],
  );

  const closePanel = useCallback(() => {
    setPanel(null);
    interaction.update({ draft: null });
  }, [interaction]);

  const openLesson = useCallback(
    (id: string) => {
      interaction.update({ draft: null });
      setSelectedId(id);
      setPanel({ mode: "edit", itemId: id });
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
      const item = itemsById.get(id);
      if (!item) return;
      if (run((state) => removeItem(state, item))) {
        setSelectedId(null);
        closePanel();
      }
    },
    [itemsById, run, closePanel],
  );

  const showLesson = useCallback(
    (id: string) => {
      openLesson(id);
      requestAnimationFrame(() => {
        boardRef.current
          ?.querySelector(`[data-lesson-id="${CSS.escape(id)}"]`)
          ?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      });
    },
    [openLesson],
  );

  const submitPanel = (values: LessonFormValues) => {
    if (!panel) return;
    const item = panel.mode === "edit" ? itemsById.get(panel.itemId) : undefined;
    if (panel.mode === "edit" && !item) return;
    const command = run((state) => saveItem(state, ctx, item ?? null, values));
    if (command === false) return;
    closePanel();
    selectAfter(command, item?.id ?? null);
  };

  const applyFromThisWeek = (item: GridItem) => (values: LessonFormValues) => {
    const command = run((state) => applyItemFromWeek(state, ctx, item, values));
    if (command === false) return;
    closePanel();
    selectAfter(command, null);
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

  const panelWarnings = (itemId: string) => (values: LessonFormValues) =>
    warningMessages(
      candidateWarnings(
        {
          id: itemId,
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
        dateOf,
      ),
    );

  // --- Gestes ---------------------------------------------------------------
  const gestures = useGridGestures({
    interaction,
    boardRef,
    scrollerRef,
    context: {
      geometry,
      boxes,
      lessonsById: itemsById,
      slots,
      index: conflictIndex,
      labels,
      dateOf,
    },
    handlers: {
      onMove: (id, target, duplicate) => {
        const item = itemsById.get(id);
        if (!item) return;
        selectAfter(
          run((state) => moveItem(state, ctx, item, target, duplicate)),
          id,
        );
      },
      onResize: (id, durationMinutes) => {
        const item = itemsById.get(id);
        if (item)
          selectAfter(
            run((state) => resizeItem(state, ctx, item, durationMinutes)),
            id,
          );
      },
      onAssignInstructor: (id, instructorId) => {
        const item = itemsById.get(id);
        if (item)
          selectAfter(
            run((state) => assignInstructor(state, ctx, item, instructorId)),
            id,
          );
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
  const selected = selectedId && itemsById.has(selectedId) ? selectedId : null;
  const neighbours = mode.kind === "dated" ? weekNeighbours(seasonRange, mode.monday) : null;
  const keyboard = useRef({
    undo,
    redo,
    openNew,
    removeLesson,
    closePanel,
    panel,
    selected,
    gestures,
    neighbours,
    changeMode,
    openPdf,
  });
  keyboard.current = {
    undo,
    redo,
    openNew,
    removeLesson,
    closePanel,
    panel,
    selected,
    gestures,
    neighbours,
    changeMode,
    openPdf,
  };
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
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (mod && key === "p" && !event.shiftKey && !event.altKey) {
        // Ctrl/Cmd+P : PDF de la semaine affichée, à la place de l'impression de la page.
        event.preventDefault();
        k.openPdf();
        return;
      }
      if (isEditable(event.target) || event.altKey) return;
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
      } else if (
        (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
        !mod &&
        !event.shiftKey &&
        k.neighbours &&
        !interaction.get().drag
      ) {
        // ← / → : semaine précédente / suivante (semaine datée).
        const target = event.key === "ArrowLeft" ? k.neighbours.previous : k.neighbours.next;
        event.preventDefault();
        if (target) k.changeMode({ kind: "dated", monday: target });
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [interaction]);

  // --- Rendu ----------------------------------------------------------------
  const editedItem = panel?.mode === "edit" ? itemsById.get(panel.itemId) : undefined;
  const panelOpen = panel?.mode === "create" || editedItem !== undefined;

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

  const commonPanelProps = {
    weekdays,
    dayStart,
    dayEnd,
    courts,
    groups: refs.groups,
    instructors: refs.instructors,
    levels: refs.levels,
    onSubmit: submitPanel,
    onClose: closePanel,
    onCreateGroup: createQuickGroup,
    dayHeading: headingOf,
    dateOf,
  };

  const renderPanel = () => {
    if (!panel || !panelOpen) return <WarningsPanel items={warningItems} onShow={showLesson} />;
    if (panel.mode === "create") {
      const dated = mode.kind === "dated";
      return (
        <LessonPanel
          key={`nouveau-${panel.key}`}
          {...commonPanelProps}
          mode="create"
          initialValues={panel.initial}
          warningsOf={panelWarnings(NEW_LESSON_ID)}
          onDraftChange={onDraftChange}
          title={dated ? "Nouveau cours ponctuel" : undefined}
          submitLabel={dated ? "Créer le cours ponctuel" : undefined}
          groupOptional={dated}
          notice={
            dated
              ? "Cours n'existant que cette semaine (rattrapage, stage, séance d'essai), possible pendant une fermeture."
              : undefined
          }
        />
      );
    }
    const item = editedItem as GridItem;
    const initialValues: LessonFormValues = {
      ...toCandidate(item),
      groupId: item.groupId ?? "",
      instructorId: item.occurrence?.originalInstructorId ?? item.instructorId ?? "",
      courtId: item.courtId ?? "",
      note: item.note ?? "",
    };
    const stamp = itemStamp(item);
    const common = {
      ...commonPanelProps,
      mode: "edit" as const,
      initialValues,
      warningsOf: panelWarnings(item.id),
    };
    if (item.kind === "lesson") {
      return <LessonPanel key={stamp} {...common} onDelete={() => removeLesson(item.id)} />;
    }
    const actions = (
      <OccurrenceActions
        key={stamp}
        item={item}
        instructors={refs.instructors}
        onCancel={(input) => run((state) => cancelItem(state, ctx, item, input)) !== false}
        onReplace={(instructorId) =>
          run((state) => replaceItem(state, ctx, item, instructorId)) !== false
        }
        onRestore={() => run((state) => restoreItem(state, ctx, item))}
        onDuplicate={(count) =>
          run((state) =>
            duplicateItemOnFollowingDays(state, ctx, item, count, season.displayedDays),
          ) !== false
        }
      />
    );
    const date = item.date
      ? `${weekdayLabel(item.weekday).toLowerCase()} ${formatDate(item.date)}`
      : "";
    if (item.kind === "one_off") {
      return (
        <LessonPanel
          key={stamp}
          {...common}
          title="Cours ponctuel"
          notice={`Le ${date} uniquement.`}
          groupOptional
          onDelete={() => removeLesson(item.id)}
        >
          {actions}
        </LessonPanel>
      );
    }
    return (
      <LessonPanel
        key={stamp}
        {...common}
        title="Modifier pour cette semaine"
        submitLabel="Enregistrer pour cette semaine"
        notice={`Séance du ${date} : « Enregistrer » ne modifie que cette séance ; la semaine type et les autres semaines restent inchangées.`}
        groupLocked
        actions={[
          { label: "Appliquer à partir de cette semaine", onClick: applyFromThisWeek(item) },
        ]}
      >
        {actions}
      </LessonPanel>
    );
  };

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
          <WeekNavigator
            mode={mode}
            season={seasonRange}
            datedMonday={datedMonday}
            todayMonday={todayMonday}
            onChange={changeMode}
          />
          <Button
            size="sm"
            onClick={() => openNew()}
            title={
              mode.kind === "dated"
                ? "Nouveau cours ponctuel (Ctrl/⌘ N)"
                : "Nouveau cours (Ctrl/⌘ N)"
            }
          >
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
          <Button
            size="sm"
            variant="outline"
            onClick={openPdf}
            title="PDF de la semaine affichée (Ctrl/⌘ P)"
          >
            <FileDown aria-hidden />
            PDF
          </Button>
          <div className="ml-auto">
            <Legend entries={legendEntries} totalMinutes={weekTotal} interaction={interaction} />
          </div>
        </header>
        <ModeBar
          season={season}
          mode={mode}
          interaction={interaction}
          names={legendEntries}
          hiddenVersions={mode.kind === "type" ? lessons.length - items.length : 0}
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
            dayHeading={headingOf}
            closedDays={closedDayList}
          />
          <aside
            aria-label="Panneau latéral"
            className="w-80 shrink-0 overflow-y-auto border-l bg-card p-4"
          >
            {renderPanel()}
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
      <PdfPreviewDialog
        job={pdfJob}
        onClose={() => setPdfOpen(false)}
        options={
          <div className="flex items-center gap-2">
            <Label htmlFor="pdf-paper">Format</Label>
            <Select
              id="pdf-paper"
              className="w-40"
              value={paper}
              onChange={(e) => changePaper(e.target.value as PaperSize)}
            >
              {PAPER_SIZES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
        }
      />
    </DndContext>
  );
}

function ModeBar({
  season,
  mode,
  interaction,
  names,
  hiddenVersions,
}: {
  season: Season;
  mode: PlanningMode;
  interaction: InteractionStore;
  names: readonly LegendEntry[];
  hiddenVersions: number;
}) {
  const hatched = useInteraction(interaction, hatchedInstructorId);
  const entry = hatched ? names.find((n) => n.id === hatched) : undefined;
  return (
    <div
      data-testid="mode-bar"
      data-mode={mode.kind}
      className={
        mode.kind === "type"
          ? "flex flex-wrap items-center gap-x-4 gap-y-1 bg-sky-700 px-4 py-1 text-white text-xs dark:bg-sky-800"
          : "flex flex-wrap items-center gap-x-4 gap-y-1 bg-emerald-700 px-4 py-1 text-white text-xs dark:bg-emerald-800"
      }
    >
      {mode.kind === "type" ? (
        <span>
          ● Mode <b>Semaine type</b> — saison {season.name} (les modifications s'appliquent à toute
          la saison)
        </span>
      ) : (
        <span>
          ● Mode <b>Semaine du {formatDate(mode.monday)}</b> — les modifications ne concernent que
          cette semaine (exceptions) ·{" "}
          <Link to="/referentiels/fermetures" className="underline underline-offset-2">
            Périodes de fermeture
          </Link>
        </span>
      )}
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
