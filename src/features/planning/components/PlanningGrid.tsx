import { House, Sun } from "lucide-react";
import { memo, type PointerEvent, type RefObject, useCallback, useMemo } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import type { Court } from "@/db/schema";
import type { Conflict } from "@/domain/conflicts";
import { weekdayLabel } from "@/domain/time";
import { cn } from "@/lib/utils";
import { courtHeaderLabel, dayHeaderLabel } from "../grid/dayView";
import {
  AXIS_WIDTH,
  boardSize,
  clockLabel,
  type GridGeometry,
  gridColumns,
  gridLines,
  hatchRects,
  type Rect,
  shadeRects,
  slotRect,
} from "../grid/geometry";
import { type CandidateLesson, type StudentShadeBand, shadeTier } from "../grid/view";
import {
  HoverCardStore,
  type LessonCard,
  lessonDescription,
  lessonDescriptionId,
} from "../hoverCard";
import {
  hatchedInstructorId,
  type InteractionStore,
  shadedDuration,
  shadedGroupId,
  useInteraction,
} from "../interaction";
import { LessonBlock, LessonContent } from "./LessonBlock";
import { LessonHoverCard } from "./LessonHoverCard";

export interface LessonView extends Rect {
  id: string;
  instructorId: string | null;
  color: string;
  groupName: string;
  timeLabel: string;
  detail: string;
  /** Fiche au survol : détail complet et avertissements. */
  card: LessonCard;
  ariaLabel: string;
  warning: boolean;
  dimmed: boolean;
  cancelled: boolean;
  replaced: boolean;
  modified: boolean;
  oneOff: boolean;
  /** Saison archivée : cours consultable, non modifiable. */
  locked: boolean;
}

/** Bande « Fermé — … » d'un jour couvert par une période de fermeture (§4.2). */
export interface ClosedDayView {
  weekday: number;
  label: string;
}

/** Apparence d'un cours candidat (fantôme, brouillon). */
export interface CandidateLook {
  color: string;
  groupName: string;
  detail: string;
}

interface PlanningGridProps {
  geometry: GridGeometry;
  courts: readonly Court[];
  lessons: readonly LessonView[];
  selectedId: string | null;
  interaction: InteractionStore;
  scrollerRef: RefObject<HTMLDivElement | null>;
  boardRef: RefObject<HTMLDivElement | null>;
  /** Intervalles d'indisponibilité d'un moniteur pour un jour (hachures, §4.4). */
  unavailableOn: (
    instructorId: string,
    weekday: number,
  ) => readonly { start: number; end: number }[];
  /**
   * Bandes ombrées des élèves d'un groupe (§4.4), pour un cours de cette durée
   * (déplacement) ou par morceau de journée (création, `null`) ; jours fermés exclus.
   */
  shadeBandsOf: (groupId: string, durationMinutes: number | null) => readonly StudentShadeBand[];
  lookOf: (candidate: CandidateLesson) => CandidateLook;
  onOpenLesson: (id: string) => void;
  onBoardPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  /** En-tête d'un jour (« Lundi » ou « Lundi 02/11 »). */
  dayHeading?: (weekday: number) => string;
  closedDays?: readonly ClosedDayView[];
  /** Vue Semaine : clic sur l'en-tête d'un jour pour l'afficher seul. */
  onShowDay?: (weekday: number) => void;
}

/**
 * Grille de la semaine ou d'un jour (§4.1, variante A) : jours en colonnes
 * subdivisées par court, heures en lignes ; en-têtes et axe horaire restent
 * visibles pendant le défilement. Fiche du cours au survol.
 */
