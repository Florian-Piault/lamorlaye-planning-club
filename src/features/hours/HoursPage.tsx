import { ChevronDown, ChevronRight, FileSpreadsheet, FileText } from "lucide-react";
import { Fragment, useCallback, useMemo, useState } from "react";
import { useViewedSeason } from "@/app/season";
import { ErrorAlert } from "@/components/form/Field";
import { Page } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDatabase } from "@/db/DatabaseProvider";
import { todayInParis } from "@/domain/dates";
import { csvBytes, hoursDetailTable, hoursSummaryTable, xlsxBytes } from "@/domain/exports";
import {
  buildHoursReport,
  type HoursLine,
  hoursLabel,
  monthPeriod,
  type Period,
  periodProblem,
  previousMonthPeriod,
  seasonPeriod,
} from "@/domain/hoursReport";
import { formatDate, weekdayLabel } from "@/domain/time";
import { loadOutputData, type OutputData } from "@/features/outputs/data";
import { SaveStatus, useSaveOutput } from "@/features/outputs/useSaveOutput";
import { RequireSeason } from "@/features/referentiels/ReferentielsPage";
import { errorMessage, useLoader } from "@/hooks/useLoader";
import { cn } from "@/lib/utils";

const DESCRIPTION =
  "Heures assurées par chaque moniteur sur une période : fermetures et annulations exclues, remplacements attribués au remplaçant, cours ponctuels inclus.";

/** Écran « Récapitulatif des heures » (SPECS.md §10). */
export function HoursPage() {
  return (
    <Page title="Récapitulatif des heures" description={DESCRIPTION}>
      <RequireSeason>
        <HoursScreen />
      </RequireSeason>
    </Page>
  );
}

function HoursScreen() {
  const { db } = useDatabase();
  const season = useViewedSeason();
  const load = useCallback(() => loadOutputData(db, season), [db, season]);
  const { data, error } = useLoader(load);
  if (error)
    return <ErrorAlert>Impossible de charger le planning : {errorMessage(error)}</ErrorAlert>;
  if (!data) return <p className="text-muted-foreground text-sm">Chargement du planning…</p>;
  return <HoursReportView data={data} today={todayInParis()} />;
}

