import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  createSeason,
  dayBar,
  demoClub,
  dragMouse,
  GRAB_OFFSET,
  goToPlanning,
  grabPoint,
  hoverLesson,
  lesson,
  lessonCard,
  openFilters,
  openPlanning,
  readLessons,
  resizePoint,
  seedPlanning,
  showDatedWeek,
  showDay,
  showWeek,
  slotPoint,
  togglePanel,
  toolbar,
} from "./support/planning";

/**
 * Lisibilité de la grille (lot L14) : vue « Semaine / Jour » et barre des
 * jours, panneau latéral repliable, menu de l'application réductible, une
 * seule barre d'outils, en-têtes de courts au vrai nom, fiche du cours au
 * survol. Club de démonstration : « Galaxie vert » le lundi à 10h00 (Court 1,
 * couvert, Karim), « Ados perfectionnement » le mercredi à 10h00 (1 h 30,
 * Court 2, extérieur, Julie).
 */

const E2E_MODULE = "/src/test/e2e.ts";

function sidebar(page: Page) {
  return page.getByTestId("app-sidebar");
}

function panel(page: Page) {
  return page.getByRole("complementary", { name: "Panneau latéral" });
}

async function width(locator: Locator): Promise<number> {
  return (await locator.boundingBox())?.width ?? 0;
}

/** Aucun défilement horizontal de la page ni de la zone de contenu. */
async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const main = document.querySelector("main") as HTMLElement;
    return {
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      main: main.scrollWidth - main.clientWidth,
    };
  });
  expect(overflow).toEqual({ page: 0, main: 0 });
}

/**
 * Les contrôles de la barre d'outils sont tous sur sa ligne et dans sa
 * largeur, sans débordement ; au moins `pills` pastilles de moniteurs sont
 * visibles entières sans faire défiler la légende.
 */
async function expectToolbarOnOneLine(page: Page, { readOnly = false, pills = 2 } = {}) {
  const bar = await toolbar(page).boundingBox();
  if (!bar) throw new Error("barre d'outils introuvable");
  const overflow = await toolbar(page).evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow, "débordement de la barre d'outils").toBe(0);
  const controls = [
    toolbar(page).getByRole("group", { name: "Mode d'affichage" }),
    ...(readOnly
      ? [toolbar(page).getByTestId("planning-read-only")]
      : [
          toolbar(page).getByRole("button", { name: "Nouveau cours" }),
          toolbar(page).getByRole("button", { name: "Annuler", exact: true }),
          toolbar(page).getByRole("button", { name: "Rétablir", exact: true }),
        ]),
    toolbar(page).getByRole("button", { name: "PDF", exact: true }),
    toolbar(page).getByRole("button", { name: /^Filtres/ }),
    toolbar(page).getByLabel("Saison affichée", { exact: true }),
  ];
  for (const control of controls) {
    const box = await control.boundingBox();
    if (!box) throw new Error("contrôle introuvable");
    expect(box.y).toBeGreaterThanOrEqual(bar.y);
    expect(box.y + box.height).toBeLessThanOrEqual(bar.y + bar.height);
    expect(box.x).toBeGreaterThanOrEqual(bar.x);
    expect(box.x + box.width).toBeLessThanOrEqual(bar.x + bar.width + 0.5);
  }
  const legend = page.getByRole("group", { name: "Légende des moniteurs" });
  await expect(legend).toHaveJSProperty("scrollLeft", 0);
  // Attente : les boutons s'animent (largeur) quand la barre change de taille.
  await expect
    .poll(
      () =>
        legend.evaluate((strip) => {
          const area = strip.getBoundingClientRect();
          return [...strip.querySelectorAll("[data-testid=instructor-pill]")].filter((pill) => {
            const box = pill.getBoundingClientRect();
            return box.width > 0 && box.left >= area.left - 0.5 && box.right <= area.right + 0.5;
          }).length;
        }),
      { message: "pastilles visibles sans défiler" },
    )
    .toBeGreaterThanOrEqual(pills);
  await expectNoHorizontalScroll(page);
}

/** Saison active « 2026-2027 » dupliquée : la saison d'origine est terminée et affichée. */
async function showFinishedSeason(page: Page) {
  await page.getByRole("button", { name: "Nouvelle saison" }).click();
  const dialog = page.getByRole("dialog", { name: "Nouvelle saison" });
  await dialog.getByRole("button", { name: "Dupliquer la saison" }).click();
  await expect(dialog).toBeHidden();
  await page
    .getByLabel("Saison affichée", { exact: true })
    .selectOption({ label: "2026-2027 (terminée)" });
  await expect(page.getByTestId("read-only-banner")).toBeVisible();
}