export function PlanningGrid({
  geometry,
  courts,
  lessons,
  selectedId,
  interaction,
  scrollerRef,
  boardRef,
  unavailableOn,
  shadeBandsOf,
  lookOf,
  onOpenLesson,
  onBoardPointerDown,
  dayHeading = weekdayLabel,
  closedDays = noClosedDays,
  onShowDay,
}: PlanningGridProps) {
  const size = boardSize(geometry);
  const onHover = useMemo(
    () => (instructorId: string | null) => interaction.update({ hoverInstructorId: instructorId }),
    [interaction],
  );
  const cards = useMemo(
    () => new HoverCardStore(() => interaction.get().drag !== null),
    [interaction],
  );
  const cardsById = useMemo(() => new Map(lessons.map((l) => [l.id, l.card])), [lessons]);
  const cardOf = useCallback((id: string) => cardsById.get(id), [cardsById]);
  return (
    <div
      ref={scrollerRef}
      data-testid="planning-scroller"
      className="relative min-w-0 flex-1 overflow-auto bg-background"
    >
      <div style={{ width: AXIS_WIDTH + size.width }}>
        <GridHeader
          geometry={geometry}
          courts={courts}
          dayHeading={dayHeading}
          onShowDay={onShowDay}
        />
        <div className="flex pt-2 pb-4">
          <TimeAxis geometry={geometry} height={size.height} />
          <div
            ref={boardRef}
            data-testid="planning-board"
            data-column-width={geometry.columnWidth}
            data-hour-height={geometry.hourHeight}
            data-day-start={geometry.dayStart}
            data-courts={geometry.courtIds.length}
            onPointerDown={onBoardPointerDown}
            className="relative touch-none select-none border-b bg-card"
            style={{ width: size.width, height: size.height }}
          >
            <GridLines geometry={geometry} />
            <ClosureLayer geometry={geometry} closedDays={closedDays} />
            <StudentShadeLayer
              geometry={geometry}
              interaction={interaction}
              shadeBandsOf={shadeBandsOf}
            />
            <HatchLayer
              geometry={geometry}
              interaction={interaction}
              unavailableOn={unavailableOn}
            />
            <LessonsLayer
              lessons={lessons}
              selectedId={selectedId}
              interaction={interaction}
              onOpen={onOpenLesson}
              onHover={onHover}
              onCard={cards.hover}
            />
            <PreviewLayer geometry={geometry} interaction={interaction} lookOf={lookOf} />
          </div>
        </div>
      </div>
      <LessonHoverCard store={cards} cardOf={cardOf} />
      <LessonDescriptions lessons={lessons} />
    </div>
  );
}

const noClosedDays: readonly ClosedDayView[] = [];

/**
 * Descriptions des cours (`aria-describedby`) : le détail de la fiche au
 * survol, masqué à l'écran, hors de la grille (rien n'y change au glisser).
 */
const LessonDescriptions = memo(function LessonDescriptions({
  lessons,
}: {
  lessons: readonly LessonView[];
}) {
  return (
    <div hidden>
      {lessons.map((lesson) => (
        <span key={lesson.id} id={lessonDescriptionId(lesson.id)}>
          {lessonDescription(lesson.card)}
        </span>
      ))}
    </div>
  );
});

/** Bandes grisées des jours fermés ; les cours ponctuels (stages) s'affichent par-dessus. */
const ClosureLayer = memo(function ClosureLayer({
  geometry,
  closedDays,
}: {
  geometry: GridGeometry;
  closedDays: readonly ClosedDayView[];
}) {
  const dayWidth = geometry.courtIds.length * geometry.columnWidth;
  return (
    <>
      {closedDays.map((day) => {
        const index = geometry.weekdays.indexOf(day.weekday);
        if (index < 0) return null;
        return (
          <div
            key={day.weekday}
            data-testid="closure-band"
            data-weekday={day.weekday}
            className="pointer-events-none absolute inset-y-0 z-[1] flex justify-center bg-muted/80 pt-3"
            style={{
              left: index * dayWidth,
              width: dayWidth,
              backgroundImage:
                "repeating-linear-gradient(-45deg, transparent 0 10px, color-mix(in oklab, var(--muted-foreground) 12%, transparent) 10px 12px)",
            }}
          >
            <span className="h-fit rounded bg-card/90 px-1.5 py-0.5 text-center font-semibold text-[11px] text-muted-foreground shadow-sm">
              {day.label}
            </span>
          </div>
        );
      })}
    </>
  );
});

