import { FileUp, Redo2, Undo2, Upload } from "lucide-react";
import { type ChangeEvent, useMemo, useState } from "react";
import { Link } from "react-router";
import { useReadOnly, useViewedSeason } from "@/app/season";
import { ErrorAlert } from "@/components/form/Field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Input, Label, Select } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TechnicalDetails } from "@/components/ui/technical-details";
import { useDatabase } from "@/db/DatabaseProvider";
import { loadImportContext } from "@/db/repositories/studentImport";
import type { Season } from "@/db/schema";
import type { ParsedTable } from "@/domain/importFile";
import {
  buildImportCommand,
  type ColumnMapping,
  type DuplicateMode,
  IMPORT_FIELDS,
  type ImportContext,
  type ImportFieldKey,
  type ImportPlan,
  type ImportSummary,
  mappingProblems,
  type PlannedRow,
  planImport,
  type RowStatus,
  restoreMapping,
  toSavedMapping,
} from "@/domain/studentImport";
import { formatDate } from "@/domain/time";
import { errorMessage } from "@/hooks/useLoader";
import { cn } from "@/lib/utils";
import { chooseImportFile, IMPORT_ACCEPT, readBrowserFile, type SelectedFile } from "./files";
import { importHistory, useImportHistory } from "./importHistory";
import { loadImportPreferences, saveImportPreferences } from "./mappingStorage";

type Step = "file" | "mapping" | "preview" | "done";

const STEPS: { key: Step; label: string }[] = [
  { key: "file", label: "Fichier" },
  { key: "mapping", label: "Colonnes" },
  { key: "preview", label: "Aperçu" },
  { key: "done", label: "Import" },
];

interface LoadedFile {
  name: string;
  table: ParsedTable;
  formatLabel: string;
}

const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
  `${count} ${count > 1 ? pluralForm : singular}`;

