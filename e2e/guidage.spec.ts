import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  createLessonWithPanel,
  createSeason,
  demoClub,
  lesson,
  openPlanning,
  seedPlanning,
  showDatedWeek,
  planningTip as tip,
  guidanceWelcome as welcome,
} from "./support/planning";

/**
 * Guidage et mode d'emploi (lot L15) : depuis une base vide, l'accueil
 * « Avant de construire le planning », les pastilles d'étape des onglets du
 * club et les toasts « Étape suivante » mènent jusqu'au premier cours, puis
 * le guidage disparaît ; l'astuce du panneau change selon la situation.
 */

const tabs = (page: Page) => page.getByRole("navigation", { name: "Fiches du club" });
const tab = (page: Page, name: string) => tabs(page).getByRole("link", { name, exact: true });
const toast = (page: Page) => page.getByTestId("toast");
const mainNav = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name });

/** Suit l'action « Étape suivante » du toast et vérifie l'écran atteint. */
async function nextStep(page: Page, label: string, path: string) {
  await toast(page)
    .getByRole("button", { name: `Étape suivante : ${label}` })
    .click();
  await expect(page).toHaveURL(new RegExp(`#${path}$`));
}

async function expectMark(link: Locator, description: string) {
  await expect(link).toHaveAccessibleDescription(description);
}

