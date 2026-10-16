import { expect, type Page, test } from "@playwright/test";
import { createSeason, seedPlanning } from "./support/planning";

/**
 * Saisie des élèves en volume (lot L13) : « Enregistrer et ajouter un autre »,
 * collage depuis un tableur dans l'import, ajout en chaîne dans la fiche
 * groupe, création d'un groupe sans quitter la liste, téléphone de l'élève
 * ou du responsable.
 */

async function seedGroups(page: Page) {
  await createSeason(page);
  await seedPlanning(page, {
    courts: [],
    instructors: [],
    lessons: [],
    groups: [
      {
        name: "Galaxie vert",
        maxSize: 12,
        minAge: 6,
        maxAge: 8,
        level: "Galaxie vert",
        students: [],
      },
      { name: "Mini-tennis", maxSize: 8, students: ["Léa", "Tom", "Zoé", "Hugo"] },
    ],
  });
}

const toast = (page: Page) => page.getByTestId("toast");

async function openGroup(page: Page, name: string) {
  await page.goto("/#/referentiels/groupes");
  await page.getByRole("table", { name: "Groupes" }).getByRole("link", { name }).click();
  await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
}

test.describe("saisie des élèves en volume", () => {
  test("saisit dix élèves d'un même groupe à la suite sans recocher le groupe", async ({
    page,
  }) => {
    await seedGroups(page);
    await page.goto("/#/referentiels/eleves");
    await page.getByRole("button", { name: "Nouvel élève" }).click();
    const dialog = page.getByRole("dialog", { name: "Nouvel élève" });
    const firstName = dialog.getByLabel("Prénom");
    const level = dialog.getByLabel("Niveau");

    // Prénom avant Nom ; le niveau est proposé depuis le premier groupe coché.
    await expect(firstName).toBeFocused();
    await expect(dialog.getByRole("textbox").first()).toHaveAccessibleName("Prénom");
    await dialog.getByLabel("Galaxie vert").check();
    await expect(level.locator("option:checked")).toHaveText("Galaxie vert");

    const names = ["Léa", "Tom", "Zoé", "Hugo", "Lina", "Anne", "Paul", "Rémi", "Inès", "Noé"];
    for (const [i, name] of names.entries()) {
      await firstName.fill(name);
      await dialog.getByLabel("Nom", { exact: true }).fill(`Martin${i}`);
      if (i === 0) {
        // Téléphone du responsable seul : la fiche est acceptée.
        await dialog.getByLabel("Nom du responsable").fill("Paul Martin");
        await dialog.getByLabel("Téléphone du responsable").fill("06 99 88 77 66");
      } else {
        await dialog.getByLabel("Téléphone", { exact: true }).fill(`06 11 22 33 ${10 + i}`);
      }
      await dialog.getByRole("button", { name: "Enregistrer et ajouter un autre" }).click();
      await expect(toast(page)).toContainText(`${name} Martin${i} ajouté(e)`);
      // Fiche suivante : vide, groupe et niveau gardés, curseur dans Prénom.
      await expect(firstName).toHaveValue("");
      await expect(firstName).toBeFocused();
      await expect(dialog.getByLabel("Galaxie vert")).toBeChecked();
      await expect(level.locator("option:checked")).toHaveText("Galaxie vert");
    }
    await expect(dialog.locator("label", { hasText: "Galaxie vert" })).toContainText("10/12");

    // Rien n'a été saisi dans la dernière fiche : elle se ferme sans question.
    await dialog.getByRole("button", { name: "Annuler" }).click();
    await expect(dialog).toBeHidden();

    const students = page.getByRole("table", { name: "Élèves" });
    await expect(students.getByRole("row")).toHaveCount(11 + 4);
    const lea = students.getByRole("row", { name: /Martin0 Léa/ });
    await expect(lea).toContainText("Galaxie vert");
    await expect(lea).toContainText("06 99 88 77 66 (resp.)");
    await expect(students.getByRole("row", { name: /Martin9 Noé/ })).toContainText(
      "06 11 22 33 19",
    );

    // En modification, le niveau est celui de la fiche : décocher le groupe ne l'efface pas.
    await page.getByRole("button", { name: "Modifier Martin0 Léa" }).click();
    const edit = page.getByRole("dialog", { name: "Modifier l'élève" });
    await edit.getByLabel("Galaxie vert").uncheck();
    await expect(edit.getByLabel("Niveau").locator("option:checked")).toHaveText("Galaxie vert");
    await edit.getByRole("button", { name: "Annuler" }).click();
    await page.getByRole("button", { name: "Abandonner" }).click();

    // « — Aucun — » choisi reste choisi d'une fiche à la suivante de la série.
    await page.getByRole("button", { name: "Nouvel élève" }).click();
    await dialog.getByLabel("Galaxie vert").check();
    await level.selectOption({ label: "— Aucun —" });
    await firstName.fill("Inès");
    await dialog.getByLabel("Nom", { exact: true }).fill("Durand");
    await dialog.getByLabel("Téléphone", { exact: true }).fill("0611223399");
    await dialog.getByRole("button", { name: "Enregistrer et ajouter un autre" }).click();
    await expect(toast(page)).toContainText("Inès Durand ajouté(e)");
    await expect(dialog.getByLabel("Galaxie vert")).toBeChecked();
    await expect(level).toHaveValue("");
    await dialog.getByLabel("Galaxie vert").uncheck();
    await dialog.getByLabel("Galaxie vert").check();
    await expect(level).toHaveValue("");

    // Sans aucun téléphone, la fiche est refusée.
    await firstName.fill("Jules");
    await dialog.getByLabel("Nom", { exact: true }).fill("Petit");
    await dialog.getByRole("button", { name: "Créer l'élève" }).click();
    await expect(dialog).toContainText(
      "Renseignez le téléphone de l'élève ou celui du responsable légal.",
    );
  });

  test("colle un tableau depuis Excel, l'importe puis annule l'import", async ({ page }) => {
    await seedGroups(page);
    await page.goto("/#/referentiels/eleves");
    await page.getByRole("link", { name: "Importer ou coller une liste" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Import/Export" })).toBeVisible();

    await page.getByRole("button", { name: "Coller depuis Excel" }).click();
    const pasted = page.getByLabel("Tableau à coller");
    await expect(pasted).toBeFocused();
    // Collage d'Excel sous Windows : tabulations, CRLF, cellule multiligne entre guillemets.
    await pasted.fill(
      "Nom\tPrénom\tTél. portable\tTéléphone du responsable\tDate de naissance\tGroupe\r\n" +
        "Éluard\tZoé\t06 11 22 33 44\t\t05/01/2019\tGalaxie vert\r\n" +
        'Lefèvre\tHélène\t\t0622334455\t12/03/2019\t"Galaxie vert\nMini-tennis"\r\n' +
        "Durand\tMaël\t\t\t\t\r\n",
    );
    await page.getByRole("button", { name: "Lire le tableau" }).click();

    await expect(page.getByTestId("import-file-info")).toContainText(
      "tableau collé — Tableau collé, séparateur tabulation, 3 lignes de données.",
    );
    await expect(page.getByLabel("La première ligne contient des élèves")).not.toBeChecked();
    const mapping = page.getByRole("table", { name: "Associer les colonnes de votre fichier" });
    await expect(mapping.getByLabel("Nom", { exact: true })).toHaveValue("0");
    await expect(mapping.getByLabel("Groupe(s)")).toHaveValue("5");
    await page.getByRole("button", { name: "Afficher l'aperçu" }).click();

    // Même aperçu qu'un fichier : téléphone de l'élève ou du responsable.
    const summary = page.getByRole("list", { name: "Résumé de l'import" });
    await expect(summary).toContainText("2 nouveaux élèves");
    await expect(summary).toContainText("1 ligne en erreur");
    const preview = page.getByRole("table", { name: "Aperçu de l'import" });
    await expect(preview.getByRole("row", { name: /^4 Durand/ })).toContainText(
      "Téléphone : renseignez le téléphone de l'élève ou celui du responsable légal.",
    );
    await page.getByRole("button", { name: "Importer 2 élèves" }).click();
    await expect(page.getByTestId("import-result")).toHaveText(
      "Import terminé : 2 élèves créés, 3 inscriptions dans les groupes. 1 ligne en erreur n'a pas été importée.",
    );
    const history = page.getByRole("region", { name: "Historique des imports" });
    await expect(history).toContainText("Dernier import : Import de 2 élèves (tableau collé)");

    await page.getByRole("link", { name: "Voir les élèves" }).click();
    const students = page.getByRole("table", { name: "Élèves" });
    await expect(students.getByRole("row")).toHaveCount(7);
    // Niveau proposé depuis le groupe (colonne Niveau absente).
    const helene = students.getByRole("row", { name: /Lefèvre Hélène/ });
    await expect(helene).toContainText("Galaxie vert");
    await expect(helene).toContainText("Mini-tennis");
    await expect(helene).toContainText("0622334455 (resp.)");

    // Annulation de l'import collé.
    await page.goto("/#/import-export");
    await history.getByRole("button", { name: "Annuler l'import" }).click();
    await expect(history).toContainText("Import annulé : Import de 2 élèves (tableau collé)");
    await page.goto("/#/referentiels/eleves");
    await expect(students.getByRole("row")).toHaveCount(5);
    await expect(students).not.toContainText("Éluard");
  });

  test("colle une liste sans en-têtes depuis la fiche d'un groupe", async ({ page }) => {
    await seedGroups(page);
    await openGroup(page, "Galaxie vert");
    await page.getByRole("link", { name: "Importer ou coller une liste" }).click();
    await expect(page.getByTestId("import-group")).toContainText("Galaxie vert");

    await page.getByRole("button", { name: "Coller depuis Excel" }).click();
    await page
      .getByLabel("Tableau à coller")
      .fill("Martin\tLéo\t0611223344\nPetit\tJade\t0622334455\n");
    await page.getByRole("button", { name: "Lire le tableau" }).click();

    // Pas d'en-têtes connus : colonnes A, B… montrées avec une valeur, première ligne gardée.
    const firstRow = page.getByLabel("La première ligne contient des élèves");
    await expect(firstRow).toBeChecked();
    await expect(page.getByTestId("import-file-info")).toContainText("2 lignes de données.");
    // La case est modifiable : décochée, la première ligne devient celle des en-têtes.
    // (Relecture asynchrone du tableau : clic puis vérification.)
    await firstRow.click();
    await expect(page.getByTestId("import-file-info")).toContainText("1 ligne de données.");
    await expect(firstRow).not.toBeChecked();
    await firstRow.click();
    await expect(page.getByTestId("import-file-info")).toContainText("2 lignes de données.");
    await expect(firstRow).toBeChecked();

    const mapping = page.getByRole("table", { name: "Associer les colonnes de votre fichier" });
    await expect(
      page.getByRole("list", { name: "Il manque des colonnes obligatoires" }),
    ).toBeVisible();
    await mapping.getByLabel("Nom", { exact: true }).selectOption({ label: "Colonne A — Martin" });
    await mapping.getByLabel("Prénom").selectOption({ label: "Colonne B — Léo" });
    await mapping
      .getByLabel("Téléphone", { exact: true })
      .selectOption({ label: "Colonne C — 0611223344" });

    await page.getByRole("button", { name: "Afficher l'aperçu" }).click();
    await expect(page.getByRole("list", { name: "Résumé de l'import" })).toContainText(
      "2 nouveaux élèves",
    );
    // L'aperçu montre le groupe pré-affecté.
    await expect(
      page.getByRole("table", { name: "Aperçu de l'import" }).getByRole("row", { name: /Martin/ }),
    ).toContainText("Galaxie vert");
    await page.getByRole("button", { name: "Importer 2 élèves" }).click();
    await expect(page.getByTestId("import-result")).toContainText(
      "2 élèves créés, 2 inscriptions dans les groupes",
    );

    // Le groupe d'origine a été pré-affecté.
    await page.getByRole("link", { name: "Retour au groupe Galaxie vert" }).click();
    const members = page.getByRole("table", { name: "Élèves du groupe" });
    await expect(members.getByRole("row", { name: /Martin Léo/ })).toBeVisible();
    await expect(members.getByRole("row", { name: /Petit Jade/ })).toBeVisible();
  });

  test("ajoute des élèves en chaîne au clavier dans la fiche groupe", async ({ page }) => {
    await seedGroups(page);
    await openGroup(page, "Galaxie vert");
    const search = page.getByLabel("Ajouter un élève (nom, prénom, téléphone)");
    const members = page.getByRole("table", { name: "Élèves du groupe" });

    // Résultat unique : Entrée l'ajoute, le champ est vidé et garde le focus.
    await search.click();
    await page.keyboard.type("tom");
    await page.keyboard.press("Enter");
    await expect(members.getByRole("row", { name: /Test Tom/ })).toBeVisible();
    await expect(search).toHaveValue("");
    await expect(search).toBeFocused();

    // Plusieurs résultats : ↓ met en surbrillance, Entrée ajoute celui-là.
    await page.keyboard.type("test");
    const results = page.getByRole("listbox", { name: "Élèves trouvés" });
    await expect(results.getByRole("option")).toHaveCount(3);
    // Liste déroulante du champ (motif combobox) : aucune option choisie d'office.
    await expect(search).toHaveAttribute("aria-expanded", "true");
    await expect(search).not.toHaveAttribute("aria-activedescendant");
    await page.keyboard.press("Enter");
    await expect(members.getByRole("row")).toHaveCount(2);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    const selected = results.getByRole("option", { selected: true });
    await expect(selected).toHaveAccessibleName("Test Léa");
    await expect(search).toHaveAttribute(
      "aria-activedescendant",
      (await selected.getAttribute("id")) ?? "",
    );
    await page.keyboard.press("Enter");
    await expect(members.getByRole("row", { name: /Test Léa/ })).toBeVisible();
    await expect(search).toBeFocused();
    await expect(page.getByTestId("group-size")).toHaveText("2 / 12");

    // Élève déjà dans le groupe : signalé, aucune création proposée.
    await page.keyboard.type("Tom Test");
    await expect(page.getByText("Test Tom : déjà dans le groupe.")).toBeVisible();
    await expect(results.getByRole("option")).toHaveCount(0);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await search.fill("");

    // Aucun résultat : « Créer « Léna Petit » » ouvre la fiche pré-remplie, groupe coché.
    await page.keyboard.type("Léna Petit");
    await expect(results.getByRole("option", { name: "Créer « Léna Petit »" })).toBeVisible();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Nouvel élève" });
    await expect(dialog.getByLabel("Prénom")).toHaveValue("Léna");
    await expect(dialog.getByLabel("Nom", { exact: true })).toHaveValue("Petit");
    await expect(dialog.getByLabel("Galaxie vert")).toBeChecked();
    await expect(dialog.getByLabel("Niveau").locator("option:checked")).toHaveText("Galaxie vert");
    // Contrôles de L12 sur la fiche pré-remplie : alerte d'âge du groupe coché.
    await dialog.getByLabel("Date de naissance").fill("2015-03-12");
    await expect(dialog.getByRole("list", { name: "Messages" })).toContainText(
      "Léna aura 11 ans, Galaxie vert est pour les 6–8 ans",
    );
    await dialog.getByLabel("Téléphone", { exact: true }).fill("0611223344");
    await dialog.getByRole("button", { name: "Créer l'élève" }).click();

    // Retour à la fiche du groupe, prête pour l'élève suivant.
    await expect(dialog).toBeHidden();
    await expect(toast(page)).toContainText("Léna Petit ajouté(e)");
    await expect(members.getByRole("row", { name: /Petit Léna/ })).toBeVisible();
    await expect(page.getByTestId("group-size")).toHaveText("3 / 12");
    await expect(search).toHaveValue("");
    await expect(search).toBeFocused();
  });

  test("reste sur la liste après la création d'un groupe", async ({ page }) => {
    await seedGroups(page);
    await page.goto("/#/referentiels/groupes");
    await page.getByRole("button", { name: "Nouveau groupe" }).click();
    const dialog = page.getByRole("dialog", { name: "Nouveau groupe" });
    await dialog.getByLabel("Nom").fill("Galaxie orange");
    await dialog.getByLabel("Élèves au maximum").fill("6");
    await dialog.getByRole("button", { name: "Créer le groupe" }).click();

    await expect(dialog).toBeHidden();
    await expect(toast(page)).toContainText("Groupe « Galaxie orange » créé");
    await expect(page.getByRole("table", { name: "Groupes" })).toContainText("Galaxie orange");

    // « Ajouter des élèves » mène à la fiche, curseur dans le champ d'ajout.
    await toast(page).getByRole("button", { name: "Ajouter des élèves" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Galaxie orange" })).toBeVisible();
    await expect(page.getByLabel("Ajouter un élève (nom, prénom, téléphone)")).toBeFocused();
  });
});