test.describe("à 960 px, sur le jeu de données de charge", () => {
  test.use({ viewport: { width: 960, height: 720 } });
  test.describe.configure({ timeout: 90_000 });

  test("l'en-tête tient sur une ligne et la vue Jour ne tronque pas les noms", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-11-18T10:00:00+01:00"));
    await createSeason(page);
    await page.evaluate(async (path) => {
      const tools = await import(/* @vite-ignore */ path);
      await tools.seedVolume();
    }, E2E_MODULE);
    await goToPlanning(page);
    await expect(page.getByTestId("lesson")).toHaveCount(150);

    // Une seule barre d'outils : plus de barre haute, titre réservé aux lecteurs d'écran.
    await expect(page.getByRole("heading", { level: 1, name: "Planning" })).toHaveClass(/sr-only/);
    // Le sélecteur de saison est repris dans la barre d'outils, il n'y en a qu'un.
    await expect(page.getByLabel("Saison affichée", { exact: true })).toHaveCount(1);
    // Menu déplié : barre étroite, pastilles réduites à la couleur et aux initiales.
    await expectToolbarOnOneLine(page, { pills: 3 });
    const pills = page.getByTestId("instructor-pill");
    await expect(pills.first().getByTestId("instructor-initials")).toBeVisible();
    await expect(pills.first().getByTestId("instructor-initials")).toHaveText(/^[A-Z]{2}$/);
    await showDatedWeek(page);
    await expectToolbarOnOneLine(page, { pills: 3 });

    // Le menu « Filtres » reste dans la fenêtre, « Effacer les filtres » compris.
    const menu = await openFilters(page);
    const box = await menu.boundingBox();
    const main = await page.locator("main").boundingBox();
    if (!box || !main) throw new Error("menu introuvable");
    expect(box.x).toBeGreaterThanOrEqual(main.x);
    expect(box.x + box.width).toBeLessThanOrEqual(main.x + main.width);
    await expect(menu.getByRole("button", { name: "Effacer les filtres" })).toBeInViewport({
      ratio: 1,
    });
    await expectNoHorizontalScroll(page);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();

    // Les 20 pastilles restent atteignables : la ligne défile.
    await expect(pills).toHaveCount(20);
    await pills.last().scrollIntoViewIfNeeded();
    await expect(pills.last()).toBeInViewport();
    await page
      .getByRole("group", { name: "Légende des moniteurs" })
      .evaluate((strip) => strip.scrollTo({ left: 0 }));

    // Vue Jour : 10 courts, cartes d'une heure lisibles.
    await showDay(page, "Mercredi");
    await expect(dayBar(page).getByRole("button", { name: "Mercredi, 25 cours" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("court-header")).toHaveCount(10);
    const names = await page.getByTestId("lesson").evaluateAll((blocks) =>
      blocks
        // Cartes d'une heure (48 px par heure, moins les marges).
        .filter((block) => block.getBoundingClientRect().height < 50)
        .map((block) => {
          const name = block.querySelector<HTMLElement>("[data-testid=lesson-name]");
          return {
            name: name?.textContent ?? "",
            truncated: !name || name.scrollWidth > name.clientWidth,
          };
        }),
    );
    expect(names.length).toBeGreaterThanOrEqual(10);
    expect(names.filter((n) => n.truncated)).toEqual([]);

    // Plus de place encore : menu réduit et panneau replié.
    const scroller = page.getByTestId("planning-scroller");
    const before = await scroller.evaluate((el) => el.clientWidth);
    await sidebar(page).getByRole("button", { name: "Réduire le menu" }).click();
    await togglePanel(page, "Replier");
    await expect(panel(page)).toHaveCount(0);
    await expect
      .poll(() => scroller.evaluate((el) => el.clientWidth))
      .toBeGreaterThan(before + 400);
    // Menu réduit : barre plus large, encore plus de pastilles (initiales sous 60rem).
    await expectToolbarOnOneLine(page, { pills: 4 });
    await expect(pills.first().getByTestId("instructor-initials")).toBeVisible();
  });

  test("saison terminée : l'en-tête tient aussi sur une ligne", async ({ page }) => {
    await createSeason(page);
    await seedPlanning(page, demoClub);
    await showFinishedSeason(page);
    await goToPlanning(page);
    const badge = toolbar(page).getByTestId("planning-read-only");
    await expect(badge).toHaveText("Consultation seulement");
    await badge.hover();
    await expect(page.getByRole("tooltip")).toHaveText(
      "Saison terminée : aucune modification possible",
    );
    await expectToolbarOnOneLine(page, { readOnly: true, pills: 2 });
    await sidebar(page).getByRole("button", { name: "Réduire le menu" }).click();
    await expectToolbarOnOneLine(page, { readOnly: true, pills: 2 });
  });
});

test.describe("barre des jours", () => {
  test("bascule entre la semaine et un jour, par les pastilles, les flèches et l'en-tête", async ({
    page,
  }) => {
    await openPlanning(page);
    const bar = dayBar(page);
    await expect(bar.getByTestId("day-pill")).toHaveText([
      "Lun1",
      "Mar0",
      "Mer1",
      "Jeu0",
      "Ven0",
      "Sam0",
    ]);
    await expect(page.getByTestId("day-header")).toHaveCount(6);
    // Flèches de jour absentes en vue Semaine (leur place reste réservée).
    await expect(bar.getByRole("button", { name: "Jour suivant" })).toBeHidden();

    // Clic sur l'en-tête d'un jour : il s'affiche seul.
    await page.getByTestId("day-header").nth(2).getByRole("button", { name: "Mercredi" }).click();
    await expect(page.getByTestId("day-header")).toHaveCount(1);
    await expect(page.getByTestId("day-header")).toHaveText(/^Mercredi/);
    await expect(lesson(page, "Ados perfectionnement")).toBeVisible();
    await expect(lesson(page, "Galaxie vert")).toHaveCount(0);

    // Flèches : jour suivant, puis en boucle jusqu'au lundi.
    await bar.getByRole("button", { name: "Jour suivant" }).click();
    await expect(page.getByTestId("day-header")).toHaveText(/^Jeudi/);
    await bar.getByRole("button", { name: "Jour précédent" }).click();
    await bar.getByRole("button", { name: "Jour précédent" }).click();
    await bar.getByRole("button", { name: "Jour précédent" }).click();
    await expect(page.getByTestId("day-header")).toHaveText(/^Lundi/);
    await bar.getByRole("button", { name: "Jour précédent" }).click();
    await expect(page.getByTestId("day-header")).toHaveText(/^Samedi/);

    await showDay(page, "Lundi");
    await expect(lesson(page, "Galaxie vert")).toBeVisible();
    // « Jour » depuis la vue Semaine revient au dernier jour vu.
    await showWeek(page);
    await bar.getByRole("button", { name: "Jour", exact: true }).click();
    await expect(page.getByTestId("day-header")).toHaveText(/^Lundi/);
    // La vue est retrouvée en revenant sur l'écran.
    await page
      .getByRole("navigation", { name: "Navigation principale" })
      .getByRole("link", { name: "Heures" })
      .click();
    await goToPlanning(page);
    await expect(page.getByTestId("day-header")).toHaveText(/^Lundi/);
    await showWeek(page);
    await expect(page.getByTestId("day-header")).toHaveCount(6);
  });

  test("en semaine précise, la navigation des semaines ouvre la barre des jours", async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date("2026-11-04T10:00:00+01:00"));
    await openPlanning(page);
    await expect(dayBar(page).getByRole("button", { name: "Semaine suivante" })).toHaveCount(0);
    await showDatedWeek(page);
    await expect(toolbar(page).getByRole("button", { name: "Semaine suivante" })).toHaveCount(0);
    // Aucun jour vu encore : « Jour » ouvre aujourd'hui (mercredi 04/11).
    await dayBar(page).getByRole("button", { name: "Jour", exact: true }).click();
    await expect(page.getByTestId("day-header")).toHaveText(/^Mercredi 04\/11/);
    await dayBar(page).getByRole("button", { name: "Semaine suivante" }).click();
    await expect(page.getByTestId("mode-bar")).toContainText("Semaine du 9 novembre");
    // Le jour affiché est gardé d'une semaine à l'autre.
    await expect(page.getByTestId("day-header")).toHaveText(/^Mercredi 11\/11/);
  });

  test("l'en-tête d'un jour s'active au clavier et passe le focus à sa pastille", async ({
    page,
  }) => {
    await openPlanning(page);
    const header = page.getByTestId("day-header").nth(2).getByRole("button", { name: "Mercredi" });
    await header.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("day-header")).toHaveCount(1);
    await expect(dayBar(page).getByRole("button", { name: "Mercredi, 1 cours" })).toBeFocused();
  });

  test("un cours sélectionné sur un autre jour n'est plus sélectionné ni supprimé", async ({
    page,
  }) => {
    await openPlanning(page);
    const galaxie = lesson(page, "Galaxie vert");
    await galaxie.click();
    await page.keyboard.press("Escape");
    await expect(galaxie).toHaveAttribute("data-selected", "true");
    // Le lundi n'est plus dessiné : Suppr ne supprime rien.
    await showDay(page, "Mercredi");
    await page.keyboard.press("Delete");
    await expect(lesson(page, "Ados perfectionnement")).toBeVisible();
    expect((await readLessons(page)).map((l) => l.group).sort()).toEqual([
      "Ados perfectionnement",
      "Galaxie vert",
    ]);
    await showDay(page, "Lundi");
    await expect(galaxie).not.toHaveAttribute("data-selected");
  });
});

