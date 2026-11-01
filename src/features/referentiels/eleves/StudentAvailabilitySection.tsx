import { Eraser, Redo2, Undo2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useViewedSeason } from "@/app/season";
import { Button } from "@/components/ui/button";
import type { WeeklySlot } from "@/domain/availability";
import { AvailabilityEditor } from "../components/AvailabilityEditor";

/** Changement des plages, avec les plages d'avant pour l'annuler. */
interface Step {
  slots: WeeklySlot[];
  message: string;
}

interface StudentAvailabilitySectionProps {
  /** Plages affichées (non encore enregistrées : elles le sont avec la fiche). */
  slots: readonly WeeklySlot[];
  onChange: (slots: WeeklySlot[]) => void;
  /** Consultation seule (saison terminée) : plages visibles, non modifiables. */
  readOnly?: boolean;
}

/**
 * Section « Disponible chaque semaine » de la fiche élève (§3.5, §8) : la frise
 * commune aux moniteurs, un texte d'état quand l'élève n'a aucune plage
 * (il est alors disponible partout, contrairement à un moniteur), « Effacer
 * tous les horaires », et l'historique défaire / refaire des modifications
 * faites depuis l'ouverture de la fiche. Rien n'est écrit en base ici : les
 * plages s'enregistrent avec la fiche.
 */
export function StudentAvailabilitySection({
  slots,
  onChange,
  readOnly = false,
}: StudentAvailabilitySectionProps) {
  const season = useViewedSeason();
  const titleId = useId();
  const [past, setPast] = useState<Step[]>([]);
  const [future, setFuture] = useState<Step[]>([]);
  // Annonce du dernier changement (lecteur d'écran) : la frise le montre déjà à l'œil.
  const [announce, setAnnounce] = useState("");
  // Plages au moment du clic, même si plusieurs changements se suivent avant le rendu.
  const current = useRef(slots);
  current.current = slots;

  const change = (next: WeeklySlot[], message: string) => {
    setPast((p) => [...p, { slots: [...current.current], message }]);
    setFuture([]);
    current.current = next;
    onChange(next);
    setAnnounce(message);
  };
  const undo = () => {
    const step = past.at(-1);
    if (!step) return;
    setPast(past.slice(0, -1));
    setFuture([...future, { slots: [...current.current], message: step.message }]);
    onChange(step.slots);
    setAnnounce(`Défait : ${step.message}`);
  };
  const redo = () => {
    const step = future.at(-1);
    if (!step) return;
    setFuture(future.slice(0, -1));
    setPast([...past, { slots: [...current.current], message: step.message }]);
    onChange(step.slots);
    setAnnounce(`Refait : ${step.message}`);
  };

  const lastDone = past.at(-1);
  const lastUndone = future.at(-1);

  return (
    <section aria-labelledby={titleId} className="grid gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={titleId} className="font-medium text-sm">
          Disponible chaque semaine
        </h3>
        {!readOnly && (
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-8"
              aria-label="Défaire la modification"
              tooltip={lastDone ? `Défaire : ${lastDone.message}` : undefined}
              disabled={!lastDone}
              reasonSide="none"
              disabledReason="Rien à défaire"
              onClick={undo}
            >
              <Undo2 aria-hidden />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-8"
              aria-label="Refaire la modification"
              tooltip={lastUndone ? `Refaire : ${lastUndone.message}` : undefined}
              disabled={!lastUndone}
              reasonSide="none"
              disabledReason="Rien à refaire"
              onClick={redo}
            >
              <Redo2 aria-hidden />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={slots.length === 0}
              reasonSide="none"
              disabledReason="Aucun horaire à effacer"
              onClick={() => change([], "Tous les horaires effacés")}
            >
              <Eraser aria-hidden />
              Effacer tous les horaires
            </Button>
          </div>
        )}
      </div>
      <p className="text-muted-foreground text-sm" data-testid="student-availability-state">
        {slots.length === 0
          ? "Aucun horaire : considéré disponible partout."
          : "Hors de ces horaires, l'élève est signalé « hors disponibilités » sur le planning."}
      </p>
      <p role="status" className="sr-only">
        {announce}
      </p>
      <AvailabilityEditor
        slots={slots}
        days={season.displayedDays}
        dayStart={season.displayStartTime}
        dayEnd={season.displayEndTime}
        color="var(--primary)"
        onChange={change}
        readOnly={readOnly}
      />
    </section>
  );
}
