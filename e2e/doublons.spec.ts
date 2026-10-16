import { expect, type Locator, type Page, test } from "@playwright/test";
import { createSeason, demoClub, seedPlanning } from "./support/planning";

/**
 * Doublons et alerte d'âge (lot L12) : signalés tôt dans la zone de message
 * réservée, jamais bloquants. Club de démonstration : élèves « Test » (Léa,
 * Tom, Zoé dans Galaxie vert, réservé ici aux 6–8 ans), moniteurs Julie Martin
 * (JM), Karim Benali (KB) et Marc Leroy (ML), courts « Court 1 » et « Court 2 ».
 */

const club = {
  ...demoClub,
  groups: demoClub.groups.map((g) =>
    g.name === "Galaxie vert" ? { ...g, minAge: 6, maxAge: 8 } : g,
  ),
};

/** Position d'un élément dans la page, défilements compris. */
function position(locator: Locator): Promise<{ x: number; y: number }> {
  return locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    let x = box.x;
    let y = box.y;
    for (let node = element.parentElement; node; node = node.parentElement) {
      x += node.scrollLeft;
      y += node.scrollTop;
    }
    return { x: Math.round(x), y: Math.round(y) };
  });
}

function tab(page: Page, name: string) {
  return page.getByRole("navigation", { name: "Référentiels" }).getByRole("link", { name });
}

async function openClub(page: Page, tabName: string) {
  await createSeason(page);
  await seedPlanning(page, club);
  await tab(page, tabName).click();
}

/** Crée un élève par la fiche : champs désignés par leur libellé, groupe facultatif. */
async function createStudent(page: Page, fields: Record<string, string>) {
  await page.getByRole("button", { name: "Nouvel élève" }).click();
  const dialog = page.getByRole("dialog", { name: "Nouvel élève" });
  for (const [label, value] of Object.entries(fields)) {
    if (label === "group") await dialog.getByLabel(value, { exact: false }).last().check();
    else if (label === "Niveau") await dialog.getByLabel("Niveau").selectOption({ label: value });
    else await dialog.getByLabel(label, { exact: true }).fill(value);
  }
  await dialog.getByRole("button", { name: "Créer l'élève" }).click();
  await expect(dialog).toBeHidden();
}

