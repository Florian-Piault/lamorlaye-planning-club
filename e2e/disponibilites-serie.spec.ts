import { expect, type Locator, type Page, test } from "@playwright/test";
import type { SeedPlanning } from "../src/test/e2e";
import { createSeason, demoClub, fixToday, seedPlanning } from "./support/planning";

/**
 * Liste des élèves et saisie des disponibilités en série (lot L19,
 * docs/SPECS.md §8) : colonne « Disponibilités », filtre « Disponibilités non
 * renseignées » combiné à la recherche, puis saisie en série sur la liste
 * filtrée (« Enregistrer et suivant », « Passer », « Terminer »), au clavier.
 * Club de démonstration : 8 élèves « Test » ; Hugo, Paul et Zoé ont des plages,
 * les autres non (Anne, Léa, Lina, Rémi, Tom, dans l'ordre de la liste). Un
 * second groupe « Galaxie orange » (Hugo, Paul, Zoé) côtoie « Galaxie vert »
 * (Léa, Tom, Zoé).
 */

const club: SeedPlanning = {
  ...demoClub,
  groups: [
    ...demoClub.groups,
    { name: "Galaxie orange", maxSize: 8, students: ["Hugo", "Paul", "Zoé"] },
  ],
  studentAvailability: {
    Hugo: [[6, "09:00", "12:00"]],
    Paul: [[2, "17:00", "20:00"]],
    Zoé: [[3, "14:00", "18:00"]],
  },
};

const MISSING = ["Test Anne", "Test Léa", "Test Lina", "Test Rémi", "Test Tom"];

test.beforeEach(async ({ page }) => {
  await fixToday(page);
  await createSeason(page);
  await seedPlanning(page, club);
  await page
    .getByRole("navigation", { name: "Fiches du club" })
    .getByRole("link", { name: "Élèves" })
    .click();
  await expect(page.getByTestId("student-count")).toHaveText("8 élèves");
});

/** Noms des élèves affichés dans la liste, dans l'ordre. */
function listedNames(page: Page): Locator {
  return page.getByRole("table", { name: "Élèves" }).getByRole("button", { name: /^Test / });
}

/** Cellule « Disponibilités » de la ligne d'un élève. */
function availabilityCell(page: Page, name: string): Locator {
  return page
    .getByRole("row")
    .filter({ has: page.getByRole("button", { name, exact: true }) })
    .getByRole("cell")
    .nth(6);
}

function missingFilter(page: Page): Locator {
  return page.getByRole("checkbox", { name: "Disponibilités non renseignées" });
}

function seriesButton(page: Page): Locator {
  return page.getByRole("button", { name: "Saisir les disponibilités en série" });
}

function seriesDialog(page: Page): Locator {
  return page.getByRole("dialog", { name: "Saisie des disponibilités en série" });
}

/** Élève affiché par la série et sa progression. */
async function expectStep(dialog: Locator, name: string, progress: string, groups?: string) {
  await expect(dialog.getByTestId("series-student")).toHaveText(name);
  await expect(dialog.getByTestId("series-progress")).toHaveText(`Élève ${progress}`);
  if (groups) await expect(dialog.getByTestId("series-groups")).toHaveText(groups);
}

/** Saisie précise d'un horaire au clavier, sous la frise. */
async function addSlot(dialog: Locator, day: string, from: string, to: string) {
  const form = dialog.getByRole("form", { name: "Saisir un horaire" });
  await form.getByLabel("Jour", { exact: false }).selectOption({ label: day });
  await form.getByLabel("De", { exact: false }).selectOption(from);
  await form.getByLabel("À", { exact: false }).selectOption(to);
  await form.getByRole("button", { name: "Ajouter un horaire" }).click();
  await expect(
    dialog.getByRole("button", { name: `Retirer ${day.toLowerCase()} ${from}–${to}` }),
  ).toBeVisible();
}

/** Horaires affichés (pastilles « Retirer mercredi 14:00–18:00 »…). */
function slotButtons(dialog: Locator): Locator {
  return dialog.getByRole("list", { name: "Horaires de disponibilité" }).getByRole("button");
}

