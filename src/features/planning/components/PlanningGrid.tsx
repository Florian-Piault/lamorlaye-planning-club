import { memo, type PointerEvent, type RefObject, useMemo } from "react";
import type { Court } from "@/db/schema";
import type { Conflict } from "@/domain/conflicts";
import { weekdayLabel } from "@/domain/time";
import { cn } from "@/lib/utils";
import {
  AXIS_WIDTH,
  boardSize,
  clockLabel,
  type GridGeometry,
  gridColumns,
  gridLines,
  hatchRects,
  type Rect,
  slotRect,
} from "../grid/geometry";
import type { CandidateLesson } from "../grid/view";
import { hatchedInstructorId, type InteractionStore, useInteraction } from "../interaction";
import { LessonBlock, LessonContent } from "./LessonBlock";

export interface LessonView extends Rect {
  id: string;
  instructorId: string;
  color: string;
  groupName: string;
  timeLabel: string;
  detail: string;
  title: string;
  ariaLabel: string;
  warning: boolean;
  dimmed: boolean;
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
  lookOf: (candidate: CandidateLesson) => CandidateLook;
  onOpenLesson: (id: string) => void;
  onBoardPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
}

/**
 * Grille de la semaine (§4.1, variante A) : jours en colonnes subdivisées par
 * court, heures en lignes ; en-têtes et axe horaire restent visibles pendant
 * le défilement.
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
  lookOf,
  onOpenLesson,
  onBoardPointerDown,
}: PlanningGridProps) {
  const size = boardSize(geometry);
  const onHover = useMemo(
    () => (instructorId: string | null) => interaction.update({ hoverInstructorId: instructorId }),
    [interaction],
  );
  return (
    <div
      ref={scrollerRef}
      data-testid="planning-scroller"
      className="relative min-w-0 flex-1 overflow-auto bg-background"
    >
      <div style={{ width: AXIS_WIDTH + size.width }}>
        <GridHeader geometry={geometry} courts={courts} />
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
            />
            <PreviewLayer geometry={geometry} interaction={interaction} lookOf={lookOf} />
          </div>
        </div>
      </div>
    </div>
  );
}

const GridHeader = memo(function GridHeader({
  geometry,
  courts,
}: {
  geometry: GridGeometry;
  courts: readonly Court[];
}) {
  const byId = new Map(courts.map((c) => [c.id, c]));
  return (
    <div className="sticky top-0 z-20 flex border-b bg-card">
      <div className="sticky left-0 z-[21] shrink-0 bg-card" style={{ width: AXIS_WIDTH }} />
      {geometry.weekdays.map((weekday) => (
        <div
          key={weekday}
          data-testid="day-header"
          className="shrink-0 border-l-2"
          style={{ width: geometry.courtIds.length * geometry.columnWidth }}
        >
          <div className="truncate pt-1.5 pb-0.5 text-center font-semibold text-sm">
            {weekdayLabel(weekday)}
          </div>
          <div className="flex">
            {geometry.courtIds.map((courtId, i) => {
              const court = byId.get(courtId);
              const kind = court?.kind === "indoor" ? "couvert" : "extérieur";
              return (
                <div
                  key={courtId}
                  title={`${court?.name ?? "Court"} (${kind})`}
                  className="truncate pb-1 text-center text-[11px] text-muted-foreground"
                  style={{ width: geometry.columnWidth }}
                >
                  C{i + 1}
                  {court?.kind === "outdoor" && " ☀"}
                  <span className="sr-only">
                    {" "}
                    {court?.name} ({kind})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
});

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
}: {
  lessons: readonly LessonView[];
  selectedId: string | null;
  interaction: InteractionStore;
  onOpen: (id: string) => void;
  onHover: (instructorId: string | null) => void;
}) {
  return (
    <>
      {lessons.map((lesson) => (
        <LessonBlock
          key={lesson.id}
          {...lesson}
          selected={lesson.id === selectedId}
          interaction={interaction}
          onOpen={onOpen}
          onHover={onHover}
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