test.describe("en-têtes de courts et fiche du cours", () => {
  test("les courts portent leur vrai nom, une icône et leur nature en bulle", async ({ page }) => {
    // Courts au nom long : abrégés en vue Semaine, entiers en vue Jour.
    const names: Record<string, string> = { "Court 1": "Central", "Court 2": "Terre battue 1" };
    await openPlanning(page, {
      ...demoClub,
      courts: [
        { name: "Central", kind: "indoor" },
        { name: "Terre battue 1", kind: "outdoor" },
      ],
      lessons: demoClub.lessons.map((l) => ({ ...l, court: names[l.court] ?? l.court })),
    });
    const courts = page.getByTestId("day-header").first().getByTestId("court-header");
    // Texte affiché, puis nom complet et nature pour les lecteurs d'écran.
    await expect(courts).toHaveText([
      "CentralCentral (court couvert)",
      "TB1Terre battue 1 (court extérieur)",
    ]);
    await expect(courts.nth(1)).toHaveAttribute("data-kind", "outdoor");
    await courts.nth(1).hover();
    await expect(page.getByRole("tooltip")).toHaveText("Terre battue 1 — court extérieur");
    await expect(dayBar(page).getByTestId("court-legend")).toHaveText(/couvert\s*·\s*extérieur/);

    await showDay(page, "Lundi");
    await expect(page.getByTestId("court-header").nth(1)).toHaveText(
      "Terre battue 1Terre battue 1 (court extérieur)",
    );
  });

  test("la fiche au survol montre le détail du cours, puis disparaît au clic", async ({ page }) => {
    await openPlanning(page);
    const ados = lesson(page, "Ados perfectionnement");
    await expect(ados).not.toHaveAttribute("title");
    // Le même détail est la description du cours pour les lecteurs d'écran.
    await expect(ados).toHaveAccessibleDescription(
      /Mercredi 10h00–11h30\. Court 2 \(extérieur\)\. Moniteur : Julie Martin\. 2\/6 élèves/,
    );
    const scope = await page.getByTestId("mode-scope").boundingBox();
    const card = await hoverLesson(page, ados);
    await expect(card.locator("p")).toHaveText([
      "Ados perfectionnement",
      "Mercredi 10h00–11h30",
      "Court 2 (extérieur)",
      "Moniteur : Julie Martin",
      "2/6 élèves",
    ]);
    await expect(card).toHaveCSS("border-left-color", "rgb(29, 78, 216)");
    // La fiche ne masque rien d'utile : elle est à côté du cours et ne déplace rien.
    const lessonBox = await ados.boundingBox();
    const cardBox = await card.boundingBox();
    if (!lessonBox || !cardBox) throw new Error("éléments introuvables");
    expect(
      cardBox.x >= lessonBox.x + lessonBox.width || cardBox.x + cardBox.width <= lessonBox.x,
    ).toBe(true);
    expect(await page.getByTestId("mode-scope").boundingBox()).toEqual(scope);

    // Au clic, la fiche disparaît (le panneau du cours s'ouvre).
    await ados.click();
    await expect(card).toBeHidden();
    await expect(page.getByRole("form", { name: "Modifier le cours" })).toBeVisible();
    // biome-ignore lint/plugin: prouve une absence après le délai réel de l'interface.
    await page.waitForTimeout(600);
    await expect(card).toBeHidden();

    // Sortie du cours : la fiche disparaît aussi ; un avertissement y figure en rouge.
    await page.keyboard.press("Escape");
    const galaxie = lesson(page, "Galaxie vert");
    await hoverLesson(page, galaxie);
    await page.mouse.move(5, 5);
    await expect(lessonCard(page)).toBeHidden();
  });

  test("la fiche signale les avertissements et Échap la ferme seule", async ({ page }) => {
    await openPlanning(page);
    // Marc n'a saisi aucune disponibilité : le cours confié est signalé.
    await lesson(page, "Galaxie vert").click();
    const form = page.getByRole("form", { name: "Modifier le cours" });
    await form.getByLabel("Moniteur", { exact: true }).selectOption({
      label: "○ Marc Leroy (aucune disponibilité saisie)",
    });
    await form.getByRole("button", { name: "Enregistrer" }).click();
    await expect(form).toBeHidden();
    await expect(lesson(page, "Galaxie vert")).toHaveAccessibleDescription(
      /Avertissement : Aucune disponibilité saisie pour Marc/,
    );
    const card = await hoverLesson(page, lesson(page, "Galaxie vert"));
    await expect(card.locator("p.text-destructive")).toHaveText([
      "⚠ Aucune disponibilité saisie pour Marc",
    ]);
    // Ouvert, le panneau reste ouvert : Échap ne ferme que la fiche.
    await page.getByRole("button", { name: "Nouveau cours" }).click();
    await expect(page.getByRole("form", { name: "Nouveau cours" })).toBeVisible();
    await hoverLesson(page, lesson(page, "Galaxie vert"));
    await page.keyboard.press("Escape");
    await expect(lessonCard(page)).toBeHidden();
    await expect(page.getByRole("form", { name: "Nouveau cours" })).toBeVisible();
  });
});

