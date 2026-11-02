import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { MessageZone } from "@/components/feedback/MessageZone";
import { errorMessages } from "@/components/feedback/messages";
import { useToast } from "@/components/feedback/Toast";
import { sameValues } from "@/components/form/formState";
import { Button } from "@/components/ui/button";
import { Dialog, useDirtyGuard, useGuardedCancel } from "@/components/ui/dialog";
import { useDatabase } from "@/db/DatabaseProvider";
import { replaceStudentAvailabilities, type StudentListItem } from "@/db/repositories/students";
import type { WeeklySlot } from "@/domain/availability";
import { errorMessage } from "@/hooks/useLoader";
import { ariaShortcut, detectPlatform, shortcutLabel } from "@/lib/keys";
import { StudentAvailabilitySection } from "./StudentAvailabilitySection";
import { slotKeys } from "./StudentForm";
import {
  advanceSeries,
  currentItem,
  isFinished,
  progressLabel,
  type Series,
  seriesSummary,
} from "./series";

/** Saisie en série en cours : les élèves figés au lancement et leurs plages à ce moment. */
export interface AvailabilitySeries {
  series: Series<StudentListItem>;
  slots: ReadonlyMap<string, readonly WeeklySlot[]>;
}

/** Raccourci de « Enregistrer et suivant ». */
const SAVE_AND_NEXT = "mod+enter";

/** Raison des boutons grisés pendant l'écriture (focalisables : le focus reste dans la fenêtre). */
const SAVING = "Enregistrement en cours";

const NO_SLOTS: readonly WeeklySlot[] = [];

interface AvailabilitySeriesDialogProps {
  run: AvailabilitySeries | null;
  onRunChange: (run: AvailabilitySeries | null) => void;
  /** Après chaque enregistrement : relecture de la liste des élèves. */
  onSaved: () => Promise<void>;
}

/**
 * Saisie des disponibilités en série (§8) : un élève à la fois, dans l'ordre
 * de la liste filtrée au lancement, avec la section de la fiche élève.
 * « Enregistrer et suivant » écrit aussitôt les plages de l'élève (rien si
 * elles n'ont pas changé : l'élève compte alors comme passé) ; « Passer »
 * n'écrit rien ; « Terminer » (ou Échap) arrête la série en gardant ce qui
 * est déjà enregistré. Un toast dresse le bilan. Pendant une écriture, la
 * fenêtre ne se ferme pas : le bilan compterait mal l'élève en cours.
 */
export function AvailabilitySeriesDialog({
  run,
  onRunChange,
  onSaved,
}: AvailabilitySeriesDialogProps) {
  const { db } = useDatabase();
  const toast = useToast();
  // Série à jour au retour d'une écriture (la fenêtre a pu changer entre-temps).
  const current = useRef(run);
  current.current = run;
  const saving = useRef(false);
  const student = run ? currentItem(run.series) : undefined;
  const name = student ? `${student.lastName} ${student.firstName}` : "";
  const announcement = run && student ? `${name}, élève ${progressLabel(run.series)}` : "";
  // Région montée vide, puis remplie : le premier élève est annoncé comme les suivants.
  const [announced, setAnnounced] = useState("");
  useEffect(() => setAnnounced(announcement), [announcement]);

  const finish = () => {
    const series = current.current?.series;
    if (!series || saving.current) return;
    onRunChange(null);
    const summary = seriesSummary(series);
    if (summary) toast.success(summary);
  };
  const advance = (outcome: "saved" | "skipped") => {
    const latest = current.current;
    if (!latest) return;
    const next = advanceSeries(latest.series, outcome);
    if (isFinished(next)) {
      current.current = { ...latest, series: next };
      finish();
    } else onRunChange({ ...latest, series: next });
  };

  return (
    <Dialog
      open={run !== null}
      onOpenChange={(open) => !open && finish()}
      title="Saisie des disponibilités en série"
      className="max-w-5xl"
    >
      <p role="status" className="sr-only">
        {announced}
      </p>
      {run && student && (
        <SeriesStep
          // Saisie et historique défaire / refaire propres à chaque élève.
          key={student.id}
          name={name}
          groups={student.groups.map((g) => g.name)}
          progress={progressLabel(run.series)}
          initialSlots={run.slots.get(student.id) ?? NO_SLOTS}
          onSave={async (slots) => {
            saving.current = true;
            try {
              await replaceStudentAvailabilities(db, student.id, slots);
            } finally {
              saving.current = false;
            }
            advance("saved");
            await onSaved();
          }}
          onSkip={() => advance("skipped")}
          onFinish={finish}
        />
      )}
    </Dialog>
  );
}

interface SeriesStepProps {
  name: string;
  groups: readonly string[];
  progress: string;
  initialSlots: readonly WeeklySlot[];
  onSave: (slots: WeeklySlot[]) => Promise<void>;
  onSkip: () => void;
  onFinish: () => void;
}

/** Un élève de la série : son nom, ses groupes, la progression, sa frise et les trois actions. */
function SeriesStep({
  name,
  groups,
  progress,
  initialSlots,
  onSave,
  onSkip,
  onFinish,
}: SeriesStepProps) {
  const [slots, setSlots] = useState<WeeklySlot[]>(() =>
    initialSlots.map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = !sameValues(slotKeys(slots), slotKeys(initialSlots));
  // « Passer » et « Terminer » abandonnent la saisie de cet élève : confirmation si elle a
  // changé. Pendant l'écriture, rien n'est perdu : pas de confirmation (la fermeture est refusée).
  useDirtyGuard(changed && !busy);
  const skip = useGuardedCancel(onSkip);
  const finish = useGuardedCancel(onFinish);

  const save = async () => {
    if (busy) return;
    // Plages inchangées : rien à écrire, l'élève compte comme passé.
    if (!changed) return onSkip();
    setBusy(true);
    setError(null);
    try {
      await onSave(slots);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const mod = detectPlatform() === "mac" ? event.metaKey : event.ctrlKey;
    if (event.key !== "Enter" || !mod || event.defaultPrevented) return;
    event.preventDefault();
    void save();
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: raccourci de la fenêtre (⌘ ↩), relayé depuis ses champs.
    <div className="grid gap-4" onKeyDown={onKeyDown}>
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <p className="font-medium" data-testid="series-student">
            {name}
          </p>
          <p className="text-muted-foreground text-sm" data-testid="series-groups">
            {groups.length > 0 ? groups.join(", ") : "Aucun groupe"}
          </p>
        </div>
        <p className="whitespace-nowrap text-sm tabular-nums" data-testid="series-progress">
          Élève {progress}
        </p>
      </div>
      <StudentAvailabilitySection slots={slots} onChange={setSlots} />
      <MessageZone label="Messages" messages={errorMessages(error)} />
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          disabledReason={SAVING}
          reasonSide="none"
          onClick={finish}
        >
          Terminer
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          disabledReason={SAVING}
          reasonSide="none"
          onClick={skip}
        >
          Passer
        </Button>
        <Button
          type="button"
          disabled={busy}
          disabledReason={SAVING}
          reasonSide="none"
          tooltip={`Enregistrer et suivant (${shortcutLabel(SAVE_AND_NEXT)})`}
          aria-keyshortcuts={ariaShortcut(SAVE_AND_NEXT)}
          onClick={() => void save()}
        >
          Enregistrer et suivant
        </Button>
      </div>
    </div>
  );
}