/** Assistant d'import d'élèves (§9.1) : fichier → correspondance → aperçu → import. */
export function StudentImport() {
  const season = useViewedSeason();
  if (useReadOnly()) {
    return (
      <Card className="max-w-6xl">
        <CardHeader>
          <CardTitle>Importer des élèves</CardTitle>
          <CardDescription data-testid="import-read-only">
            La saison {season.name} est terminée : aucun élève ne peut y être importé. Revenez à la
            saison en cours pour importer des élèves.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return <StudentImportWizard season={season} />;
}

function StudentImportWizard({ season }: { season: Season }) {
  const { db } = useDatabase();
  const [step, setStep] = useState<Step>("file");
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateMode>("ignore");
  const [preview, setPreview] = useState<{ plan: ImportPlan; context: ImportContext } | null>(null);
  const [result, setResult] = useState<{ summary: ImportSummary; errors: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const openFile = (selected: SelectedFile | null) =>
    run(async () => {
      if (!selected) return;
      // SheetJS et PapaParse ne sont chargés qu'à l'ouverture d'un fichier.
      const { describeFormat, readImportFile } = await import("@/domain/importFile");
      const table = readImportFile(selected.bytes, selected.name);
      const preferences = loadImportPreferences();
      setFile({ name: selected.name, table, formatLabel: describeFormat(table.format) });
      setMapping(restoreMapping(table.headers, preferences?.mapping));
      setDuplicates(preferences?.duplicates ?? "ignore");
      setPreview(null);
      setResult(null);
      setStep("mapping");
    });

  const showPreview = () =>
    run(async () => {
      if (!file || !mapping) return;
      saveImportPreferences({ mapping: toSavedMapping(file.table.headers, mapping), duplicates });
      const context = await loadImportContext(db, season.id);
      setPreview({ plan: planImport(file.table.rows, context, { mapping, duplicates }), context });
      setStep("preview");
    });

  const runImport = () =>
    run(async () => {
      if (!file || !preview) return;
      const { command, summary } = buildImportCommand(preview.plan, preview.context, {
        fileName: file.name,
      });
      const done = await importHistory.execute(db, { command, summary, fileName: file.name });
      if (done) {
        setResult({ summary, errors: preview.plan.counts.error });
        setStep("done");
      }
    });

  const restart = () => {
    setStep("file");
    setFile(null);
    setMapping(null);
    setPreview(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <ImportHistoryBar />
      <Card>
        <CardHeader>
          <CardTitle>Importer des élèves</CardTitle>
          <CardDescription>
            À partir d'un fichier Excel ou d'un export de votre logiciel d'adhérents. Les élèves
            sont ajoutés à la saison {season.name}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Stepper current={step} />
          <ErrorAlert>{error}</ErrorAlert>
          {step === "file" && <FileStep busy={busy} onFile={openFile} onError={setError} />}
          {step === "mapping" && file && mapping && (
            <MappingStep
              file={file}
              mapping={mapping}
              duplicates={duplicates}
              busy={busy}
              onMappingChange={setMapping}
              onDuplicatesChange={setDuplicates}
              onBack={restart}
              onNext={showPreview}
            />
          )}
          {step === "preview" && preview && (
            <PreviewStep
              plan={preview.plan}
              busy={busy}
              onBack={() => setStep("mapping")}
              onImport={runImport}
            />
          )}
          {step === "done" && result && <DoneStep {...result} onRestart={restart} />}
        </CardContent>
      </Card>
    </div>
  );
}

function Stepper({ current }: { current: Step }) {
  const index = STEPS.findIndex((s) => s.key === current);
  return (
    <ol aria-label="Étapes de l'import" className="flex flex-wrap gap-2 text-sm">
      {STEPS.map((s, i) => (
        <li
          key={s.key}
          aria-current={i === index ? "step" : undefined}
          className={cn(
            "flex items-center gap-2 rounded-full border px-3 py-1",
            i === index && "border-primary bg-primary text-primary-foreground",
            i < index && "text-muted-foreground",
            i > index && "border-dashed text-muted-foreground",
          )}
        >
          <span className="font-semibold tabular-nums">{i + 1}</span>
          {s.label}
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Étape 1 : fichier
// ---------------------------------------------------------------------------

function FileStep({
  busy,
  onFile,
  onError,
}: {
  busy: boolean;
  onFile: (file: SelectedFile | null) => void;
  onError: (message: string) => void;
}) {
  const { driver } = useDatabase();
  const onChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (selected) onFile(await readBrowserFile(selected));
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="text-muted-foreground text-sm">
        <p>Fichier Excel ou export de votre logiciel d'adhérents.</p>
        <p>
          La première ligne doit contenir les en-têtes des colonnes. Nom, prénom et téléphone sont
          obligatoires.
        </p>
      </div>
      <TechnicalDetails>
        <p>
          Formats acceptés : Excel (.xlsx, .xls, premier onglet) et CSV (séparateur « ; », « , » ou
          tabulation, encodage UTF-8 ou Windows-1252, détectés automatiquement).
        </p>
      </TechnicalDetails>
      {driver.kind === "tauri" ? (
        <div>
          <Button
            disabled={busy}
            onClick={async () => {
              try {
                onFile(await chooseImportFile());
              } catch (e) {
                onError(errorMessage(e));
              }
            }}
          >
            <FileUp aria-hidden />
            Choisir un fichier…
          </Button>
        </div>
      ) : (
        <div className="flex max-w-md flex-col gap-1.5">
          <Label htmlFor="import-file">Fichier à importer</Label>
          <Input
            id="import-file"
            type="file"
            accept={IMPORT_ACCEPT}
            disabled={busy}
            onChange={onChange}
          />
        </div>
      )}
      {busy && <p className="text-muted-foreground text-sm">Lecture du fichier…</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Étape 2 : correspondance
// ---------------------------------------------------------------------------

/** Première valeur non vide de la colonne, pour illustrer la correspondance. */
function sampleValue(table: ParsedTable, column: number | null): string {
  if (column === null) return "";
  for (const row of table.rows.slice(0, 50)) {
    const value = row.cells[column];
    if (value) return value;
  }
  return "";
}

function MappingStep({
  file,
  mapping,
  duplicates,
  busy,
  onMappingChange,
  onDuplicatesChange,
  onBack,
  onNext,
}: {
  file: LoadedFile;
  mapping: ColumnMapping;
  duplicates: DuplicateMode;
  busy: boolean;
  onMappingChange: (mapping: ColumnMapping) => void;
  onDuplicatesChange: (mode: DuplicateMode) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const problems = mappingProblems(mapping);
  const { headers } = file.table;
  const setColumn = (key: ImportFieldKey, value: string) => {
    const column = value === "" ? null : Number(value);
    const next = { ...mapping, [key]: column };
    // Une colonne ne sert qu'à un seul champ.
    if (column !== null) {
      for (const field of IMPORT_FIELDS) {
        if (field.key !== key && next[field.key] === column) next[field.key] = null;
      }
    }
    onMappingChange(next);
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm" data-testid="import-file-info">
        <span className="font-medium">{file.name}</span>
        <span className="text-muted-foreground">
          {" "}
          — {file.formatLabel}, {plural(file.table.rows.length, "ligne")} de données.
        </span>
      </p>

      <h3 className="font-medium text-sm">Associer les colonnes de votre fichier</h3>
      <Table aria-label="Associer les colonnes de votre fichier" className="max-w-3xl">
        <TableHeader>
          <TableRow>
            <TableHead className="w-56">Champ de l'élève</TableHead>
            <TableHead className="w-72">Colonne du fichier</TableHead>
            <TableHead>Exemple</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {IMPORT_FIELDS.map((field) => {
            const column = mapping[field.key];
            const id = `mapping-${field.key}`;
            return (
              <TableRow key={field.key}>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Label htmlFor={id}>{field.label}</Label>
                    {field.required && (
                      <span className="text-destructive text-sm leading-none" aria-hidden>
                        *
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Select
                    id={id}
                    value={column === null ? "" : String(column)}
                    onChange={(e) => setColumn(field.key, e.target.value)}
                    aria-invalid={field.required && column === null ? true : undefined}
                  >
                    <option value="">— Ne pas importer —</option>
                    {headers.map((header, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: les colonnes sont fixes.
                      <option key={i} value={i}>
                        {header}
                      </option>
                    ))}
                  </Select>
                </TableCell>
                <TableCell className="max-w-64 truncate text-muted-foreground">
                  {sampleValue(file.table, column)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <p className="text-muted-foreground text-xs">
        Groupe(s) : nom du groupe de la saison (plusieurs groupes séparés par une virgule ou un
        point-virgule). Niveau : nom d'un niveau du club. Le choix des colonnes est mémorisé pour le
        prochain import.
      </p>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium text-sm">
          Élèves déjà enregistrés (même nom, prénom et date de naissance)
        </legend>
        {(
          [
            ["ignore", "Les ignorer"],
            ["update", "Les mettre à jour avec les valeurs du fichier"],
          ] as const
        ).map(([mode, label]) => (
          <Label key={mode} className="font-normal">
            <input
              type="radio"
              name="duplicates"
              value={mode}
              checked={duplicates === mode}
              onChange={() => onDuplicatesChange(mode)}
              className="accent-primary"
            />
            {label}
          </Label>
        ))}
      </fieldset>

      {problems.length > 0 && (
        <ul aria-label="Il manque des colonnes obligatoires" className="text-destructive text-sm">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} disabled={busy}>
          Changer de fichier
        </Button>
        <Button onClick={onNext} disabled={busy || problems.length > 0}>
          Afficher l'aperçu
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Étape 3 : aperçu
// ---------------------------------------------------------------------------

const STATUS: Record<
  RowStatus,
  { label: string; variant: "secondary" | "outline" | "destructive" | "warning" }
> = {
  create: { label: "Nouvel élève", variant: "secondary" },
  update: { label: "Mise à jour", variant: "secondary" },
  unchanged: { label: "Inchangé", variant: "outline" },
  duplicate: { label: "Déjà enregistré", variant: "outline" },
  error: { label: "Erreur", variant: "destructive" },
};

function PreviewStep({
  plan,
  busy,
  onBack,
  onImport,
}: {
  plan: ImportPlan;
  busy: boolean;
  onBack: () => void;
  onImport: () => void;
}) {
  const [onlyIssues, setOnlyIssues] = useState(false);
  const rows = useMemo(
    () =>
      onlyIssues
        ? plan.rows.filter((r) => r.errors.length > 0 || r.warnings.length > 0)
        : plan.rows,
    [plan, onlyIssues],
  );
  const { counts } = plan;
  const toImport = counts.create + counts.update;

  return (
    <div className="flex flex-col gap-4">
      <ul aria-label="Résumé de l'import" className="flex flex-wrap gap-2 text-sm">
        <li>
          <Badge variant="secondary">
            {plural(counts.create, "nouvel élève", "nouveaux élèves")}
          </Badge>
        </li>
        {counts.update > 0 && (
          <li>
            <Badge variant="secondary">
              {plural(counts.update, "mise à jour", "mises à jour")}
            </Badge>
          </li>
        )}
        {counts.duplicate > 0 && (
          <li>
            <Badge variant="outline">
              {plural(counts.duplicate, "déjà enregistré (ignoré)", "déjà enregistrés (ignorés)")}
            </Badge>
          </li>
        )}
        {counts.unchanged > 0 && (
          <li>
            <Badge variant="outline">{plural(counts.unchanged, "inchangé")}</Badge>
          </li>
        )}
        {counts.error > 0 && (
          <li>
            <Badge variant="destructive">
              {plural(counts.error, "ligne en erreur", "lignes en erreur")}
            </Badge>
          </li>
        )}
        {plan.outOfAgeRange > 0 && (
          <li>
            <Badge variant="warning">
              {plural(plan.outOfAgeRange, "ligne hors tranche d'âge", "lignes hors tranche d'âge")}
            </Badge>
          </li>
        )}
      </ul>

      {plan.unknownGroups.length > 0 && (
        <p
          role="status"
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 text-sm dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
        >
          Groupes introuvables dans la saison : {plan.unknownGroups.join(", ")}. Les élèves
          concernés sont importés sans être inscrits dans ces groupes.
        </p>
      )}
      {plan.unknownLevels.length > 0 && (
        <p
          role="status"
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 text-sm dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
        >
          Niveaux introuvables : {plan.unknownLevels.join(", ")}. Le niveau des élèves concernés
          reste vide.
        </p>
      )}
      {counts.error > 0 && (
        <p className="text-muted-foreground text-sm">
          Les lignes en erreur ne sont pas importées ; les autres le sont normalement.
        </p>
      )}

      <Checkbox
        label="Afficher uniquement les lignes à vérifier"
        checked={onlyIssues}
        onChange={(e) => setOnlyIssues(e.target.checked)}
      />

      <div className="max-h-[28rem] overflow-auto rounded-md border">
        <Table aria-label="Aperçu de l'import">
          <TableHeader className="sticky top-0 bg-background">
            <TableRow>
              <TableHead className="w-16">Ligne</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Prénom</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Naissance</TableHead>
              <TableHead>Groupe(s)</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Remarques</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <PreviewRow key={row.line} row={row} />
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} disabled={busy}>
          Retour au choix des colonnes
        </Button>
        <Button onClick={onImport} disabled={busy || toImport === 0}>
          <Upload aria-hidden />
          {toImport === 0 ? "Aucun élève à importer" : `Importer ${plural(toImport, "élève")}`}
        </Button>
      </div>
    </div>
  );
}

function PreviewRow({ row }: { row: PlannedRow }) {
  const status = STATUS[row.status];
  const birthDate = row.values?.birthDate ? formatDate(row.values.birthDate) : row.raw.birthDate;
  return (
    <TableRow
      data-status={row.status}
      data-out-of-age-range={row.outOfAgeRange || undefined}
      className={cn(
        row.status === "error" && "bg-destructive/5",
        row.outOfAgeRange && "bg-amber-50 dark:bg-amber-500/10",
      )}
    >
      <TableCell className="tabular-nums">{row.line}</TableCell>
      <TableCell>{row.raw.lastName}</TableCell>
      <TableCell>{row.raw.firstName}</TableCell>
      <TableCell className="whitespace-nowrap">{row.values?.phone ?? row.raw.phone}</TableCell>
      <TableCell className="whitespace-nowrap">{birthDate}</TableCell>
      <TableCell>{row.raw.groups}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          <Badge variant={status.variant}>{status.label}</Badge>
          {row.outOfAgeRange && <Badge variant="warning">Hors tranche</Badge>}
        </div>
      </TableCell>
      <TableCell className="text-xs">
        {row.errors.length + row.warnings.length > 0 && (
          <ul className="flex flex-col gap-0.5">
            {row.errors.map((e) => (
              <li key={e} className="text-destructive">
                {e}
              </li>
            ))}
            {row.warnings.map((w) => (
              <li key={w} className="text-amber-700 dark:text-amber-300">
                {w}
              </li>
            ))}
          </ul>
        )}
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// Étape 4 : résultat et historique
// ---------------------------------------------------------------------------

function DoneStep({
  summary,
  errors,
  onRestart,
}: {
  summary: ImportSummary;
  errors: number;
  onRestart: () => void;
}) {
  const parts = [plural(summary.created, "élève créé", "élèves créés")];
  if (summary.updated > 0) parts.push(plural(summary.updated, "mis à jour", "mis à jour"));
  if (summary.memberships > 0) {
    parts.push(
      plural(summary.memberships, "inscription dans un groupe", "inscriptions dans les groupes"),
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <output className="text-sm" data-testid="import-result">
        Import terminé : {parts.join(", ")}.
        {errors > 0 &&
          ` ${plural(errors, "ligne en erreur n'a", "lignes en erreur n'ont")} pas été importée${errors > 1 ? "s" : ""}.`}
      </output>
      <div className="flex gap-2">
        <Button asChild variant="outline">
          <Link to="/referentiels/eleves">Voir les élèves</Link>
        </Button>
        <Button variant="outline" onClick={onRestart}>
          Importer un autre fichier
        </Button>
      </div>
    </div>
  );
}

/** Annuler / rétablir le dernier import de la session. */
function ImportHistoryBar() {
  const { db } = useDatabase();
  const { past, future, busy, error, confirmUndo } = useImportHistory();
  const last = past.at(-1);
  const next = future.at(-1);
  if (!last && !next && !error) return null;
  if (confirmUndo) {
    return (
      <section
        role="alertdialog"
        aria-label="Annuler l'import ?"
        className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 text-sm dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
      >
        <p>{confirmUndo}</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={() => importHistory.undo(db, { force: true })}
          >
            Annuler quand même
          </Button>
          <Button size="sm" variant="outline" onClick={() => importHistory.cancelUndo()}>
            Garder l'import
          </Button>
        </div>
      </section>
    );
  }
  return (
    <section
      aria-label="Historique des imports"
      className="flex flex-col gap-2 rounded-lg border bg-muted/40 px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {last ? (
          <span>
            Dernier import : <span className="font-medium">{last.command.label}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">Import annulé : {next?.command.label}</span>
        )}
        <div className="ml-auto flex gap-2">
          {last && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => importHistory.undo(db)}
            >
              <Undo2 aria-hidden />
              Annuler l'import
            </Button>
          )}
          {next && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => importHistory.redo(db)}
            >
              <Redo2 aria-hidden />
              Rétablir l'import
            </Button>
          )}
        </div>
      </div>
      <ErrorAlert>{error}</ErrorAlert>
    </section>
  );
}