test.describe("panneau latéral et menu de l'application", () => {
  test("le panneau replié se rouvre à la création et à l'ouverture d'un cours", async ({
    page,
  }) => {
    await openPlanning(page);
    const board = page.getByTestId("planning-board");
    const columns = Number(await board.getAttribute("data-column-width"));
    await expect(panel(page)).toBeVisible();
    await togglePanel(page, "Replier");
    await expect(panel(page)).toHaveCount(0);
    // Sans rail : la grille prend toute la largeur.
    await expect
      .poll(async () => Number(await board.getAttribute("data-column-width")))
      .toBeGreaterThan(columns);

    // Création par sélection sur la grille : le panneau revient.
    const from = await slotPoint(page, 1, 0, "09:00");
    const to = await slotPoint(page, 1, 0, "10:00");
    await dragMouse(page, { x: from.x, y: from.y + 2 }, { x: to.x, y: to.y - 2 });
    await expect(page.getByRole("form", { name: "Nouveau cours" })).toBeVisible();
    await expect(dayBar(page).getByRole("button", { name: "Replier le panneau" })).toBeVisible();
    // Fermé, le cours rend la place : le panneau est de nouveau replié.
    await page.keyboard.press("Escape");
    await expect(panel(page)).toHaveCount(0);

    // Bouton « Nouveau cours » et ouverture d'un cours : de même.
    await toolbar(page).getByRole("button", { name: "Nouveau cours" }).click();
    await expect(page.getByRole("form", { name: "Nouveau cours" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel(page)).toHaveCount(0);
    await lesson(page, "Galaxie vert").click();
    await expect(page.getByRole("form", { name: "Modifier le cours" })).toBeVisible();
    // « Replier le panneau » ferme le cours et replie le panneau.
    await togglePanel(page, "Replier");
    await expect(panel(page)).toHaveCount(0);

    await togglePanel(page, "Afficher");
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).getByRole("heading", { name: /Avertissements/ })).toBeVisible();
  });

  test("le menu de l'application se réduit aux icônes, choix mémorisé", async ({ page }) => {
    await openPlanning(page);
    const nav = page.getByRole("navigation", { name: "Navigation principale" });
    const full = await width(sidebar(page));
    await nav.getByRole("button", { name: "Réduire le menu" }).click();
    await expect(sidebar(page)).toHaveAttribute("data-collapsed", "true");
    expect(await width(sidebar(page))).toBeLessThan(full / 2);
    // Libellés annoncés et affichés en bulle au survol.
    const hours = nav.getByRole("link", { name: "Heures" });
    await expect(hours).toBeVisible();
    await hours.hover();
    await expect(page.getByRole("tooltip")).toHaveText("Heures");
    await hours.click();
    await expect(page.getByRole("heading", { level: 1, name: "Heures" })).toBeVisible();
    // L'écran affiché reste marqué dans le menu réduit.
    await expect(hours).toHaveClass(/bg-sidebar-primary/);
    expect((await hours.locator("svg").boundingBox())?.width).toBeGreaterThan(10);

    // Mémorisé sur le poste : retrouvé au prochain lancement.
    await page.reload();
    await expect(sidebar(page)).toHaveAttribute("data-collapsed", "true");
    await nav.getByRole("button", { name: "Déplier le menu" }).click();
    await expect(sidebar(page)).not.toHaveAttribute("data-collapsed");
    await page.reload();
    await expect(nav.getByRole("button", { name: "Réduire le menu" })).toBeVisible();
  });
});

