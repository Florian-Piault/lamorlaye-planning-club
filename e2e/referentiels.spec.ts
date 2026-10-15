import { expect, type Page, test } from "@playwright/test";

/**
 * Saisie des référentiels (lot L1). Hors de Tauri, la base est une base sql.js
 * en mémoire : chaque test repart d'une base vierge (niveaux pré-remplis).
 */

async function createSeason(page: Page) {
  await page.goto("/#/referentiels");
  const form = page.getByRole("form", { name: "Saison" });
  await form.getByLabel("Nom", { exact: true }).fill("2026-2027");
  await form.getByLabel("Date de début").fill("2026-09-01");
  await form.getByLabel("Date de fin").fill("2027-06-30");
  await form.getByLabel("Dimanche").uncheck();
  await form.getByRole("button", { name: "Créer la saison" }).click();
  await expect(page.getByText("Saison active")).toBeVisible();
}

function tab(page: Page, name: string) {
  return page.getByRole("navigation", { name: "Référentiels" }).getByRole("link", { name });
}

async function createCourt(page: Page, name: string, kind: "Couvert" | "Extérieur") {
  await page.getByRole("button", { name: "Nouveau court" }).click();
  const dialog = page.getByRole("dialog", { name: "Nouveau court" });
  await dialog.getByLabel("Nom").fill(name);
  await dialog.getByLabel("Type").selectOption({ label: kind });
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dialog).toBeHidden();
}

async function createInstructor(page: Page, firstName: string, lastName: string) {
  await tab(page, "Moniteurs").click();
  await page.getByRole("button", { name: "Nouveau moniteur" }).click();
  const dialog = page.getByRole("dialog", { name: "Nouveau moniteur" });
  await dialog.getByLabel("Prénom").fill(firstName);
  await dialog.getByLabel("Nom", { exact: true }).fill(lastName);
  await dialog.getByRole("button", { name: "Créer le moniteur" }).click();
  await expect(page.getByRole("heading", { name: `${firstName} ${lastName}` })).toBeVisible();
}

async function createStudent(
  page: Page,
  student: { lastName: string; firstName: string; phone: string; birthDate?: string },
  groups: string[] = [],
) {
  await page.getByRole("button", { name: "Nouvel élève" }).click();
  const dialog = page.getByRole("dialog", { name: "Nouvel élève" });
  await dialog.getByLabel("Nom", { exact: true }).fill(student.lastName);
  await dialog.getByLabel("Prénom").fill(student.firstName);
  await dialog.getByLabel("Téléphone", { exact: true }).fill(student.phone);
  if (student.birthDate) await dialog.getByLabel("Date de naissance").fill(student.birthDate);
  for (const group of groups) await dialog.getByLabel(group).check();
  await dialog.getByRole("button", { name: "Créer l'élève" }).click();
  await expect(dialog).toBeHidden();
}

