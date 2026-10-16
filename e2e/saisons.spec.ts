import { type Download, expect, type Page, test } from "@playwright/test";
import {
  createSeason,
  demoClub,
  dragMouse,
  goToPlanning,
  grabPoint,
  lesson,
  readLessons,
  seedPlanning,
  slotPoint,
  tryWritingSeason,
} from "./support/planning";

/**
 * Saisons et RGPD (lot L7) : nouvelle saison par duplication, consultation
 * d'une saison archivée en lecture seule, export et suppression définitive
 * des données d'un élève. Club de démonstration : 2 courts, 3 moniteurs,
 * 4 groupes, 8 élèves (nom « Test »), 2 cours.
 */

const club = {
  ...demoClub,
  closures: [{ label: "Vacances de la Toussaint", startDate: "2026-10-17", endDate: "2026-11-01" }],
  unavailabilities: [
    {
      instructor: "Julie",
      startsAt: "2026-11-09T00:00",
      endsAt: "2026-11-10T00:00",
      reason: "Tournoi",
    },
  ],
};

function nav(page: Page, name: string) {
  return page
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("link", { name });
}

function tab(page: Page, name: string) {
  return page.getByRole("navigation", { name: "Fiches du club" }).getByRole("link", { name });
}

/** Saison 2026-2027 avec le club, puis duplication vers 2027-2028 par l'interface. */
async function duplicateClub(page: Page) {
  await createSeason(page);
  await seedPlanning(page, club);
  await page.getByRole("button", { name: "Nouvelle saison" }).click();
  const dialog = page.getByRole("dialog", { name: "Nouvelle saison" });
  await expect(dialog.getByLabel("Dupliquer la saison 2026-2027")).toBeChecked();
  await expect(dialog.getByLabel("Nom", { exact: true })).toHaveValue("2027-2028");
  await expect(dialog.getByLabel("Date de début")).toHaveValue("2027-09-01");
  await dialog.getByRole("button", { name: "Dupliquer la saison" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("toast")).toHaveText(
    "Saison « 2027-2028 » créée par duplication : 2 courts, 3 moniteurs, 4 groupes, 8 élèves, 2 cours repris.",
  );
}

async function viewSeason(page: Page, label: string) {
  await page.getByLabel("Saison affichée").selectOption({ label });
}

function waitForFile(page: Page, name: string): Promise<Download> {
  return page.waitForEvent("download", (d) => d.suggestedFilename() === name);
}

async function downloaded(download: Download): Promise<string> {
  const path = await download.path();
  const { readFile } = await import("node:fs/promises");
  return readFile(path, "utf8");
}

test.describe("saisons", () => {
  test("duplique la saison, puis modifie la nouvelle sans effet sur l'ancienne", async ({
    page,
  }) => {
    await duplicateClub(page);
    const seasons = page.getByRole("table", { name: "Saisons" });
    await expect(seasons.getByRole("row", { name: /2027-2028/ })).toContainText("En cours");
    await expect(seasons.getByRole("row", { name: /2026-2027/ })).toContainText("Terminée");
    await expect(page.getByLabel("Saison affichée")).toHaveValue(/.+/);
    await expect(page.getByTestId("read-only-banner")).toHaveCount(0);

    // La semaine type est reprise ; ni fermetures ni indisponibilités datées.
    expect(await readLessons(page)).toHaveLength(2);
    await tab(page, "Fermetures").click();
    await expect(page.getByText("Aucune période de fermeture.", { exact: false })).toBeVisible();
    await tab(page, "Moniteurs").click();
    await page.getByRole("link", { name: "Martin Julie" }).click();
    await expect(page.getByText("Aucune indisponibilité.")).toBeVisible();
    await expect(page.getByRole("list", { name: "Horaires de disponibilité" })).toContainText(
      "16:00–21:00",
    );

    // Modifications de la nouvelle saison.
    await tab(page, "Courts").click();
    await page.getByRole("button", { name: "Modifier Court 1" }).click();
    const courtDialog = page.getByRole("dialog", { name: "Modifier le court" });
    await courtDialog.getByLabel("Nom").fill("Court central");
    await courtDialog.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Court central")).toBeVisible();
    await tab(page, "Élèves").click();
    await page.getByRole("button", { name: "Supprimer Test Tom" }).click();
    await page
      .getByRole("dialog", { name: "Supprimer Test Tom ?" })
      .getByRole("button", {
        name: "Supprimer",
      })
      .click();
    await expect(page.getByTestId("student-count")).toHaveText("7 élèves");
    await goToPlanning(page);
    const from = await grabPoint(lesson(page, "Galaxie vert"));
    const to = await slotPoint(page, 1, 0, "10:15");
    await dragMouse(page, from, to);
    await expect
      .poll(() => readLessons(page))
      .toContainEqual(expect.objectContaining({ group: "Galaxie vert", weekday: 2 }));

    // La saison d'origine est intacte.
    expect(await readLessons(page, "2026-2027")).toContainEqual(
      expect.objectContaining({ group: "Galaxie vert", weekday: 1, startTime: "10:00" }),
    );
    await viewSeason(page, "2026-2027 (terminée)");
    await expect(page.getByTestId("read-only-banner")).toContainText("2026-2027");
    await nav(page, "Le club").click();
    await tab(page, "Courts").click();
    await expect(page.getByRole("list", { name: "Courts" })).toContainText("Court 1");
    await expect(page.getByText("Court central")).toHaveCount(0);
    await tab(page, "Élèves").click();
    await expect(page.getByTestId("student-count")).toHaveText("8 élèves");
    await tab(page, "Fermetures").click();
    await expect(page.getByText("Vacances de la Toussaint")).toBeVisible();

    // Retour à la saison active.
    await page.getByRole("button", { name: "Revenir à la saison 2027-2028" }).click();
    await expect(page.getByTestId("read-only-banner")).toHaveCount(0);
    await expect(page.getByText("Aucune période de fermeture.", { exact: false })).toBeVisible();
  });

  test("une saison archivée n'est modifiable par aucun écran", async ({ page }) => {
    await duplicateClub(page);
    await viewSeason(page, "2026-2027 (terminée)");
    await expect(page.getByTestId("read-only-banner")).toBeVisible();

    // Saison.
    await expect(
      page.getByText("Consultation seulement (saison terminée) : ses fiches"),
    ).toBeVisible();
    await expect(page.getByRole("form", { name: "Saison" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Nouvelle saison" })).toHaveCount(0);

    // Courts.
    await tab(page, "Courts").click();
    await expect(page.getByRole("list", { name: "Courts" })).toContainText("Court 1");
    for (const name of [
      "Nouveau court",
      "Modifier Court 1",
      "Supprimer Court 1",
      "Déplacer Court 1",
    ]) {
      await expect(page.getByRole("button", { name })).toHaveCount(0);
    }

    // Moniteurs, disponibilités et indisponibilités.
    await tab(page, "Moniteurs").click();
    await expect(page.getByRole("link", { name: "Martin Julie" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Nouveau moniteur" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Supprimer/ })).toHaveCount(0);
    await page.getByRole("link", { name: "Martin Julie" }).click();
    await expect(page.getByRole("heading", { name: "Julie Martin" })).toBeVisible();
    const fiche = page.getByRole("form", { name: "Fiche moniteur" });
    await expect(fiche.getByLabel("Prénom")).toBeDisabled();
    await expect(fiche.getByRole("button", { name: "Enregistrer" })).toHaveCount(0);
    await expect(page.getByText(/Tournoi/)).toBeVisible();
    for (const name of [
      "Supprimer",
      "Ajouter un horaire",
      "Ajouter l'indisponibilité",
      "Retirer lundi 16:00–21:00",
    ]) {
      await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
    }
    await expect(page.getByRole("button", { name: /Modifier l'indisponibilité/ })).toHaveCount(0);
    // Peindre la grille des disponibilités n'a aucun effet.
    const cell = page.locator('[data-weekday="2"][data-time="10:00"]');
    await expect(cell).toHaveAttribute("data-available", "false");
    await cell.click();
    await expect(cell).toHaveAttribute("data-available", "false");

    // Niveaux (communs, en lecture seule pendant la consultation).
    await tab(page, "Niveaux").click();
    await expect(page.getByRole("list", { name: "Niveaux" })).toContainText("Galaxie blanc");
    await expect(page.getByRole("button", { name: "Nouveau niveau" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^(Modifier|Supprimer|Déplacer)/ })).toHaveCount(
      0,
    );

    // Groupes et composition.
    await tab(page, "Groupes").click();
    await expect(page.getByRole("button", { name: "Nouveau groupe" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Supprimer/ })).toHaveCount(0);
    await page.getByRole("link", { name: "Galaxie vert" }).click();
    await expect(page.getByTestId("group-size")).toHaveText("3 / 8");
    await expect(page.getByRole("form", { name: "Fiche groupe" }).getByLabel("Nom")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Enregistrer" })).toHaveCount(0);
    await expect(page.getByRole("searchbox")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Retirer/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Supprimer Galaxie vert" })).toHaveCount(0);

    // Élèves : consultation de la fiche, export possible, suppression impossible.
    await tab(page, "Élèves").click();
    await expect(page.getByTestId("student-count")).toHaveText("8 élèves");
    await expect(page.getByRole("button", { name: "Nouvel élève" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^(Modifier|Supprimer) / })).toHaveCount(0);
    await page.getByRole("button", { name: "Test Léa", exact: true }).click();
    const fiche2 = page.getByRole("dialog", { name: "Fiche élève" });
    await expect(fiche2.getByLabel("Nom", { exact: true })).toBeDisabled();
    await expect(fiche2.getByRole("button", { name: /Enregistrer|Créer/ })).toHaveCount(0);
    await fiche2.getByRole("button", { name: "Fermer" }).last().click();
    await page.getByRole("button", { name: "Données personnelles de Test Léa" }).click();
    const privacy = page.getByRole("dialog", { name: "Données personnelles" });
    await expect(privacy.getByRole("button", { name: "Exporter ses données" })).toBeVisible();
    await expect(privacy.getByRole("button", { name: /Supprimer définitivement/ })).toHaveCount(0);
    await privacy.getByRole("button", { name: "Fermer" }).last().click();

    // Fermetures.
    await tab(page, "Fermetures").click();
    await expect(page.getByText("Vacances de la Toussaint")).toBeVisible();
    for (const name of [
      "Nouvelle fermeture",
      "Vacances et jours fériés…",
      "Modifier Vacances de la Toussaint",
      "Supprimer Vacances de la Toussaint",
    ]) {
      await expect(page.getByRole("button", { name })).toHaveCount(0);
    }

    // Import.
    await nav(page, "Import/Export").click();
    await expect(page.getByTestId("import-read-only")).toBeVisible();
    await expect(page.getByRole("button", { name: /Choisir un fichier|Importer/ })).toHaveCount(0);

    // Planning : ni boutons, ni panneau d'édition, ni gestes, ni raccourcis.
    const before = await readLessons(page, "2026-2027");
    await goToPlanning(page);
    await expect(page.getByTestId("planning-read-only")).toBeVisible();
    for (const name of ["Nouveau cours", "Annuler", "Rétablir"]) {
      await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
    }
    await expect(lesson(page, "Galaxie vert")).toHaveAttribute("data-locked", "true");
    await expect(page.getByTestId("resize-handle")).toHaveCount(0);
    await lesson(page, "Galaxie vert").click();
    const detail = page.getByRole("form", { name: "Détail du cours" });
    await expect(detail).toBeVisible();
    await expect(detail.getByLabel("Moniteur")).toBeDisabled();
    await expect(
      detail.getByRole("button", { name: /Enregistrer|Supprimer|Appliquer/ }),
    ).toHaveCount(0);
    // Suppr, Ctrl/Cmd+Z, Ctrl/Cmd+N : sans effet.
    await page.keyboard.press("Delete");
    await page.keyboard.press("ControlOrMeta+z");
    await detail.getByRole("button", { name: "Fermer le panneau" }).click();
    await page.keyboard.press("ControlOrMeta+n");
    await expect(page.getByRole("form", { name: "Nouveau cours" })).toHaveCount(0);
    // Glisser un cours ou sélectionner un créneau : sans effet.
    await dragMouse(
      page,
      await grabPoint(lesson(page, "Galaxie vert")),
      await slotPoint(page, 1, 1, "11:00"),
    );
    await dragMouse(
      page,
      await slotPoint(page, 4, 0, "14:00"),
      await slotPoint(page, 4, 0, "15:00"),
    );
    await expect(page.getByRole("form", { name: "Nouveau cours" })).toHaveCount(0);
    // Semaine datée : aucune action sur la séance.
    await page.getByRole("button", { name: "Une semaine précise" }).first().click();
    await expect(page.getByTestId("mode-bar")).toHaveAttribute("data-mode", "dated");
    await expect(page.getByTestId("mode-bar")).toContainText(
      "Consultation seulement (saison terminée)",
    );
    await lesson(page, "Galaxie vert").click();
    const side = page.getByRole("complementary", { name: "Panneau latéral" });
    await expect(side.getByRole("form", { name: "Détail du cours" })).toBeVisible();
    await expect(side.getByRole("button")).toHaveText(["", "Fermer"]);
    expect(await readLessons(page, "2026-2027")).toEqual(before);

    // Refus au niveau des repositories et de la persistance des commandes.
    const refusals = await tryWritingSeason(page, "2026-2027");
    expect(refusals).toHaveLength(3);
    for (const message of refusals) expect(message).toMatch(/terminée/);
    expect(await tryWritingSeason(page, "2027-2028")).toEqual(["ok", "ok", "ok"]);
  });
});

test.describe("RGPD", () => {
  test("exporte les données d'un élève de toutes les saisons", async ({ page }) => {
    await duplicateClub(page);
    await tab(page, "Élèves").click();
    await page.getByRole("button", { name: "Données personnelles de Test Hugo" }).click();
    const dialog = page.getByRole("dialog", { name: "Données personnelles" });
    const records = dialog.getByRole("list", { name: "Fiches de l'élève" });
    await expect(records.getByRole("listitem")).toHaveCount(2);
    await expect(records).toContainText("Saison 2026-2027");
    await expect(records).toContainText("Groupes : Ados perfectionnement");
    const file = waitForFile(page, "donnees-test-hugo.json");
    await dialog.getByRole("button", { name: "Exporter ses données" }).click();
    const json = JSON.parse(await downloaded(await file));
    expect(json.personne).toEqual({ nom: "Test", prénom: "Hugo", dateDeNaissance: null });
    expect(
      json.saisons.map((s: { saison: { nom: string; statut: string } }) => [
        s.saison.nom,
        s.saison.statut,
      ]),
    ).toEqual([
      ["2026-2027", "terminée"],
      ["2027-2028", "en cours"],
    ]);
    expect(json.saisons[1].fiche.téléphone).toBe("0600000000");
    expect(json.saisons[1].groupes).toEqual([{ nom: "Ados perfectionnement", niveau: null }]);
    await expect(dialog.getByTestId("output-saved")).toHaveText(
      "Téléchargé : donnees-test-hugo.json",
    );
  });

  test("supprime définitivement un élève, y compris de ses groupes et des saisons archivées", async ({
    page,
  }) => {
    await duplicateClub(page);
    await tab(page, "Élèves").click();
    await page.getByRole("button", { name: "Données personnelles de Test Léa" }).click();
    const dialog = page.getByRole("dialog", { name: "Données personnelles" });
    await dialog.getByRole("button", { name: "Supprimer définitivement…" }).click();
    const confirm = dialog.getByRole("button", { name: "Supprimer définitivement", exact: true });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel(/Je confirme la suppression définitive/).check();
    await confirm.click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("toast")).toHaveText(
      "Données de l'élève supprimées définitivement (2 fiches).",
    );
    await expect(page.getByTestId("student-count")).toHaveText("7 élèves");
    await expect(page.getByRole("button", { name: "Test Léa", exact: true })).toHaveCount(0);

    // Retirée de ses groupes, dans la saison active comme dans l'archive.
    await tab(page, "Groupes").click();
    await page.getByRole("link", { name: "Galaxie vert" }).click();
    await expect(page.getByTestId("group-size")).toHaveText("2 / 8");
    await viewSeason(page, "2026-2027 (terminée)");
    await tab(page, "Élèves").click();
    await expect(page.getByTestId("student-count")).toHaveText("7 élèves");
    await tab(page, "Groupes").click();
    await page.getByRole("link", { name: "Galaxie vert" }).click();
    await expect(page.getByTestId("group-size")).toHaveText("2 / 8");

    // Recherche RGPD toutes saisons (Réglages) : plus aucune trace.
    await nav(page, "Réglages").click();
    const search = page.getByRole("searchbox", { name: "Rechercher un élève (toutes saisons)" });
    await search.fill("Léa");
    await expect(page.getByText("Aucun élève trouvé.")).toBeVisible();
    await search.fill("Zoé");
    await expect(page.getByRole("list", { name: "Élèves trouvés" })).toContainText(
      "Test Zoé — 2027-2028, 2026-2027",
    );
  });

  test("efface depuis les réglages un ancien élève présent seulement dans une archive", async ({
    page,
  }) => {
    await duplicateClub(page);
    // Paul quitte le club : supprimé de la nouvelle saison, il reste dans l'archive.
    await tab(page, "Élèves").click();
    await page.getByRole("button", { name: "Supprimer Test Paul" }).click();
    await page
      .getByRole("dialog", { name: "Supprimer Test Paul ?" })
      .getByRole("button", {
        name: "Supprimer",
      })
      .click();
    await nav(page, "Réglages").click();
    await page
      .getByRole("searchbox", { name: "Rechercher un élève (toutes saisons)" })
      .fill("paul");
    await page.getByRole("button", { name: "Données personnelles de Test Paul" }).click();
    const dialog = page.getByRole("dialog", { name: "Données personnelles" });
    await expect(dialog.getByRole("list", { name: "Fiches de l'élève" })).toContainText("Terminée");
    await dialog.getByRole("button", { name: "Supprimer définitivement…" }).click();
    await dialog.getByLabel(/Je confirme la suppression définitive/).check();
    await dialog.getByRole("button", { name: "Supprimer définitivement", exact: true }).click();
    await expect(page.getByTestId("toast")).toHaveText(
      "Données supprimées définitivement (1 fiche).",
    );
    await viewSeason(page, "2026-2027 (terminée)");
    await nav(page, "Le club").click();
    await tab(page, "Élèves").click();
    await expect(page.getByTestId("student-count")).toHaveText("7 élèves");
  });
});