for (const view of ["Semaine", "Jour"] as const) {
  test.describe(`gestes de la grille en vue ${view}`, () => {
    // Fenêtre haute : toute l'amplitude est visible, sans défilement automatique.
    test.use({ viewport: { width: 1366, height: 1000 } });

    test.beforeEach(async ({ page }) => {
      await openPlanning(page);
      // Le lundi est le premier jour dessiné dans les deux vues.
      if (view === "Jour") await showDay(page, "Lundi");
      else await expect(page.getByTestId("day-header")).toHaveCount(6);
    });

    test("crée un cours par sélection", async ({ page }) => {
      const from = await slotPoint(page, 0, 1, "17:00");
      const to = await slotPoint(page, 0, 1, "18:30");
      await dragMouse(
        page,
        { x: from.x, y: from.y + 2 },
        { x: to.x, y: to.y - 2 },
        { drop: false },
      );
      await expect(page.getByTestId("selection-box")).toHaveText("17h00–18h30");
      await page.mouse.up();
      const form = page.getByRole("form", { name: "Nouveau cours" });
      await expect(form.getByLabel("Jour", { exact: false })).toHaveValue("1");
      await expect(form.getByLabel("Court", { exact: true }).locator("option:checked")).toHaveText(
        "Court 2",
      );
      await expect(form.getByLabel("Durée", { exact: true }).locator("option:checked")).toHaveText(
        "1 h 30",
      );
      await form.getByLabel("Groupe", { exact: true }).selectOption({ label: "Mini-tennis (1/6)" });
      await form.getByLabel("Moniteur", { exact: true }).selectOption({ label: "● Karim Benali" });
      await form.getByRole("button", { name: "Créer le cours" }).click();
      await expect(lesson(page, "Mini-tennis")).toContainText("17h00–18h30");
      await expect
        .poll(() => readLessons(page))
        .toContainEqual(
          expect.objectContaining({
            group: "Mini-tennis",
            weekday: 1,
            court: "Court 2",
            startTime: "17:00",
            durationMinutes: 90,
          }),
        );
    });

    test("déplace, redimensionne et duplique un cours", async ({ page }) => {
      const galaxie = lesson(page, "Galaxie vert");
      // Déplacement : Court 2, 14h00.
      const target = await slotPoint(page, 0, 1, "14:00");
      await dragMouse(page, await grabPoint(galaxie), { x: target.x, y: target.y + GRAB_OFFSET });
      await expect(galaxie).toContainText("14h00–15h00");
      await expect
        .poll(() => readLessons(page))
        .toContainEqual(
          expect.objectContaining({ group: "Galaxie vert", court: "Court 2", startTime: "14:00" }),
        );

      // Redimensionnement : jusqu'à 15h30.
      const end = await slotPoint(page, 0, 1, "15:30");
      await dragMouse(page, await resizePoint(galaxie), end);
      await expect(galaxie).toContainText("14h00–15h30");
      await expect
        .poll(() => readLessons(page))
        .toContainEqual(expect.objectContaining({ group: "Galaxie vert", durationMinutes: 90 }));

      // Duplication (Alt) : Court 1, 14h00.
      const copy = await slotPoint(page, 0, 0, "14:00");
      await dragMouse(
        page,
        await grabPoint(galaxie),
        { x: copy.x - 10, y: copy.y + GRAB_OFFSET },
        { drop: false },
      );
      await page.keyboard.down("Alt");
      await page.mouse.move(copy.x, copy.y + GRAB_OFFSET, { steps: 2 });
      await expect(page.getByTestId("drag-tooltip")).toContainText("Duplication (Alt)");
      await page.mouse.up();
      await page.keyboard.up("Alt");
      await expect(lesson(page, "Galaxie vert")).toHaveCount(2);
      await expect
        .poll(async () =>
          (await readLessons(page)).filter((l) => l.group === "Galaxie vert").map((l) => l.court),
        )
        .toEqual(expect.arrayContaining(["Court 1", "Court 2"]));
    });
  });
}
