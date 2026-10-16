import { expect, type Page, test } from "@playwright/test";
import { contrastIssues, tabStops, unnamedControls } from "./support/a11y";
import { lesson, openPlanning, readLessons } from "./support/planning";
import { SCREENS, visit } from "./support/screens";

/**
 * Accessibilité (lot L8) : déplacement d'un cours au clavier avec annonces
 * en français, contrastes des écrans principaux en thème clair et sombre,
 * noms accessibles et focus visibles.
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
  for (const path of ["/#/planning", "/#/referentiels/eleves", "/#/reglages", "/#/a-propos"]) {
    test(`chaque arrêt de tabulation est visible (${path})`, async ({ page }) => {
      await openPlanning(page);
      await visit(page, path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.locator("body").click({ position: { x: 1, y: 1 } });
      const stops = await tabStops(page, 30);
      expect(stops.filter((s) => !s.visible).map((s) => s.element)).toEqual([]);
    });
  }
});
