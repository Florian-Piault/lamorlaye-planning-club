import { CalendarPlus, Pencil, Plus, WandSparkles } from "lucide-react";
import { type FormEvent, useCallback, useMemo, useState } from "react";
import { useReadOnly, useViewedSeason } from "@/app/season";
import { MessageZone } from "@/components/feedback/MessageZone";
import { errorMessages } from "@/components/feedback/messages";
import { Field } from "@/components/form/Field";
import { sameValues } from "@/components/form/formState";
import { useFormErrors } from "@/components/form/useFormErrors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, useDirtyGuard, useGuardedCancel } from "@/components/ui/dialog";
import { Checkbox, Input } from "@/components/ui/input";
import { useDatabase } from "@/db/DatabaseProvider";
import { loadPlanningState, persistCommand } from "@/db/repositories/planning";
import type { Closure } from "@/db/schema";
import {
  type ClosureInput,
  type Command,
  createClosure,
  createClosures,
  deleteClosure,
  type PlanningState,
  updateClosure,
} from "@/domain/commands";
import { daysBetween } from "@/domain/dates";
import {
  closureProposals,
  followSelection,
  type ProposalRow,
  proposalClosureLabel,
  SCHOOL_CALENDAR,
} from "@/domain/schoolCalendar";
import { formatDate } from "@/domain/time";
import { errorMessage, useLoader } from "@/hooks/useLoader";
import { DeleteAction } from "../components/DeleteAction";

/** « du 17/10/2026 au 01/11/2026 » ou « le 11/11/2026 ». */
export function describePeriod(startDate: string, endDate: string): string {
  return startDate === endDate
    ? `le ${formatDate(startDate)}`
    : `du ${formatDate(startDate)} au ${formatDate(endDate)}`;
}

type Editing = { mode: "create" } | { mode: "edit"; closure: Closure } | null;

/**
 * Périodes de fermeture de la saison (§3.8) : vacances et jours fériés, sans
 * cours réguliers. Saisie manuelle et assistant de pré-remplissage à partir
 * du calendrier embarqué (zone B, jours fériés).
 */