const GridHeader = memo(function GridHeader({
  geometry,
  courts,
  dayHeading,
  onShowDay,
}: {
  geometry: GridGeometry;
  courts: readonly Court[];
  dayHeading: (weekday: number) => string;
  onShowDay?: (weekday: number) => void;
}) {
  const byId = new Map(courts.map((c) => [c.id, c]));
  const dayWidth = geometry.courtIds.length * geometry.columnWidth;
  return (
    <div className="sticky top-0 z-20 flex border-b bg-card">
      <div className="sticky left-0 z-[21] shrink-0 bg-card" style={{ width: AXIS_WIDTH }} />
      {geometry.weekdays.map((weekday) => {
        const label = dayHeading(weekday);
        const text = dayHeaderLabel(label, weekday, dayWidth);
        return (
          <div
            key={weekday}
            data-testid="day-header"
            className="shrink-0 border-l-2"
            style={{ width: dayWidth }}
          >
            <div className="flex justify-center px-0.5 pt-1 pb-0.5 font-semibold text-sm">
              {onShowDay ? (
                <Tooltip content={`Afficher le ${weekdayLabel(weekday).toLowerCase()} seul`}>
                  <button
                    type="button"
                    onClick={() => onShowDay(weekday)}
                    className="max-w-full truncate rounded px-1.5 hover:bg-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span aria-hidden={text !== label || undefined}>{text}</span>
                    {text !== label && <span className="sr-only">{label}</span>}
                  </button>
                </Tooltip>
              ) : (
                <span className="truncate px-1.5">{label}</span>
              )}
            </div>
            <div className="flex">
              {geometry.courtIds.map((courtId) => (
                <CourtHeader key={courtId} court={byId.get(courtId)} width={geometry.columnWidth} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
});

/**
 * En-tête d'un court : vrai nom, abrégé si la colonne est étroite (« Terre
 * battue 1 » → « TB1 »), icône soleil (extérieur) ou maison (couvert) ; nom
 * complet et nature en bulle et pour les lecteurs d'écran.
 */
function CourtHeader({ court, width }: { court: Court | undefined; width: number }) {
  const name = court?.name ?? "Court";
  const outdoor = court?.kind === "outdoor";
  const kind = outdoor ? "court extérieur" : "court couvert";
  const { text, icon } = courtHeaderLabel(name, width);
  const Icon = outdoor ? Sun : House;
  return (
    <Tooltip content={`${name} — ${kind}`} describe={false}>
      <div
        data-testid="court-header"
        data-kind={court?.kind}
        className="flex items-center justify-center gap-1 overflow-hidden px-0.5 pb-1 text-[11px] text-muted-foreground"
        style={{ width }}
      >
        {icon && (
          <Icon
            aria-hidden
            className={cn("size-3 shrink-0", outdoor && "text-amber-700 dark:text-amber-400")}
          />
        )}
        <span aria-hidden className="truncate">
          {text}
        </span>
        <span className="sr-only">
          {name} ({kind})
        </span>
      </div>
    </Tooltip>
  );
}

const TimeAxis = memo(function TimeAxis({
  geometry,
  height,
}: {
  geometry: GridGeometry;
  height: number;
}) {
  return (
    <div
      aria-hidden
      className="sticky left-0 z-[15] shrink-0 bg-background"
      style={{ width: AXIS_WIDTH, height }}
    >
      {gridLines(geometry)
        .filter((line) => !line.half)
        .map((line) => (
          <div
            key={line.minute}
            className="-translate-y-[7px] absolute right-1.5 text-[11px] text-muted-foreground"
            style={{ top: line.y }}
          >
            {Math.floor(line.minute / 60)}h
          </div>
        ))}
    </div>
  );
});

const GridLines = memo(function GridLines({ geometry }: { geometry: GridGeometry }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {gridColumns(geometry).map((column) => (
        <div
          key={column.index}
          className={cn(
            "absolute inset-y-0 border-l",
            column.firstOfDay && "border-foreground/25 border-l-2",
          )}
          style={{ left: column.index * geometry.columnWidth }}
        />
      ))}
      {gridLines(geometry).map((line) => (
        <div
          key={line.minute}
          className={cn("absolute inset-x-0 border-t", line.half && "border-dashed opacity-60")}
          style={{ top: line.y }}
        />
      ))}
    </div>
  );
});

/**
 * Ombrage des élèves (§4.4) : aplat ambré, sans motif, pour ne pas le
 * confondre avec les hachures du moniteur, dessinées par-dessus. Opacité par
 * palier (`shadeTier`) : plus foncé quand plus d'élèves sont indisponibles.
 */
const SHADE_OPACITY = { 1: 0.14, 2: 0.24, 3: 0.36, 4: 0.5 } as const;

/**
 * Bandes ombrées pendant le déplacement ou la création d'un cours d'un groupe.
 * Le groupe et la durée ne changent qu'au début et à la fin du geste : les
 * bandes sont calculées une fois par geste, pas à chaque mouvement du pointeur.
 */
function StudentShadeLayer({
  geometry,
  interaction,
  shadeBandsOf,
}: {
  geometry: GridGeometry;
  interaction: InteractionStore;
  shadeBandsOf: PlanningGridProps["shadeBandsOf"];
}) {
  const groupId = useInteraction(interaction, shadedGroupId);
  const durationMinutes = useInteraction(interaction, shadedDuration);
  const rects = useMemo(
    () => (groupId ? shadeRects(geometry, shadeBandsOf(groupId, durationMinutes)) : []),
    [geometry, groupId, durationMinutes, shadeBandsOf],
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[1]">
      {rects.map((rect) => {
        const tier = shadeTier(rect.band.count);
        return (
          <div
            key={rect.key}
            data-testid="student-shade"
            data-weekday={rect.band.weekday}
            data-start={rect.band.start}
            data-end={rect.band.end}
            data-count={rect.band.count}
            data-tier={tier}
            className="absolute bg-amber-500"
            style={{
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              opacity: SHADE_OPACITY[tier],
            }}
          />
        );
      })}
    </div>
  );
}

const HATCH =
  "repeating-linear-gradient(45deg, var(--muted-foreground) 0 1.5px, transparent 1.5px 9px)";

function HatchLayer({
  geometry,
  interaction,
  unavailableOn,
}: {
  geometry: GridGeometry;
  interaction: InteractionStore;
  unavailableOn: PlanningGridProps["unavailableOn"];
}) {
  const instructorId = useInteraction(interaction, hatchedInstructorId);
  const rects = useMemo(
    () =>
      instructorId ? hatchRects(geometry, (weekday) => unavailableOn(instructorId, weekday)) : [],
    [geometry, instructorId, unavailableOn],
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[1]">
      {rects.map((rect) => (
        <div
          key={rect.key}
          data-testid="hatch"
          className="absolute opacity-40"
          style={{
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            backgroundImage: HATCH,
          }}
        />
      ))}
    </div>
  );
}

const LessonsLayer = memo(function LessonsLayer({
  lessons,
  selectedId,
  interaction,
  onOpen,
  onHover,
  onCard,
}: {
  lessons: readonly LessonView[];
  selectedId: string | null;
  interaction: InteractionStore;
  onOpen: (id: string) => void;
  onHover: (instructorId: string | null) => void;
  onCard: (id: string | null, element?: HTMLElement) => void;
}) {
  return (
    <>
      {lessons.map(({ card: _card, ...lesson }) => (
        <LessonBlock
          key={lesson.id}
          {...lesson}
          selected={lesson.id === selectedId}
          interaction={interaction}
          onOpen={onOpen}
          onHover={onHover}
          onCard={onCard}
        />
      ))}
    </>
  );
});

/** Fantôme du glisser, cadre de sélection et brouillon du nouveau cours. */
function PreviewLayer({
  geometry,
  interaction,
  lookOf,
}: {
  geometry: GridGeometry;
  interaction: InteractionStore;
  lookOf: PlanningGridProps["lookOf"];
}) {
  const drag = useInteraction(interaction, (s) => s.drag);
  const draft = useInteraction(interaction, (s) => s.draft);
  const ghost =
    drag && (drag.kind === "move" || drag.kind === "resize") && drag.candidate ? drag : null;
  const selection = drag?.kind === "select" && drag.candidate ? drag.candidate : null;
  return (
    <>
      {draft && !selection && (
        <CandidateBlock
          geometry={geometry}
          candidate={draft}
          look={lookOf(draft)}
          warnings={[]}
          testId="lesson-draft"
          className="z-[8] opacity-85 outline-2 outline-foreground outline-dashed -outline-offset-2"
        />
      )}
      {ghost?.candidate && (
        <CandidateBlock
          geometry={geometry}
          candidate={ghost.candidate}
          look={lookOf(ghost.candidate)}
          warnings={ghost.warnings}
          testId="lesson-ghost"
          className="z-10 opacity-95 shadow-xl"
        />
      )}
      {selection && <SelectionBox geometry={geometry} candidate={selection} />}
    </>
  );
}

function CandidateBlock({
  geometry,
  candidate,
  look,
  warnings,
  testId,
  className,
}: {
  geometry: GridGeometry;
  candidate: CandidateLesson;
  look: CandidateLook;
  warnings: readonly Conflict[];
  testId: string;
  className?: string;
}) {
  const rect = candidatePosition(geometry, candidate);
  if (!rect) return null;
  const end = candidate.start + candidate.durationMinutes;
  return (
    <div
      data-testid={testId}
      data-warning={warnings.length > 0 || undefined}
      data-weekday={candidate.weekday}
      data-court-id={candidate.courtId ?? undefined}
      data-start={candidate.start}
      data-duration={candidate.durationMinutes}
      className={cn(
        "pointer-events-none absolute overflow-hidden rounded-[5px] px-1.5 py-0.5 text-[11px] text-white leading-tight",
        warnings.length > 0 && "ring-2 ring-destructive",
        className,
      )}
      style={{ ...rect, backgroundColor: look.color }}
    >
      <LessonContent
        groupName={look.groupName}
        timeLabel={`${clockLabel(candidate.start)}–${clockLabel(end)}`}
        detail={look.detail}
        warning={warnings.length > 0}
      />
    </div>
  );
}

function SelectionBox({
  geometry,
  candidate,
}: {
  geometry: GridGeometry;
  candidate: CandidateLesson;
}) {
  const rect = candidatePosition(geometry, candidate);
  if (!rect) return null;
  return (
    <div
      data-testid="selection-box"
      className="pointer-events-none absolute z-[8] rounded-[5px] border-2 border-sky-600 bg-sky-500/15 px-1 py-0.5 font-semibold text-[11px] text-sky-700 dark:text-sky-300"
      style={rect}
    >
      {clockLabel(candidate.start)}–{clockLabel(candidate.start + candidate.durationMinutes)}
    </div>
  );
}

function candidatePosition(geometry: GridGeometry, candidate: CandidateLesson): Rect | null {
  if (!candidate.courtId) return null;
  return slotRect(geometry, {
    weekday: candidate.weekday,
    courtId: candidate.courtId,
    start: candidate.start,
    end: candidate.start + candidate.durationMinutes,
  });
}
