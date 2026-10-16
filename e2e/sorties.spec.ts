import { readFile } from "node:fs/promises";
import { type Download, expect, type Page, test } from "@playwright/test";
import { createSeason, demoClub, goToPlanning, seedPlanning } from "./support/planning";

/**
 * Sorties (lot L6) : récapitulatif des heures, aperçu des PDF et exports
 * CSV / Excel. Hors de Tauri, l'enregistrement passe par un téléchargement.
 *
 * Club de démonstration : Karim assure « Galaxie vert » le lundi (1 h),
 * Julie « Ados perfectionnement » le mercredi (1 h 30). Vacances de la
 * Toussaint du 17/10 au 01/11/2026, séance du lundi 02/11 annulée, Marc
 * remplace Julie le mercredi 04/11.
 */
const club = {
  ...demoClub,
  closures: [{ label: "Vacances de la Toussaint", startDate: "2026-10-17", endDate: "2026-11-01" }],
  exceptions: [
    { kind: "cancellation" as const, group: "Galaxie vert", occurrenceDate: "2026-11-02" },
    {
      kind: "replacement" as const,
      group: "Ados perfectionnement",
      occurrenceDate: "2026-11-04",
      instructor: "Marc",
    },
  ],
};

async function openClub(page: Page) {
  await createSeason(page);
  await seedPlanning(page, club);
}

function navigate(page: Page, name: string) {
  return page
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("link", { name })
    .click();
}

/** Attend le téléchargement du fichier `name` (l'aperçu PDF peut en déclencher d'autres). */
function waitForFile(page: Page, name: string): Promise<Download> {
  return page.waitForEvent("download", (d) => d.suggestedFilename() === name);
}

async function downloaded(download: Download): Promise<Buffer> {
  const path = await download.path();
  if (!path) throw new Error("téléchargement introuvable");
  return readFile(path);
}

test.beforeEach(async ({ page }) => {
  // Aujourd'hui : mercredi 04/11/2026.
  await page.clock.setFixedTime(new Date("2026-11-04T10:00:00+01:00"));
});

