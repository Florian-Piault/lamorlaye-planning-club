import { expect, type Page, test } from "@playwright/test";
import {
  contrastIssues,
  iconContrastIssues,
  tabStops,
  unmeasured,
  unnamedControls,
  weakFocus,
} from "./support/a11y";
import {
  createSeason,
  demoClub,
  goToPlanning,
  guidanceWelcome,
  hoverLesson,
  lesson,
  openFilters,
  openPlanning,
  readLessons,
  seedPlanning,
  showDatedWeek,
  showDay,
} from "./support/planning";
import { SCREENS, visit } from "./support/screens";

/**
 * Accessibilité (lots L8 et L16) : déplacement d'un cours au clavier avec
 * annonces en français, contrastes des textes et des icônes des écrans
 * principaux et des écrans de la v1.1 en thème clair et sombre, noms
 * accessibles, focus visibles et contrastés, toasts au clavier.
 */

/**
 * Espace saisit le cours focalisé. Le capteur clavier de dnd-kit n'écoute les
 * flèches qu'après un `setTimeout(0)` : on laisse passer ce délai avant de
 * les envoyer, sinon elles peuvent être perdues (test instable sous charge).
 */
async function grab(page: Page) {
  await page.keyboard.press("Space");
  await expect(page.getByTestId("lesson-ghost")).toBeVisible();
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
}

test.describe("déplacement d'un cours au clavier", () => {
  test("déplace un cours par pas de 15 min, de court et de jour, avec annonces", async ({
    page,
  }) => {
    await openPlanning(page);
    const galaxie = lesson(page, "Galaxie vert");
    await galaxie.focus();
    await expect(galaxie).toHaveAttribute("aria-roledescription", "cours déplaçable");

    // Espace saisit le cours : annonce en français et fantôme à sa place.
    await grab(page);
    const ghost = page.getByTestId("lesson-ghost");
    await expect(page.locator("[id^='DndLiveRegion']")).toContainText(
      "Déplacement commencé : Galaxie vert, lundi 10h00",
    );
    await expect(ghost).toHaveAttribute("data-start", String(10 * 60));

    // ↓ ↓ : 30 min plus tard ; → : court suivant ; Maj+→ : jour suivant.
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(ghost).toHaveAttribute("data-start", String(10 * 60 + 30));
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Shift+ArrowRight");
    await expect(ghost).toHaveAttribute("data-weekday", "2");
    // L'infobulle (zone « status ») décrit le créneau visé et ses avertissements.
    await expect(page.getByTestId("drag-tooltip")).toContainText("Mardi · Court 2 · 10h30–11h30");
    await expect(page.getByTestId("drag-tooltip")).toContainText("Déplacement au clavier");

    // Espace dépose le cours ; la semaine type est modifiée en base.
    await page.keyboard.press("Space");
    await expect(ghost).toHaveCount(0);
    await expect(page.locator("[id^='DndLiveRegion']")).toContainText(
      "Déplacement terminé : Galaxie vert.",
    );
    await expect(galaxie).toContainText("10h30–11h30");
    await expect(galaxie).toBeFocused();
    await expect
      .poll(async () => (await readLessons(page)).find((l) => l.group === "Galaxie vert"))
      .toMatchObject({ weekday: 2, court: "Court 2", startTime: "10:30" });

    // Échap annule un déplacement en cours ; ← / → ne changent pas de semaine pendant le geste.
    await grab(page);
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Shift+ArrowLeft");
    await expect(ghost).toHaveAttribute("data-start", String(10 * 60 + 15));
    await expect(ghost).toHaveAttribute("data-weekday", "1");
    await page.keyboard.press("Escape");
    await expect(ghost).toHaveCount(0);
    await expect(page.locator("[id^='DndLiveRegion']")).toContainText(
      "Déplacement annulé : Galaxie vert reste à sa place.",
    );
    await expect(galaxie).toContainText("10h30–11h30");
    expect((await readLessons(page)).find((l) => l.group === "Galaxie vert")).toMatchObject({
      weekday: 2,
      startTime: "10:30",
    });

    // Entrée ouvre le détail du cours ; Ctrl/Cmd+Z annule le déplacement.
    await galaxie.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("form", { name: "Modifier le cours" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.keyboard.press("ControlOrMeta+z");
    await expect(galaxie).toContainText("10h00–11h00");
  });

  test("une pastille de moniteur s'active au clavier sans démarrer de glisser", async ({
    page,
  }) => {
    await openPlanning(page);
    const pill = page.getByRole("button", { name: "Karim Benali, 1h cette semaine" });
    await pill.focus();
    await page.keyboard.press("Space");
    await expect(pill).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("hatch").first()).toBeVisible();
    await expect(page.getByTestId("drag-tooltip")).toHaveCount(0);
    await page.keyboard.press("Enter");
    await expect(pill).toHaveAttribute("aria-pressed", "false");
  });
});

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`écrans principaux, thème ${colorScheme === "light" ? "clair" : "sombre"}`, () => {
    test.use({ colorScheme });

    test("contrastes suffisants et contrôles nommés", async ({ page }) => {
      test.setTimeout(90_000);
      await openPlanning(page);
      for (const screen of SCREENS) {
        await visit(page, screen.path);
        await screen.ready(page);
        const issues = await contrastIssues(page);
        expect(issues, `contrastes de ${screen.path}`).toEqual([]);
        expect(await iconContrastIssues(page), `icônes de ${screen.path}`).toEqual([]);
        expect(await unmeasured(page), `non mesurés de ${screen.path}`).toEqual([]);
        expect(await unnamedControls(page), `noms de ${screen.path}`).toEqual([]);
      }
      // Semaine datée (bandeau vert, séances annulées) et fiche d'un moniteur.
      await visit(page, "/#/planning");
      await page
        .getByRole("group", { name: "Mode d'affichage" })
        .getByRole("button", { name: "Une semaine précise" })
        .click();
      await expect(page.getByTestId("mode-bar")).toHaveAttribute("data-mode", "dated");
      expect(await contrastIssues(page), "contrastes de la semaine datée").toEqual([]);
      await visit(page, "/#/referentiels/moniteurs");
      await page.getByRole("link", { name: /Julie/ }).first().click();
      await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
      expect(await contrastIssues(page), "contrastes de la fiche moniteur").toEqual([]);
      expect(await unnamedControls(page), "noms de la fiche moniteur").toEqual([]);
    });
  });
}

