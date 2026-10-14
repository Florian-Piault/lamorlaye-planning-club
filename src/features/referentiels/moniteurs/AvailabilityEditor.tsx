import { Plus, X } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import {
  isAvailableAt,
  setAvailability,
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

/** Pas de la grille : celui des cours (§3.6). */
const STEP = 15;

interface AvailabilityEditorProps {
  slots: readonly WeeklySlot[];
  /** Jours affichés de la saison. */
  days: readonly number[];
  /** Amplitude horaire de la saison (`HH:MM`). */
  dayStart: string;
  dayEnd: string;
  color: string;
  onChange: (slots: WeeklySlot[]) => void;
}

interface Drag {
  weekday: number;
  anchor: number;
  current: number;
  /** Rendre disponible (vrai) ou indisponible (faux). */
  available: boolean;
}

/**
 * Éditeur visuel des plages hebdomadaires de disponibilité (§3.3) : une ligne
 * par jour, cliquer-glisser pour peindre une plage disponible, ou pour
 * l'effacer en partant d'une case déjà disponible. Un formulaire permet aussi
 * une saisie précise au clavier.
 */
export function AvailabilityEditor({
  slots,
  days,
  dayStart,
  dayEnd,
  color,
  onChange,
}: AvailabilityEditorProps) {
  const start = timeToMinutes(dayStart);
  const end = timeToMinutes(dayEnd);
  const cells = useMemo(
    () => Array.from({ length: Math.max(0, (end - start) / STEP) }, (_, i) => start + i * STEP),
    [start, end],
  );
  const hours = cells.filter((m) => m % 60 === 0);
  const [drag, setDrag] = useState<Drag | null>(null);

  useEffect(() => {
    if (!drag) return;
    const finish = () => {
      const from = Math.min(drag.anchor, drag.current);
      const to = Math.max(drag.anchor, drag.current) + STEP;
      setDrag(null);
      onChange(setAvailability(slots, drag.weekday, from, to, drag.available));
    };
    window.addEventListener("pointerup", finish);
    return () => window.removeEventListener("pointerup", finish);
  }, [drag, slots, onChange]);

  const inDrag = (weekday: number, minute: number) =>
    drag !== null &&
    drag.weekday === weekday &&
    minute >= Math.min(drag.anchor, drag.current) &&
    minute <= Math.max(drag.anchor, drag.current);

  const weekdays = WEEKDAYS.filter((d) => days.includes(d.value));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Cliquez-glissez sur une ligne pour ajouter une plage de disponibilité ; partez d'une plage
        existante pour l'effacer. Total : {formatDuration(totalWeeklyMinutes(slots))} par semaine.
      </p>
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
                className="grid h-8 flex-1 overflow-hidden rounded border"
                style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}
              >
                {cells.map((minute) => {
                  const available = isAvailableAt(slots, day.value, minute);
                  const preview = inDrag(day.value, minute) ? drag?.available : undefined;
                  const shown = preview ?? available;
                  return (
                    <div
                      key={minute}
                      data-weekday={day.value}
                      data-time={minutesToTime(minute)}
                      data-available={available}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        setDrag({
                          weekday: day.value,
                          anchor: minute,
                          current: minute,
                          available: !available,
                        });
                      }}
                      onPointerEnter={() =>
                        setDrag((d) =>
                          d && d.weekday === day.value ? { ...d, current: minute } : d,
                        )
                      }
                      className={cn(
                        "h-full cursor-pointer",
                        minute % 60 === 0 && "border-border border-l",
                        !shown && "hover:bg-accent",
                        preview === false && "bg-destructive/20",
                      )}
                      style={
                        shown ? { backgroundColor: color, opacity: preview ? 0.7 : 1 } : undefined
                      }
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <SlotList slots={slots} weekdays={weekdays.map((d) => d.value)} onChange={onChange} />
      <AddSlotForm
        weekdays={weekdays.map((d) => d.value)}
        times={[...cells, end]}
        onAdd={(weekday, from, to) => onChange(setAvailability(slots, weekday, from, to, true))}
      />
    </div>
  );
}

function SlotList({
  slots,
  weekdays,
  onChange,
}: {
  slots: readonly WeeklySlot[];
  weekdays: readonly number[];
  onChange: (slots: WeeklySlot[]) => void;
}) {
  const otherDays = [...new Set(slots.map((s) => s.weekday))].filter((d) => !weekdays.includes(d));
  const days = [...weekdays, ...otherDays];
  return (
    <ul aria-label="Plages de disponibilité" className="grid gap-1 text-sm sm:grid-cols-2">
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
                  <button
                    type="button"
                    aria-label={`Retirer ${weekdayLabel(weekday).toLowerCase()} ${label}`}
                    className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    onClick={() =>
                      onChange(
                        setAvailability(
                          slots,
                          weekday,
                          timeToMinutes(slot.startTime),
                          timeToMinutes(slot.endTime),
                          false,
                        ),
                      )
                    }
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </span>
              );
            })}
          </li>
        );
      })}
    </ul>
  );
}

function AddSlotForm({
  weekdays,
  times,
  onAdd,
}: {
  weekdays: readonly number[];
  times: readonly number[];
  onAdd: (weekday: number, from: number, to: number) => void;
}) {
  const [weekday, setWeekday] = useState(weekdays[0] ?? 1);
  const [from, setFrom] = useState(times[0] ?? 0);
  const [to, setTo] = useState(times.at(-1) ?? 0);
  const invalid = to <= from;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!invalid) onAdd(weekday, from, to);
  };

  return (
    <form
      onSubmit={submit}
      aria-label="Ajouter une plage"
      className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed p-3"
    >
      <Label className="flex-col items-start gap-1.5">
        Jour
        <Select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
          {weekdays.map((d) => (
            <option key={d} value={d}>
              {weekdayLabel(d)}
            </option>
          ))}
        </Select>
      </Label>
      <Label className="flex-col items-start gap-1.5">
        De
        <Select value={from} onChange={(e) => setFrom(Number(e.target.value))}>
          {times.slice(0, -1).map((m) => (
            <option key={m} value={m}>
              {minutesToTime(m)}
            </option>
          ))}
        </Select>
      </Label>
      <Label className="flex-col items-start gap-1.5">
        À
        <Select value={to} onChange={(e) => setTo(Number(e.target.value))}>
          {times.slice(1).map((m) => (
            <option key={m} value={m}>
              {minutesToTime(m)}
            </option>
          ))}
        </Select>
      </Label>
      <Button type="submit" variant="outline" disabled={invalid}>
        <Plus aria-hidden />
        Ajouter la plage
      </Button>
    </form>
  );
}
