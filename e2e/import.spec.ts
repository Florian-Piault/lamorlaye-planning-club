import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { createSeason, seedPlanning } from "./support/planning";

/**
 * Import d'élèves (lot L5). Le fichier de test est un CSV Windows-1252 séparé
 * par des points-virgules (export Excel « CSV » typique), avec des lignes
 * invalides, un élève déjà enregistré et un groupe inconnu.
 */

const FIXTURE = fileURLToPath(new URL("./fixtures/eleves-windows1252.csv", import.meta.url));

function navigate(page: Page, name: string) {
  return page
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("link", { name })
    .click();
}

async function openImport(page: Page) {
  await createSeason(page);
  // « Test Léa » (sans date de naissance) est déjà enregistrée, dans « Galaxie vert ».
  await seedPlanning(page, {
    courts: [],
    instructors: [],
    lessons: [],
    groups: [
      { name: "Galaxie vert", maxSize: 8, students: ["Léa"] },
      { name: "Ados perfectionnement", maxSize: 6, students: ["Hugo"] },
    ],
  });
  await navigate(page, "Import/Export");
  await expect(page.getByRole("heading", { name: "Import/Export" })).toBeVisible();
}

test.describe("import d'élèves", () => {
  test("importe un fichier, signale les lignes invalides et annule l'import", async ({ page }) => {
    await openImport(page);

    // 1. Fichier.
    await page.getByLabel("Fichier à importer", { exact: true }).setInputFiles(FIXTURE);
    await expect(page.getByTestId("import-file-info")).toContainText(
      "eleves-windows1252.csv — CSV, séparateur « ; », encodage Windows-1252, 7 lignes de données.",
    );

    // 2. Correspondance proposée d'après les en-têtes.
    const mapping = page.getByRole("table", { name: "Associer les colonnes de votre fichier" });
    await expect(mapping.getByLabel("Nom", { exact: true })).toHaveValue("0");
    await expect(mapping.getByLabel("Téléphone", { exact: true })).toHaveValue("3");
    await expect(mapping.getByLabel("Groupe(s)", { exact: true })).toHaveValue("5");
    await expect(mapping.getByLabel("Niveau", { exact: true })).toHaveValue("");
    await expect(mapping.getByRole("row", { name: /Prénom/ })).toContainText("Zoé");
    await page.getByRole("button", { name: "Afficher l'aperçu" }).click();

    // 3. Aperçu : erreurs ligne par ligne, sans bloquer les autres lignes.
    const summary = page.getByRole("list", { name: "Résumé de l'import" });
    await expect(summary).toContainText("3 nouveaux élèves");
    await expect(summary).toContainText("1 déjà enregistré (ignoré)");
    await expect(summary).toContainText("3 lignes en erreur");
    await expect(page.getByText("Groupes introuvables dans la saison : Zumba.")).toBeVisible();

    const preview = page.getByRole("table", { name: "Aperçu de l'import" });
    await expect(preview.locator('tbody tr[data-status="error"]')).toHaveCount(3);
    await expect(preview.getByRole("row", { name: /^4 Cœur/ })).toContainText(
      "« 31/02/2016 » n'est pas une date valide.",
    );
    await expect(preview.getByRole("row", { name: /^5 Durand/ })).toContainText(
      "Téléphone : renseignez le téléphone de l'élève ou celui du responsable légal.",
    );
    await expect(preview.getByRole("row", { name: /^6 Brûlé/ })).toContainText(
      "E-mail : adresse e-mail invalide.",
    );
    await expect(preview.getByRole("row", { name: /^7 Test/ })).toContainText("Déjà enregistré");
    await expect(preview.getByRole("row", { name: /^8 Gérard/ })).toContainText(
      "Groupe inconnu « Zumba »",
    );

    await page.getByLabel("Afficher uniquement les lignes à vérifier", { exact: true }).check();
    await expect(preview.locator("tbody tr")).toHaveCount(4);
    await page.getByLabel("Afficher uniquement les lignes à vérifier", { exact: true }).uncheck();

    // 4. Import.
    await page.getByRole("button", { name: "Importer 3 élèves" }).click();
    await expect(page.getByTestId("import-result")).toHaveText(
      "Import terminé : 3 élèves créés, 2 inscriptions dans les groupes. 3 lignes en erreur n'ont pas été importées.",
    );
    const history = page.getByRole("region", { name: "Historique des imports" });
    await expect(history).toContainText(
      "Dernier import : Import de 3 élèves (eleves-windows1252.csv)",
    );

    await page.getByRole("link", { name: "Voir les élèves" }).click();
    const students = page.getByRole("table", { name: "Élèves" });
    await expect(students.getByRole("row")).toHaveCount(6);
    await expect(students.getByRole("row", { name: /Éluard Zoé/ })).toContainText("Galaxie vert");
    await expect(students.getByRole("row", { name: /Éluard Zoé/ })).toContainText("06 11 22 33 44");
    await expect(students.getByRole("row", { name: /Lefèvre Hélène/ })).toContainText("12/03/2016");

    // Annulation de l'import entier, puis rétablissement.
    await navigate(page, "Import/Export");
    await history.getByRole("button", { name: "Annuler l'import" }).click();
    await expect(history).toContainText("Import annulé : Import de 3 élèves");
    await navigate(page, "Le club");
    await page
      .getByRole("navigation", { name: "Fiches du club" })
      .getByRole("link", { name: "Élèves" })
      .click();
    await expect(students.getByRole("row")).toHaveCount(3);
    await expect(students).not.toContainText("Éluard");

    await navigate(page, "Import/Export");
    await history.getByRole("button", { name: "Rétablir l'import" }).click();
    await expect(history).toContainText("Dernier import : Import de 3 élèves");
    await navigate(page, "Le club");
    await page
      .getByRole("navigation", { name: "Fiches du club" })
      .getByRole("link", { name: "Élèves" })
      .click();
    await expect(students.getByRole("row")).toHaveCount(6);
  });

  test("mémorise la correspondance et met à jour les doublons", async ({ page }) => {
    await openImport(page);
    const input = page.getByLabel("Fichier à importer", { exact: true });
    await input.setInputFiles(FIXTURE);
    const mapping = page.getByRole("table", { name: "Associer les colonnes de votre fichier" });
    // Ne pas importer les groupes ; mettre à jour les élèves déjà enregistrés.
    await mapping
      .getByLabel("Groupe(s)", { exact: true })
      .selectOption({ label: "— Ne pas importer —" });
    await page.getByLabel("Les mettre à jour avec les valeurs du fichier", { exact: true }).check();
    await page.getByRole("button", { name: "Afficher l'aperçu" }).click();
    const summary = page.getByRole("list", { name: "Résumé de l'import" });
    await expect(summary).toContainText("3 nouveaux élèves");
    await expect(summary).toContainText("1 inchangé");
    await expect(page.getByText("Groupes introuvables")).toBeHidden();

    // Retour au choix du fichier : la correspondance et l'option sont retrouvées.
    await page.getByRole("button", { name: "Retour au choix des colonnes" }).click();
    await page.getByRole("button", { name: "Changer de fichier" }).click();
    await input.setInputFiles(FIXTURE);
    await expect(mapping.getByLabel("Groupe(s)", { exact: true })).toHaveValue("");
    await expect(mapping.getByLabel("Nom", { exact: true })).toHaveValue("0");
    await expect(
      page.getByLabel("Les mettre à jour avec les valeurs du fichier", { exact: true }),
    ).toBeChecked();
  });

  test("marque et compte les lignes hors tranche d'âge sans bloquer l'import", async ({ page }) => {
    await createSeason(page);
    await seedPlanning(page, {
      courts: [],
      instructors: [],
      lessons: [],
      groups: [{ name: "Galaxie vert", maxSize: 8, minAge: 6, maxAge: 8, students: [] }],
    });
    await navigate(page, "Import/Export");
    await page.getByLabel("Fichier à importer", { exact: true }).setInputFiles(FIXTURE);
    await page.getByRole("button", { name: "Afficher l'aperçu" }).click();

    // Zoé (9 ans au début de saison) et Hélène (10 ans) sont hors des 6–8 ans.
    const summary = page.getByRole("list", { name: "Résumé de l'import" });
    await expect(summary).toContainText("2 lignes hors tranche d'âge");
    const preview = page.getByRole("table", { name: "Aperçu de l'import" });
    await expect(preview.locator("tbody tr[data-out-of-age-range]")).toHaveCount(2);
    await expect(preview.getByRole("row", { name: /^2 Éluard/ })).toContainText(
      "Zoé aura 9 ans, Galaxie vert est pour les 6–8 ans",
    );
    await expect(page.getByRole("button", { name: "Importer 4 élèves" })).toBeEnabled();
  });
});
