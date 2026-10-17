import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  createSeason,
  demoClub,
  lesson,
  openFilters,
  openPlanning,
  seedPlanning,
  slotPoint,
} from "./support/planning";

/**
 * Socle UX commun (lot L9) : rien ne bouge sous le curseur (zone de message
 * réservée, barre de mode à hauteur fixe, éléments toujours présents), garde
 * des modales (focus initial, Échap en cascade, confirmation si la saisie a
 * changé), toast commun, raison des boutons grisés, cases à cocher nommées.
 */

/**
 * Position d'un élément dans la page, défilements compris : un défilement
 * (provoqué par un clic de Playwright) n'est pas un décalage de mise en page.
 */
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
  return page.getByRole("navigation", { name: "Fiches du club" }).getByRole("link", { name });
}

function discardDialog(page: Page) {
  return page.getByRole("dialog", { name: "Abandonner les modifications ?" });
}

test.describe("rien ne bouge sous le curseur", () => {
  test("« Créer le cours » reste en place quand un avertissement apparaît ou au survol d'un cours", async ({
    page,
  }) => {
    await openPlanning(page);
    await page.getByRole("button", { name: "Nouveau cours" }).click();
    const form = page.getByRole("form", { name: "Nouveau cours" });
    const create = form.getByRole("button", { name: "Créer le cours" });
    const warnings = form.getByRole("list", { name: "Avertissements du créneau" });
    const before = await position(create);
    await expect(warnings).toBeEmpty();

    // Un avertissement : la zone réservée l'accueille, le bouton ne bouge pas.
    await form.getByLabel("Moniteur", { exact: true }).selectOption({
      label: "○ Marc Leroy (aucune disponibilité saisie)",
    });
    await expect(warnings).toContainText("Aucune disponibilité saisie pour Marc");
    expect(await position(create)).toEqual(before);

    // Trois avertissements : « + N autres », dépliable au clic seulement.
    await form
      .getByLabel("Groupe", { exact: true })
      .selectOption({ label: "Adultes débutants (3/2)" });
    await form.getByLabel("Jour").selectOption({ label: "Lundi" });
    await form.getByLabel("Court").selectOption({ label: "Court 1" });
    await form.getByLabel("Début").selectOption({ label: "10:00" });
    const more = form.getByRole("button", { name: /^\+ \d+ autres? avertissements?$/ });
    await expect(more).toBeVisible();
    expect(await position(create)).toEqual(before);
    await more.click();
    await expect(warnings).toContainText("3 / 2 élèves");
    await expect(warnings).toContainText("Court 1 déjà occupé par Galaxie vert");
    await form.getByRole("button", { name: "Masquer les autres messages" }).click();
    expect(await position(create)).toEqual(before);

    // Survol d'un cours : la pastille des hachures tient dans la barre de mode (B7) ;
    // elle garde le moniteur choisi dans le panneau plutôt que celui survolé (B8).
    const modeBar = page.getByTestId("mode-bar");
    const barHeight = (await modeBar.boundingBox())?.height;
    await lesson(page, "Ados perfectionnement").hover();
    await expect(page.getByTestId("hatch-info")).toHaveText(
      "Zones rayées : Marc Leroy (aucune disponibilité)",
    );
    expect((await modeBar.boundingBox())?.height).toBe(barHeight);
    expect(await position(create)).toEqual(before);
  });

  test("la barre de mode garde sa hauteur quand la pastille des hachures apparaît (B7)", async ({
    page,
  }) => {
    await openPlanning(page);
    const modeBar = page.getByTestId("mode-bar");
    const panel = page.getByRole("complementary", { name: "Panneau latéral" });
    const before = { bar: (await modeBar.boundingBox())?.height, panel: await position(panel) };
    // Aucun moniteur choisi : la pastille n'existe qu'au survol d'un cours.
    await expect(page.getByTestId("hatch-info")).toHaveCount(0);
    await lesson(page, "Galaxie vert").hover();
    await expect(page.getByTestId("hatch-info")).toHaveText(/^Zones rayées : Karim Benali/);
    expect({ bar: (await modeBar.boundingBox())?.height, panel: await position(panel) }).toEqual(
      before,
    );
    await page.mouse.move(5, 5);
    await expect(page.getByTestId("hatch-info")).toHaveCount(0);
    expect((await modeBar.boundingBox())?.height).toBe(before.bar);
  });

  test("la pastille de la barre de mode donne son détail en bulle", async ({ page }) => {
    await openPlanning(page);
    const legend = page.getByRole("group", { name: "Légende des moniteurs" });
    await legend.getByRole("button", { name: /^Marc Leroy/ }).click();
    const pill = page.getByTestId("hatch-info");
    await expect(pill).toHaveText("Zones rayées : Marc Leroy (aucune disponibilité)");
    await pill.hover();
    await expect(page.getByRole("tooltip")).toHaveText(
      "Zones rayées : Marc Leroy n'a saisi aucune disponibilité (indisponible partout)",
    );
    await expect(pill).toHaveAccessibleDescription(/indisponible partout/);
    await page.mouse.move(5, 5);
    await expect(page.getByRole("tooltip")).toHaveCount(0);
  });

  test("les boutons du formulaire élève restent en place", async ({ page }) => {
    await createSeason(page);
    await tab(page, "Élèves").click();
    await page.getByRole("button", { name: "Nouvel élève" }).click();
    const dialog = page.getByRole("dialog", { name: "Nouvel élève" });
    const create = dialog.getByRole("button", { name: "Créer l'élève" });
    const cancel = dialog.getByRole("button", { name: "Annuler" });
    const before = [await position(create), await position(cancel)];

    await dialog.getByLabel("Date de naissance").fill("2016-05-04");
    await expect(dialog.getByRole("list", { name: "Messages" })).toContainText(
      "Élève mineur : renseignez le nom et le téléphone du responsable légal.",
    );
    expect([await position(create), await position(cancel)]).toEqual(before);
  });

  test("le tableau de la fiche groupe ne descend pas (recherche et alertes)", async ({ page }) => {
    await openPlanning(page);
    await page
      .getByRole("navigation", { name: "Navigation principale" })
      .getByRole("link", { name: "Le club" })
      .click();
    await tab(page, "Groupes").click();
    await page.getByRole("link", { name: "Adultes débutants" }).click();
    const members = page.getByRole("table", { name: "Élèves du groupe" });
    const alerts = page.getByRole("list", { name: "Alertes" });
    await expect(alerts).toContainText("3 / 2 élèves");
    const before = await position(members);

    // Résultats de recherche en liste superposée.
    await page.getByLabel("Ajouter un élève (nom, prénom, téléphone)").fill("hugo");
    await expect(page.getByRole("listbox", { name: "Élèves trouvés" })).toBeVisible();
    expect(await position(members)).toEqual(before);

    // Retrait d'un membre : l'alerte disparaît, la place reste réservée.
    await page.getByRole("button", { name: "Retirer Test Rémi du groupe" }).click();
    await expect(page.getByTestId("group-size")).toHaveText("2 / 2");
    await expect(alerts).toBeEmpty();
    await expect(page.getByRole("listbox", { name: "Élèves trouvés" })).toBeHidden();
    expect(await position(members)).toEqual(before);
  });

  test("« Effacer les filtres » est toujours présent, grisé avec sa raison", async ({
    page,
    browserName,
  }) => {
    await openPlanning(page);
    const menu = await openFilters(page);
    const clear = menu.getByRole("button", { name: "Effacer les filtres" });
    await expect(clear).toBeDisabled();
    await expect(clear).toHaveAccessibleDescription("Aucun filtre actif");
    await expect(page.getByText("Aucun filtre actif", { exact: true })).toBeVisible();
    const before = await position(clear);

    // La raison est aussi en bulle, atteignable au clavier.
    // WebKit ne tabule vers les boutons qu'avec ⌥ (réglage par défaut de macOS).
    await page.getByLabel("Filtrer par groupe").focus();
    await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
    await expect(clear).toBeFocused();
    await expect(page.getByRole("tooltip")).toHaveText("Aucun filtre actif");

    await page
      .getByRole("group", { name: "Filtrer par court" })
      .getByRole("button", { name: "Court 1" })
      .click();
    await expect(clear).toBeEnabled();
    await expect(page.getByText("Aucun filtre actif", { exact: true })).toBeHidden();
    expect(await position(clear)).toEqual(before);
    await clear.click();
    await expect(clear).toBeDisabled();
  });

  test("les boutons grisés de la navigation et des disponibilités disent pourquoi", async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date("2026-09-02T10:00:00+02:00"));
    await openPlanning(page);
    await page
      .getByRole("group", { name: "Mode d'affichage" })
      .getByRole("button", { name: "Une semaine précise" })
      .click();
    const previous = page.getByRole("button", { name: "Semaine précédente" });
    await expect(previous).toBeDisabled();
    await expect(previous).toHaveAccessibleDescription("Première semaine de la saison");
    await previous.hover();
    await expect(page.getByRole("tooltip")).toHaveText("Première semaine de la saison");

    await page
      .getByRole("navigation", { name: "Navigation principale" })
      .getByRole("link", { name: "Le club" })
      .click();
    await tab(page, "Moniteurs").click();
    await page.getByRole("link", { name: /Julie/ }).first().click();
    const addSlot = page.getByRole("form", { name: "Saisir un horaire" });
    const add = addSlot.getByRole("button", { name: "Ajouter un horaire" });
    await expect(add).toBeEnabled();
    await addSlot.getByLabel("De").selectOption("14:00");
    await addSlot.getByLabel("À").selectOption("12:00");
    await expect(add).toBeDisabled();
    await expect(addSlot.getByText("L'heure de fin doit suivre l'heure de début")).toBeVisible();
  });
});

