import { ClipboardPaste, FileUp, Redo2, Undo2, Upload } from "lucide-react";
import { type ChangeEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
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
import { getGroup } from "@/db/repositories/groups";
import { loadImportContext } from "@/db/repositories/studentImport";
import type { Season } from "@/db/schema";
import type { ParsedTable } from "@/domain/importFile";
import {
  buildImportCommand,
  type ColumnMapping,
  type DuplicateMode,
  emptyMapping,
  IMPORT_FIELDS,
  type ImportContext,
  type ImportFieldKey,
  type ImportPlan,
  type ImportSummary,
  looksLikeHeaderRow,
  mappingProblems,
  type PlannedRow,
  planImport,
  type RowStatus,
  restoreMapping,
  toSavedMapping,
} from "@/domain/studentImport";
import { formatContactPhone } from "@/domain/students";
import { formatDate } from "@/domain/time";
import { errorMessage, useLoader } from "@/hooks/useLoader";
import { shortcutLabel } from "@/lib/keys";
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
  /** Texte d'un tableau collé (relu si l'on change la ligne d'en-têtes). */
  pastedText?: string;
}

/** Nom du « fichier » d'un tableau collé (libellé de l'import, historique). */
const PASTED_NAME = "tableau collé";

const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
  `${count} ${count > 1 ? pluralForm : singular}`;