/** Récapitulatif d'une saison chargée (exporté pour les tests). */
export function HoursReportView({ data, today }: { data: OutputData; today: string }) {
  const { season } = data;
  const [period, setPeriod] = useState<Period>(() => monthPeriod(today));
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const { state: saveState, save, open } = useSaveOutput();

  const problem = periodProblem(period);
  const report = useMemo(
    () =>
      problem
        ? null
        : buildHoursReport(
            {
              lessons: data.state.lessons,
              exceptions: data.state.exceptions,
              closures: data.state.closures,
              season: { startDate: season.startDate, endDate: season.endDate },
            },
            { instructors: data.instructors, groups: data.groups, courts: data.courts },
            period,
          ),
    [data, season.startDate, season.endDate, period, problem],
  );

  const presets: { label: string; period: Period }[] = [
    { label: "Mois en cours", period: monthPeriod(today) },
    { label: "Mois précédent", period: previousMonthPeriod(today) },
    { label: "Saison", period: seasonPeriod(season) },
  ];

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exportCsv = (detail: boolean) => {
    if (!report) return;
    const table = detail ? hoursDetailTable(report) : hoursSummaryTable(report);
    const name = `${detail ? "detail-heures" : "heures"}-${report.period.from}-${report.period.to}.csv`;
    return save({ name, kind: "csv", bytes: csvBytes(table) });
  };

  /** Classeur Excel (§9.2) : récapitulatif et détail des séances, un onglet chacun. */
  const exportXlsx = () => {
    if (!report) return;
    return save(async () => ({
      name: `heures-${report.period.from}-${report.period.to}.xlsx`,
      kind: "xlsx",
      bytes: await xlsxBytes([hoursSummaryTable(report), hoursDetailTable(report)]),
    }));
  };

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Période</CardTitle>
          <CardDescription>Bornes incluses. Saison {season.name}.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hours-from">Du</Label>
            <Input
              id="hours-from"
              type="date"
              className="w-44"
              value={period.from}
              onChange={(e) => setPeriod((p) => ({ ...p, from: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hours-to">Au</Label>
            <Input
              id="hours-to"
              type="date"
              className="w-44"
              value={period.to}
              onChange={(e) => setPeriod((p) => ({ ...p, to: e.target.value }))}
            />
          </div>
          <fieldset className="flex flex-wrap gap-2" aria-label="Raccourcis de période">
            {presets.map((preset) => {
              const active = preset.period.from === period.from && preset.period.to === period.to;
              return (
                <Button
                  key={preset.label}
                  size="sm"
                  variant={active ? "default" : "outline"}
                  aria-pressed={active}
                  onClick={() => setPeriod(preset.period)}
                >
                  {preset.label}
                </Button>
              );
            })}
          </fieldset>
        </CardContent>
      </Card>

      {problem && <ErrorAlert>{problem}</ErrorAlert>}

      {report && (
        <Card>
          <CardHeader>
            <CardTitle>
              Du {formatDate(report.period.from)} au {formatDate(report.period.to)}
            </CardTitle>
            <CardDescription>
              Cliquez sur un moniteur pour afficher le détail de ses séances.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Table aria-label="Heures par moniteur">
              <TableHeader>
                <TableRow>
                  <TableHead>Moniteur</TableHead>
                  <TableHead className="w-28 text-right">Séances</TableHead>
                  <TableHead className="w-32 text-right">Heures</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.lines.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      Aucun moniteur dans la saison.
                    </TableCell>
                  </TableRow>
                )}
                {report.lines.map((line) => (
                  <Fragment key={line.instructorId}>
                    <InstructorRow
                      line={line}
                      expanded={expanded.has(line.instructorId)}
                      onToggle={() => toggle(line.instructorId)}
                    />
                    {expanded.has(line.instructorId) && <DetailRow line={line} />}
                  </Fragment>
                ))}
                <TableRow className="font-semibold" data-testid="hours-total">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{report.totalSessions}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {hoursLabel(report.totalMinutes)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={saveState.busy} onClick={() => exportCsv(false)}>
                <FileText aria-hidden />
                Exporter le récapitulatif (CSV)
              </Button>
              <Button variant="outline" disabled={saveState.busy} onClick={() => exportCsv(true)}>
                <FileText aria-hidden />
                Exporter le détail des séances (CSV)
              </Button>
              <Button variant="outline" disabled={saveState.busy} onClick={exportXlsx}>
                <FileSpreadsheet aria-hidden />
                Exporter en Excel
              </Button>
            </div>
            <SaveStatus state={saveState} onOpen={open} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InstructorRow({
  line,
  expanded,
  onToggle,
}: {
  line: HoursLine;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = expanded ? ChevronDown : ChevronRight;
  return (
    <TableRow data-testid="hours-row">
      <TableCell>
        <button
          type="button"
          className="flex items-center gap-2 rounded-sm text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={expanded}
          onClick={onToggle}
        >
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          <span
            className="inline-flex h-5 min-w-8 items-center justify-center rounded px-1 font-semibold text-white text-xs"
            style={{ backgroundColor: line.color }}
          >
            {line.initials}
          </span>
          {line.name}
        </button>
      </TableCell>
      <TableCell className="text-right tabular-nums">{line.sessions}</TableCell>
      <TableCell className="text-right tabular-nums">{hoursLabel(line.minutes)}</TableCell>
    </TableRow>
  );
}

function DetailRow({ line }: { line: HoursLine }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={3} className="bg-muted/30 p-0">
        {line.details.length === 0 ? (
          <p className="px-10 py-3 text-muted-foreground text-sm">Aucune séance sur la période.</p>
        ) : (
          <Table aria-label={`Séances de ${line.name}`} className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-10">Date</TableHead>
                <TableHead>Horaire</TableHead>
                <TableHead>Groupe</TableHead>
                <TableHead>Court</TableHead>
                <TableHead>Remarque</TableHead>
                <TableHead className="text-right">Durée</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {line.details.map((d) => (
                <TableRow key={d.key}>
                  <TableCell className={cn("whitespace-nowrap pl-10")}>
                    {weekdayLabel(d.weekday)} {formatDate(d.date)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {d.startTime}–{d.endTime}
                  </TableCell>
                  <TableCell>{d.groupName}</TableCell>
                  <TableCell>{d.courtName}</TableCell>
                  <TableCell>{d.remark}</TableCell>
                  <TableCell className="text-right tabular-nums">{hoursLabel(d.minutes)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCell>
    </TableRow>
  );
}