test.describe("focus visible", () => {
  for (const colorScheme of ["light", "dark"] as const) {
    test.describe(colorScheme === "light" ? "thème clair" : "thème sombre", () => {
      test.use({ colorScheme });
      for (const path of ["/#/planning", "/#/referentiels/eleves", "/#/reglages", "/#/a-propos"]) {
        test(`chaque arrêt de tabulation est visible (${path})`, async ({ page }) => {
          await openPlanning(page);
          await visit(page, path);
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          await page.locator("body").click({ position: { x: 1, y: 1 } });
          const stops = await tabStops(page, 30, { allControls: true });
          // Visible et contrasté (3:1, WCAG 1.4.11) depuis la passe de la v1.1.
          expect(weakFocus(stops)).toEqual([]);
        });
      }
    });
  }
});

/**
 * Passe d'accessibilité de la v1.1 (lot L16) sur les écrans nouveaux ou
 * transformés : contrastes des textes (4,5:1) et des icônes (3:1), noms
 * accessibles, dans les deux thèmes ; puis arrêts de tabulation (indicateur
 * de focus visible et contrasté, 3:1), Tooltip et toasts au clavier.
 */

/** Textes, icônes et noms de l'état affiché. */
async function audit(page: Page, label: string) {
  // Contrôles « souples » : tous les défauts d'un parcours sont relevés d'un coup.
  expect.soft(await contrastIssues(page), `contrastes : ${label}`).toEqual([]);
  expect.soft(await iconContrastIssues(page), `icônes : ${label}`).toEqual([]);
  expect.soft(await unnamedControls(page), `noms : ${label}`).toEqual([]);
  // Fonds en image ou en dégradé : non mesurables, donc signalés.
  expect.soft(await unmeasured(page), `non mesurés : ${label}`).toEqual([]);
}