test.describe("guidage de la première utilisation", () => {
  test("de la base vide au premier cours, puis le guidage disparaît", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/#/planning");

    // Accueil à la place de l'état vide : étapes dans l'ordre, un seul bouton.
    await expect(welcome(page)).toBeVisible();
    const steps = welcome(page).getByRole("list", { name: "Étapes" }).getByRole("listitem");
    const labels = ["Saison", "Courts", "Moniteurs", "Groupes", "Élèves"];
    await expect(steps).toHaveCount(labels.length);
    for (const [i, label] of labels.entries()) {
      await expect(steps.nth(i).getByText(label, { exact: true })).toBeVisible();
    }
    await expect(welcome(page).getByRole("link")).toHaveCount(1);
    // Ce qui relie un cours, un court, un moniteur et un groupe.
    await expect(welcome(page)).toContainText(
      "Le planning place des cours sur les courts du club, chacun avec un moniteur et un groupe",
    );
    await expect(welcome(page)).toContainText(
      "Niveaux et fermetures sont facultatifs et peuvent attendre.",
    );
    await welcome(page).getByRole("link", { name: "Créer la saison" }).click();

    // Pastilles d'étape : Saison en couleur, rien sur Niveaux et Fermetures.
    await expectMark(tab(page, "Saison"), "Étape 1, la suivante");
    await expectMark(tab(page, "Élèves"), "Étape 5");
    await expect(tab(page, "Niveaux").getByTestId("step-mark")).toHaveCount(0);
    await expect(tab(page, "Fermetures").getByTestId("step-mark")).toHaveCount(0);

    // 1. Saison : la confirmation (B11) reçoit « Étape suivante ».
    const season = page.getByRole("form", { name: "Saison" });
    await season.getByLabel("Nom", { exact: true }).fill("2026-2027");
    await season.getByLabel("Date de début", { exact: true }).fill("2026-09-01");
    await season.getByLabel("Date de fin", { exact: true }).fill("2027-06-30");
    await season.getByRole("button", { name: "Créer la saison" }).click();
    await expect(toast(page)).toContainText("Saison « 2026-2027 » créée");
    await expectMark(tab(page, "Saison"), "Étape 1, faite");
    await expectMark(tab(page, "Courts"), "Étape 2, la suivante");
    await nextStep(page, "Courts", "/referentiels/courts");

    // L'accueil du planning coche la saison et mène aux courts.
    await mainNav(page, "Planning").click();
    await expect(steps.first()).toContainText("Saison (fait)");
    await welcome(page).getByRole("link", { name: "Ajouter vos courts" }).click();

    // 2. Courts.
    await page.getByRole("button", { name: "Nouveau court" }).click();
    const court = page.getByRole("dialog", { name: "Nouveau court" });
    await court.getByLabel("Nom", { exact: true }).fill("Court 1");
    await court.getByRole("button", { name: "Enregistrer" }).click();
    await expect(toast(page)).toContainText("Premier court ajouté");
    await nextStep(page, "Moniteurs", "/referentiels/moniteurs");

    // 3. Moniteurs.
    await page.getByRole("button", { name: "Nouveau moniteur" }).click();
    const instructor = page.getByRole("dialog", { name: "Nouveau moniteur" });
    await instructor.getByLabel("Prénom", { exact: true }).fill("Julie");
    await instructor.getByLabel("Nom", { exact: true }).fill("Martin");
    await instructor.getByRole("button", { name: "Créer le moniteur" }).click();
    await expect(toast(page)).toContainText("Premier moniteur ajouté");
    await nextStep(page, "Groupes", "/referentiels/groupes");

    // 4. Groupes : le toast garde « Ajouter des élèves », qui mène à l'étape suivante.
    await page.getByRole("button", { name: "Nouveau groupe" }).click();
    const group = page.getByRole("dialog", { name: "Nouveau groupe" });
    await group.getByLabel("Nom", { exact: true }).fill("Galaxie vert");
    await group.getByLabel("Élèves au maximum", { exact: true }).fill("8");
    await group.getByRole("button", { name: "Créer le groupe" }).click();
    await expect(toast(page)).toContainText("Groupe « Galaxie vert » créé");
    await expectMark(tab(page, "Élèves"), "Étape 5, la suivante");
    await toast(page).getByRole("button", { name: "Ajouter des élèves" }).click();

    // 5. Élèves, depuis la fiche du groupe.
    const search = page.getByLabel("Ajouter un élève (nom, prénom, téléphone)", { exact: true });
    await expect(search).toBeFocused();
    await search.fill("Léa Petit");
    await page.getByRole("option", { name: "Créer « Léa Petit »" }).click();
    const student = page.getByRole("dialog", { name: "Nouvel élève" });
    await student.getByLabel("Téléphone", { exact: true }).fill("0611223344");
    await student.getByRole("button", { name: "Créer l'élève" }).click();
    await expect(toast(page)).toContainText("Léa Petit ajouté(e)");
    await expectMark(tab(page, "Élèves"), "Étape 5, faite");
    await nextStep(page, "Planning", "/planning");

    // Planning : plus d'accueil, l'astuce « aucun cours placé » prend le relais.
    await expect(welcome(page)).toBeHidden();
    await expect(tip(page)).toHaveAttribute("data-context", "no-lesson");
    await expect(tip(page)).toContainText("Commencez par + Nouveau cours en haut");

    // Premier cours.
    await createLessonWithPanel(page, { court: "Court 1", day: "Lundi" });
    await expect(lesson(page, "Galaxie vert")).toBeVisible();
    // Le toast du planning garde son « Annuler cette action ».
    await expect(toast(page).getByRole("button", { name: "Annuler cette action" })).toBeVisible();
    await expect(tip(page)).toHaveAttribute("data-context", "selected");

    // Le guidage a disparu : plus aucune pastille sur les onglets du club.
    await mainNav(page, "Le club").click();
    await expect(tab(page, "Saison")).toBeVisible();
    await expect(tabs(page).getByTestId("step-mark")).toHaveCount(0);
    await expect(tab(page, "Saison")).toHaveAccessibleDescription("");
  });

  test("nouvelle saison et changement de saison : aucune étape annoncée", async ({ page }) => {
    await openPlanning(page);
    // Saison vierge créée alors que la précédente est complète : pas d'« Étape suivante ».
    await createBlankSeason(page, "2027-2028");
    await expect(toast(page)).toContainText("Saison « 2027-2028 » créée");
    await expect(page.getByRole("button", { name: /^Étape suivante/ })).toHaveCount(0);
    // Le guidage reprend pour la nouvelle saison, sans toast.
    await expect(tab(page, "Courts")).toHaveAccessibleDescription("Étape 2, la suivante");
    // Retour à la saison terminée, puis à la saison en cours : rien n'est annoncé.
    await page
      .getByLabel("Saison affichée", { exact: true })
      .selectOption({ label: "2026-2027 (terminée)" });
    await expect(tabs(page).getByTestId("step-mark")).toHaveCount(0);
    await page
      .getByLabel("Saison affichée", { exact: true })
      .selectOption({ label: "2027-2028 (en cours)" });
    await expect(tab(page, "Courts")).toHaveAccessibleDescription("Étape 2, la suivante");
    // biome-ignore lint/plugin: prouve une absence après le délai réel de l'interface.
    await page.waitForTimeout(500);
    await expect(page.getByRole("button", { name: /^Étape suivante/ })).toHaveCount(0);
  });

  test("pas d'« Étape suivante » dans une fenêtre ouverte", async ({ page }) => {
    await createSeason(page);
    await seedPlanning(page, {
      ...demoClub,
      groups: [{ name: "Galaxie vert", maxSize: 8, students: [] }],
      lessons: [],
    });
    await page.goto("/#/referentiels/eleves");
    await page.getByRole("button", { name: "Nouvel élève" }).click();
    const student = page.getByRole("dialog", { name: "Nouvel élève" });
    await student.getByLabel("Prénom", { exact: true }).fill("Léa");
    await student.getByLabel("Nom", { exact: true }).fill("Petit");
    await student.getByLabel("Téléphone", { exact: true }).fill("0611223344");
    await student.getByRole("button", { name: "Enregistrer et ajouter un autre" }).click();
    await expect(toast(page)).toContainText("Léa Petit ajouté(e)");
    // biome-ignore lint/plugin: prouve une absence après le délai réel de l'interface.
    await page.waitForTimeout(500);
    await expect(page.getByRole("button", { name: /^Étape suivante/ })).toHaveCount(0);
    await expect(student).toBeVisible();
  });

  test("données saisies d'un coup : ni toast d'étape ni pastille", async ({ page }) => {
    // Saison créée à l'écran, puis club et cours insérés d'un coup.
    await openPlanning(page);
    await expect(welcome(page)).toBeHidden();
    await expect(page.getByText(/^Premier (court|moniteur|groupe|élève)/)).toHaveCount(0);
    await mainNav(page, "Le club").click();
    await expect(tab(page, "Saison")).toBeVisible();
    await expect(tabs(page).getByTestId("step-mark")).toHaveCount(0);
  });
});