test.describe("garde des modales", () => {
  test("focus sur le premier champ, ou sur « Annuler » pour une suppression", async ({ page }) => {
    await openPlanning(page);
    await page
      .getByRole("navigation", { name: "Navigation principale" })
      .getByRole("link", { name: "Le club" })
      .click();
    await tab(page, "Courts").click();
    await page.getByRole("button", { name: "Nouveau court" }).click();
    const court = page.getByRole("dialog", { name: "Nouveau court" });
    await expect(court.getByLabel("Nom")).toBeFocused();
    await court.getByRole("button", { name: "Fermer" }).click();
    await expect(court).toBeHidden();

    await page.getByRole("button", { name: "Supprimer Court 2" }).click();
    const confirm = page.getByRole("dialog", { name: "Supprimer Court 2 ?" });
    await expect(confirm.getByRole("button", { name: "Annuler" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(confirm).toBeHidden();

    await tab(page, "Élèves").click();
    await page.getByRole("button", { name: "Nouvel élève" }).click();
    // Prénom avant Nom (v1.1) : premier champ de la fiche élève.
    await expect(
      page.getByRole("dialog", { name: "Nouvel élève" }).getByLabel("Prénom"),
    ).toBeFocused();
    await page.keyboard.press("Escape");

    // De même pour la fiche moniteur, où Prénom précède aussi Nom.
    await tab(page, "Moniteurs").click();
    await page.getByRole("button", { name: "Nouveau moniteur" }).click();
    const instructor = page.getByRole("dialog", { name: "Nouveau moniteur" });
    await expect(instructor.getByLabel("Prénom")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(instructor.getByLabel("Nom", { exact: true })).toBeFocused();
  });

  test("Échap dans un champ date ne ferme pas ; confirmation seulement si la saisie a changé", async ({
    page,
  }) => {
    await createSeason(page);
    await tab(page, "Fermetures").click();
    const open = () => page.getByRole("button", { name: "Nouvelle fermeture" }).click();
    const dialog = page.getByRole("dialog", { name: "Nouvelle fermeture" });

    // Saisie intacte : le premier Échap reste au champ date, le suivant ferme sans
    // question. Repli retenu (risques de L9) : les trois moteurs ne disent pas si
    // le calendrier natif est ouvert, le premier Échap lui revient donc toujours.
    await open();
    await expect(dialog.getByLabel("Libellé")).toBeFocused();
    await dialog.getByLabel("Du", { exact: true }).focus();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(discardDialog(page)).toHaveCount(0);

    // Saisie modifiée : Échap demande confirmation, « Continuer la saisie » par défaut.
    await open();
    await dialog.getByLabel("Libellé").fill("Tournoi du club");
    await page.keyboard.press("Escape");
    const discard = discardDialog(page);
    await expect(discard).toBeVisible();
    await expect(discard.getByRole("button", { name: "Continuer la saisie" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(discard).toBeHidden();
    await expect(dialog.getByLabel("Libellé")).toHaveValue("Tournoi du club");

    // Échap dans la confirmation y revient aussi ; « Annuler » passe par la même garde.
    await dialog.getByRole("button", { name: "Annuler" }).click();
    await expect(discard).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(discard).toBeHidden();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Fermer" }).click();
    await discard.getByRole("button", { name: "Abandonner" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("list", { name: "Périodes de fermeture" })).toHaveCount(0);

    // Revenue à son état d'ouverture, la saisie n'est plus « modifiée ».
    await open();
    await dialog.getByLabel("Libellé").fill("x");
    await dialog.getByLabel("Libellé").fill("");
    await dialog.getByRole("button", { name: "Annuler" }).click();
    await expect(dialog).toBeHidden();
  });

  test("le panneau de cours garde sa saisie : Échap, autre créneau, fermeture", async ({
    page,
  }) => {
    await openPlanning(page);
    // Sans modification, passer d'un cours à l'autre se fait sans question.
    await lesson(page, "Galaxie vert").click();
    await lesson(page, "Ados perfectionnement").click();
    await expect(page.getByRole("form", { name: "Modifier le cours" })).toBeVisible();
    await expect(discardDialog(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Fermer le panneau" }).click();

    await page.getByRole("button", { name: "Nouveau cours" }).click();
    const form = page.getByRole("form", { name: "Nouveau cours" });
    await expect(form.getByLabel("Rechercher un groupe")).toBeFocused();
    await form.getByLabel("Court").selectOption({ label: "Court 2" });
    // Échap, même dans un champ, passe par la garde : confirmation, saisie gardée.
    await form.getByLabel("Court").focus();
    await page.keyboard.press("Escape");
    await expect(discardDialog(page)).toBeVisible();
    await discardDialog(page).getByRole("button", { name: "Continuer la saisie" }).click();
    await expect(form).toBeVisible();

    // Choisir un autre créneau sur la grille : confirmation, la saisie est gardée.
    const from = await slotPoint(page, 1, 0, "09:00");
    const to = await slotPoint(page, 1, 0, "10:00");
    await page.mouse.move(from.x, from.y + 2);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y - 2, { steps: 6 });
    await page.mouse.up();
    const discard = discardDialog(page);
    await expect(discard).toBeVisible();
    await discard.getByRole("button", { name: "Continuer la saisie" }).click();
    await expect(form.getByLabel("Court").locator("option:checked")).toHaveText("Court 2");

    await form.getByRole("button", { name: "Fermer le panneau" }).click();
    await discard.getByRole("button", { name: "Abandonner" }).click();
    await expect(form).toBeHidden();
  });
});

test.describe("toast commun", () => {
  test("confirme la création de la saison (B11) dans une région aria-live", async ({ page }) => {
    await createSeason(page);
    const region = page.getByTestId("toast-region");
    await expect(region).toHaveAttribute("aria-live", "polite");
    // Première saison : le guidage (L15) ajoute « Étape suivante » à la confirmation.
    await expect(
      region.getByTestId("toast").getByText("Saison « 2026-2027 » créée", { exact: true }),
    ).toBeVisible();
    await expect(region.getByRole("button", { name: "Étape suivante : Courts" })).toBeVisible();
    await expect(page.getByText("Modifications enregistrées.")).toHaveCount(0);
  });

  test("un succès reste affiché tant qu'il est survolé, puis s'efface", async ({ page }) => {
    await page.clock.install();
    await createSeason(page);
    const toast = page.getByTestId("toast");
    await page.getByRole("form", { name: "Saison" }).getByLabel("Nom", { exact: true }).fill("X");
    await page
      .getByRole("form", { name: "Saison" })
      .getByRole("button", { name: "Enregistrer" })
      .click();
    await expect(toast).toHaveText("Modifications enregistrées.");
    // En bas à droite de la fenêtre, un seul à la fois : le nouveau remplace l'ancien.
    const box = await toast.boundingBox();
    const viewport = page.viewportSize();
    if (!box || !viewport) throw new Error("toast introuvable");
    expect(viewport.width - (box.x + box.width)).toBeLessThan(24);
    expect(viewport.height - (box.y + box.height)).toBeLessThan(24);
    await toast.hover();
    await page.clock.runFor(5_000);
    await expect(toast).toBeVisible();
    await page.mouse.move(5, 5);
    await page.clock.runFor(4_500);
    await expect(toast).toBeHidden();
  });
});

test.describe("toast commun du planning", () => {
  test("un seul toast à la fois : le nouveau message remplace l'ancien", async ({ page }) => {
    await openPlanning(page);
    const toasts = page.getByTestId("toast");
    await lesson(page, "Galaxie vert").click();
    await page.keyboard.press("Delete");
    await expect(toasts).toHaveCount(1);
    await expect(toasts).toContainText(/^Suppression du cours/);
    // Ctrl/⌘ Z pendant que le premier est affiché : un autre message, à sa place.
    await page.keyboard.press("ControlOrMeta+z");
    await expect(toasts).toContainText(/^Annulé : /);
    await expect(toasts).toHaveCount(1);
    await expect(toasts).not.toContainText(/^Suppression du cours/);
  });

  test("« Annuler cette action » affiche « Annulé : … »", async ({ page }) => {
    await openPlanning(page);
    await lesson(page, "Galaxie vert").click();
    await page.keyboard.press("Delete");
    await expect(lesson(page, "Galaxie vert")).toHaveCount(0);
    const toast = page.getByTestId("toast");
    await toast.getByRole("button", { name: "Annuler cette action" }).click();
    await expect(lesson(page, "Galaxie vert")).toHaveCount(1);
    await expect(toast).toContainText(/^Annulé : /);
  });

  test("un échec d'enregistrement reste affiché jusqu'à sa fermeture", async ({ page }) => {
    await page.clock.install();
    await openPlanning(page);
    await page.evaluate(async (path) => {
      const tools = await import(/* @vite-ignore */ path);
      await tools.archiveActiveSeason();
    }, "/src/test/e2e.ts");
    await lesson(page, "Galaxie vert").click();
    await page.keyboard.press("Delete");
    const alerts = page.getByTestId("toast-alerts");
    await expect(alerts).toHaveAttribute("aria-live", "assertive");
    const toast = alerts.getByTestId("toast");
    await expect(toast).toContainText("La modification n'a pas pu être enregistrée");
    // L'état est relu : le cours refusé revient sur la grille.
    await expect(lesson(page, "Galaxie vert")).toHaveCount(1);
    await page.clock.runFor(10_000);
    await expect(toast).toBeVisible();
    await toast.getByRole("button", { name: "Masquer le message" }).click();
    await expect(toast).toBeHidden();
  });

  test("les toasts restent visibles au-dessus d'une fenêtre modale", async ({ page }) => {
    await createSeason(page);
    await tab(page, "Courts").click();
    await page.getByRole("button", { name: "Nouveau court" }).click();
    const dialog = page.getByRole("dialog", { name: "Nouveau court" });
    await expect(dialog.getByTestId("toast-region")).toHaveCount(1);
    await dialog.getByRole("button", { name: "Annuler" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator("dialog [data-testid=toast-region]")).toHaveCount(0);
  });
});

test.describe("erreurs de champ", () => {
  test("l'erreur d'un champ s'efface dès qu'il est modifié (B10)", async ({ page }) => {
    await createSeason(page);
    await tab(page, "Courts").click();
    await page.getByRole("button", { name: "Nouveau court" }).click();
    const dialog = page.getByRole("dialog", { name: "Nouveau court" });
    const name = dialog.getByLabel("Nom");
    await name.fill("");
    await dialog.getByRole("button", { name: "Enregistrer" }).click();
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await name.fill("C");
    await expect(name).not.toHaveAttribute("aria-invalid");
  });

  /**
   * Les autres formulaires (aide commune `useFormErrors`) : un champ
   * obligatoire laissé vide est signalé, puis son erreur disparaît dès la
   * première frappe, avant tout nouvel enregistrement.
   */
  const forms: {
    name: string;
    open: (page: Page) => Promise<Locator>;
    field: string;
    submit: string;
  }[] = [
    {
      name: "saison",
      open: async (page) => {
        await tab(page, "Saison").click();
        return page.getByRole("form", { name: "Saison" });
      },
      field: "Nom",
      submit: "Enregistrer",
    },
    {
      name: "moniteur",
      open: async (page) => {
        await tab(page, "Moniteurs").click();
        await page.getByRole("button", { name: "Nouveau moniteur" }).click();
        return page.getByRole("dialog", { name: "Nouveau moniteur" });
      },
      field: "Prénom",
      submit: "Créer le moniteur",
    },
    {
      name: "indisponibilité",
      open: async (page) => {
        await tab(page, "Moniteurs").click();
        await page.getByRole("link", { name: /Julie/ }).first().click();
        return page.getByRole("form", { name: "Ajouter l'indisponibilité" });
      },
      field: "Du",
      submit: "Ajouter l'indisponibilité",
    },
    {
      name: "groupe",
      open: async (page) => {
        await tab(page, "Groupes").click();
        await page.getByRole("button", { name: "Nouveau groupe" }).click();
        return page.getByRole("dialog", { name: "Nouveau groupe" });
      },
      field: "Nom",
      submit: "Créer le groupe",
    },
    {
      name: "élève",
      open: async (page) => {
        await tab(page, "Élèves").click();
        await page.getByRole("button", { name: "Nouvel élève" }).click();
        return page.getByRole("dialog", { name: "Nouvel élève" });
      },
      field: "Prénom",
      submit: "Créer l'élève",
    },
    {
      name: "niveau",
      open: async (page) => {
        await tab(page, "Niveaux").click();
        await page.getByRole("button", { name: "Nouveau niveau" }).click();
        return page.getByRole("dialog", { name: "Nouveau niveau" });
      },
      field: "Libellé",
      submit: "Enregistrer",
    },
  ];
  test("l'erreur générale s'affiche en rouge dans la zone réservée, puis s'efface (B10)", async ({
    page,
  }) => {
    await createSeason(page);
    await tab(page, "Fermetures").click();
    await page.getByRole("button", { name: "Nouvelle fermeture" }).click();
    const dialog = page.getByRole("dialog", { name: "Nouvelle fermeture" });
    const save = dialog.getByRole("button", { name: "Enregistrer" });
    const before = await position(save);
    // Enregistrement refusé (libellé et dates vides) : erreur générale en tête de la zone.
    await save.click();
    const alert = dialog.getByRole("list", { name: "Messages" }).getByRole("alert");
    await expect(alert).toBeVisible();
    const colors = await alert.evaluate((el) => {
      const probe = document.createElement("span");
      probe.style.color = "var(--destructive)";
      el.append(probe);
      const expected = getComputedStyle(probe).color;
      probe.remove();
      return { actual: getComputedStyle(el).color, expected };
    });
    expect(colors.actual).toBe(colors.expected);
    expect(await position(save)).toEqual(before);
    // Une modification de la saisie l'efface aussitôt.
    await dialog.getByLabel("Libellé").fill("Tournoi");
    await expect(alert).toHaveCount(0);
    expect(await position(save)).toEqual(before);
  });

  for (const form of forms) {
    test(`même règle dans le formulaire ${form.name} (B10)`, async ({ page }) => {
      await createSeason(page);
      await seedPlanning(page, demoClub);
      const scope = await form.open(page);
      const field = scope.getByLabel(form.field, { exact: true });
      await field.fill("");
      await scope.getByRole("button", { name: form.submit, exact: true }).click();
      await expect(field).toHaveAttribute("aria-invalid", "true");
      if ((await field.getAttribute("type")) === "date") await field.fill("2026-11-02");
      else await field.fill("A");
      await expect(field).not.toHaveAttribute("aria-invalid");
    });
  }
});

/**
 * Cases à cocher visibles de `scope` sans lien explicite avec leur libellé
 * (`<label for>` relié à l'identifiant de la case) ni nom propre
 * (`aria-label`) : un libellé seulement voisin est lu « on » (B12).
 */
function looseCheckboxes(scope: Locator): Promise<string[]> {
  return scope.evaluate((root) =>
    [...root.querySelectorAll<HTMLInputElement>("input[type=checkbox]")]
      .filter((box) => box.getBoundingClientRect().width > 0)
      .filter(
        (box) =>
          !box.hasAttribute("aria-label") &&
          !(box.id && [...(box.labels ?? [])].some((label) => label.htmlFor === box.id)),
      )
      .map((box) => box.outerHTML.slice(0, 100)),
  );
}

test.describe("cases à cocher", () => {
  test("chaque case est reliée à son libellé (B12)", async ({ page }) => {
    await page.goto("/#/referentiels");
    const form = page.getByRole("form", { name: "Saison" });
    const sunday = form.getByRole("checkbox", { name: "Dimanche" });
    await expect(sunday).toBeChecked();
    expect(
      await sunday.evaluate(
        (el: HTMLInputElement) =>
          el.id !== "" && [...(el.labels ?? [])].some((label) => label.htmlFor === el.id),
      ),
    ).toBe(true);
    await form.getByText("Dimanche", { exact: true }).click();
    await expect(sunday).not.toBeChecked();
  });

  test("toutes les cases des fiches et de l'import sont nommées par leur libellé (B12)", async ({
    page,
  }) => {
    await createSeason(page);
    await seedPlanning(page, demoClub);
    const check = async (scope: Locator, label: string) => {
      await expect(scope.getByRole("checkbox").first(), label).toBeVisible();
      expect(await looseCheckboxes(scope), label).toEqual([]);
    };
    await tab(page, "Saison").click();
    await check(page.getByRole("form", { name: "Saison" }), "saison");

    const dialogs: [string, string, string][] = [
      ["Courts", "Nouveau court", "Nouveau court"],
      ["Moniteurs", "Nouveau moniteur", "Nouveau moniteur"],
      ["Niveaux", "Nouveau niveau", "Nouveau niveau"],
      ["Groupes", "Nouveau groupe", "Nouveau groupe"],
      ["Élèves", "Nouvel élève", "Nouvel élève"],
      ["Fermetures", "Vacances et jours fériés…", "Vacances scolaires et jours fériés"],
    ];
    for (const [tabName, button, title] of dialogs) {
      await tab(page, tabName).click();
      await page.getByRole("button", { name: button }).click();
      const dialog = page.getByRole("dialog", { name: title });
      await check(dialog, title);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    }
    // Groupes de la fiche élève : nommés par le groupe, sa tranche et son effectif.
    await tab(page, "Élèves").click();
    await page.getByRole("button", { name: "Nouvel élève" }).click();
    await expect(
      page
        .getByRole("dialog", { name: "Nouvel élève" })
        .getByRole("checkbox", { name: /^Galaxie vert/ }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await tab(page, "Moniteurs").click();
    await page.getByRole("link", { name: /Julie/ }).first().click();
    await check(page.getByRole("form", { name: "Ajouter l'indisponibilité" }), "indisponibilité");

    await page.goto("/#/import-export");
    await page.getByRole("button", { name: "Coller depuis Excel" }).click();
    await page.getByLabel("Tableau à coller").fill("Martin\tLéo\t0611223344\n");
    await page.getByRole("button", { name: "Lire le tableau" }).click();
    await expect(
      page.getByRole("checkbox", { name: "La première ligne contient des élèves" }),
    ).toBeVisible();
    await check(page.locator("main"), "import");

    // Suppression définitive des données d'un élève (RGPD) : case de confirmation.
    // (La fenêtre d'export d'une sauvegarde n'existe que dans l'application de bureau :
    // recette RECETTE.md 8.9.)
    await page.goto("/#/referentiels/eleves");
    await page.getByRole("button", { name: "Données personnelles de Test Léa" }).click();
    const privacy = page.getByRole("dialog", { name: "Données personnelles" });
    await privacy.getByRole("button", { name: "Supprimer définitivement…" }).click();
    await expect(
      privacy.getByRole("checkbox", { name: /^Je confirme la suppression définitive/ }),
    ).toBeVisible();
    await check(privacy, "suppression des données d'un élève");
  });
});