const clubTab = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Fiches du club" }).getByRole("link", { name, exact: true });

/** Club de démonstration, Galaxie vert réservé aux 6–8 ans (alerte d'âge). */
const ageClub = {
  ...demoClub,
  groups: demoClub.groups.map((g) =>
    g.name === "Galaxie vert" ? { ...g, minAge: 6, maxAge: 8 } : g,
  ),
};

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`écrans de la v1.1, thème ${colorScheme === "light" ? "clair" : "sombre"}`, () => {
    test.use({ colorScheme });

    test("guidage, toasts, zone de message, bulle et garde des modales", async ({ page }) => {
      test.setTimeout(90_000);
      // Base vide : accueil « Avant de construire le planning ».
      await page.goto("/#/planning");
      await expect(guidanceWelcome(page)).toBeVisible();
      await audit(page, "accueil du guidage");

      // Saison créée : toast de succès avec « Étape suivante », pastilles d'étape des onglets.
      await createSeason(page);
      await expect(page.getByTestId("toast")).toBeVisible();
      await expect(page.getByTestId("step-mark").first()).toBeVisible();
      await audit(page, "toast de succès et pastilles d'étape");

      // Bulle commune ouverte au clavier.
      await seedPlanning(page, ageClub);
      await clubTab(page, "Courts").click();
      await page.getByRole("button", { name: "Modifier Court 2" }).focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press(
        page.context().browser()?.browserType().name() === "webkit" ? "Alt+Tab" : "Tab",
      );
      await expect(page.getByRole("tooltip")).toBeVisible();
      await audit(page, "bulle d'aide");

      // Zone de message : doublon (avertissement) et erreur, dans une fenêtre.
      await clubTab(page, "Élèves").click();
      await page.getByRole("button", { name: "Nouvel élève" }).click();
      const dialog = page.getByRole("dialog", { name: "Nouvel élève" });
      await dialog.getByLabel("Prénom", { exact: true }).fill("Léa");
      await dialog.getByLabel("Nom", { exact: true }).fill("Test");
      await dialog.getByLabel("Date de naissance", { exact: true }).fill("2015-05-03");
      await dialog.getByLabel("Galaxie vert", { exact: false }).check();
      const messages = dialog.getByRole("list", { name: "Messages" });
      await expect(messages).toContainText("existe déjà");
      await dialog.getByRole("button", { name: "Créer l'élève" }).click();
      // Erreur de champ (téléphone manquant) en rouge, avertissements de la zone en ambre.
      await expect(
        dialog.getByText("Renseignez le téléphone de l'élève ou celui du responsable légal."),
      ).toBeVisible();
      // Doublon, âge et élève mineur : « + N autres », déplié au clic.
      await dialog.getByRole("button", { name: /^\+ \d+ autres/ }).click();
      await expect(messages).toContainText("Galaxie vert est pour les 6–8 ans");
      await audit(page, "erreur de champ et zone de message");

      // Garde de modale : « Abandonner les modifications ? ».
      await page.keyboard.press("Escape");
      const discard = page.getByRole("dialog", { name: "Abandonner les modifications ?" });
      await expect(discard).toBeVisible();
      await audit(page, "garde de modale");
      await discard.getByRole("button", { name: "Abandonner" }).click();

      // Toast d'erreur persistant (saison archivée en douce, suppression refusée).
      await goToPlanning(page);
      await page.evaluate(async (path) => {
        const tools = await import(/* @vite-ignore */ path);
        await tools.archiveActiveSeason();
      }, "/src/test/e2e.ts");
      await lesson(page, "Galaxie vert").click();
      await page.keyboard.press("Delete");
      await expect(page.getByTestId("toast-alerts").getByTestId("toast")).toBeVisible();
      await audit(page, "toast d'erreur");
    });

    test("planning : barre des jours, Filtres, fiche au survol, mode d'emploi, menu réduit", async ({
      page,
    }) => {
      test.setTimeout(90_000);
      await openPlanning(page);
      await showDay(page, "Lundi");
      await audit(page, "vue Jour et barre des jours");
      await openFilters(page);
      await audit(page, "menu Filtres");
      await page.keyboard.press("Escape");
      await hoverLesson(page, lesson(page, "Galaxie vert"));
      await audit(page, "fiche du cours au survol");
      await page.mouse.move(5, 5);
      await page.getByRole("button", { name: "Tout le mode d'emploi" }).click();
      await expect(page.getByTestId("planning-manual")).toBeVisible();
      await audit(page, "mode d'emploi");
      await page
        .getByRole("navigation", { name: "Navigation principale" })
        .getByRole("button", { name: "Réduire le menu" })
        .click();
      await expect(page.getByTestId("app-sidebar")).toHaveAttribute("data-collapsed", "true");
      await showDatedWeek(page);
      await audit(page, "menu réduit, semaine précise");
    });

    test("frise, fiche groupe, collage et initiales déjà prises", async ({ page }) => {
      test.setTimeout(90_000);
      await createSeason(page);
      await seedPlanning(page, ageClub);

      // Frise des disponibilités : clic simple qui pré-remplit le formulaire.
      await clubTab(page, "Moniteurs").click();
      await page.getByRole("link", { name: /Julie/ }).first().click();
      await page
        .getByRole("group", { name: "Disponibilités du mardi" })
        .locator('[data-time="10:00"]')
        .click();
      await expect(
        page.getByRole("form", { name: "Saisir un horaire" }).getByLabel("De", { exact: false }),
      ).toBeFocused();
      await audit(page, "frise des disponibilités");

      // Fiche groupe : liste des élèves trouvés (combobox).
      await clubTab(page, "Groupes").click();
      await page
        .getByRole("table", { name: "Groupes" })
        .getByRole("link", { name: "Galaxie vert" })
        .click();
      await page
        .getByLabel("Ajouter un élève (nom, prénom, téléphone)", { exact: true })
        .fill("test");
      await expect(page.getByRole("listbox", { name: "Élèves trouvés" })).toBeVisible();
      await audit(page, "fiche groupe, élèves trouvés");

      // Collage depuis Excel : saisie, correspondance puis aperçu (ligne hors tranche).
      await page.goto("/#/import-export");
      await page.getByRole("button", { name: "Coller depuis Excel" }).click();
      await page
        .getByLabel("Tableau à coller", { exact: true })
        .fill(
          "Nom\tPrénom\tTél. portable\tDate de naissance\tGroupe\n" +
            "Durand\tMaël\t0611223344\t05/01/2012\tGalaxie vert\n",
        );
      await audit(page, "collage depuis Excel");
      await page.getByRole("button", { name: "Lire le tableau" }).click();
      await expect(
        page.getByRole("table", { name: "Associer les colonnes de votre fichier" }),
      ).toBeVisible();
      await audit(page, "correspondance des colonnes");
      await page.getByRole("button", { name: "Afficher l'aperçu" }).click();
      await expect(page.getByRole("table", { name: "Aperçu de l'import" })).toBeVisible();
      await audit(page, "aperçu de l'import");

      // Initiales et nom de court déjà pris.
      await page.goto("/#/referentiels/moniteurs");
      await page.getByRole("button", { name: "Nouveau moniteur" }).click();
      const instructor = page.getByRole("dialog", { name: "Nouveau moniteur" });
      await instructor.getByLabel("Prénom", { exact: true }).fill("Jean");
      await instructor.getByLabel("Nom", { exact: true }).fill("Morel");
      await instructor.getByLabel("Initiales", { exact: true }).fill("JM");
      await expect(instructor.getByRole("list", { name: "Messages" })).toContainText(
        "déjà utilisé",
      );
      await audit(page, "initiales déjà prises");
    });
  });
}