test.describe("doublons et alerte d'âge", () => {
  test("signale un élève déjà inscrit sans déplacer les boutons ni bloquer", async ({ page }) => {
    await openClub(page, "Élèves");
    await expect(page.getByTestId("student-count")).toHaveText("8 élèves");
    await page.getByRole("button", { name: "Nouvel élève" }).click();
    const dialog = page.getByRole("dialog", { name: "Nouvel élève" });
    const create = dialog.getByRole("button", { name: "Créer l'élève" });
    const cancel = dialog.getByRole("button", { name: "Annuler" });
    const before = [await position(create), await position(cancel)];

    // Sans casse ni accents.
    await dialog.getByLabel("Nom", { exact: true }).fill("TEST");
    await dialog.getByLabel("Prénom").fill("lea");
    const messages = dialog.getByRole("list", { name: "Messages" });
    await expect(messages).toContainText("Un élève Test Léa (Galaxie vert) existe déjà");
    await expect(messages.getByRole("button", { name: "Ouvrir sa fiche" })).toBeVisible();
    expect([await position(create), await position(cancel)]).toEqual(before);

    // Vrai homonyme : l'enregistrement reste possible.
    await dialog.getByLabel("Téléphone", { exact: true }).fill("0611223344");
    await dialog.getByLabel("Date de naissance").fill("2018-02-01");
    await expect(messages).toContainText("Un élève Test Léa (Galaxie vert) existe déjà");
    await create.click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("student-count")).toHaveText("9 élèves");

    // Recherche de la fiche groupe : les homonymes sont désignés avec naissance et groupes.
    await tab(page, "Groupes").click();
    await page.getByRole("link", { name: "Ados perfectionnement" }).click();
    await page.getByLabel("Ajouter un élève (nom, prénom, téléphone)").fill("léa");
    const found = page.getByRole("list", { name: "Élèves trouvés" });
    await expect(found).toContainText("Galaxie vert");
    await expect(found).toContainText("né(e) le 01/02/2018");
    await expect(
      found.getByRole("button", { name: "Ajouter Test Léa (Galaxie vert)" }),
    ).toBeVisible();
    await expect(
      found.getByRole("button", { name: "Ajouter TEST lea (né(e) le 01/02/2018)" }),
    ).toBeVisible();
    // Sans homonyme, le nom suffit.
    await page.getByLabel("Ajouter un élève (nom, prénom, téléphone)").fill("zoé");
    await expect(
      found.getByRole("button", { name: "Ajouter Test Zoé", exact: true }),
    ).toBeVisible();
    await tab(page, "Élèves").click();

    // La confirmation de suppression désigne l'élève avec ses groupes.
    await page.getByRole("button", { name: "Supprimer Test Tom" }).click();
    await expect(page.getByRole("dialog", { name: "Supprimer Test Tom ?" })).toContainText(
      "l'élève « Test Tom » (Galaxie vert, Mini-tennis)",
    );
  });

  test("« Ouvrir sa fiche » remplace la saisie, après confirmation", async ({ page }) => {
    await openClub(page, "Élèves");
    await page.getByRole("button", { name: "Nouvel élève" }).click();
    const dialog = page.getByRole("dialog", { name: "Nouvel élève" });
    await dialog.getByLabel("Nom", { exact: true }).fill("Test");
    await dialog.getByLabel("Prénom").fill("Hugo");
    await dialog.getByRole("button", { name: "Ouvrir sa fiche" }).click();
    await page
      .getByRole("dialog", { name: "Abandonner les modifications ?" })
      .getByRole("button", { name: "Abandonner" })
      .click();
    const edit = page.getByRole("dialog", { name: "Modifier l'élève" });
    await expect(edit.getByLabel("Prénom")).toHaveValue("Hugo");
    await expect(edit.getByLabel("Ados perfectionnement")).toBeChecked();
    // La fiche ouverte n'est pas son propre doublon.
    await expect(edit.getByRole("list", { name: "Messages" })).toBeEmpty();
    // Le focus revient dans la fenêtre : Échap la ferme (rien n'a changé).
    await expect(edit.getByLabel("Nom", { exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(edit).toBeHidden();
  });

  test("« Reprendre ses coordonnées » d'une saison passée, sans les groupes", async ({ page }) => {
    await openClub(page, "Élèves");
    await createStudent(page, {
      Nom: "Martin",
      Prénom: "Léa",
      Téléphone: "0611223344",
      "E-mail": "lea@exemple.fr",
      "Date de naissance": "2015-05-03",
      "Classement FFT": "30/2",
      "Nom du responsable": "Paul Martin",
      "Téléphone du responsable": "0622334455",
      Niveau: "Galaxie vert",
      group: "Galaxie vert",
    });
    await createStudent(page, {
      Nom: "Durand",
      Prénom: "Tom",
      Téléphone: "0633445566",
      Niveau: "Débutant",
    });
    // Un niveau archivé depuis n'est pas repris.
    await tab(page, "Niveaux").click();
    await page.getByRole("button", { name: "Supprimer Débutant" }).click();
    await page
      .getByRole("dialog", { name: "Supprimer Débutant ?" })
      .getByRole("button", { name: "Archiver" })
      .click();

    await tab(page, "Saison").click();
    await page.getByRole("button", { name: "Nouvelle saison" }).click();
    const season = page.getByRole("dialog", { name: "Nouvelle saison" });
    await season.getByLabel("Saison vierge").check();
    await season.getByLabel("Nom", { exact: true }).fill("2027-2028");
    await season.getByLabel("Date de début").fill("2027-09-01");
    await season.getByLabel("Date de fin").fill("2028-06-30");
    await season.getByRole("button", { name: "Créer la saison" }).click();
    await expect(season).toBeHidden();
    // Un groupe du même nom dans la nouvelle saison : il ne doit pas être coché.
    await seedPlanning(page, {
      courts: [],
      instructors: [],
      groups: [{ name: "Galaxie vert", maxSize: 8, students: [] }],
      lessons: [],
    });
    await tab(page, "Élèves").click();
    await expect(page.getByTestId("student-count")).toHaveText("0 élève");

    await page.getByRole("button", { name: "Nouvel élève" }).click();
    const dialog = page.getByRole("dialog", { name: "Nouvel élève" });
    await dialog.getByLabel("Nom", { exact: true }).fill("Martin");
    await dialog.getByLabel("Prénom").fill("Léa");
    const messages = dialog.getByRole("list", { name: "Messages" });
    await expect(messages).toContainText("Léa Martin était inscrit(e) en 2026-2027.");
    // Fiche d'une autre saison : pas de « Ouvrir sa fiche ».
    await expect(messages.getByRole("button", { name: "Ouvrir sa fiche" })).toHaveCount(0);
    await messages.getByRole("button", { name: "Reprendre ses coordonnées" }).click();
    await expect(dialog.getByLabel("Téléphone", { exact: true })).toHaveValue("0611223344");
    await expect(dialog.getByLabel("E-mail")).toHaveValue("lea@exemple.fr");
    await expect(dialog.getByLabel("Date de naissance")).toHaveValue("2015-05-03");
    await expect(dialog.getByLabel("Classement FFT")).toHaveValue("30/2");
    await expect(dialog.getByLabel("Nom du responsable")).toHaveValue("Paul Martin");
    await expect(dialog.getByLabel("Téléphone du responsable")).toHaveValue("0622334455");
    await expect(dialog.getByLabel("Niveau").locator("option:checked")).toHaveText("Galaxie vert");
    await expect(dialog.getByLabel("Galaxie vert")).not.toBeChecked();
    await expect(messages).toContainText("Coordonnées reprises de 2026-2027.");
    // Un autre prénom : la reprise ne vaut plus pour cette saisie.
    await dialog.getByLabel("Prénom").fill("Léo");
    await expect(messages).not.toContainText("Coordonnées reprises");
    await dialog.getByLabel("Prénom").fill("Léa");
    await dialog.getByRole("button", { name: "Créer l'élève" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("student-count")).toHaveText("1 élève");

    await page.getByRole("button", { name: "Nouvel élève" }).click();
    await dialog.getByLabel("Nom", { exact: true }).fill("Durand");
    await dialog.getByLabel("Prénom").fill("Tom");
    await messages.getByRole("button", { name: "Reprendre ses coordonnées" }).click();
    await expect(dialog.getByLabel("Téléphone", { exact: true })).toHaveValue("0633445566");
    await expect(dialog.getByLabel("Niveau")).toHaveValue("");
  });

  test("affiche les tranches et avertit d'un groupe hors tranche", async ({ page }) => {
    await openClub(page, "Élèves");
    await page.getByRole("button", { name: "Nouvel élève" }).click();
    const dialog = page.getByRole("dialog", { name: "Nouvel élève" });
    const group = dialog.getByLabel("Galaxie vert");
    await expect(group).toHaveAccessibleName(/Galaxie vert · 6–8 ans/);
    await expect(group).not.toHaveAccessibleName(/hors tranche/);

    await dialog.getByLabel("Nom", { exact: true }).fill("Durand");
    await dialog.getByLabel("Prénom").fill("Léa");
    await dialog.getByLabel("Téléphone", { exact: true }).fill("0611223344");
    // 11 ans au 1er septembre 2026.
    await dialog.getByLabel("Date de naissance").fill("2015-05-03");
    await expect(group).toHaveAccessibleName(/hors tranche/);
    const messages = dialog.getByRole("list", { name: "Messages" });
    await expect(messages).not.toContainText("Galaxie vert est pour");
    await group.check();
    await expect(messages).toContainText("Léa aura 11 ans, Galaxie vert est pour les 6–8 ans");

    // Une date qui remet l'élève dans la tranche efface l'avertissement.
    await dialog.getByLabel("Date de naissance").fill("2019-05-03");
    await expect(messages).not.toContainText("Galaxie vert est pour");
    // Une date qui met hors tranche le groupe déjà coché l'avertit aussitôt.
    await dialog.getByLabel("Date de naissance").fill("2015-05-03");
    await expect(messages).toContainText("Léa aura 11 ans, Galaxie vert est pour les 6–8 ans");
    await dialog.getByRole("button", { name: "Créer l'élève" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("row", { name: /Durand Léa/ })).toContainText("Galaxie vert");
  });

  test("propose des initiales libres en un clic (B2)", async ({ page }) => {
    await openClub(page, "Moniteurs");
    await page.getByRole("button", { name: "Nouveau moniteur" }).click();
    const dialog = page.getByRole("dialog", { name: "Nouveau moniteur" });
    await dialog.getByLabel("Prénom").fill("Jean");
    await dialog.getByLabel("Nom", { exact: true }).fill("Morel");
    const initials = dialog.getByLabel("Initiales");
    await expect(initials).toHaveValue("JMo");
    await initials.fill("jm");
    const messages = dialog.getByRole("list", { name: "Messages" });
    await expect(messages).toContainText("jm est déjà utilisé par Julie Martin. Utiliser JMo ?");
    await messages.getByRole("button", { name: "Utiliser JMo" }).click();
    await expect(initials).toHaveValue("JMo");
    await expect(messages).toBeEmpty();

    // Enregistrement possible avec des initiales déjà prises.
    await initials.fill("KB");
    await expect(messages).toContainText("KB est déjà utilisé par Karim Benali.");
    await dialog.getByRole("button", { name: "Créer le moniteur" }).click();
    await expect(page.getByRole("heading", { name: "Jean Morel" })).toBeVisible();
  });

  test("signale un nom de court déjà pris (B5)", async ({ page }) => {
    await openClub(page, "Courts");
    await page.getByRole("button", { name: "Nouveau court" }).click();
    const dialog = page.getByRole("dialog", { name: "Nouveau court" });
    const messages = dialog.getByRole("list", { name: "Messages" });
    // Nom proposé : « Court 3 », libre.
    await expect(messages).toBeEmpty();
    await dialog.getByLabel("Nom").fill("court 1");
    await expect(messages).toContainText("Un court « Court 1 » existe déjà");
    await dialog.getByRole("button", { name: "Enregistrer" }).click();
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("list", { name: "Courts" }).getByTestId("sortable-item"),
    ).toHaveCount(3);
  });
});
