import { weekdayLabel } from "@/domain/time";
import { clockLabel, hoursLabel } from "../grid/geometry";
import { warningMessages } from "../grid/view";
import { type InteractionStore, useInteraction } from "../interaction";

interface DragFeedbackProps {
  interaction: InteractionStore;
  courtName: (courtId: string | null) => string;
  instructor: (id: string) => { name: string; color: string } | null;
  groupName: (groupId: string | null) => string;
}

/**
 * Retour visuel près du pointeur pendant un glisser (§5.2) : nature du geste,
 * créneau visé et avertissements en temps réel ; pastille du moniteur glissée.
 */
export function DragFeedback({ interaction, courtName, instructor, groupName }: DragFeedbackProps) {
  const drag = useInteraction(interaction, (s) => s.drag);
  const pointer = useInteraction(interaction, (s) => s.pointer);
  if (!drag || !pointer) return null;

  const chip = drag.kind === "instructor" ? instructor(drag.instructorId) : null;
  const candidate = drag.candidate;
  let heading: string;
  switch (drag.kind) {
    case "move":
      heading = drag.duplicate ? "Duplication (Alt)" : "Déplacement";
      break;
    case "resize":
      heading = `Durée : ${hoursLabel(candidate?.durationMinutes ?? 0)}`;
      break;
    case "select":
      heading = "Nouveau cours";
      break;
    case "instructor":
      heading = candidate
        ? `Confier « ${groupName(candidate.groupId)} » à ${chip?.name ?? "ce moniteur"}`
        : "Déposer sur un cours";
      break;
  }
  const left = Math.min(pointer.clientX + 16, window.innerWidth - 310);
  const top = pointer.clientY + (drag.kind === "instructor" ? 40 : 16);

  return (
    <>
      {chip && (
        <div
          data-testid="drag-chip"
          className="pointer-events-none fixed z-[100] flex items-center gap-1.5 rounded-full py-1 pr-2.5 pl-1.5 font-semibold text-white text-xs shadow-lg"
          style={{
            left: pointer.clientX + 10,
            top: pointer.clientY + 10,
            backgroundColor: chip.color,
          }}
        >
          <span className="size-3 rounded-full bg-white/80" />
          {chip.name}
        </div>
      )}
      <div
        role="status"
        data-testid="drag-tooltip"
        className="pointer-events-none fixed z-[100] max-w-[300px] rounded-md bg-foreground px-2.5 py-1.5 text-background text-xs shadow-lg"
        style={{ left, top }}
      >
        <div className="font-semibold">{heading}</div>
        {candidate && (
          <div>
            {weekdayLabel(candidate.weekday)} · {courtName(candidate.courtId)} ·{" "}
            {clockLabel(candidate.start)}–{clockLabel(candidate.start + candidate.durationMinutes)}
          </div>
        )}
        {warningMessages(drag.warnings).map((message) => (
          <div key={message} className="text-red-300 dark:text-red-700">
            ⚠ {message}
          </div>
        ))}
      </div>
    </>
  );
}
