import { expect, type Locator, type Page, test } from "@playwright/test";
import type { SeedPlanning } from "../src/test/e2e";
import {
  createSeason,
  demoClub,
  fixToday,
  goToPlanning,
  lesson,
  seedPlanning,
} from "./support/planning";

/**
 * Saisie des disponibilités dans la fiche élève (lot L18, docs/SPECS.md §3.5
 * et §8) : la frise des moniteurs, dans une section « Disponible chaque
 * semaine » ; les plages s'enregistrent avec la fiche, sous la garde de
 * saisie, avec annuler / rétablir ; lecture seule dans une saison terminée.
 * Club de démonstration : « Galaxie vert » (Léa, Tom, Zoé) le lundi à 10h00 ;
 * les élèves s'appellent tous « Test ».
 */

test.beforeEach(async ({ page }) => {
  await fixToday(page);
});

function tab(page: Page, name: string) {
  return page.getByRole("navigation", { name: "Fiches du club" }).getByRole("link", { name });
}

/** Saison et club de démonstration (plages d'élève éventuelles), onglet Élèves ouvert. */
async function openStudents(page: Page, spec: SeedPlanning = demoClub) {
  await createSeason(page);
  await seedPlanning(page, spec);
  await tab(page, "Élèves").click();
  await expect(page.getByTestId("student-count")).toHaveText("8 élèves");
}

/** Ouvre la fiche d'un élève de la liste ; renvoie la fenêtre et sa section des disponibilités. */
async function openStudent(page: Page, firstName: string, title = "Modifier l'élève") {
  await page.getByRole("button", { name: `Test ${firstName}`, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: title });
  const section = dialog.getByRole("region", { name: "Disponible chaque semaine" });
  await expect(section).toBeVisible();
  return { dialog, section };
}

/** Saisie précise d'un horaire au clavier, sous la frise. */
async function addSlot(section: Locator, day: string, from: string, to: string) {
  const form = section.getByRole("form", { name: "Saisir un horaire" });
  await form.getByLabel("Jour", { exact: false }).selectOption({ label: day });
  await form.getByLabel("De", { exact: false }).selectOption(from);
  await form.getByLabel("À", { exact: false }).selectOption(to);
  await form.getByRole("button", { name: "Ajouter un horaire" }).click();
}

/** Glisse dans une rangée de la frise d'un repère horaire à un autre. */
async function dragAlong(page: Page, row: Locator, from: string, to: string) {
  const start = await row.locator(`[data-time="${from}"]`).boundingBox();
  const end = await row.locator(`[data-time="${to}"]`).boundingBox();
  if (!start || !end) throw new Error("cases introuvables");
  await page.mouse.move(start.x + 1, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + 1, end.y + end.height / 2, { steps: 12 });
  await page.mouse.up();
}

/** Horaires affichés d'un jour (pastilles « Retirer … »), dans l'ordre. */
function removeButtons(section: Locator, day: string) {
  return section.getByRole("button", { name: new RegExp(`^Retirer ${day} `) });
}

/** Le jour n'affiche que ces horaires (« Retirer mercredi 14:00–18:00 »…), dans l'ordre. */
async function expectSlots(section: Locator, day: string, names: string[]) {
  const buttons = removeButtons(section, day);
  await expect(buttons).toHaveCount(names.length);
  for (const [i, name] of names.entries()) {
    await expect(buttons.nth(i)).toHaveAccessibleName(name);
  }
}

const EVERYWHERE = "Aucun horaire : considéré disponible partout.";

