// @vitest-environment node
/**
 * Génération réelle des PDF en Node (même moteur @react-pdf que dans
 * l'application) et vérification sommaire : nombre de pages et texte présent,
 * relu avec pdf.js.
 */
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import { OUTPUT_REFS, OUTPUT_SEASON, OUTPUT_STATE, OUTPUT_STUDENTS } from "@/test/outputs";
import {
  buildAttendanceSheets,
  buildInstructorSheets,
  buildWeekSheet,
  type WeekContext,
} from "./model";
import { countPdfPages, type DocumentMeta, renderPdf } from "./render";

const meta: DocumentMeta = { title: "Test", seasonName: "2026-2027", printedOn: "2026-10-15" };

const context = (overrides: Partial<WeekContext> = {}): WeekContext => ({
  season: OUTPUT_SEASON,
  state: OUTPUT_STATE,
  refs: OUTPUT_REFS,
  mode: { kind: "dated", monday: "2026-11-02" },
  today: "2026-10-15",
  ...overrides,
});

/** Texte de chaque page, extrait par pdf.js. */
async function pagesText(bytes: Uint8Array): Promise<string[]> {
  const task = getDocument({ data: bytes.slice(), useSystemFonts: false });
  const document = await task.promise;
  const pages: string[] = [];
  for (let i = 1; i <= document.numPages; i++) {
    const page = await document.getPage(i);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " "),
    );
  }
  await task.destroy();
  return pages;
}

describe("rendu des PDF", () => {
  it("produit le planning de la semaine datée en A4 et en A3", async () => {
    const sheet = buildWeekSheet(context());
    const a4 = await renderPdf({ kind: "week", sheet, paper: "A4" }, meta);
    expect(new TextDecoder().decode(a4.subarray(0, 5))).toBe("%PDF-");
    expect(countPdfPages(a4)).toBe(1);
    const [text] = await pagesText(a4);
    expect(text).toContain("Semaine du 02/11/2026 au 08/11/2026");
    expect(text).toContain("Galaxie vert");
    expect(text).toContain("ANNULÉ");
    expect(text).toContain("Rempl. KB");
    // Initiales et légende, lisibles en noir et blanc.
    expect(text).toContain("ML");
    expect(text).toContain("Marc Leroy — 1 h");
    expect(text).toContain("Page 1 / 1");

    const a3 = await renderPdf({ kind: "week", sheet, paper: "A3" }, meta);
    expect(countPdfPages(a3)).toBe(1);
    const task = getDocument({ data: a3.slice() });
    const page = await (await task.promise).getPage(1);
    // A3 paysage : 1191 × 842 points.
    expect(page.view.map(Math.round)).toEqual([0, 0, 1191, 842]);
    await task.destroy();
  });

  it("produit le planning par moniteur, une page par moniteur", async () => {
    const sheets = buildInstructorSheets(context());
    const bytes = await renderPdf({ kind: "instructors", sheets }, meta);
    expect(countPdfPages(bytes)).toBe(sheets.length);
    const pages = await pagesText(bytes);
    expect(pages[0]).toContain("Planning de Karim Benali (KB)");
    expect(pages[0]).toContain("Remplacé(e) par Marc Leroy");
    // Aucun caractère perdu d'un document à l'autre (police propre à chaque document).
    expect(pages[0]).toContain("Élèves");
    expect(pages[0]).toContain("Total : 0 h (0 séance)");
    expect(pages.join(" ")).toContain("Planning de Julie Martin (JM)");
  });

  it("produit les feuilles d'appel, une page par groupe", async () => {
    const sheets = buildAttendanceSheets({
      season: OUTPUT_SEASON,
      lessons: OUTPUT_STATE.lessons,
      refs: OUTPUT_REFS,
      students: OUTPUT_STUDENTS,
      today: "2026-10-15",
    });
    const bytes = await renderPdf({ kind: "attendance", sheets }, meta);
    expect(countPdfPages(bytes)).toBe(2);
    const pages = await pagesText(bytes);
    expect(pages[1]).toContain("Feuille d'appel — Galaxie vert");
    expect(pages[1]).toContain("DURAND Zoé");
    expect(pages[1]).toContain("BERNARD Tom");
    expect(pages[1]).toContain("ÉLUARD Léa");
    expect(pages[1]).toContain("Claire Durand — 06 99 88 77 66");
  });

  it("compte les pages d'un PDF", () => {
    const fake = new TextEncoder().encode(
      "<< /Type /Pages /Kids [1 0 R 2 0 R] >> << /Type /Page >> << /Type/Page /Parent 3 0 R >>",
    );
    expect(countPdfPages(fake)).toBe(2);
    expect(countPdfPages(new Uint8Array())).toBe(0);
  });
});