test.describe("référentiels", () => {
  test("crée la saison, les courts et les réordonne par glisser-déposer", async ({ page }) => {
    await createSeason(page);
    await tab(page, "Courts").click();
    await createCourt(page, "Court 1", "Couvert");
    await createCourt(page, "Court 2", "Extérieur");
    await createCourt(page, "Court 3", "Extérieur");

    const courts = page.getByRole("list", { name: "Courts" }).getByTestId("sortable-item");
    await expect(courts).toHaveText([/Court 1/, /Court 2/, /Court 3/]);
    await expect(courts.first()).toContainText("Couvert");

    // Glisser « Court 3 » en tête de liste.
    const handle = page.getByRole("button", { name: "Déplacer Court 3" });
    const target = page.getByRole("button", { name: "Déplacer Court 1" });
    const from = await handle.boundingBox();
    const to = await target.boundingBox();
    if (!from || !to) throw new Error("poignées introuvables");
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, from.y - 10, { steps: 5 });
    await page.mouse.move(to.x + to.width / 2, to.y + 2, { steps: 10 });
    await page.mouse.up();
    await expect(courts).toHaveText([/Court 3/, /Court 1/, /Court 2/]);

    // L'ordre est enregistré : il est conservé après un changement d'onglet.
    await tab(page, "Saison").click();
    await tab(page, "Courts").click();
    await expect(courts).toHaveText([/Court 3/, /Court 1/, /Court 2/]);
  });

  test("attribue des couleurs distinctes aux moniteurs et saisit leurs disponibilités", async ({
    page,
  }) => {
    await createSeason(page);
    await createInstructor(page, "Karim", "Benali");

    // Plage du lundi peinte à la souris de 09:00 à 11:45 (fin incluse → 12:00).
    const monday = page.getByRole("group", { name: "Disponibilités du lundi" });
    const start = await monday.locator('[data-time="09:00"]').boundingBox();
    const end = await monday.locator('[data-time="11:45"]').boundingBox();
    if (!start || !end) throw new Error("cases introuvables");
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 12 });
    await page.mouse.up();
    const slots = page.getByRole("list", { name: "Plages de disponibilité" });
    await expect(slots).toContainText("09:00–12:00");
    await expect(monday.locator('[data-time="10:00"]')).toHaveAttribute("data-available", "true");

    // Saisie précise au clavier.
    const addSlot = page.getByRole("form", { name: "Ajouter une plage" });
    await addSlot.getByLabel("Jour").selectOption({ label: "Mercredi" });
    await addSlot.getByLabel("De").selectOption("14:00");
    await addSlot.getByLabel("À").selectOption("18:30");
    await addSlot.getByRole("button", { name: "Ajouter la plage" }).click();
    await expect(slots).toContainText("14:00–18:30");
    await expect(page.getByText("Total : 7 h 30 par semaine")).toBeVisible();

    // Effacer une plage.
    await page.getByRole("button", { name: "Retirer lundi 09:00–12:00" }).click();
    await expect(slots).not.toContainText("09:00–12:00");

    // Indisponibilité datée.
    const unavailability = page.getByRole("form", { name: "Ajouter l'indisponibilité" });
    await unavailability.getByLabel("Du").fill("2026-11-09");
    await unavailability.getByLabel("Au").fill("2026-11-11");
    await unavailability.getByLabel("Motif").fill("Tournoi");
    await unavailability.getByRole("button", { name: "Ajouter l'indisponibilité" }).click();
    await expect(page.getByRole("list", { name: "Indisponibilités" })).toContainText(
      "Du 09/11/2026 au 11/11/2026 — Tournoi",
    );

    await createInstructor(page, "Kevin", "Bertin");
    await page.getByRole("link", { name: "Moniteurs", exact: true }).first().click();
    const table = page.getByRole("table", { name: "Moniteurs" });
    await expect(table.getByRole("row")).toHaveCount(3);
    const chips = table.getByTestId("instructor-color");
    await expect(chips).toHaveText(["KB", "KBe"]);
    const colors = await chips.evaluateAll((els) =>
      els.map((el) => getComputedStyle(el).backgroundColor),
    );
    expect(new Set(colors).size).toBe(2);
    await expect(table).toContainText("4 h 30 / sem.");
  });

  test("compose un groupe par recherche d'élèves et signale les dépassements", async ({ page }) => {
    await createSeason(page);
    await tab(page, "Groupes").click();
    await page.getByRole("button", { name: "Nouveau groupe" }).click();
    const dialog = page.getByRole("dialog", { name: "Nouveau groupe" });
    await dialog.getByLabel("Nom").fill("Galaxie vert 1");
    await dialog.getByLabel("Niveau").selectOption({ label: "Galaxie vert" });
    await dialog.getByLabel("Âge minimum").fill("8");
    await dialog.getByLabel("Âge maximum").fill("10");
    await dialog.getByLabel("Effectif maximum").fill("2");
    await dialog.getByRole("button", { name: "Créer le groupe" }).click();
    await expect(page.getByRole("heading", { name: "Galaxie vert 1" })).toBeVisible();

    await tab(page, "Élèves").click();
    await createStudent(
      page,
      { lastName: "Martin", firstName: "Léa", phone: "06 11 22 33 44", birthDate: "2017-03-12" },
      ["Galaxie vert 1"],
    );
    await createStudent(page, {
      lastName: "Durand",
      firstName: "Tom",
      phone: "06 22 33 44 55",
      birthDate: "2016-10-01",
    });
    await createStudent(page, {
      lastName: "Éluard",
      firstName: "Zoé",
      phone: "06 33 44 55 66",
      birthDate: "2021-01-05",
    });

    const students = page.getByRole("table", { name: "Élèves" });
    await expect(students.getByRole("row")).toHaveCount(4);
    await expect(students.getByRole("row", { name: /Martin Léa/ })).toContainText("Galaxie vert 1");

    // Recherche sans accents.
    await page.getByLabel("Rechercher un élève").fill("eluard");
    await expect(students.getByRole("row")).toHaveCount(2);
    await page.getByLabel("Rechercher un élève").fill("");

    await tab(page, "Groupes").click();
    await page.getByRole("link", { name: "Galaxie vert 1" }).click();
    await expect(page.getByTestId("group-size")).toHaveText("1 / 2");

    const search = page.getByLabel("Ajouter un élève (nom, prénom, téléphone)");
    await search.fill("tom");
    await page.getByRole("button", { name: "Ajouter Durand Tom" }).click();
    await search.fill("zoe");
    await page.getByRole("button", { name: "Ajouter Éluard Zoé" }).click();

    const members = page.getByRole("table", { name: "Élèves du groupe" });
    await expect(members.getByRole("row")).toHaveCount(4);
    await expect(page.getByTestId("group-size")).toHaveText("3 / 2");
    const alerts = page.getByRole("list", { name: "Alertes" });
    await expect(alerts).toContainText("3 / 2 élèves");
    await expect(alerts).toContainText("1 élève hors tranche d'âge");

    await page.getByRole("button", { name: "Retirer Éluard Zoé du groupe" }).click();
    await expect(page.getByTestId("group-size")).toHaveText("2 / 2");
    await expect(page.getByRole("list", { name: "Alertes" })).toBeHidden();

    // Glisser-déposer d'un élève trouvé sur la composition (§8).
    await search.fill("zoe");
    const handle = page.getByRole("button", { name: "Glisser Éluard Zoé dans le groupe" });
    const from = await handle.boundingBox();
    const to = await members.boundingBox();
    if (!from || !to) throw new Error("éléments introuvables");
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, from.y + 20, { steps: 3 });
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
    await expect(page.getByTestId("composition-drop")).toHaveAttribute("data-over", "true");
    await page.mouse.up();
    await expect(page.getByTestId("group-size")).toHaveText("3 / 2");
    await expect(members.getByRole("row", { name: /Éluard Zoé/ })).toBeVisible();
  });

  test("trie les listes et propose l'archivage d'un élément utilisé", async ({ page }) => {
    await createSeason(page);
    await tab(page, "Élèves").click();
    await createStudent(page, { lastName: "Zola", firstName: "Émile", phone: "0611223344" });
    await createStudent(page, { lastName: "Arnaud", firstName: "Anne", phone: "0622334455" });

    const rows = page.getByRole("table", { name: "Élèves" }).getByRole("row");
    await expect(rows.nth(1)).toContainText("Arnaud Anne");
    await page.getByRole("button", { name: "Nom" }).click();
    await expect(rows.nth(1)).toContainText("Zola Émile");

    // Un élève non utilisé est supprimé après confirmation.
    await page.getByRole("button", { name: "Supprimer Zola Émile" }).click();
    const confirm = page.getByRole("dialog", { name: "Supprimer Zola Émile ?" });
    await expect(confirm).toContainText("Cette action est définitive");
    await confirm.getByRole("button", { name: "Supprimer" }).click();
    await expect(rows).toHaveCount(2);

    // Un niveau utilisé par un élève : archivage proposé.
    await page.getByRole("button", { name: "Modifier Arnaud Anne" }).click();
    const edit = page.getByRole("dialog", { name: "Modifier l'élève" });
    await edit.getByLabel("Niveau").selectOption({ label: "Débutant" });
    await edit.getByRole("button", { name: "Enregistrer" }).click();
    await expect(edit).toBeHidden();

    await tab(page, "Niveaux").click();
    await page.getByRole("button", { name: "Supprimer Débutant" }).click();
    const archive = page.getByRole("dialog", { name: "Supprimer Débutant ?" });
    await expect(archive).toContainText("est utilisé par 1 élève");
    await archive.getByRole("button", { name: "Archiver" }).click();
    await expect(archive).toBeHidden();
    const levels = page.getByRole("list", { name: "Niveaux" }).getByTestId("sortable-item");
    await expect(levels.filter({ hasText: "Débutant" })).toContainText("Archivé");
  });
});
