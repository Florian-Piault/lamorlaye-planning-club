import { Minus, Plus, X } from "lucide-react";
import {
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import {
  AVAILABILITY_STEP,
  availabilityChange,
  cellStart,
  clickPrefill,
  draggedRange,
  type Interval,
  isAvailableAt,
  isDragGesture,
  isFullyAvailable,
  minuteAtOffset,
  overlapsAvailability,
  type SlotDraft,
  slotsOfDay,
  totalWeeklyMinutes,
  type WeeklySlot,
} from "@/domain/availability";
import {
  formatDuration,
  minutesToTime,
  timeToMinutes,
  WEEKDAYS,
  weekdayLabel,
} from "@/domain/time";
import { cn } from "@/lib/utils";

const STEP = AVAILABILITY_STEP;

interface AvailabilityEditorProps {
  slots: readonly WeeklySlot[];
  /** Jours affichés de la saison. */
  days: readonly number[];
  /** Amplitude horaire de la saison (`HH:MM`). */
  dayStart: string;
  dayEnd: string;
  color: string;
  /**
   * Nouvelles plages, avec le message qui annonce ce qui a réellement changé
   * (« Lundi 14:00–18:00 ajouté ») ; l'éditeur ne l'appelle pas quand un geste
   * ou un bouton ne change rien.
   */
  onChange: (slots: WeeklySlot[], message: string) => void;
  /** Consultation seule (saison archivée) : grille et liste non modifiables. */
  readOnly?: boolean;
}

/** Geste en cours dans la frise, depuis l'appui. */
interface Gesture {
  weekday: number;
  /** Rangée de la frise, pour convertir la position du pointeur en minutes. */
  left: number;
  width: number;
  originX: number;
  originY: number;
  /** Minute (non arrondie) sous le pointeur à l'appui. */
  anchor: number;
  /** Rendre disponible (vrai) ou indisponible (faux). */
  available: boolean;
  /** Seuil de glisser franchi : sinon, c'est un clic simple. */
  dragging: boolean;
  /** Pointeur du geste (capturé par la rangée) : les autres sont ignorés. */
  pointerId: number;
}

/** Aperçu du glisser en cours. */
interface Preview extends Interval {
  weekday: number;
  available: boolean;
}

/**
 * Éditeur visuel des plages hebdomadaires de disponibilité (§3.3) : une ligne
 * par jour, cliquer-glisser pour peindre une plage disponible, ou pour
 * l'effacer en partant d'une case déjà disponible. Un clic simple n'enregistre
 * rien : il pré-remplit le formulaire de saisie précise, sous la frise.
 */
export function AvailabilityEditor({
  slots,
  days,
  dayStart,
  dayEnd,
  color,
  onChange,
  readOnly = false,
}: AvailabilityEditorProps) {
  const start = timeToMinutes(dayStart);
  const end = timeToMinutes(dayEnd);
  const cells = useMemo(
    () => Array.from({ length: Math.max(0, (end - start) / STEP) }, (_, i) => start + i * STEP),
    [start, end],
  );
  const hours = cells.filter((m) => m % 60 === 0);
  const weekdays = WEEKDAYS.filter((d) => days.includes(d.value));
  const weekdayValues = weekdays.map((d) => d.value);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [draft, setDraft] = useState<SlotDraft>(() => ({
    weekday: weekdayValues[0] ?? 1,
    start,
    end,
  }));
  const fromRef = useRef<HTMLSelectElement>(null);
  const hintId = useId();
  // Geste courant, lu par les écouteurs de la fenêtre : l'état React peut ne
  // pas encore refléter le dernier déplacement au relâchement (WebKit).
  const gesture = useRef<Gesture | null>(null);
  const latest = useRef({ slots, onChange, start, end });
  latest.current = { slots, onChange, start, end };
  const [active, setActive] = useState(false);

  const change = (weekday: number, from: number, to: number, available: boolean) => {
    const { slots, onChange } = latest.current;
    const result = availabilityChange(slots, weekday, from, to, available);
    if (result) onChange(result.slots, result.message);
  };
  const changeRef = useRef(change);
  changeRef.current = change;

  useEffect(() => {
    if (!active) return;
    const rangeOf = (current: Gesture, clientX: number) => {
      const { start, end } = latest.current;
      return draggedRange(
        current.anchor,
        minuteAtOffset(clientX - current.left, current.width, start, end),
        start,
        end,
      );
    };
    const move = (event: PointerEvent) => {
      const current = gesture.current;
      if (!current || event.pointerId !== current.pointerId) return;
      if (
        !current.dragging &&
        !isDragGesture(event.clientX - current.originX, event.clientY - current.originY)
      ) {
        return;
      }
      current.dragging = true;
      setPreview({
        ...rangeOf(current, event.clientX),
        weekday: current.weekday,
        available: current.available,
      });
    };
    const finish = (event: PointerEvent) => {
      const current = gesture.current;
      if (!current || event.pointerId !== current.pointerId) return;
      gesture.current = null;
      setActive(false);
      setPreview(null);
      const dragging =
        current.dragging ||
        isDragGesture(event.clientX - current.originX, event.clientY - current.originY);
      if (dragging) {
        const range = rangeOf(current, event.clientX);
        changeRef.current(current.weekday, range.start, range.end, current.available);
        return;
      }
      // Clic simple : formulaire pré-rempli, rien n'est enregistré.
      const { slots, start, end } = latest.current;
      const prefill = clickPrefill(slots, current.weekday, current.anchor, start, end);
      setDraft({ weekday: prefill.weekday, start: prefill.start, end: prefill.end });
      fromRef.current?.focus();
    };
    const cancel = (event: PointerEvent) => {
      if (event.pointerId !== gesture.current?.pointerId) return;
      gesture.current = null;
      setActive(false);
      setPreview(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [active]);

  const startGesture = (weekday: number) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (readOnly || event.button !== 0 || gesture.current) return;
    event.preventDefault();
    // Capturé : le glisser continue hors de la rangée (et au doigt, sans défilement).
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const row = event.currentTarget.getBoundingClientRect();
    const anchor = minuteAtOffset(event.clientX - row.left, row.width, start, end);
    gesture.current = {
      weekday,
      left: row.left,
      width: row.width,
      originX: event.clientX,
      originY: event.clientY,
      anchor,
      available: !isAvailableAt(slots, weekday, cellStart(anchor, start, end)),
      dragging: false,
      pointerId: event.pointerId,
    };
    setActive(true);
  };

  const inPreview = (weekday: number, minute: number) =>
    preview !== null &&
    preview.weekday === weekday &&
    minute >= preview.start &&
    minute < preview.end;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        {readOnly
          ? ""
          : "Cliquez-glissez sur une ligne pour ajouter un horaire de disponibilité ; partez d'un horaire existant pour l'effacer. Un clic simple remplit le formulaire ci-dessous. "}
        Total : {formatDuration(totalWeeklyMinutes(slots))} par semaine.
      </p>
      {!readOnly && (
        <p id={hintId} className="sr-only">
          Frise à la souris ; au clavier, utilisez le formulaire « Saisir un horaire » sous la liste
          des horaires.
        </p>
      )}
      <div className="select-none overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="flex">
            <div className="w-24 shrink-0" />
            <div
              className="grid flex-1 text-[10px] text-muted-foreground"
              style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}
              aria-hidden
            >
              {hours.map((minute) => {
                const column = (minute - start) / STEP;
                const span = Math.min(60 / STEP, cells.length - column);
                return (
                  <div key={minute} style={{ gridColumn: `${column + 1} / span ${span}` }}>
                    {minutesToTime(minute).replace(":00", "h")}
                  </div>
                );
              })}
            </div>
          </div>
          {weekdays.map((day) => (
            <div key={day.value} className="flex items-center py-0.5">
              <div className="w-24 shrink-0 font-medium text-sm">{day.label}</div>
              {/* biome-ignore lint/a11y/useSemanticElements: rangée de grille, pas un groupe de champs. */}
              <div
                role="group"
                aria-label={`Disponibilités du ${day.label.toLowerCase()}`}
                aria-describedby={readOnly ? undefined : hintId}
                className={cn(
                  "grid h-8 flex-1 touch-none overflow-hidden rounded border",
                  !readOnly && "cursor-pointer",
                )}
                style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}
                onPointerDown={startGesture(day.value)}
              >
                {cells.map((minute) => {
                  const available = isAvailableAt(slots, day.value, minute);
                  const shownPreview = inPreview(day.value, minute)
                    ? preview?.available
                    : undefined;
                  const shown = shownPreview ?? available;
                  return (
                    <div
                      key={minute}
                      data-weekday={day.value}
                      data-time={minutesToTime(minute)}
                      data-available={available}
                      className={cn(
                        "h-full",
                        minute % 60 === 0 && "border-border border-l",
                        !shown && !readOnly && "hover:bg-accent",
                        shownPreview === false && "bg-destructive/20",
                      )}
                      style={
                        shown
                          ? { backgroundColor: color, opacity: shownPreview ? 0.7 : 1 }
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <SlotList
        slots={slots}
        weekdays={weekdayValues}
        onRemove={(weekday, from, to) => change(weekday, from, to, false)}
        readOnly={readOnly}
      />
      {!readOnly && (
        <SlotForm
          slots={slots}
          weekdays={weekdayValues}
          times={[...cells, end]}
          draft={draft}
          onDraftChange={setDraft}
          fromRef={fromRef}
          onApply={(available) => change(draft.weekday, draft.start, draft.end, available)}
        />
      )}
    </div>
  );
}

function SlotList({
  slots,
  weekdays,
  onRemove,
  readOnly,
}: {
  slots: readonly WeeklySlot[];
  weekdays: readonly number[];
  onRemove: (weekday: number, from: number, to: number) => void;
  readOnly: boolean;
}) {
  const otherDays = [...new Set(slots.map((s) => s.weekday))].filter((d) => !weekdays.includes(d));
  const days = [...weekdays, ...otherDays];
  return (
    <ul aria-label="Horaires de disponibilité" className="grid gap-1 text-sm sm:grid-cols-2">
      {days.map((weekday) => {
        const daySlots = slotsOfDay(slots, weekday);
        return (
          <li key={weekday} className="flex flex-wrap items-center gap-1.5">
            <span className="w-20 text-muted-foreground">{weekdayLabel(weekday)}</span>
            {daySlots.length === 0 && <span className="text-muted-foreground">—</span>}
            {daySlots.map((slot) => {
              const label = `${slot.startTime}–${slot.endTime}`;
              return (
                <span
                  key={slot.startTime}
                  className="inline-flex items-center gap-1 rounded-md border bg-card py-0.5 pr-0.5 pl-2"
                >
                  {label}
                  {!readOnly && (
                    <Tooltip content="Retirer cet horaire">
                      <button
                        type="button"
                        aria-label={`Retirer ${weekdayLabel(weekday).toLowerCase()} ${label}`}
                        className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                        onClick={() =>
                          onRemove(
                            weekday,
                            timeToMinutes(slot.startTime),
                            timeToMinutes(slot.endTime),
                          )
                        }
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    </Tooltip>
                  )}
                </span>
              );
            })}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Saisie précise d'une plage au clavier (« Jour / De / À ») : « Ajouter » rend
 * le moniteur disponible, « Retirer » l'en retire (tout ou partie d'une plage).
 * Un clic simple dans la frise la pré-remplit.
 */
function SlotForm({
  slots,
  weekdays,
  times,
  draft,
  onDraftChange,
  fromRef,
  onApply,
}: {
  slots: readonly WeeklySlot[];
  weekdays: readonly number[];
  times: readonly number[];
  draft: SlotDraft;
  onDraftChange: (draft: SlotDraft) => void;
  fromRef: RefObject<HTMLSelectElement | null>;
  onApply: (available: boolean) => void;
}) {
  const invalid = draft.end <= draft.start;
  // Chaque bouton est grisé, avec sa raison, quand il ne changerait rien.
  const covered = !invalid && isFullyAvailable(slots, draft.weekday, draft.start, draft.end);
  const removable = !invalid && overlapsAvailability(slots, draft.weekday, draft.start, draft.end);
  const set = (patch: Partial<SlotDraft>) => onDraftChange({ ...draft, ...patch });
  // Une plage pré-remplie peut déborder de l'amplitude affichée : ses bornes restent proposées.
  const withCurrent = (list: readonly number[], current: number) =>
    list.includes(current) ? list : [...list, current].sort((a, b) => a - b);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!invalid && !covered) onApply(true);
  };

  return (
    <form
      onSubmit={submit}
      aria-label="Saisir un horaire"
      className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed p-3"
    >
      <Label className="flex-col items-start gap-1.5">
        Jour
        <Select value={draft.weekday} onChange={(e) => set({ weekday: Number(e.target.value) })}>
          {withCurrent(weekdays, draft.weekday).map((d) => (
            <option key={d} value={d}>
              {weekdayLabel(d)}
            </option>
          ))}
        </Select>
      </Label>
      <Label className="flex-col items-start gap-1.5">
        De
        <Select
          ref={fromRef}
          value={draft.start}
          onChange={(e) => set({ start: Number(e.target.value) })}
        >
          {withCurrent(times.slice(0, -1), draft.start).map((m) => (
            <option key={m} value={m}>
              {minutesToTime(m)}
            </option>
          ))}
        </Select>
      </Label>
      <Label className="flex-col items-start gap-1.5">
        À
        <Select value={draft.end} onChange={(e) => set({ end: Number(e.target.value) })}>
          {withCurrent(times.slice(1), draft.end).map((m) => (
            <option key={m} value={m}>
              {minutesToTime(m)}
            </option>
          ))}
        </Select>
      </Label>
      <Button
        type="submit"
        variant="outline"
        disabled={invalid || covered}
        disabledReason={
          invalid
            ? "L'heure de fin doit suivre l'heure de début"
            : "Déjà disponible sur tout cet horaire"
        }
      >
        <Plus aria-hidden />
        Ajouter un horaire
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={!removable}
        reasonSide="none"
        disabledReason={
          invalid
            ? "Choisissez une heure de fin après l'heure de début"
            : "Aucune disponibilité sur cet horaire"
        }
        onClick={() => onApply(false)}
      >
        <Minus aria-hidden />
        Retirer l'horaire
      </Button>
    </form>
  );
}
