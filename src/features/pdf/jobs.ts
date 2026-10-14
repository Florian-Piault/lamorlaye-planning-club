import type { Lesson } from "@/db/schema";
import {
  buildAttendanceSheets,
  buildInstructorSheets,
  buildWeekSheet,
  fullName,
  type OutputReferences,
  type OutputSeason,
  type OutputStudent,
  type PaperSize,
  pdfFileNames,
  type WeekContext,
  weekTitle,
} from "./model";
import type { PdfJob } from "./PdfPreviewDialog";
import { renderPdf } from "./render";

/** Planning de la semaine (type ou datée), A4 ou A3 paysage. */
export function weekPdfJob(ctx: WeekContext, paper: PaperSize): PdfJob {
  const title = `Planning — ${weekTitle(ctx.mode, ctx.season)}`;
  return {
    title: `PDF de la semaine — ${weekTitle(ctx.mode, ctx.season)}`,
    fileName: pdfFileNames.week(ctx.mode, ctx.season, paper),
    render: () =>
      renderPdf(
        { kind: "week", sheet: buildWeekSheet(ctx), paper },
        { title, seasonName: ctx.season.name, printedOn: ctx.today },
      ),
  };
}

/** Planning d'un moniteur, ou de tous les moniteurs (une page chacun, un seul fichier). */
export function instructorsPdfJob(ctx: WeekContext, instructorId: string | null): PdfJob {
  const instructor = instructorId
    ? ctx.refs.instructors.find((i) => i.id === instructorId)
    : undefined;
  const who = instructor ? fullName(instructor) : "tous les moniteurs";
  const title = `Planning de ${who} — ${weekTitle(ctx.mode, ctx.season)}`;
  return {
    title,
    fileName: pdfFileNames.instructors(ctx.mode, ctx.season, instructor),
    render: async () => {
      const sheets = buildInstructorSheets(ctx, instructorId ? [instructorId] : undefined);
      if (sheets.length === 0) throw new Error("Aucun moniteur n'a de séance cette semaine.");
      return renderPdf(
        { kind: "instructors", sheets },
        { title, seasonName: ctx.season.name, printedOn: ctx.today },
      );
    },
  };
}

/** Feuilles d'appel d'un groupe, ou de tous les groupes actifs (une page chacun). */
export function attendancePdfJob(input: {
  season: OutputSeason;
  lessons: readonly Lesson[];
  refs: OutputReferences;
  students: readonly OutputStudent[];
  today: string;
  groupId: string | null;
}): PdfJob {
  const group = input.groupId ? input.refs.groups.find((g) => g.id === input.groupId) : undefined;
  const title = group ? `Feuille d'appel — ${group.name}` : "Feuilles d'appel — tous les groupes";
  return {
    title,
    fileName: pdfFileNames.attendance(input.season, group),
    render: async () => {
      const sheets = buildAttendanceSheets({
        ...input,
        groupIds: input.groupId ? [input.groupId] : undefined,
      });
      if (sheets.length === 0) throw new Error("Aucun groupe actif dans la saison.");
      return renderPdf(
        { kind: "attendance", sheets },
        { title, seasonName: input.season.name, printedOn: input.today },
      );
    },
  };
}