function clubTab(page: Page, name: string): Locator {
  return page.getByRole("navigation", { name: "Fiches du club" }).getByRole("link", { name });
}

function groupFilter(page: Page): Locator {
  return page.getByRole("combobox", { name: /^Groupe/ });
}

const toast = (page: Page) => page.getByTestId("toast");

/** Appelle un outil de `src/test/e2e.ts` dans la page (même base que l'application). */
async function tool(page: Page, name: string, ...args: unknown[]) {
  await page.evaluate(
    async ({ path, name, args }) => {
      const tools = await import(/* @vite-ignore */ path);
      await tools[name](...args);
    },
    { path: "/src/test/e2e.ts", name, args },
  );
}

/** Ouvre la fiche d'un élève et renvoie ses horaires affichés (lus en base à l'ouverture). */
async function openSheet(page: Page, name: string): Promise<Locator> {
  await page.getByRole("button", { name, exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Modifier l'élève" });
  await expect(sheet.getByRole("region", { name: "Disponible chaque semaine" })).toBeVisible();
  return sheet;
}

/** Avance au clavier (⌥ Tab sous WebKit ; ⇧ pour reculer) jusqu'à ce que `target` ait le focus. */
async function tabTo(page: Page, target: Locator, { back = false, max = 40 } = {}) {
  const webkit = page.context().browser()?.browserType().name() === "webkit";
  const key = `${webkit ? "Alt+" : ""}${back ? "Shift+" : ""}Tab`;
  for (let i = 0; i < max; i++) {
    await page.keyboard.press(key);
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error("élément introuvable au clavier");
}

test.describe("liste des élèves et saisie des disponibilités en série", () => {
  test("la colonne, le filtre « non renseignées » et le filtre par groupe se combinent", async ({
    page,
  }) => {
    await expect(availabilityCell(page, "Test Hugo")).toHaveText("Renseignées");
    await expect(availabilityCell(page, "Test Anne")).toHaveText("Non renseignées");

    await missingFilter(page).check();
    await expect(listedNames(page)).toHaveText(MISSING);
    await expect(page.getByTestId("student-count")).toHaveText("5 sur 8");

    // Un groupe à la fois : « Galaxie vert » seul, pas « Galaxie orange ».
    await missingFilter(page).uncheck();
    await groupFilter(page).selectOption({ label: "Galaxie vert" });
    await expect(listedNames(page)).toHaveText(["Test Léa", "Test Tom", "Test Zoé"]);
    await groupFilter(page).selectOption({ label: "Galaxie orange" });
    await expect(listedNames(page)).toHaveText(["Test Hugo", "Test Paul", "Test Zoé"]);
    // Combiné à « non renseignées » : Zoé, qui a des plages, reste à l'écart.
    await groupFilter(page).selectOption({ label: "Galaxie vert" });
    await missingFilter(page).check();
    await expect(listedNames(page)).toHaveText(["Test Léa", "Test Tom"]);
    await expect(page.getByTestId("student-count")).toHaveText("2 sur 8");
    // Et à la recherche.
    const search = page.getByRole("searchbox", { name: "Rechercher un élève" });
    await search.fill("Tom");
    await expect(listedNames(page)).toHaveText(["Test Tom"]);
    await search.fill("");
    await expect(listedNames(page)).toHaveText(["Test Léa", "Test Tom"]);

    // La série part de la liste telle qu'elle est filtrée à ce moment.
    await seriesButton(page).click();
    const dialog = seriesDialog(page);
    await expectStep(dialog, "Test Léa", "1 / 2", "Galaxie vert");
    await dialog.getByRole("button", { name: "Terminer" }).click();
    await expect(dialog).toBeHidden();

    // Rien à saisir : bouton grisé.
    await groupFilter(page).selectOption({ label: "Galaxie orange" });
    await expect(page.getByText("Aucun résultat.")).toBeVisible();
    await expect(seriesButton(page)).toHaveAttribute("aria-disabled", "true");
  });

  test("la série reprend les plages des élèves déjà renseignés et n'écrit rien sans changement", async ({
    page,
  }) => {
    // Sans le filtre « non renseignées » : Hugo, Paul et Zoé ont déjà des plages.
    await groupFilter(page).selectOption({ label: "Galaxie orange" });
    await seriesButton(page).click();
    const dialog = seriesDialog(page);
    await expectStep(dialog, "Test Hugo", "1 / 3");
    await expect(slotButtons(dialog)).toHaveAccessibleName("Retirer samedi 09:00–12:00");

    // Inchangé : « Enregistrer et suivant » n'écrit rien, Hugo compte comme passé.
    await dialog.getByRole("button", { name: "Enregistrer et suivant" }).click();
    await expectStep(dialog, "Test Paul", "2 / 3");
    await expect(slotButtons(dialog)).toHaveAccessibleName("Retirer mardi 17:00–20:00");
    // Une plage de plus : les anciennes sont gardées.
    await addSlot(dialog, "Jeudi", "10:00", "12:00");
    await dialog.getByRole("button", { name: "Enregistrer et suivant" }).click();
    await expectStep(dialog, "Test Zoé", "3 / 3");
    await expect(slotButtons(dialog)).toHaveAccessibleName("Retirer mercredi 14:00–18:00");
    await dialog.getByRole("button", { name: "Passer" }).click();
    await expect(dialog).toBeHidden();
    await expect(toast(page)).toContainText(
      "Saisie en série terminée : 1 élève enregistré, 2 passés.",
    );

    // En base : Hugo et Zoé intacts, Paul avec ses deux plages.
    for (const [name, slots] of [
      ["Test Hugo", ["Retirer samedi 09:00–12:00"]],
      ["Test Paul", ["Retirer mardi 17:00–20:00", "Retirer jeudi 10:00–12:00"]],
      ["Test Zoé", ["Retirer mercredi 14:00–18:00"]],
    ] as const) {
      const sheet = await openSheet(page, name);
      await expect(slotButtons(sheet)).toHaveCount(slots.length);
      for (const [i, slot] of slots.entries()) {
        await expect(slotButtons(sheet).nth(i)).toHaveAccessibleName(slot);
      }
      await sheet.getByRole("button", { name: "Annuler", exact: true }).click();
      await expect(sheet).toBeHidden();
    }
  });

  test("Échap ou la croix pendant un enregistrement ne ferment pas la série", async ({ page }) => {
    await missingFilter(page).check();
    await seriesButton(page).click();
    const dialog = seriesDialog(page);
    await expectStep(dialog, "Test Anne", "1 / 5");
    await addSlot(dialog, "Mercredi", "14:00", "18:00");

    await tool(page, "slowDownBatches", 1500);
    await dialog.getByRole("button", { name: "Enregistrer et suivant" }).click();
    await expect(dialog.getByRole("button", { name: "Terminer" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    // Échap atteint la fenêtre : le focus y est resté.
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await dialog.getByRole("button", { name: "Fermer" }).click();
    // Ni confirmation (rien n'est perdu), ni fermeture : l'écriture s'achève sur l'élève suivant.
    await expect(page.getByRole("dialog", { name: "Abandonner les modifications ?" })).toHaveCount(
      0,
    );
    await expectStep(dialog, "Test Léa", "2 / 5");
    await expect(toast(page)).toHaveCount(0);

    await dialog.getByRole("button", { name: "Terminer" }).click();
    await expect(dialog).toBeHidden();
    await expect(toast(page)).toHaveCount(1);
    await expect(toast(page)).toContainText("Saisie en série arrêtée : 1 élève enregistré.");
    await missingFilter(page).uncheck();
    await expect(availabilityCell(page, "Test Anne")).toHaveText("Renseignées");
  });

  test("une écriture refusée s'affiche dans la fenêtre et garde l'élève", async ({ page }) => {
    await missingFilter(page).check();
    await seriesButton(page).click();
    const dialog = seriesDialog(page);
    await expectStep(dialog, "Test Anne", "1 / 5");
    // La base refuse désormais les écritures de la saison.
    await tool(page, "archiveActiveSeason");

    // Rien à écrire pour Anne : aucune erreur, elle est passée.
    await dialog.getByRole("button", { name: "Enregistrer et suivant" }).click();
    await expectStep(dialog, "Test Léa", "2 / 5");
    await expect(dialog.getByRole("alert")).toHaveCount(0);

    await addSlot(dialog, "Mercredi", "14:00", "18:00");
    await dialog.getByRole("button", { name: "Enregistrer et suivant" }).click();
    await expect(dialog.getByRole("alert")).not.toBeEmpty();
    await expectStep(dialog, "Test Léa", "2 / 5");
    await expect(slotButtons(dialog)).toHaveAccessibleName("Retirer mercredi 14:00–18:00");
  });

  test("pas de saisie en série dans une saison terminée", async ({ page }) => {
    await expect(seriesButton(page)).toBeVisible();
    await clubTab(page, "Saison").click();
    await page.getByRole("button", { name: "Nouvelle saison" }).click();
    const create = page.getByRole("dialog", { name: "Nouvelle saison" });
    await create.getByRole("button", { name: "Dupliquer la saison" }).click();
    await expect(create).toBeHidden();
    await page.getByLabel("Saison affichée", { exact: true }).selectOption({
      label: "2026-2027 (terminée)",
    });
    await expect(page.getByTestId("read-only-banner")).toBeVisible();
    await clubTab(page, "Élèves").click();
    await expect(page.getByTestId("student-count")).toHaveText("8 élèves");
    await expect(availabilityCell(page, "Test Hugo")).toHaveText("Renseignées");
    await expect(seriesButton(page)).toHaveCount(0);
  });

  test("enchaîne les élèves sans plage : enregistrer, passer, puis toast de fin", async ({
    page,
  }) => {
    await missingFilter(page).check();
    await seriesButton(page).click();
    const dialog = seriesDialog(page);
    await expectStep(dialog, "Test Anne", "1 / 5", "Adultes débutants");
    await expect(dialog.getByTestId("student-availability-state")).toHaveText(
      "Aucun horaire : considéré disponible partout.",
    );

    // « Enregistrer et suivant » : Anne enregistrée, Léa affichée.
    await addSlot(dialog, "Mercredi", "14:00", "18:00");
    await dialog.getByRole("button", { name: "Enregistrer et suivant" }).click();
    await expectStep(dialog, "Test Léa", "2 / 5", "Galaxie vert");
    await expect(slotButtons(dialog)).toHaveCount(0);

    // « Passer » après une saisie : confirmation, puis rien d'enregistré pour Léa.
    await addSlot(dialog, "Samedi", "09:00", "12:00");
    await dialog.getByRole("button", { name: "Passer" }).click();
    const confirm = page.getByRole("dialog", { name: "Abandonner les modifications ?" });
    await confirm.getByRole("button", { name: "Abandonner" }).click();
    await expect(confirm).toBeHidden();
    await expectStep(dialog, "Test Lina", "3 / 5", "Ados perfectionnement");

    await addSlot(dialog, "Lundi", "17:00", "19:00");
    await dialog.getByRole("button", { name: "Enregistrer et suivant" }).click();
    await expectStep(dialog, "Test Rémi", "4 / 5");
    // « Passer » sans saisie : aucune confirmation.
    await dialog.getByRole("button", { name: "Passer" }).click();
    await expectStep(dialog, "Test Tom", "5 / 5", "Galaxie vert, Mini-tennis");
    await addSlot(dialog, "Mardi", "17:00", "18:00");
    await dialog.getByRole("button", { name: "Enregistrer et suivant" }).click();

    await expect(dialog).toBeHidden();
    await expect(toast(page)).toContainText(
      "Saisie en série terminée : 3 élèves enregistrés, 2 passés.",
    );
    // Les élèves saisis ne sont plus dans le filtre ; ceux passés y restent.
    await expect(listedNames(page)).toHaveText(["Test Léa", "Test Rémi"]);
    await missingFilter(page).uncheck();
    await expect(availabilityCell(page, "Test Anne")).toHaveText("Renseignées");
    await expect(availabilityCell(page, "Test Léa")).toHaveText("Non renseignées");

    // Les plages enregistrées sont celles saisies.
    await page.getByRole("button", { name: "Test Anne", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Modifier l'élève" });
    await expect(slotButtons(sheet)).toHaveCount(1);
    await expect(slotButtons(sheet)).toHaveAccessibleName("Retirer mercredi 14:00–18:00");
  });

  test("« Terminer » au milieu de la série garde les plages déjà enregistrées", async ({
    page,
  }) => {
    await missingFilter(page).check();
    await seriesButton(page).click();
    const dialog = seriesDialog(page);
    await expectStep(dialog, "Test Anne", "1 / 5");
    await addSlot(dialog, "Mercredi", "14:00", "18:00");
    await dialog.getByRole("button", { name: "Enregistrer et suivant" }).click();
    await expectStep(dialog, "Test Léa", "2 / 5");

    await dialog.getByRole("button", { name: "Terminer" }).click();
    await expect(dialog).toBeHidden();
    await expect(toast(page)).toContainText("Saisie en série arrêtée : 1 élève enregistré.");
    await expect(listedNames(page)).toHaveText(MISSING.slice(1));
    await missingFilter(page).uncheck();
    await expect(availabilityCell(page, "Test Anne")).toHaveText("Renseignées");
  });

  test("la série se parcourt au clavier, sans souris", async ({ page }) => {
    await page.getByRole("searchbox", { name: "Rechercher un élève" }).focus();
    await tabTo(page, missingFilter(page));
    await page.keyboard.press("Space");
    await expect(missingFilter(page)).toBeChecked();
    await expect(listedNames(page)).toHaveText(MISSING);
    await tabTo(page, seriesButton(page));
    await page.keyboard.press("Enter");

    const dialog = seriesDialog(page);
    await expectStep(dialog, "Test Anne", "1 / 5");
    const day = dialog
      .getByRole("form", { name: "Saisir un horaire" })
      .getByLabel("Jour", { exact: false });
    await expect(day).toBeFocused();

    // Un horaire ajouté au clavier, puis « Enregistrer et suivant » par son raccourci.
    await tabTo(page, dialog.getByRole("button", { name: "Ajouter un horaire" }));
    await page.keyboard.press("Enter");
    await expect(dialog.getByRole("button", { name: /^Retirer lundi / })).toHaveCount(1);
    await page.keyboard.press("ControlOrMeta+Enter");
    await expectStep(dialog, "Test Léa", "2 / 5");
    // Le focus revient au début de la saisie de l'élève suivant.
    await expect(day).toBeFocused();

    // « Passer » au clavier.
    await tabTo(page, dialog.getByRole("button", { name: "Passer" }));
    await page.keyboard.press("Enter");
    await expectStep(dialog, "Test Lina", "3 / 5");
    await expect(day).toBeFocused();

    // « Enregistrer et suivant » atteint aussi par Tab.
    await tabTo(page, dialog.getByRole("button", { name: "Ajouter un horaire" }));
    await page.keyboard.press("Enter");
    await tabTo(page, dialog.getByRole("button", { name: "Enregistrer et suivant" }));
    await page.keyboard.press("Enter");
    await expectStep(dialog, "Test Rémi", "4 / 5");

    // « Terminer » après une saisie : confirmation, puis bilan sans l'élève abandonné.
    await tabTo(page, dialog.getByRole("button", { name: "Ajouter un horaire" }));
    await page.keyboard.press("Enter");
    await expect(dialog.getByRole("button", { name: /^Retirer lundi / })).toHaveCount(1);
    await tabTo(page, dialog.getByRole("button", { name: "Terminer" }));
    await page.keyboard.press("Enter");
    const confirm = page.getByRole("dialog", { name: "Abandonner les modifications ?" });
    await expect(confirm.getByRole("button", { name: "Continuer la saisie" })).toBeFocused();
    await tabTo(page, confirm.getByRole("button", { name: "Abandonner" }), { back: true });
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    await expect(toast(page)).toContainText(
      "Saisie en série arrêtée : 2 élèves enregistrés, 1 passé.",
    );
    // Le focus revient au bouton qui a lancé la série.
    await expect(seriesButton(page)).toBeFocused();
    await expect(listedNames(page)).toHaveText(["Test Léa", "Test Rémi", "Test Tom"]);
  });
});