/** Tab, ou ⌥ Tab sous WebKit (macOS), où Tab seul ne s'arrête que sur les champs. */
function tabKey(page: Page, shift = false) {
  const webkit = page.context().browser()?.browserType().name() === "webkit";
  return `${webkit ? "Alt+" : ""}${shift ? "Shift+" : ""}Tab`;
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`focus sur les écrans de la v1.1, thème ${colorScheme === "light" ? "clair" : "sombre"}`, () => {
    test.use({ colorScheme });

    /** Parcourt la page depuis son début : chaque arrêt a un indicateur contrasté (3:1). */
    async function expectStrongFocus(page: Page, label: string, count = 30) {
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      const stops = await tabStops(page, count, { allControls: true });
      expect.soft(weakFocus(stops), `focus : ${label}`).toEqual([]);
    }

    test("indicateurs de focus visibles et contrastés", async ({ page }) => {
      test.setTimeout(120_000);
      await page.goto("/#/planning");
      await expect(guidanceWelcome(page)).toBeVisible();
      await expectStrongFocus(page, "accueil du guidage", 15);

      await openPlanning(page, ageClub);
      await showDay(page, "Lundi");
      await expectStrongFocus(page, "planning en vue Jour", 40);

      await page.getByRole("link", { name: "Le club" }).click();
      await clubTab(page, "Groupes").click();
      await page
        .getByRole("table", { name: "Groupes" })
        .getByRole("link", { name: "Galaxie vert" })
        .click();
      await expect(page.getByRole("heading", { level: 2, name: "Galaxie vert" })).toBeVisible();
      await expectStrongFocus(page, "fiche groupe");

      await clubTab(page, "Moniteurs").click();
      await page.getByRole("link", { name: /Julie/ }).first().click();
      await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
      await expectStrongFocus(page, "fiche moniteur");

      await page.goto("/#/import-export");
      await page.getByRole("button", { name: "Coller depuis Excel" }).click();
      await expectStrongFocus(page, "collage depuis Excel");

      // Dans une fenêtre : le focus reste dans la fenêtre (piège de focus natif).
      await page.goto("/#/referentiels/eleves");
      await page.getByRole("button", { name: "Nouvel élève" }).click();
      await expect(page.getByRole("dialog", { name: "Nouvel élève" })).toBeVisible();
      await expectStrongFocus(page, "fiche élève", 25);

      // Enregistrement refusé : les champs en erreur gardent un anneau contrasté au focus.
      const student = page.getByRole("dialog", { name: "Nouvel élève" });
      await student.getByRole("button", { name: "Créer l'élève" }).click();
      await expect(student.getByLabel("Prénom", { exact: true })).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      await expectStrongFocus(page, "fiche élève en erreur", 25);
    });

    test("le toast est atteignable au clavier et reste affiché tant qu'il a le focus", async ({
      page,
    }) => {
      await page.clock.install();
      await createSeason(page);
      const toast = page.getByTestId("toast");
      await expect(toast).toBeVisible();
      // Rendu à la fin du document : Tab depuis le dernier contrôle de la page.
      await page.evaluate(() => {
        const controls = [
          ...document.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea"),
        ].filter((el) => !el.closest("[data-testid=toast]") && el.offsetParent !== null);
        controls[controls.length - 1]?.focus();
      });
      await page.keyboard.press(tabKey(page));
      const next = toast.getByRole("button", { name: "Étape suivante : Courts" });
      await expect(next).toBeFocused();
      await page.keyboard.press(tabKey(page));
      const close = toast.getByRole("button", { name: "Masquer le message" });
      await expect(close).toBeFocused();
      // Bulle commune au focus clavier ; Maj+Tab revient à l'action.
      await expect(page.getByRole("tooltip")).toHaveText("Masquer le message");
      await page.keyboard.press(tabKey(page, true));
      await expect(next).toBeFocused();
      // Le focus suspend l'effacement.
      await page.clock.runFor(12_000);
      await expect(toast).toBeVisible();
      // Entrée suit l'action.
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/#\/referentiels\/courts$/);
    });
  });
}