/** Assistant d'import d'élèves (§9.1) : fichier ou collage → colonnes → aperçu → import. */
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
  // Lien « Importer ou coller une liste » (onglet Élèves, fiche groupe) : carte
  // mise en vue ; depuis la fiche, groupe pré-affecté (sans colonne Groupe).
  const [params] = useSearchParams();
  const fromLink = params.has("import");
  const groupId = params.get("groupe");
  const loadGroup = useCallback(async () => {
    const group = groupId ? await getGroup(db, groupId) : undefined;
    // Seulement un groupe de la saison affichée (lien ancien ou saison changée entre-temps).
    return group && group.seasonId === season.id ? group : null;
  }, [db, groupId, season.id]);
  const presetGroup = useLoader(loadGroup).data ?? null;
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (fromLink) cardRef.current?.scrollIntoView({ block: "start" });
  }, [fromLink]);
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
      load({ name: selected.name, table, formatLabel: describeFormat(table.format) });
    });

  /** Tableau collé : même suite que les fichiers (en-têtes détectés, case modifiable). */
  const openPasted = (text: string, headerRow?: boolean) =>
    run(async () => {
      const { describeFormat, readPastedText } = await import("@/domain/importFile");
      const table = readPastedText(text, headerRow ?? looksLikeHeaderRow);
      load({
        name: PASTED_NAME,
        table,
        formatLabel: describeFormat(table.format),
        pastedText: text,
      });
    });

  const load = (loaded: LoadedFile) => {
    const preferences = loadImportPreferences();
    setFile(loaded);
    // Sans en-têtes, les colonnes « Colonne A… » ne désignent rien d'un collage à l'autre :
    // aucune correspondance mémorisée n'est reprise (ni enregistrée, voir `showPreview`).
    setMapping(
      loaded.table.headerRow
        ? restoreMapping(loaded.table.headers, preferences?.mapping)
        : emptyMapping(),
    );
    setDuplicates(preferences?.duplicates ?? "ignore");
    setPreview(null);
    setResult(null);
    setStep("mapping");
  };

  const showPreview = () =>
    run(async () => {
      if (!file || !mapping) return;
      saveImportPreferences({
        mapping: file.table.headerRow
          ? toSavedMapping(file.table.headers, mapping)
          : (loadImportPreferences()?.mapping ?? {}),
        duplicates,
      });
      const context = await loadImportContext(db, season.id);
      const defaultGroupIds = presetGroup ? [presetGroup.id] : [];
      setPreview({
        plan: planImport(file.table.rows, context, { mapping, duplicates, defaultGroupIds }),
        context,
      });
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
    <div ref={cardRef} className="flex max-w-6xl scroll-mt-4 flex-col gap-6">
      <ImportHistoryBar />
      <Card>
        <CardHeader>
          <CardTitle>Importer des élèves</CardTitle>
          <CardDescription>
            À partir d'un fichier Excel ou d'un export de votre logiciel d'adhérents, ou en collant
            un tableau copié dans Excel. Les élèves sont ajoutés à la saison {season.name}.
          </CardDescription>
          {presetGroup && (
            <p className="text-sm" data-testid="import-group">
              Depuis le groupe <span className="font-medium">{presetGroup.name}</span> : les élèves
              y sont inscrits si la liste n'a pas de colonne « Groupe(s) ».
            </p>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Stepper current={step} />
          <ErrorAlert>{error}</ErrorAlert>
          {step === "file" && (
            <FileStep
              busy={busy}
              onFile={openFile}
              onPaste={(text) => openPasted(text)}
              onError={setError}
            />
          )}
          {step === "mapping" && file && mapping && (
            <MappingStep
              file={file}
              onHeaderRowChange={
                file.pastedText === undefined
                  ? undefined
                  : (headerRow) => openPasted(file.pastedText ?? "", headerRow)
              }
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
              groups={preview.context.groups}
              busy={busy}
              onBack={() => setStep("mapping")}
              onImport={runImport}
            />
          )}
          {step === "done" && result && (
            <DoneStep {...result} group={presetGroup} onRestart={restart} />
          )}
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
  onPaste,
  onError,
}: {
  busy: boolean;
  onFile: (file: SelectedFile | null) => void;
  onPaste: (text: string) => void;
  onError: (message: string) => void;
}) {
  const { driver } = useDatabase();
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState("");
  const pasteId = useId();
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
          La première ligne contient de préférence les en-têtes des colonnes (sans en-têtes, les
          colonnes sont nommées « Colonne A », « Colonne B »…). Nom et prénom sont obligatoires,
          ainsi que le téléphone de l'élève ou celui du responsable légal.
        </p>
      </div>
      <TechnicalDetails>
        <p>
          Formats acceptés : Excel (.xlsx, .xls, premier onglet) et CSV (séparateur « ; », « , » ou
          tabulation, encodage UTF-8 ou Windows-1252, détectés automatiquement).
        </p>
        <p>
          Tableau collé : cellules séparées par des tabulations, fins de ligne Windows, macOS ou
          Linux ; les retours à la ligne d'une cellule deviennent « , ».
        </p>
      </TechnicalDetails>
      <div className="flex flex-wrap items-end gap-3">
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
        <Button
          variant="outline"
          disabled={busy}
          aria-expanded={pasting}
          aria-controls={pasteId}
          onClick={() => setPasting((p) => !p)}
        >
          <ClipboardPaste aria-hidden />
          Coller depuis Excel
        </Button>
      </div>
      {pasting && (
        <div id={pasteId} className="flex max-w-3xl flex-col gap-2">
          <Label htmlFor={`${pasteId}-text`}>Tableau à coller</Label>
          <p className="text-muted-foreground text-xs">
            Sélectionnez les lignes dans Excel (ou un autre tableur), copiez-les, puis collez-les
            ici ({shortcutLabel("mod+v")}).
          </p>
          <textarea
            id={`${pasteId}-text`}
            // biome-ignore lint/a11y/noAutofocus: zone ouverte à la demande, prête à recevoir le collage.
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            spellCheck={false}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <div>
            <Button
              disabled={busy || text.trim() === ""}
              disabledReason={text.trim() === "" ? "Collez d'abord un tableau." : undefined}
              onClick={() => onPaste(text)}
            >
              Lire le tableau
            </Button>
          </div>
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
  onHeaderRowChange,
  mapping,
  duplicates,
  busy,
  onMappingChange,
  onDuplicatesChange,
  onBack,
  onNext,
}: {
  file: LoadedFile;
  /** Tableau collé : la première ligne est-elle celle des en-têtes ? */
  onHeaderRowChange?: (headerRow: boolean) => void;
  mapping: ColumnMapping;
  duplicates: DuplicateMode;
  busy: boolean;
  onMappingChange: (mapping: ColumnMapping) => void;
  onDuplicatesChange: (mode: DuplicateMode) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const problems = mappingProblems(mapping);
  const { headers, headerRow } = file.table;
  // Sans en-têtes, « Colonne A » seule ne dit rien : l'option montre une valeur de la colonne.
  const columnLabel = (header: string, index: number) => {
    const sample = headerRow ? "" : sampleValue(file.table, index);
    return sample ? `${header} — ${sample}` : header;
  };
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
      {onHeaderRowChange && (
        <Checkbox
          label="La première ligne contient des élèves"
          checked={!headerRow}
          disabled={busy}
          onChange={(e) => onHeaderRowChange(!e.target.checked)}
        />
      )}

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
                        {columnLabel(header, i)}
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
  groups,
  busy,
  onBack,
  onImport,
}: {
  plan: ImportPlan;
  groups: ImportContext["groups"];
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
  const groupNames = useMemo(() => new Map(groups.map((g) => [g.id, g.name])), [groups]);
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
              <PreviewRow key={row.line} row={row} groupNames={groupNames} />
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

function PreviewRow({
  row,
  groupNames,
}: {
  row: PlannedRow;
  /** Noms des groupes de la saison, par identifiant (groupes reconnus ou pré-affectés). */
  groupNames: ReadonlyMap<string, string>;
}) {
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
      <TableCell className="whitespace-nowrap">
        {row.values ? formatContactPhone(row.values) : row.raw.phone || row.raw.guardianPhone}
      </TableCell>
      <TableCell className="whitespace-nowrap">{birthDate}</TableCell>
      <TableCell>
        {row.groupIds.length > 0
          ? row.groupIds.map((id) => groupNames.get(id) ?? id).join(", ")
          : row.raw.groups}
      </TableCell>
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
  group,
  onRestart,
}: {
  summary: ImportSummary;
  errors: number;
  /** Groupe d'où l'import a été lancé (retour à sa fiche). */
  group: { id: string; name: string } | null;
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
        {group && (
          <Button asChild variant="outline">
            <Link to={`/referentiels/groupes/${group.id}`}>Retour au groupe {group.name}</Link>
          </Button>
        )}
        <Button asChild variant="outline">
          <Link to="/referentiels/eleves">Voir les élèves</Link>
        </Button>
        <Button variant="outline" onClick={onRestart}>
          Importer une autre liste
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
