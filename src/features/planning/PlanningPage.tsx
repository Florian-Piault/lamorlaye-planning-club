import { DndContext } from "@dnd-kit/core";
import { FileDown, LandPlot, Lock, Plus, Redo2, Undo2 } from "lucide-react";
import {
  type ReactNode,
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
import { useToast } from "@/components/feedback/Toast";
import { ErrorAlert } from "@/components/form/Field";
import { OwnToolbar, SeasonSelector } from "@/components/layout/AppShell";
import { EmptyState, Page } from "@/components/layout/Page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDiscardGuard, useEscapeCascade } from "@/components/ui/dialog";
import { Label, Select } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { useDatabase } from "@/db/DatabaseProvider";
import { createGroup } from "@/db/repositories/groups";
import type { Season } from "@/db/schema";
import type { Command, PlanningState } from "@/domain/commands";
import { createConflictIndex } from "@/domain/conflicts";
import { todayInParis } from "@/domain/dates";
import { canRedo, canUndo, redoLabel, undoLabel } from "@/domain/history";
import { unavailableIntervals } from "@/domain/instructorAvailability";
import { weekOccurrences } from "@/domain/occurrences";
import { formatDate, timeToMinutes, weekdayLabel, weekdayShort } from "@/domain/time";
import type { GroupInput } from "@/domain/validation";
import { weekPdfJob } from "@/features/pdf/jobs";
import { PAPER_SIZES, type PaperSize } from "@/features/pdf/model";
import { PdfPreviewDialog } from "@/features/pdf/PdfPreviewDialog";
import { RequireSeason } from "@/features/referentiels/ReferentielsPage";
import { errorMessage } from "@/hooks/useLoader";
import { ariaShortcut, shortcutLabel } from "@/lib/keys";
import { cn } from "@/lib/utils";
import { DayBar } from "./components/DayBar";
import { DragFeedback } from "./components/DragFeedback";
import { FiltersMenu } from "./components/Filters";
import { Legend, type LegendEntry } from "./components/Legend";
import { type LessonFormValues, LessonPanel } from "./components/LessonPanel";
import { OccurrenceActions } from "./components/OccurrenceActions";
import { type CandidateLook, type LessonView, PlanningGrid } from "./components/PlanningGrid";
import { type WarningItem, WarningsPanel } from "./components/WarningsPanel";
import { ModeSelector, WeekNavigator } from "./components/WeekNavigator";
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
  dayToOpen,
  focusedWeekday,
  type GridView,
  gridWeekdays,
  lessonCountByWeekday,
  viewColumnWidth,
  WEEK_VIEW,
} from "./grid/dayView";
import {
  AXIS_WIDTH,
  clockLabel,
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
  weekName,
  weekNeighbours,
} from "./grid/items";
import {
  busyLabel,
  type CandidateLesson,
  candidateWarnings,
  displayedCourts,
  displayedRange,
  displayedWeekdays,
  hasFilters,
  type InstructorLabel,
  laterChangesSummary,
  matchesFilters,
  minutesByInstructor,
  NEW_LESSON_ID,
  noFilters,
  type PlanningFilters,
  semaineTypeDate,
  slotWarnings,
  warningMessages,
  weekLessons,
} from "./grid/view";
import { hatchedInstructorId, InteractionStore, useInteraction } from "./interaction";
import { loadPlanningReferences, type PlanningReferences } from "./references";
import { PlanningStore, usePlanningSnapshot } from "./store";
import { useGridGestures } from "./useGridGestures";

const DESCRIPTION = "Le planning habituel de la saison, et chaque semaine du calendrier.";
const NEUTRAL_COLOR = "#64748B";

/** Dernier mode affiché, par saison : on le retrouve en revenant sur l'écran. */
const rememberedModes = new Map<string, PlanningMode>();
/** Dernière vue (Semaine / Jour), par saison. */
const rememberedViews = new Map<string, GridView>();
/** Dernier jour vu en vue Jour, par saison. */
const rememberedDays = new Map<string, number>();
/** Panneau latéral replié (pour la session). */
let rememberedFold = false;
const PANEL_ID = "planning-panel";
/** Dernier format de papier choisi pour le PDF de la semaine. */
let rememberedPaper: PaperSize = "A4";