test.describe("sorties", () => {
  test("récapitulatif des heures sur une période avec vacances, annulation et remplacement", async ({
    page,
  }) => {
    await openClub(page);
    await navigate(page, "Heures");
    await expect(
      page.getByRole("heading", { level: 1, name: "Récapitulatif des heures" }),
    ).toBeVisible();

    await page.getByLabel("Du").fill("2026-10-15");
    await page.getByLabel("Au").fill("2026-11-15");
    const table = page.getByRole("table", { name: "Heures par moniteur" });
    const rows = table.getByTestId("hours-row");
    // 19/10, 26/10, 21/10 et 28/10 fermés ; 02/11 annulé ; 04/11 assuré par Marc.
    await expect(rows).toHaveText([
      "KBKarim Benali11 h",
      "MLMarc Leroy11 h 30",
      "JMJulie Martin11 h 30",
    ]);
    await expect(table.getByTestId("hours-total")).toHaveText("Total34 h");

    await table.getByRole("button", { name: /Marc Leroy/ }).click();
    const detail = page.getByRole("table", { name: "Séances de Marc Leroy" });
    await expect(detail).toContainText("Mercredi 04/11/2026");
    await expect(detail).toContainText("Remplace JM");

    // Export CSV du récapitulatif.
    const file = waitForFile(page, "heures-2026-10-15-2026-11-15.csv");
    await page.getByText("Détails techniques").click();
    await page.getByRole("button", { name: "Exporter le récapitulatif (CSV)" }).click();
    const csv = (await downloaded(await file)).toString("utf8");
    expect(csv.startsWith("﻿Moniteur;Initiales;Séances;Minutes;Heures;Période\r\n")).toBe(true);
    expect(csv).toContain("Marc Leroy;ML;1;90;1,5;15/10/2026 → 15/11/2026");
    expect(csv).toContain("Total;;3;240;4;");
    await expect(page.getByTestId("output-saved")).toHaveText(
      "Téléchargé : heures-2026-10-15-2026-11-15.csv",
    );

    // Export Excel : récapitulatif et détail, un onglet chacun.
    const xlsx = waitForFile(page, "heures-2026-10-15-2026-11-15.xlsx");
    await page.getByRole("button", { name: "Exporter vers Excel" }).click();
    expect((await downloaded(await xlsx)).subarray(0, 2).toString("latin1")).toBe("PK");

    // Raccourci « Saison ».
    await page.getByRole("button", { name: "Saison" }).click();
    await expect(page.getByLabel("Du")).toHaveValue("2026-09-01");
    await expect(page.getByLabel("Au")).toHaveValue("2027-06-30");
  });

  test("aperçu et enregistrement du PDF de la semaine (Ctrl/Cmd+P)", async ({ page }) => {
    await openClub(page);
    await goToPlanning(page);

    await page.keyboard.press("ControlOrMeta+p");
    const dialog = page.getByRole("dialog", { name: /PDF de la semaine/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId("pdf-info")).toHaveText(
      "planning-semaine-type-2026-2027-a4.pdf — 1 page",
    );
    await expect(dialog.getByTitle("Aperçu du PDF")).toHaveAttribute("src", /^blob:/);

    await dialog.getByLabel("Format").selectOption("A3");
    await expect(dialog.getByTestId("pdf-info")).toHaveText(
      "planning-semaine-type-2026-2027-a3.pdf — 1 page",
    );
    const file = waitForFile(page, "planning-semaine-type-2026-2027-a3.pdf");
    await dialog.getByRole("button", { name: "Enregistrer le PDF…" }).click();
    const bytes = await downloaded(await file);
    expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    await expect(dialog.getByTestId("output-saved")).toHaveText(
      "Téléchargé : planning-semaine-type-2026-2027-a3.pdf",
    );
    await dialog.getByRole("button", { name: "Fermer l'aperçu" }).click();
    await expect(dialog).toBeHidden();

    // Bouton « PDF » de l'en-tête, en semaine datée.
    await page
      .getByRole("group", { name: "Mode d'affichage" })
      .getByRole("button", { name: "Une semaine précise" })
      .click();
    await page.getByRole("button", { name: "PDF", exact: true }).click();
    await expect(
      page.getByRole("dialog", {
        name: "PDF de la semaine — Semaine du 02/11/2026 au 08/11/2026",
      }),
    ).toBeVisible();
    await expect(page.getByTestId("pdf-info")).toHaveText(
      "planning-semaine-2026-11-02-a3.pdf — 1 page",
    );
  });

  test("documents PDF et exports de l'écran Import/Export", async ({ page }) => {
    await openClub(page);
    await navigate(page, "Import/Export");
    await expect(page.getByText("Documents PDF", { exact: true })).toBeVisible();

    // Planning par moniteur, semaine datée du 02/11 : Karim (annulé), Julie (remplacée), Marc.
    await page.getByLabel("Planning", { exact: true }).selectOption("dated");
    await page.getByLabel("Semaine du").fill("2026-11-04");
    await page.getByRole("button", { name: "PDF par moniteur…" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Planning de tous les moniteurs — Semaine du 02/11/2026");
    await expect(dialog.getByTestId("pdf-info")).toHaveText(
      "planning-moniteurs-semaine-2026-11-02.pdf — 3 pages",
    );
    await dialog.getByRole("button", { name: "Fermer l'aperçu" }).click();

    // Feuilles d'appel de tous les groupes actifs, puis d'un seul.
    await page.getByRole("button", { name: "Feuilles d'appel…" }).click();
    await expect(dialog.getByTestId("pdf-info")).toHaveText(
      "feuilles-appel-2026-2027.pdf — 4 pages",
    );
    await dialog.getByRole("button", { name: "Fermer l'aperçu" }).click();
    await page.getByLabel("Groupe", { exact: true }).selectOption({ label: "Galaxie vert" });
    await page.getByRole("button", { name: "Feuilles d'appel…" }).click();
    await expect(dialog.getByTestId("pdf-info")).toHaveText(
      "feuille-appel-galaxie-vert.pdf — 1 page",
    );
    const pdf = waitForFile(page, "feuille-appel-galaxie-vert.pdf");
    await dialog.getByRole("button", { name: "Enregistrer le PDF…" }).click();
    expect((await downloaded(await pdf)).subarray(0, 5).toString("latin1")).toBe("%PDF-");
    await dialog.getByRole("button", { name: "Fermer l'aperçu" }).click();

    // Exports CSV et Excel.
    const csvFile = waitForFile(page, "cours-2026-2027.csv");
    await page.getByText("Détails techniques").first().click();
    await page.getByRole("button", { name: "Exporter cours en CSV" }).click();
    const csv = (await downloaded(await csvFile)).toString("utf8");
    expect(csv).toContain(
      "Lundi;10:00;11:00;60;Court 1;Galaxie vert;Karim Benali;KB;01/09/2026;;\r\n",
    );
    await expect(page.getByTestId("output-saved")).toHaveText("Téléchargé : cours-2026-2027.csv");

    const groupsFile = waitForFile(page, "groupes-2026-2027.csv");
    await page.getByRole("button", { name: "Exporter groupes en CSV" }).click();
    expect((await downloaded(await groupsFile)).toString("utf8")).toContain(
      "Adultes débutants;;;;3;2;oui;",
    );

    const xlsxFile = waitForFile(page, "eleves-2026-2027.xlsx");
    await page.getByRole("button", { name: "Exporter vers Excel : élèves" }).click();
    expect((await downloaded(await xlsxFile)).subarray(0, 2).toString("latin1")).toBe("PK");
  });
});