test.describe("disponibilités dans la fiche élève", () => {
  test("pose une plage le mercredi de 14 h à 18 h, enregistrée avec la fiche", async ({ page }) => {
    await openStudents(page);
    let { dialog, section } = await openStudent(page, "Léa");
    const state = section.getByTestId("student-availability-state");
    await expect(state).toHaveText(EVERYWHERE);

    await addSlot(section, "Mercredi", "14:00", "18:00");
    const wednesday = section.getByRole("group", { name: "Disponibilités du mercredi" });
    await expect(wednesday.locator('[data-time="17:45"]')).toHaveAttribute(
      "data-available",
      "true",
    );
    await expect(wednesday.locator('[data-time="18:00"]')).toHaveAttribute(
      "data-available",
      "false",
    );
    await expectSlots(section, "mercredi", ["Retirer mercredi 14:00–18:00"]);
    await expect(state).not.toHaveText(EVERYWHERE);

    await dialog.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(dialog).toBeHidden();

    // À la réouverture, la plage est là ; un autre élève n'en a aucune.
    ({ dialog, section } = await openStudent(page, "Léa"));
    await expectSlots(section, "mercredi", ["Retirer mercredi 14:00–18:00"]);
    await expect(section.getByTestId("student-availability-state")).not.toHaveText(EVERYWHERE);
    await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
    await expect(dialog).toBeHidden();
    ({ dialog, section } = await openStudent(page, "Tom"));
    await expect(section.getByTestId("student-availability-state")).toHaveText(EVERYWHERE);
    await dialog.getByRole("button", { name: "Annuler", exact: true }).click();

    // Le planning en tient compte : Léa n'est pas disponible le lundi à 10h00.
    await goToPlanning(page);
    await expect(lesson(page, "Galaxie vert")).toHaveAccessibleDescription(
      /1 élève hors disponibilités : Léa Test$/,
    );
  });

  test("deux plages contiguës du même jour s'affichent fusionnées", async ({ page }) => {
    await openStudents(page, {
      ...demoClub,
      // Deux plages contiguës en base, telles quelles.
      studentAvailability: {
        Léa: [
          [3, "14:00", "16:00"],
          [3, "16:00", "18:00"],
        ],
      },
    });
    let { dialog, section } = await openStudent(page, "Léa");
    await expectSlots(section, "mercredi", ["Retirer mercredi 14:00–18:00"]);

    // Au clavier, puis à la frise : chaque fois une seule plage pour le jour.
    await addSlot(section, "Samedi", "09:00", "10:00");
    await addSlot(section, "Samedi", "10:00", "12:00");
    await expectSlots(section, "samedi", ["Retirer samedi 09:00–12:00"]);
    const tuesday = section.getByRole("group", { name: "Disponibilités du mardi" });
    await dragAlong(page, tuesday, "14:00", "16:00");
    await expectSlots(section, "mardi", ["Retirer mardi 14:00–16:00"]);
    await dragAlong(page, tuesday, "16:00", "18:00");
    await expectSlots(section, "mardi", ["Retirer mardi 14:00–18:00"]);

    await dialog.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(dialog).toBeHidden();
    ({ dialog, section } = await openStudent(page, "Léa"));
    await expectSlots(section, "mardi", ["Retirer mardi 14:00–18:00"]);
    await expectSlots(section, "samedi", ["Retirer samedi 09:00–12:00"]);
  });

  test("« Effacer tous les horaires » puis enregistrer : l'élève redevient disponible partout", async ({
    page,
  }) => {
    await openStudents(page, {
      ...demoClub,
      studentAvailability: { Léa: [[3, "14:00", "18:00"]] },
    });
    let { dialog, section } = await openStudent(page, "Léa");
    const state = section.getByTestId("student-availability-state");
    await expect(state).not.toHaveText(EVERYWHERE);

    await section.getByRole("button", { name: "Effacer tous les horaires" }).click();
    await expect(state).toHaveText(EVERYWHERE);
    await expect(removeButtons(section, "mercredi")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(dialog).toBeHidden();

    ({ dialog, section } = await openStudent(page, "Léa"));
    await expect(section.getByTestId("student-availability-state")).toHaveText(EVERYWHERE);
    // Aucune pastille d'horaire (« Retirer mercredi 14:00–18:00 »), quel que soit le jour.
    await expect(section.getByRole("button", { name: /^Retirer \S+ \d/ })).toHaveCount(0);
    await expect(
      section.getByRole("button", { name: "Effacer tous les horaires" }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  test("fermer après une modification des plages demande confirmation", async ({ page }) => {
    await openStudents(page);
    let { dialog, section } = await openStudent(page, "Léa");
    await addSlot(section, "Mercredi", "14:00", "18:00");
    await expect(removeButtons(section, "mercredi")).toHaveCount(1);

    await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
    const discard = page.getByRole("dialog", { name: "Abandonner les modifications ?" });
    await expect(discard).toBeVisible();
    await discard.getByRole("button", { name: "Abandonner" }).click();
    await expect(dialog).toBeHidden();

    // Rien n'a été enregistré ; une modification défaite ne demande plus rien.
    ({ dialog, section } = await openStudent(page, "Léa"));
    await expect(section.getByTestId("student-availability-state")).toHaveText(EVERYWHERE);
    await addSlot(section, "Mercredi", "14:00", "18:00");
    await expect(removeButtons(section, "mercredi")).toHaveCount(1);
    await section.getByRole("button", { name: "Défaire la modification" }).click();
    await expect(removeButtons(section, "mercredi")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(discard).toHaveCount(0);
  });

  test("annuler une modification (« Défaire ») restaure les plages précédentes, « Refaire » la rejoue", async ({
    page,
  }) => {
    await openStudents(page, {
      ...demoClub,
      studentAvailability: { Léa: [[3, "14:00", "18:00"]] },
    });
    let { dialog, section } = await openStudent(page, "Léa");
    const undo = section.getByRole("button", { name: "Défaire la modification" });
    const redo = section.getByRole("button", { name: "Refaire la modification" });
    const state = section.getByTestId("student-availability-state");
    await expect(undo).toHaveAttribute("aria-disabled", "true");
    await expect(redo).toHaveAttribute("aria-disabled", "true");

    await addSlot(section, "Samedi", "09:00", "12:00");
    await section.getByRole("button", { name: "Effacer tous les horaires" }).click();
    await expect(state).toHaveText(EVERYWHERE);

    // Défaire : les plages d'avant l'effacement reviennent, avec l'ajout du samedi.
    await undo.click();
    await expect(state).not.toHaveText(EVERYWHERE);
    await expectSlots(section, "mercredi", ["Retirer mercredi 14:00–18:00"]);
    await expectSlots(section, "samedi", ["Retirer samedi 09:00–12:00"]);
    // Encore : l'ajout du samedi est défait, il ne reste rien à défaire.
    await undo.click();
    await expect(removeButtons(section, "samedi")).toHaveCount(0);
    await expect(removeButtons(section, "mercredi")).toHaveCount(1);
    await expect(undo).toHaveAttribute("aria-disabled", "true");

    // Refaire rejoue l'ajout du samedi.
    await redo.click();
    await expect(removeButtons(section, "samedi")).toHaveCount(1);
    await expect(removeButtons(section, "mercredi")).toHaveCount(1);

    await dialog.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(dialog).toBeHidden();
    ({ dialog, section } = await openStudent(page, "Léa"));
    await expectSlots(section, "mercredi", ["Retirer mercredi 14:00–18:00"]);
    await expectSlots(section, "samedi", ["Retirer samedi 09:00–12:00"]);
  });

  test("en création, les plages s'enregistrent avec le nouvel élève", async ({ page }) => {
    await openStudents(page);
    await page.getByRole("button", { name: "Nouvel élève" }).click();
    const dialog = page.getByRole("dialog", { name: "Nouvel élève" });
    const section = dialog.getByRole("region", { name: "Disponible chaque semaine" });
    await expect(section.getByTestId("student-availability-state")).toHaveText(EVERYWHERE);
    await dialog.getByLabel("Prénom", { exact: true }).fill("Nina");
    await dialog.getByLabel("Nom", { exact: true }).fill("Test");
    await dialog.getByLabel("Téléphone", { exact: true }).fill("0601020304");
    await addSlot(section, "Jeudi", "17:00", "19:00");
    await dialog.getByRole("button", { name: "Créer l'élève" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("student-count")).toHaveText("9 élèves");

    const reopened = await openStudent(page, "Nina");
    await expectSlots(reopened.section, "jeudi", ["Retirer jeudi 17:00–19:00"]);
  });

  test("« Enregistrer et ajouter un autre » enregistre les plages, la fiche suivante repart sans plage", async ({
    page,
  }) => {
    await openStudents(page);
    await page.getByRole("button", { name: "Nouvel élève" }).click();
    const dialog = page.getByRole("dialog", { name: "Nouvel élève" });
    const section = dialog.getByRole("region", { name: "Disponible chaque semaine" });
    const state = section.getByTestId("student-availability-state");
    await dialog.getByLabel("Prénom", { exact: true }).fill("Nina");
    await dialog.getByLabel("Nom", { exact: true }).fill("Test");
    await dialog.getByLabel("Téléphone", { exact: true }).fill("0601020304");
    await addSlot(section, "Jeudi", "17:00", "19:00");
    await expect(state).not.toHaveText(EVERYWHERE);
    await dialog.getByRole("button", { name: "Enregistrer et ajouter un autre" }).click();

    // Fiche suivante : vide, sans plage ni historique.
    await expect(page.getByTestId("student-count")).toHaveText("9 élèves");
    await expect(dialog.getByLabel("Prénom", { exact: true })).toHaveValue("");
    await expect(state).toHaveText(EVERYWHERE);
    await expect(section.getByRole("button", { name: /^Retirer \S+ \d/ })).toHaveCount(0);
    await expect(section.getByRole("button", { name: "Défaire la modification" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await dialog.getByRole("button", { name: "Annuler" }).click();
    await expect(dialog).toBeHidden();

    const reopened = await openStudent(page, "Nina");
    await expectSlots(reopened.section, "jeudi", ["Retirer jeudi 17:00–19:00"]);
  });

  test("deux plages disjointes du même jour sont gardées toutes les deux", async ({ page }) => {
    await openStudents(page);
    let { dialog, section } = await openStudent(page, "Léa");
    await addSlot(section, "Samedi", "09:00", "12:00");
    await addSlot(section, "Samedi", "14:00", "18:00");
    await expectSlots(section, "samedi", [
      "Retirer samedi 09:00–12:00",
      "Retirer samedi 14:00–18:00",
    ]);
    await dialog.getByRole("button", { name: "Enregistrer" }).click();
    await expect(dialog).toBeHidden();

    ({ dialog, section } = await openStudent(page, "Léa"));
    await expectSlots(section, "samedi", [
      "Retirer samedi 09:00–12:00",
      "Retirer samedi 14:00–18:00",
    ]);
    const saturday = section.getByRole("group", { name: "Disponibilités du samedi" });
    await expect(saturday.locator('[data-time="12:00"]')).toHaveAttribute(
      "data-available",
      "false",
    );
    await expect(saturday.locator('[data-time="14:00"]')).toHaveAttribute("data-available", "true");
  });

  test("la fiche d'un élève d'une saison terminée montre ses plages sans pouvoir les modifier", async ({
    page,
  }) => {
    await createSeason(page);
    await seedPlanning(page, {
      ...demoClub,
      studentAvailability: { Léa: [[3, "14:00", "18:00"]] },
    });
    await page.getByRole("button", { name: "Nouvelle saison" }).click();
    const create = page.getByRole("dialog", { name: "Nouvelle saison" });
    await create.getByRole("button", { name: "Dupliquer la saison" }).click();
    await expect(create).toBeHidden();

    // La copie de la nouvelle saison a gardé ses plages.
    await tab(page, "Élèves").click();
    let { dialog, section } = await openStudent(page, "Léa");
    await expectSlots(section, "mercredi", ["Retirer mercredi 14:00–18:00"]);
    await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
    await expect(dialog).toBeHidden();

    await page.getByLabel("Saison affichée", { exact: true }).selectOption({
      label: "2026-2027 (terminée)",
    });
    await expect(page.getByTestId("read-only-banner")).toBeVisible();
    await tab(page, "Élèves").click();
    ({ dialog, section } = await openStudent(page, "Léa", "Fiche élève"));
    await expect(section.getByRole("list", { name: "Horaires de disponibilité" })).toContainText(
      "14:00–18:00",
    );
    await expect(section.getByTestId("student-availability-state")).not.toHaveText(EVERYWHERE);
    for (const name of [
      "Retirer mercredi 14:00–18:00",
      "Ajouter un horaire",
      "Effacer tous les horaires",
      "Défaire la modification",
      "Refaire la modification",
    ]) {
      await expect(section.getByRole("button", { name, exact: true })).toHaveCount(0);
    }
    await expect(section.getByRole("form", { name: "Saisir un horaire" })).toHaveCount(0);
    // Peindre la frise n'a aucun effet.
    const tuesday = section.getByRole("group", { name: "Disponibilités du mardi" });
    const cell = tuesday.locator('[data-time="10:00"]');
    await expect(cell).toHaveAttribute("data-available", "false");
    await dragAlong(page, tuesday, "10:00", "12:00");
    await expect(cell).toHaveAttribute("data-available", "false");
  });
});