export function PlanningPage() {
  const { season, readOnly } = useSeason();
  if (!season) {
    return (
      <Page title="Planning" description={DESCRIPTION}>
        <RequireSeason>{null}</RequireSeason>
      </Page>
    );
  }
  return <PlanningScreen key={`${season.id}:${readOnly}`} season={season} readOnly={readOnly} />;
}

interface Loaded {
  refs: PlanningReferences;
  store: PlanningStore;
}

/** Charge les référentiels et le planning de la saison, puis affiche la grille. */
function PlanningScreen({ season, readOnly }: { season: Season; readOnly: boolean }) {
  const { db } = useDatabase();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadPlanningReferences(db, season.id),
      PlanningStore.load(db, season.id, { readOnly }),
    ]).then(
      ([refs, store]) => !cancelled && setLoaded({ refs, store }),
      (e: unknown) => !cancelled && setError(e),
    );
    return () => {
      cancelled = true;
    };
  }, [db, season.id, readOnly]);

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
  // Saison archivée : consultation seule (aucun geste, panneau, raccourci ni annulation).
  const readOnly = store.readOnly;
  const snapshot = usePlanningSnapshot(store);
  const interaction = useMemo(() => new InteractionStore(), []);
  const [filters, setFilters] = useState<PlanningFilters>(noFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [panelFolded, setPanelFolded] = useState(rememberedFold);
  const toast = useToast();
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

  // --- Garde du panneau de cours (spec UX v1.1) ------------------------------
  // Le panneau se comporte comme une modale : si sa saisie a changé, le fermer,
  // ouvrir un autre cours ou choisir un autre créneau demande confirmation.
  const {
    setDirty: onPanelDirtyChange,
    guard: guardPanel,
    confirmation: discardConfirmation,
  } = useDiscardGuard();
  const escapeForPicker = useEscapeCascade();
  const [datedMonday, setDatedMonday] = useState(() =>
    mode.kind === "dated" ? mode.monday : todayMonday,
  );
  const changeMode = useCallback(
    (next: PlanningMode) =>
      guardPanel(() => {
        rememberedModes.set(season.id, next);
        setModeState(next);
        if (next.kind === "dated") setDatedMonday(next.monday);
        setSelectedId(null);
        setPanel(null);
        interaction.update({ draft: null });
      }),
    [season.id, interaction, guardPanel],
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

  // Jours de la saison (panneau, barre des jours) ; la grille n'en dessine
  // qu'un en vue Jour.
  const weekdayList = displayedWeekdays(season.displayedDays, items);
  const allWeekdays = useStable(weekdayList, weekdayList.join(","));
  const [view, setViewState] = useState<GridView>(
    () => rememberedViews.get(season.id) ?? WEEK_VIEW,
  );
  // Dernier jour vu en vue Jour : « Jour » y revient depuis la vue Semaine.
  const [lastDay, setLastDay] = useState<number | null>(
    () => rememberedDays.get(season.id) ?? null,
  );
  const changeView = useCallback(
    (next: GridView) => {
      rememberedViews.set(season.id, next);
      setViewState(next);
      if (next.kind === "day") {
        rememberedDays.set(season.id, next.weekday);
        setLastDay(next.weekday);
      }
    },
    [season.id],
  );
  const gridDayList = gridWeekdays(allWeekdays, view);
  const weekdays = useStable(gridDayList, gridDayList.join(","));
  const dayCounts = useMemo(() => lessonCountByWeekday(items), [items]);
  const todayWeekday = allWeekdays.find((w) => dateOf(w) === today) ?? null;
  const openedDay = dayToOpen(allWeekdays, lastDay, todayWeekday);
  // En-tête d'un jour (vue Semaine) : le jour s'affiche seul et le focus passe
  // à sa pastille, l'en-tête cliqué ayant disparu.
  const showDayFromHeader = useCallback(
    (weekday: number) => {
      changeView({ kind: "day", weekday });
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>('[data-testid="day-pill"][aria-pressed="true"]')
          ?.focus(),
      );
    },
    [changeView],
  );
  const courtList = displayedCourts(refs.courts, items);
  const courts = useStable(courtList, courtList.map((c) => c.id).join(","));
  const courtIds = useMemo(() => courts.map((c) => c.id), [courts]);
  const columnWidth = viewColumnWidth(
    scrollerWidth - AXIS_WIDTH - 2,
    weekdays.length * courtIds.length,
    view,
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
  const drawnIds = useMemo(() => new Set(boxes.map((b) => b.id)), [boxes]);
  // Changement de jour (vue Jour) : la sélection d'un cours qui n'est plus dessiné est vidée.
  useEffect(() => {
    if (selectedId && itemsById.has(selectedId) && !drawnIds.has(selectedId)) setSelectedId(null);
  }, [selectedId, itemsById, drawnIds]);

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
      const color = instructor?.color ?? NEUTRAL_COLOR;
      const status = [
        occurrence?.cancellation &&
          `Annulé cette semaine : ${cancellationLabel(occurrence.cancellation.reason, occurrence.cancellation.note)}`,
        occurrence?.replaced &&
          `Remplacement : ${instructorName(occurrence.instructorId)} au lieu de ${instructorName(
            occurrence.originalInstructorId,
          )}`,
        occurrence?.modified && "Modifié cette semaine",
        item.kind === "one_off" && "Cours ponctuel",
      ].filter((s): s is string => Boolean(s));
      return [
        {
          ...box,
          id: item.id,
          instructorId: item.instructorId,
          color,
          groupName,
          timeLabel,
          detail: `${instructor?.initials ?? "?"}${size ? ` · ${size}` : ""}`,
          card: {
            heading: groupName,
            lines: [
              `${day} ${timeLabel}`,
              courtName,
              `Moniteur : ${instructorName(item.instructorId)}`,
              size && `${size} élèves`,
              ...status,
              item.note,
            ].filter((line): line is string => Boolean(line)),
            warnings: messages,
            color,
          },
          ariaLabel: `${groupName}, ${day} ${timeLabel}, ${court?.name ?? "court inconnu"}, ${instructorName(
            item.instructorId,
          )}${status.length > 0 ? `, ${status.join(", ").toLowerCase()}` : ""}${
            messages.length > 0 ? `, ${messages.length} avertissement(s)` : ""
          }`,
          warning: messages.length > 0,
          dimmed: filtered && !matchesFilters(item, filters),
          locked: readOnly,
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
    readOnly,
  ]);

  const warningItems: WarningItem[] = useMemo(
    () =>
      [...active]
        .filter((i) => warnings.has(i.id))
        .sort((a, b) => a.weekday - b.weekday || a.start - b.start)
        .map((i) => ({
          lessonId: i.id,
          title: `${weekdayShort(i.weekday)}${
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
          initials: i.initials,
          color: i.color,
          minutes: minutes.get(i.id) ?? 0,
          noAvailability: i.availabilities.length === 0,
        })),
    [refs.instructors, minutes],
  );

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
  // Toast commun : succès (avec « Annuler cette action »), erreurs persistantes.
  const undoRef = useRef<() => void>(() => {});
  const notify = useCallback(
    (message: string, undoable = false) =>
      toast.success(
        message,
        undoable
          ? { action: { label: "Annuler cette action", run: () => undoRef.current() } }
          : undefined,
      ),
    [toast],
  );
  const notifyError = useCallback((message: string) => toast.error(message), [toast]);
  // Échec d'écriture en base (le moteur a restauré l'état) : erreur persistante.
  useEffect(() => {
    if (snapshot.error) toast.error(snapshot.error, { onDismiss: () => store.dismissError() });
  }, [snapshot.error, toast, store]);

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
        notifyError(errorMessage(e));
        return false;
      }
    },
    [store, notify, notifyError],
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

  /** Fermeture demandée par l'utilisatrice (croix, Fermer, Échap, clic dans le vide). */
  const requestClosePanel = useCallback(() => guardPanel(closePanel), [guardPanel, closePanel]);

  const openLesson = useCallback(
    (id: string) =>
      guardPanel(() => {
        interaction.update({ draft: null });
        setSelectedId(id);
        setPanel({ mode: "edit", itemId: id });
      }),
    [interaction, guardPanel],
  );

  const openNew = useCallback(
    (values?: Partial<LessonFormValues>) => {
      if (readOnly) return;
      guardPanel(() => {
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
      });
    },
    [interaction, weekdays, dayStart, dayEnd, readOnly, guardPanel],
  );

  const undo = useCallback(() => {
    const command = store.undo();
    if (command) notify(`Annulé : ${lowerFirst(command.label)}`);
  }, [store, notify]);

  const redo = useCallback(() => {
    const command = store.redo();
    if (command) notify(`Rétabli : ${lowerFirst(command.label)}`);
  }, [store, notify]);
  undoRef.current = undo;

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
      // Vue Jour : on passe au jour du cours s'il n'est pas affiché.
      const weekday = itemsById.get(id)?.weekday;
      if (
        view.kind === "day" &&
        weekday !== undefined &&
        weekday !== focusedWeekday(allWeekdays, view)
      ) {
        changeView({ kind: "day", weekday });
      }
      openLesson(id);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          boardRef.current
            ?.querySelector(`[data-lesson-id="${CSS.escape(id)}"]`)
            ?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
        }),
      );
    },
    [openLesson, itemsById, view, allWeekdays, changeView],
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

  const onPanelInstructorChange = useCallback(
    (instructorId: string | null) => interaction.update({ panelInstructorId: instructorId }),
    [interaction],
  );

  // Cours placés, désignés par leur groupe et leur horaire : moniteurs occupés (§5.1).
  const busySlots = useMemo(
    () =>
      slots.map((slot) => ({
        ...slot,
        label: busyLabel(
          slot.groupId ? (groupsById.get(slot.groupId)?.name ?? null) : null,
          slot.start,
          slot.end,
        ),
      })),
    [slots, groupsById],
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
    readOnly,
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
      onBoardClick: () =>
        guardPanel(() => {
          setSelectedId(null);
          closePanel();
        }),
      onCancel: () => notify("Déplacement interrompu"),
    },
  });

  // --- Annonces pour les lecteurs d'écran (glisser-déposer dnd-kit) ----------
  const describe = useRef<(activeId: string | number, withSlot?: boolean) => string>(() => "");
  describe.current = (activeId, withSlot = false) => {
    const [kind, id = ""] = String(activeId).split(/:(.*)/s);
    if (kind === "instructor") return `pastille de ${instructorName(id)}`;
    const item = itemsById.get(id);
    if (!item) return "cours";
    const group = item.groupId ? groupsById.get(item.groupId)?.name : undefined;
    const name = group ?? (item.kind === "one_off" ? "cours ponctuel" : "cours");
    return withSlot
      ? `${name}, ${weekdayLabel(item.weekday).toLowerCase()} ${clockLabel(item.start)}`
      : name;
  };
  const accessibility = useMemo(
    () => ({
      screenReaderInstructions: {
        draggable:
          "Cours de la grille. Entrée : ouvrir le détail. Espace : saisir le cours pour le déplacer au clavier, puis flèches haut et bas pour changer l'heure par pas de 15 minutes (Maj : 1 heure), flèches gauche et droite pour changer de court (Maj : changer de jour), Espace ou Entrée pour déposer, Échap pour annuler. À la souris : glisser pour déplacer, Alt pour dupliquer, bord inférieur pour changer la durée.",
      },
      announcements: {
        onDragStart: ({ active }: { active: { id: string | number } }) =>
          `Déplacement commencé : ${describe.current(active.id, true)}. Flèches pour déplacer, Espace ou Entrée pour déposer, Échap pour annuler.`,
        onDragOver: () => undefined,
        onDragMove: () => undefined,
        onDragEnd: ({ active }: { active: { id: string | number } }) =>
          `Déplacement terminé : ${describe.current(active.id)}.`,
        onDragCancel: ({ active }: { active: { id: string | number } }) =>
          `Déplacement annulé : ${describe.current(active.id)} reste à sa place.`,
      },
    }),
    [],
  );

  // --- Raccourcis clavier (§11.5) ---------------------------------------------
  // Un cours sélectionné qui n'est plus dessiné (autre jour en vue Jour) ne
  // l'est plus : Suppr ne supprime jamais un cours invisible.
  const selected = selectedId && drawnIds.has(selectedId) ? selectedId : null;
  const neighbours = mode.kind === "dated" ? weekNeighbours(seasonRange, mode.monday) : null;
  const keyboard = useRef({
    undo,
    redo,
    openNew,
    removeLesson,
    requestClosePanel,
    panel,
    selected,
    gestures,
    neighbours,
    changeMode,
    openPdf,
    readOnly,
  });
  keyboard.current = {
    undo,
    redo,
    openNew,
    removeLesson,
    requestClosePanel,
    panel,
    selected,
    gestures,
    neighbours,
    changeMode,
    openPdf,
    readOnly,
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const k = keyboard.current;
      if (document.querySelector("dialog[open]")) return;
      // Échap en cascade : un champ date ou heure, puis une bulle ouverte, d'abord.
      const picker = escapeForPicker(event);
      if (event.key === "Escape") {
        // Bulle, fiche d'un cours ou menu « Filtres » ouverts : Échap les ferme, eux seuls.
        if (
          picker ||
          event.defaultPrevented ||
          document.querySelector("[role=tooltip], [data-escape-layer], [data-menu-open]")
        ) {
          return;
        }
        const drag = interaction.get().drag;
        // Un glisser dnd-kit est interrompu par dnd-kit lui-même (onDragCancel).
        if (drag && drag.kind !== "select") return;
        if (k.gestures.cancelSelection()) return;
        // Comme une fenêtre : la garde demande confirmation si la saisie a changé.
        if (k.panel) k.requestClosePanel();
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
      // Pendant un glisser (souris ou clavier), les touches appartiennent au geste.
      if (isEditable(event.target) || event.altKey || interaction.get().drag) return;
      // Saison archivée : seuls les raccourcis de consultation restent actifs.
      const writing =
        (mod && (key === "z" || key === "y" || key === "n")) ||
        ((event.key === "Delete" || event.key === "Backspace") && !mod);
      if (k.readOnly && writing) return;
      if (mod && key === "z") {
        event.preventDefault();
        if (event.shiftKey) k.redo();
        else k.undo();
      } else if (mod && key === "y") {
        event.preventDefault();
        k.redo();
      } else if (mod && key === "n" && !event.shiftKey) {
        // Ctrl/Cmd+N seulement (§11.5) : pas de raccourci d'une seule lettre,
        // qui se déclencherait par mégarde (WCAG 2.1.4).
        event.preventDefault();
        k.openNew();
      } else if ((event.key === "Delete" || event.key === "Backspace") && !mod && k.selected) {
        event.preventDefault();
        k.removeLesson(k.selected);
      } else if (
        (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
        !mod &&
        !event.shiftKey &&
        k.neighbours
      ) {
        // ← / → : semaine précédente / suivante (semaine datée).
        const target = event.key === "ArrowLeft" ? k.neighbours.previous : k.neighbours.next;
        event.preventDefault();
        if (target) k.changeMode({ kind: "dated", monday: target });
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [interaction, escapeForPicker]);

  // --- Rendu ----------------------------------------------------------------
  const editedItem = panel?.mode === "edit" ? itemsById.get(panel.itemId) : undefined;
  const panelOpen = panel?.mode === "create" || editedItem !== undefined;
  // Replié, le panneau disparaît ; il se rouvre de lui-même, le temps d'un
  // cours ouvert ou créé.
  const panelVisible = !panelFolded || panelOpen;
  const togglePanel = () => {
    if (!panelVisible) {
      rememberedFold = false;
      setPanelFolded(false);
      return;
    }
    guardPanel(() => {
      closePanel();
      rememberedFold = true;
      setPanelFolded(true);
    });
  };

  if (courts.length === 0) {
    return (
      <Page title="Planning" description={DESCRIPTION}>
        <EmptyState icon={LandPlot} title="Aucun court">
          <p>Ajoutez au moins un court pour construire le planning habituel.</p>
          <Button asChild className="mt-4">
            <Link to="/referentiels/courts">Saisir les courts</Link>
          </Button>
        </EmptyState>
      </Page>
    );
  }

  const commonPanelProps = {
    weekdays: allWeekdays,
    dayStart,
    dayEnd,
    courts,
    groups: refs.groups,
    instructors: refs.instructors,
    levels: refs.levels,
    onSubmit: submitPanel,
    onClose: requestClosePanel,
    onDirtyChange: onPanelDirtyChange,
    onInstructorChange: onPanelInstructorChange,
    busySlots,
    onCreateGroup: createQuickGroup,
    dayHeading: headingOf,
    dateOf,
    readOnly,
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
              ? "Cette semaine seulement : rattrapage, stage, séance d'essai… Possible pendant une fermeture."
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
      excludedId: item.id,
    };
    if (item.kind === "lesson") {
      return <LessonPanel key={stamp} {...common} onDelete={() => removeLesson(item.id)} />;
    }
    const actions = readOnly ? null : (
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
          notice={`Cette semaine seulement : le ${date}.`}
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
        notice={`Séance du ${date} : vos changements ne concernent que cette séance ; le planning habituel et les autres semaines restent inchangés.`}
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
      accessibility={accessibility}
    >
      <OwnToolbar />
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Une seule barre d'outils, sur une ligne : la barre haute est masquée. */}
        <header
          data-testid="planning-toolbar"
          // Conteneur : en dessous de 50rem, « Filtres » et la saison se compactent.
          className="@container flex h-12 shrink-0 flex-nowrap items-center gap-1 border-b bg-card px-4"
        >
          <h1 className="sr-only">Planning</h1>
          <ModeSelector mode={mode} datedMonday={datedMonday} onChange={changeMode} />
          {readOnly ? (
            // Libellé court (la barre tient sur une ligne) ; la raison est en bulle.
            <Tooltip content="Saison terminée : aucune modification possible">
              <Badge
                variant="outline"
                className="shrink-0"
                data-testid="planning-read-only"
                // Focalisable : la bulle se lit au clavier.
                tabIndex={0}
              >
                <Lock aria-hidden />
                Consultation seulement
              </Badge>
            </Tooltip>
          ) : (
            <>
              <Button
                size="sm"
                className="text-xs @max-[50rem]:has-[>svg]:px-2"
                onClick={() => openNew()}
                aria-keyshortcuts={ariaShortcut("mod+n")}
                tooltip={`${mode.kind === "dated" ? "Nouveau cours ponctuel" : "Nouveau cours"} (${shortcutLabel("mod+n")})`}
              >
                <Plus aria-hidden />
                Nouveau cours
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="size-8 @max-[50rem]:size-7"
                aria-label="Annuler"
                onClick={undo}
                disabled={!canUndo(snapshot.history)}
                aria-keyshortcuts={ariaShortcut("mod+z")}
                tooltip={`${undoLabel(snapshot.history) ?? "Rien à annuler"} (${shortcutLabel("mod+z")})`}
              >
                <Undo2 aria-hidden />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="size-8 @max-[50rem]:size-7"
                aria-label="Rétablir"
                onClick={redo}
                disabled={!canRedo(snapshot.history)}
                aria-keyshortcuts={ariaShortcut("mod+shift+z")}
                tooltip={`${redoLabel(snapshot.history) ?? "Rien à rétablir"} (${shortcutLabel("mod+shift+z")})`}
              >
                <Redo2 aria-hidden />
              </Button>
            </>
          )}
          <Button
            size="icon"
            variant="outline"
            className="size-8 @max-[50rem]:size-7"
            aria-label="PDF"
            onClick={openPdf}
            aria-keyshortcuts={ariaShortcut("mod+p")}
            tooltip={`PDF de la semaine affichée (${shortcutLabel("mod+p")})`}
          >
            <FileDown aria-hidden />
          </Button>
          <FiltersMenu
            filters={filters}
            onChange={setFilters}
            instructors={filterOptions.instructors}
            courts={filterOptions.courts}
            groups={filterOptions.groups}
          />
          <Legend entries={legendEntries} interaction={interaction} readOnly={readOnly} />
          <SeasonSelector compact />
        </header>
        <ModeBar
          readOnly={readOnly}
          mode={mode}
          interaction={interaction}
          names={legendEntries}
          laterChanges={mode.kind === "type" ? laterChangesSummary(lessons, referenceDate) : null}
        />
        <DayBar
          weekdays={allWeekdays}
          counts={dayCounts}
          view={view}
          onViewChange={changeView}
          openedDay={openedDay}
          weekNavigation={
            mode.kind === "dated" ? (
              <WeekNavigator
                monday={mode.monday}
                season={seasonRange}
                todayMonday={todayMonday}
                onChange={changeMode}
              />
            ) : null
          }
          panelVisible={panelVisible}
          panelId={PANEL_ID}
          onTogglePanel={togglePanel}
        />
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
            onShowDay={view.kind === "week" ? showDayFromHeader : undefined}
          />
          {panelVisible && (
            <aside
              id={PANEL_ID}
              aria-label="Panneau latéral"
              className="w-80 shrink-0 overflow-y-auto border-l bg-card p-4"
            >
              {renderPanel()}
            </aside>
          )}
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
      {discardConfirmation}
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

/**
 * Barre de mode, sur une ligne à hauteur fixe (B7) : la phrase de portée,
 * toujours visible, dit si les changements valent pour toute la saison ou
 * pour cette semaine seulement ; elle est tronquée si la place manque. Les
 * informations ponctuelles (cours qui changent plus tard, moniteur hachuré)
 * sont des pastilles courtes avec leur détail en bulle. Rien ne bouge en
 * dessous au survol d'un cours.
 */
function ModeBar({
  readOnly,
  mode,
  interaction,
  names,
  laterChanges,
}: {
  readOnly: boolean;
  mode: PlanningMode;
  interaction: InteractionStore;
  names: readonly LegendEntry[];
  laterChanges: { label: string; detail: string } | null;
}) {
  const hatched = useInteraction(interaction, hatchedInstructorId);
  const entry = hatched ? names.find((n) => n.id === hatched) : undefined;
  const name = mode.kind === "type" ? "Planning habituel" : weekName(mode.monday);
  const scope = readOnly
    ? "Consultation seulement (saison terminée)"
    : mode.kind === "type"
      ? "Vos changements valent pour toutes les semaines de la saison"
      : "Vos changements ne concernent que cette semaine";
  return (
    <div
      data-testid="mode-bar"
      data-mode={mode.kind}
      className={cn(
        "flex h-6 shrink-0 items-center gap-3 overflow-hidden whitespace-nowrap px-4 text-white text-xs",
        mode.kind === "type" ? "bg-sky-700 dark:bg-sky-800" : "bg-emerald-700 dark:bg-emerald-800",
      )}
    >
      {/* La phrase de portée passe avant les pastilles : ce sont elles qui rétrécissent. */}
      <span className="shrink-0">
        ● <b>{name}</b> — <span data-testid="mode-scope">{scope}</span>
      </span>
      {!readOnly && mode.kind === "dated" && (
        <Link
          to="/referentiels/fermetures"
          className="shrink-0 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-white"
        >
          Périodes de fermeture
        </Link>
      )}
      <div className="ml-auto flex min-w-0 items-center justify-end gap-1.5">
        {laterChanges && (
          <ModePill testId="later-changes" detail={laterChanges.detail}>
            {laterChanges.label}
          </ModePill>
        )}
        {entry && (
          <ModePill
            testId="hatch-info"
            detail={
              entry.noAvailability
                ? `Zones rayées : ${entry.name} n'a saisi aucune disponibilité (indisponible partout)`
                : `Zones rayées : ${entry.name} n'est pas disponible`
            }
          >
            Zones rayées : {entry.name}
            {entry.noAvailability && " (aucune disponibilité)"}
          </ModePill>
        )}
      </div>
    </div>
  );
}

/**
 * Pastille courte de la barre de mode, détail en bulle (survol et clavier) ;
 * tronquée si la place manque, pour laisser la phrase de portée entière.
 */
function ModePill({
  testId,
  detail,
  children,
}: {
  testId: string;
  detail: string;
  children: ReactNode;
}) {
  return (
    <Tooltip content={detail}>
      <span
        // biome-ignore lint/a11y/noNoninteractiveTabindex: focalisable pour lire la bulle au clavier.
        tabIndex={0}
        data-testid={testId}
        className="min-w-0 truncate rounded-full border border-white/60 px-2 leading-[18px] focus-visible:outline-2 focus-visible:outline-white"
      >
        {children}
      </span>
    </Tooltip>
  );
}