export function ClosuresTab() {
  const { db } = useDatabase();
  const season = useViewedSeason();
  const readOnly = useReadOnly();
  const load = useCallback(() => loadPlanningState(db, season.id), [db, season.id]);
  const { data, reload } = useLoader(load);
  const [editing, setEditing] = useState<Editing>(null);
  const [assistant, setAssistant] = useState(false);
  const closures = data?.closures ?? [];

  /** Construit la commande sur l'état relu en base, l'écrit puis recharge la liste. */
  const execute = async (build: (state: PlanningState) => Command) => {
    const command = build(await loadPlanningState(db, season.id));
    await persistCommand(db, command);
    reload();
  };

  return (
    <section className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-muted-foreground text-sm">
          Pendant une fermeture, les cours du planning habituel sont suspendus ; les cours ponctuels
          (stages) restent possibles.
        </p>
        {!readOnly && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAssistant(true)}>
              <WandSparkles aria-hidden />
              Vacances et jours fériés…
            </Button>
            <Button onClick={() => setEditing({ mode: "create" })}>
              <Plus aria-hidden />
              Nouvelle fermeture
            </Button>
          </div>
        )}
      </div>
      {closures.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
          {readOnly
            ? "Aucune période de fermeture."
            : "Aucune période de fermeture. L'assistant propose les vacances scolaires de la zone B et les jours fériés de la saison."}
        </p>
      ) : (
        <ul aria-label="Périodes de fermeture" className="divide-y rounded-lg border">
          {closures.map((closure) => {
            const days = daysBetween(closure.startDate, closure.endDate) + 1;
            return (
              <li key={closure.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="flex-1">
                  <span className="font-medium">{closure.label}</span>{" "}
                  <span className="text-muted-foreground">
                    {describePeriod(closure.startDate, closure.endDate)}
                  </span>
                </span>
                <Badge variant="outline">{days === 1 ? "1 jour" : `${days} jours`}</Badge>
                {!readOnly && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Modifier ${closure.label}`}
                      tooltip="Modifier"
                      onClick={() => setEditing({ mode: "edit", closure })}
                    >
                      <Pencil aria-hidden />
                    </Button>
                    <DeleteAction
                      name={closure.label}
                      subject={`la fermeture « ${closure.label} »`}
                      onDelete={() => execute((state) => deleteClosure(state, closure.id))}
                      onDone={() => undefined}
                    />
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing?.mode === "edit" ? "Modifier la fermeture" : "Nouvelle fermeture"}
      >
        {editing && (
          <ClosureForm
            initialValues={
              editing.mode === "edit" ? editing.closure : { label: "", startDate: "", endDate: "" }
            }
            onCancel={() => setEditing(null)}
            onSubmit={async (values) => {
              await execute((state) =>
                editing.mode === "edit"
                  ? updateClosure(state, editing.closure.id, values)
                  : createClosure(state, { ...values, seasonId: season.id }),
              );
              setEditing(null);
            }}
          />
        )}
      </Dialog>
      <Dialog
        open={assistant}
        onOpenChange={setAssistant}
        className="max-w-3xl"
        title="Vacances scolaires et jours fériés"
        description={`Zone B · calendrier embarqué mis à jour le ${formatDate(
          SCHOOL_CALENDAR.updatedOn,
        )} · années ${SCHOOL_CALENDAR.years.map((y) => y.schoolYear).join(", ")}`}
      >
        {assistant && (
          <ClosureAssistant
            season={season}
            closures={closures}
            onCancel={() => setAssistant(false)}
            onSubmit={async (inputs) => {
              await execute((state) =>
                createClosures(
                  state,
                  inputs.map((input) => ({ ...input, seasonId: season.id })),
                ),
              );
              setAssistant(false);
            }}
          />
        )}
      </Dialog>
    </section>
  );
}

type ClosureValues = Pick<ClosureInput, "label" | "startDate" | "endDate">;

function ClosureForm({
  initialValues,
  onSubmit,
  onCancel,
}: {
  initialValues: ClosureValues;
  onSubmit: (values: ClosureValues) => Promise<void>;
  onCancel: () => void;
}) {
  const initial: ClosureValues = {
    label: initialValues.label,
    startDate: initialValues.startDate,
    endDate: initialValues.endDate,
  };
  const [values, setValues] = useState<ClosureValues>(initial);
  const { error, setError, changed } = useFormErrors<ClosureValues>();
  useDirtyGuard(!sameValues(values, initial));
  const cancel = useGuardedCancel(onCancel);
  const set = (patch: Partial<ClosureValues>) => {
    changed(patch);
    setValues((v) => ({ ...v, ...patch }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await onSubmit({ ...values, endDate: values.endDate || values.startDate });
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <form onSubmit={submit} noValidate aria-label="Période de fermeture" className="grid gap-4">
      <Field label="Libellé" required hint="Ex. « Vacances de la Toussaint », « Tournoi du club »">
        {(props) => (
          <Input {...props} value={values.label} onChange={(e) => set({ label: e.target.value })} />
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Du" required>
          {(props) => (
            <Input
              {...props}
              type="date"
              value={values.startDate}
              onChange={(e) => set({ startDate: e.target.value })}
            />
          )}
        </Field>
        <Field label="Au" hint="Inclus ; vide = un seul jour.">
          {(props) => (
            <Input
              {...props}
              type="date"
              value={values.endDate}
              onChange={(e) => set({ endDate: e.target.value })}
            />
          )}
        </Field>
      </div>
      <MessageZone label="Messages" messages={errorMessages(error)} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={cancel}>
          Annuler
        </Button>
        <Button type="submit">Enregistrer</Button>
      </div>
    </form>
  );
}

/**
 * Assistant de pré-remplissage (§3.8) : propositions cochées par défaut,
 * dates modifiables, ajout en une seule opération. Les cases des jours fériés
 * suivent en direct les périodes cochées qui les couvrent (B9).
 */
function ClosureAssistant({
  season,
  closures,
  onSubmit,
  onCancel,
}: {
  season: { startDate: string; endDate: string };
  closures: readonly Closure[];
  onSubmit: (inputs: ClosureValues[]) => Promise<void>;
  onCancel: () => void;
}) {
  const initial = useMemo(
    (): ProposalRow[] =>
      closureProposals(season, closures).map((p) => ({
        ...p,
        checked: p.selected,
        auto: p.kind === "public_holiday",
      })),
    [season, closures],
  );
  const [rows, setRows] = useState<ProposalRow[]>(initial);
  const [error, setError] = useState<string | null>(null);
  useDirtyGuard(!sameValues(rows, initial));
  const cancel = useGuardedCancel(onCancel);
  const set = (id: string, patch: Partial<ProposalRow>) => {
    setError(null);
    setRows((list) => followSelection(list.map((r) => (r.id === id ? { ...r, ...patch } : r))));
  };
  const chosen = rows.filter((r) => r.checked && r.inSeason);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (chosen.length === 0) {
      setError("Cochez au moins une période.");
      return;
    }
    try {
      await onSubmit(
        chosen.map((r) => ({
          label: proposalClosureLabel(r),
          startDate: r.startDate,
          endDate: r.endDate || r.startDate,
        })),
      );
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <form onSubmit={submit} noValidate aria-label="Assistant des fermetures" className="grid gap-4">
      <ul aria-label="Propositions" className="divide-y rounded-lg border">
        {rows.map((row) => {
          const disabled = !row.inSeason;
          return (
            <li
              key={row.id}
              data-testid="closure-proposal"
              className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
            >
              <Checkbox
                aria-label={`${proposalClosureLabel(row)} ${describePeriod(row.startDate, row.endDate)}`}
                checked={row.checked && !disabled}
                disabled={disabled}
                onChange={(e) => set(row.id, { checked: e.target.checked, auto: false })}
              />
              <div className="min-w-0">
                <div className="font-medium">
                  {proposalClosureLabel(row)}
                  {!row.inSeason && (
                    <Badge variant="outline" className="ml-2">
                      hors saison
                    </Badge>
                  )}
                  {row.existing && (
                    <Badge variant="secondary" className="ml-2">
                      déjà saisie
                    </Badge>
                  )}
                  {row.coveredBy && (
                    <Badge variant="outline" className="ml-2">
                      compris dans {row.coveredBy}
                    </Badge>
                  )}
                </div>
                <div className="truncate text-muted-foreground text-xs" title={row.detail}>
                  {row.detail}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  aria-label={`Début — ${row.label}`}
                  className="h-8 w-[9.5rem]"
                  disabled={disabled}
                  value={row.startDate}
                  onChange={(e) => set(row.id, { startDate: e.target.value })}
                />
                <span aria-hidden>→</span>
                <Input
                  type="date"
                  aria-label={`Fin — ${row.label}`}
                  className="h-8 w-[9.5rem]"
                  disabled={disabled}
                  value={row.endDate}
                  onChange={(e) => set(row.id, { endDate: e.target.value })}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <MessageZone label="Messages" messages={errorMessages(error)} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={cancel}>
          Annuler
        </Button>
        <Button type="submit">
          <CalendarPlus aria-hidden />
          {chosen.length <= 1
            ? `Ajouter ${chosen.length} fermeture`
            : `Ajouter ${chosen.length} fermetures`}
        </Button>
      </div>
    </form>
  );
}