test.describe("mode d'emploi du planning", () => {
  test("l'astuce change entre aucun cours, cours sélectionné et sinon", async ({ page }) => {
    await openPlanning(page, { ...demoClub, lessons: [] });
    const mac = await isMac(page);

    // Aucun cours placé : commencer par « + Nouveau cours ».
    await expect(tip(page)).toHaveAttribute("data-context", "no-lesson");
    await expect(tip(page)).toContainText("Commencez par + Nouveau cours en haut");

    // Les Avertissements ne bougent pas quand l'astuce change (hauteur réservée).
    const warnings = page.getByRole("heading", { name: /^Avertissements/ });
    const top = async () => (await warnings.boundingBox())?.y;
    const reference = await top();
    expect(reference).toBeDefined();

    // Le cours créé est sélectionné : déplacer, durée, supprimer, annuler.
    await createLessonWithPanel(page, {
      court: "Court 1",
      day: "Lundi",
      start: "1020",
      group: "Galaxie vert (3/8)",
      instructor: "● Julie Martin",
    });
    await expect(tip(page)).toHaveAttribute("data-context", "selected");
    await expect(tip(page)).toContainText(
      "Glissez ce cours pour le déplacer, tirez son bas pour changer sa durée.",
    );
    await expect(tip(page)).toContainText(
      mac ? "⌫ le supprime, ⌘ Z annule." : "Suppr le supprime, Ctrl+Z annule.",
    );
    expect(await top()).toBe(reference);

    // Sinon (plus de sélection) : cliquer un cours, avec la phrase de portée.
    await page.keyboard.press("Escape");
    await expect(tip(page)).toHaveAttribute("data-context", "other");
    await expect(tip(page)).toContainText(
      "Cliquez un cours pour le modifier. En Planning habituel",
    );
    expect(await top()).toBe(reference);

    // Un cours ouvert puis refermé reste sélectionné.
    await lesson(page, "Galaxie vert").click();
    const panel = page.getByRole("form", { name: "Modifier le cours" });
    await panel.getByRole("button", { name: "Fermer le panneau" }).click();
    await expect(tip(page)).toHaveAttribute("data-context", "selected");

    // Semaine précise : la phrase de portée suit le mode.
    await page
      .getByRole("group", { name: "Mode d'affichage" })
      .getByRole("button", { name: "Une semaine précise" })
      .click();
    await expect(tip(page)).toHaveAttribute("data-context", "other");
    await expect(tip(page)).toContainText("ne concernent que cette semaine");
    expect(await top()).toBe(reference);
  });

  test("un cours ponctuel compte comme premier cours", async ({ page }) => {
    await openPlanning(page, { ...demoClub, lessons: [] });
    await expect(tip(page)).toHaveAttribute("data-context", "no-lesson");
    await showDatedWeek(page);
    await createLessonWithPanel(page, {
      court: "Court 1",
      instructor: "● Julie Martin",
      start: "1020",
    });
    await page.keyboard.press("Escape");
    await expect(tip(page)).toHaveAttribute("data-context", "other");
    // Le guidage est complet : plus de pastille sur les onglets du club.
    await mainNav(page, "Le club").click();
    await expect(tab(page, "Saison")).toBeVisible();
    await expect(tabs(page).getByTestId("step-mark")).toHaveCount(0);
  });

  test("saison terminée : astuce de consultation", async ({ page }) => {
    await openPlanning(page);
    await createBlankSeason(page, "2027-2028");
    await page
      .getByLabel("Saison affichée", { exact: true })
      .selectOption({ label: "2026-2027 (terminée)" });
    await mainNav(page, "Planning").click();
    await expect(tip(page)).toHaveAttribute("data-context", "read-only");
    await expect(tip(page)).toContainText(
      "Saison terminée : cliquez un cours pour voir son détail",
    );
  });

  test("tout le mode d'emploi, replié par défaut, touches du système", async ({ page }) => {
    await openPlanning(page);
    const mac = await isMac(page);
    const toggle = page.getByRole("button", { name: "Tout le mode d'emploi" });
    const manual = page.getByTestId("planning-manual");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(manual).toBeHidden();

    await toggle.click();
    await expect(manual).toBeVisible();
    await expect(manual.getByRole("heading")).toHaveText(["Les bases", "Pour aller plus vite"]);
    await expect(manual.getByRole("listitem").first()).toContainText("+ Nouveau cours");
    // B4 : seul Ctrl/⌘ N est annoncé pour créer un cours.
    const keys = await manual.locator("kbd").allTextContents();
    expect(keys).not.toContain("N");
    expect(keys).toContain(mac ? "⌘ N" : "Ctrl+N");
    expect(keys).toContain(mac ? "⌥" : "Alt");
    expect(keys).toContain(mac ? "⌫" : "Suppr");

    await page.getByRole("button", { name: "Masquer le mode d'emploi" }).click();
    await expect(manual).toBeHidden();

    // Replié à chaque ouverture du planning.
    await toggle.click();
    await mainNav(page, "Le club").click();
    await mainNav(page, "Planning").click();
    await expect(page.getByRole("button", { name: "Tout le mode d'emploi" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});

/** Nouvelle saison vierge, depuis l'onglet Saison (la précédente devient terminée). */
async function createBlankSeason(page: Page, name: string) {
  await page.goto("/#/referentiels/saison");
  await page.getByRole("button", { name: "Nouvelle saison" }).click();
  const dialog = page.getByRole("dialog", { name: "Nouvelle saison" });
  await dialog.getByLabel("Saison vierge", { exact: true }).check();
  await dialog.getByLabel("Nom", { exact: true }).fill(name);
  await dialog.getByRole("button", { name: "Créer la saison" }).click();
  await expect(dialog).toBeHidden();
}

function isMac(page: Page): Promise<boolean> {
  return page.evaluate(() =>
    /Mac|iPhone|iPad/i.test(`${navigator.platform} ${navigator.userAgent}`),
  );
}
