import { CircleX, CopyPlus, RotateCcw, UserRoundCog } from "lucide-react";
import { type FormEvent, useId, useMemo, useState } from "react";
import { ErrorAlert } from "@/components/form/Field";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import type { CancellationReason } from "@/db/schema";
import type { CancellationInput } from "@/domain/commands";
import { CANCELLATION_REASONS, cancellationLabel } from "../grid/actions";
import type { GridItem } from "../grid/items";
import { instructorChoices } from "../grid/view";
import type { PlanningInstructor } from "../references";

interface OccurrenceActionsProps {
  item: GridItem;
  instructors: readonly PlanningInstructor[];
  onCancel: (input: CancellationInput) => boolean;
  onReplace: (instructorId: string) => boolean;
  onRestore: () => void;
  onDuplicate: (count: number) => boolean;
}

/**
 * Actions sur une séance d'une semaine précise (semaine datée, §5.5) : annuler
 * avec motif, désigner un remplaçant, « Revenir au cours habituel » (supprime
 * les exceptions de l'occurrence) ; pour un cours ponctuel, « Dupliquer sur
 * les jours suivants » (stage).
 */
export function OccurrenceActions(props: OccurrenceActionsProps) {
  const { item } = props;
  return (
    <section aria-label="Actions sur la séance" className="mt-5 flex flex-col gap-4 border-t pt-4">
      {item.kind === "one_off" ? (
        <DuplicateForm onDuplicate={props.onDuplicate} />
      ) : (
        <RegularActions {...props} />
      )}
    </section>
  );
}

function RegularActions({
  item,
  instructors,
  onCancel,
  onReplace,
  onRestore,
}: OccurrenceActionsProps) {
  const occurrence = item.occurrence;
  const byId = new Map(instructors.map((i) => [i.id, i]));
  const name = (id: string | null) => {
    const instructor = id ? byId.get(id) : undefined;
    return instructor ? `${instructor.firstName} ${instructor.lastName}` : "moniteur inconnu";
  };
  return (
    <>
      {occurrence && (occurrence.cancellation || occurrence.replaced || occurrence.modified) && (
        <ul aria-label="État de la séance" className="flex flex-col gap-1 text-xs">
          {occurrence.cancellation && (
            <li className="rounded-md bg-muted px-2 py-1">
              Annulé cette semaine :{" "}
              {cancellationLabel(occurrence.cancellation.reason, occurrence.cancellation.note)}
            </li>
          )}
          {occurrence.replaced && (
            <li className="rounded-md bg-muted px-2 py-1">
              ⇄ Remplacement : {name(occurrence.instructorId)} au lieu de{" "}
              {name(occurrence.originalInstructorId)}
            </li>
          )}
          {occurrence.modified && (
            <li className="rounded-md bg-muted px-2 py-1">✎ Modifié cette semaine</li>
          )}
        </ul>
      )}
      {!item.cancelled && <CancelForm onCancel={onCancel} />}
      {!item.cancelled && (
        <ReplaceForm item={item} instructors={instructors} onReplace={onReplace} />
      )}
      {occurrence && occurrence.exceptionIds.length > 0 && (
        <div>
          <Button type="button" variant="outline" onClick={onRestore}>
            <RotateCcw aria-hidden />
            Revenir au cours habituel
          </Button>
        </div>
      )}
    </>
  );
}

function CancelForm({ onCancel }: { onCancel: OccurrenceActionsProps["onCancel"] }) {
  const id = useId();
  const [reason, setReason] = useState<CancellationReason>("rain");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (reason === "other" && note.trim() === "") {
      setError("Précisez le motif de l'annulation.");
      return;
    }
    setError(null);
    onCancel({ reason, note: note.trim() || null });
  };
  return (
    <form onSubmit={submit} aria-label="Annuler cette séance" noValidate className="grid gap-2">
      <h3 className="font-semibold text-sm">Annuler cette séance</h3>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-reason`}>Motif</Label>
          <Select
            id={`${id}-reason`}
            value={reason}
            onChange={(e) => setReason(e.target.value as CancellationReason)}
          >
            {CANCELLATION_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-note`}>Précision</Label>
          <Input
            id={`${id}-note`}
            value={note}
            placeholder={reason === "other" ? "Obligatoire" : "Facultatif"}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
      <ErrorAlert>{error}</ErrorAlert>
      <div>
        <Button type="submit" variant="outline" className="text-destructive">
          <CircleX aria-hidden />
          Annuler la séance
        </Button>
      </div>
    </form>
  );
}

function ReplaceForm({
  item,
  instructors,
  onReplace,
}: Pick<OccurrenceActionsProps, "item" | "instructors" | "onReplace">) {
  const id = useId();
  const planned = item.occurrence?.originalInstructorId ?? item.instructorId;
  const [value, setValue] = useState(item.occurrence?.replaced ? (item.instructorId ?? "") : "");
  const choices = useMemo(
    () =>
      instructorChoices(
        instructors.filter((i) => i.id !== planned && (i.active || i.id === value)),
        {
          date: item.date,
          weekday: item.weekday,
          start: item.start,
          end: item.start + item.durationMinutes,
        },
      ),
    [instructors, planned, value, item.date, item.weekday, item.start, item.durationMinutes],
  );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onReplace(value || (planned ?? ""));
  };
  return (
    <form onSubmit={submit} aria-label="Désigner un remplaçant" noValidate className="grid gap-2">
      <h3 className="font-semibold text-sm">Désigner un remplaçant</h3>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-substitute`}>Remplaçant</Label>
        <Select id={`${id}-substitute`} value={value} onChange={(e) => setValue(e.target.value)}>
          <option value="">— aucun (moniteur prévu) —</option>
          {choices.map(({ instructor, note }) => (
            <option key={instructor.id} value={instructor.id}>
              {note ? "○" : "●"} {instructor.firstName} {instructor.lastName}
              {note ? ` (${note})` : ""}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Button type="submit" variant="outline">
          <UserRoundCog aria-hidden />
          Désigner le remplaçant
        </Button>
      </div>
    </form>
  );
}

function DuplicateForm({ onDuplicate }: { onDuplicate: OccurrenceActionsProps["onDuplicate"] }) {
  const id = useId();
  const [count, setCount] = useState("4");
  const [error, setError] = useState<string | null>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = Number(count);
    if (!Number.isInteger(value) || value < 1 || value > 31) {
      setError("Indiquez un nombre de jours entre 1 et 31.");
      return;
    }
    setError(null);
    onDuplicate(value);
  };
  return (
    <form
      onSubmit={submit}
      aria-label="Dupliquer sur les jours suivants"
      noValidate
      className="grid gap-2"
    >
      <h3 className="font-semibold text-sm">Dupliquer sur les jours suivants</h3>
      <p className="text-muted-foreground text-xs">
        Copie le cours aux mêmes heure, court et moniteur (stage), en sautant les jours non
        affichés.
      </p>
      <div className="flex items-end gap-2">
        <div className="flex w-28 flex-col gap-1.5">
          <Label htmlFor={`${id}-count`}>Nombre de jours</Label>
          <Input
            id={`${id}-count`}
            type="number"
            min={1}
            max={31}
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline">
          <CopyPlus aria-hidden />
          Dupliquer
        </Button>
      </div>
      <ErrorAlert>{error}</ErrorAlert>
    </form>
  );
}
