import { FileDown, FileSpreadsheet, FileText } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useActiveSeason } from "@/app/season";
import { ErrorAlert } from "@/components/form/Field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { useDatabase } from "@/db/DatabaseProvider";
import { startOfIsoWeek, todayInParis } from "@/domain/dates";
import {
  csvBytes,
  type DataTable,
  groupsTable,
  lessonsTable,
  studentsTable,
  xlsxBytes,
} from "@/domain/exports";
import { isValidDate } from "@/domain/time";
import { loadOutputData, type OutputData } from "@/features/outputs/data";
import type { OutputKind } from "@/features/outputs/save";
import { SaveStatus, useSaveOutput } from "@/features/outputs/useSaveOutput";
import { attendancePdfJob, instructorsPdfJob, weekPdfJob } from "@/features/pdf/jobs";
import { PAPER_SIZES, type PaperSize, slug, type WeekContext } from "@/features/pdf/model";
import { type PdfJob, PdfPreviewDialog } from "@/features/pdf/PdfPreviewDialog";
import { clampWeek, type PlanningMode, TYPE_MODE } from "@/features/planning/grid/items";
import { semaineTypeDate, weekLessons } from "@/features/planning/grid/view";
import { errorMessage, useLoader } from "@/hooks/useLoader";

/** Documents PDF et exports CSV / Excel de la saison (§9.2). */
export function Outputs() {
  const { db } = useDatabase();
  const season = useActiveSeason();
  const load = useCallback(() => loadOutputData(db, season), [db, season]);
  const { data, error, loading } = useLoader(load);

  if (error)
    return <ErrorAlert>Impossible de charger la saison : {errorMessage(error)}</ErrorAlert>;
  if (!data || loading) {
    return <p className="text-muted-foreground text-sm">Chargement des données de la saison…</p>;
  }
  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <PdfCard data={data} />
      <ExportCard data={data} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Documents PDF
// ---------------------------------------------------------------------------

type PdfChoice = "week" | "instructors" | "attendance";

function PdfCard({ data }: { data: OutputData }) {
  const today = todayInParis();
  const { season } = data;
  const [weekKind, setWeekKind] = useState<"type" | "dated">("type");
  const [weekDate, setWeekDate] = useState(() => clampWeek(season, today));
  const [paper, setPaper] = useState<PaperSize>("A4");
  const [instructorId, setInstructorId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [choice, setChoice] = useState<PdfChoice | null>(null);

  const mode: PlanningMode =
    weekKind === "type" || !isValidDate(weekDate)
      ? TYPE_MODE
      : { kind: "dated", monday: startOfIsoWeek(weekDate) };
  const modeKey = mode.kind === "type" ? "type" : mode.monday;

  const job: PdfJob | null = useMemo(() => {
    if (!choice) return null;
    const refs = { courts: data.courts, instructors: data.instructors, groups: data.groups };
    const weekMode: PlanningMode =
      modeKey === "type" ? TYPE_MODE : { kind: "dated", monday: modeKey };
    const ctx: WeekContext = {
      season: data.season,
      state: data.state,
      refs,
      mode: weekMode,
      today,
    };
    switch (choice) {
      case "week":
        return weekPdfJob(ctx, paper);
      case "instructors":
        return instructorsPdfJob(ctx, instructorId || null);
      case "attendance":
        return attendancePdfJob({
          season: data.season,
          lessons: data.state.lessons,
          refs,
          students: data.students,
          today,
          groupId: groupId || null,
        });
    }
  }, [choice, data, modeKey, paper, instructorId, groupId, today]);

  const outOfSeason =
    weekKind === "dated" &&
    isValidDate(weekDate) &&
    (weekDate < season.startDate || weekDate > season.endDate);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents PDF</CardTitle>
        <CardDescription>
          Planning de la semaine, planning par moniteur et feuilles d'appel, à imprimer ou à
          diffuser. Un aperçu s'affiche avant l'enregistrement.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <fieldset className="flex flex-wrap items-end gap-4">
          <legend className="mb-2 font-medium text-sm">Semaine</legend>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pdf-week-kind">Planning</Label>
            <Select
              id="pdf-week-kind"
              className="w-48"
              value={weekKind}
              onChange={(e) => setWeekKind(e.target.value as "type" | "dated")}
            >
              <option value="type">Semaine type</option>
              <option value="dated">Semaine datée</option>
            </Select>
          </div>
          {weekKind === "dated" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pdf-week-date">Semaine du</Label>
              <Input
                id="pdf-week-date"
                type="date"
                className="w-44"
                value={weekDate}
                min={season.startDate}
                max={season.endDate}
                onChange={(e) => setWeekDate(e.target.value)}
              />
            </div>
          )}
          {outOfSeason && (
            <p className="text-amber-700 text-sm dark:text-amber-300">
              Cette semaine est en dehors de la saison.
            </p>
          )}
        </fieldset>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-3 rounded-lg border p-4">
            <p className="font-medium text-sm">Planning de la semaine</p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pdf-paper-size">Format</Label>
              <Select
                id="pdf-paper-size"
                value={paper}
                onChange={(e) => setPaper(e.target.value as PaperSize)}
              >
                {PAPER_SIZES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>
            <Button className="mt-auto" onClick={() => setChoice("week")}>
              <FileDown aria-hidden />
              PDF de la semaine…
            </Button>
          </div>
          <div className="flex flex-col gap-3 rounded-lg border p-4">
            <p className="font-medium text-sm">Planning par moniteur</p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pdf-instructor">Moniteur</Label>
              <Select
                id="pdf-instructor"
                value={instructorId}
                onChange={(e) => setInstructorId(e.target.value)}
              >
                <option value="">Tous les moniteurs (une page chacun)</option>
                {data.instructors.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.firstName} {i.lastName} ({i.initials})
                  </option>
                ))}
              </Select>
            </div>
            <Button className="mt-auto" onClick={() => setChoice("instructors")}>
              <FileDown aria-hidden />
              PDF par moniteur…
            </Button>
          </div>
          <div className="flex flex-col gap-3 rounded-lg border p-4">
            <p className="font-medium text-sm">Feuilles d'appel</p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pdf-group">Groupe</Label>
              <Select id="pdf-group" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                <option value="">Tous les groupes actifs (une page chacun)</option>
                {data.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button className="mt-auto" onClick={() => setChoice("attendance")}>
              <FileDown aria-hidden />
              Feuilles d'appel…
            </Button>
          </div>
        </div>
      </CardContent>
      <PdfPreviewDialog job={job} onClose={() => setChoice(null)} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Exports CSV / Excel
// ---------------------------------------------------------------------------

type ExportKey = "lessons" | "groups" | "students";

const EXPORTS: { key: ExportKey; label: string; description: string }[] = [
  {
    key: "lessons",
    label: "Cours",
    description: "Cours de la semaine type, avec leurs dates d'effet.",
  },
  { key: "groups", label: "Groupes", description: "Groupes, effectifs et créneaux." },
  { key: "students", label: "Élèves", description: "Fiches des élèves et leurs groupes." },
];

function exportTable(key: ExportKey, data: OutputData): DataTable {
  const refs = {
    courts: data.courts,
    groups: data.groups,
    instructors: data.instructors,
  };
  switch (key) {
    case "lessons":
      return lessonsTable(data.state.lessons, refs);
    case "groups":
      return groupsTable(
        data.groups,
        weekLessons(data.state.lessons, semaineTypeDate(data.season, todayInParis())),
        refs,
      );
    case "students":
      return studentsTable(data.students);
  }
}

function ExportCard({ data }: { data: OutputData }) {
  const { state, save, open } = useSaveOutput();
  const exportAs = (key: ExportKey, kind: OutputKind) =>
    save(async () => {
      const table = exportTable(key, data);
      const name = `${slug(table.sheetName)}-${slug(data.season.name)}.${kind}`;
      const bytes = kind === "csv" ? csvBytes(table) : await xlsxBytes([table]);
      return { name, kind, bytes };
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exports CSV / Excel</CardTitle>
        <CardDescription>
          Fichiers CSV (séparateur « ; », UTF-8) ou classeurs Excel, de la saison {data.season.name}
          . Les heures des moniteurs s'exportent depuis l'écran « Heures ».
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col divide-y rounded-lg border">
          {EXPORTS.map((e) => (
            <li key={e.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="mr-auto">
                <p className="font-medium text-sm">{e.label}</p>
                <p className="text-muted-foreground text-xs">{e.description}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={state.busy}
                aria-label={`Exporter ${e.label.toLowerCase()} en CSV`}
                onClick={() => exportAs(e.key, "csv")}
              >
                <FileText aria-hidden />
                CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={state.busy}
                aria-label={`Exporter ${e.label.toLowerCase()} en Excel`}
                onClick={() => exportAs(e.key, "xlsx")}
              >
                <FileSpreadsheet aria-hidden />
                Excel
              </Button>
            </li>
          ))}
        </ul>
        <SaveStatus state={state} onOpen={open} />
      </CardContent>
    </Card>
  );
}
