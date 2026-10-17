import { expect, type Page, test } from "@playwright/test";
import { perfLimit } from "../src/test/perf";
import { createSeason, goToPlanning } from "./support/planning";

/**
 * Tests de charge de l'interface (lot L8) sur la volumétrie cible
 * (SPECS.md §11.5) : 10 courts, 20 moniteurs, 60 groupes, 500 élèves,
 * 150 cours dans la semaine type, avec exceptions et vacances.
 *
 * Les durées sont mesurées depuis le processus de test (aller-retour
 * Playwright compris) : les seuils sont des majorants larges, la mesure est
 * jointe au rapport (annotation « performance »).
 */

const E2E_MODULE = "/src/test/e2e.ts";

test.describe.configure({ timeout: 90_000 });

test.beforeEach(async ({ page }) => {
  // Aujourd'hui : mercredi 18/11/2026, semaine ordinaire (hors vacances).
  await page.clock.setFixedTime(new Date("2026-11-18T10:00:00+01:00"));
  await createSeason(page);
  await page.evaluate(async (path) => {
    const tools = await import(/* @vite-ignore */ path);
    await tools.seedVolume();
  }, E2E_MODULE);
});

/** Durée (ms) d'une action jusqu'à ce que son résultat soit affiché. */
async function timed(action: () => Promise<unknown>): Promise<number> {
  const start = Date.now();
  await action();
  return Date.now() - start;
}

function report(label: string, durations: number[]) {
  const average = durations.reduce((a, b) => a + b, 0) / durations.length;
  test.info().annotations.push({
    type: "performance",
    description: `${label} : ${average.toFixed(0)} ms en moyenne (max ${Math.max(...durations)} ms, ${durations.length} mesure(s))`,
  });
  return average;
}

function nav(page: Page) {
  return page.getByRole("navigation", { name: "Navigation principale" });
}

test.describe("volumétrie cible (§11.5)", () => {
  test("affiche la semaine type et navigue entre les semaines datées", async ({ page }) => {
    const lessons = page.getByTestId("lesson");
    const display = await timed(async () => {
      await nav(page).getByRole("link", { name: "Planning" }).click();
      await expect(lessons).toHaveCount(150);
    });
    expect(report("affichage de la semaine type (150 cours)", [display])).toBeLessThan(
      perfLimit(3_000),
    );
    await expect(page.getByTestId("instructor-pill")).toHaveCount(20);

    // Passage en semaine datée, puis 12 semaines vers l'avant (vacances de Noël comprises).
    const modeBar = page.getByTestId("mode-bar");
    await page
      .getByRole("group", { name: "Mode d'affichage" })
      .getByRole("button", { name: "Une semaine précise" })
      .click();
    await expect(modeBar).toContainText("Semaine du 16 novembre");
    await expect(lessons).not.toHaveCount(0);

    const steps: number[] = [];
    let monday = new Date(Date.UTC(2026, 10, 16));
    for (let i = 0; i < 12; i++) {
      monday = new Date(monday.getTime() + 7 * 86_400_000);
      const label = monday.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        timeZone: "UTC",
      });
      steps.push(
        await timed(async () => {
          await page.keyboard.press("ArrowRight");
          await expect(modeBar).toContainText(`Semaine du ${label.replace(/^1 /, "1er ")}`);
        }),
      );
      // Semaine entière de vacances de Noël : six bandes « Fermé ».
      if (label === "28 décembre") await expect(page.getByTestId("closure-band")).toHaveCount(6);
    }
    // §11.5 : affichage d'une semaine perçu comme instantané.
    expect(report("navigation entre semaines datées", steps)).toBeLessThan(perfLimit(500));
  });

  test("garde un glisser-déposer fluide", async ({ page }) => {
    await goToPlanning(page);
    await expect(page.getByTestId("lesson")).toHaveCount(150);
    const source = page.getByTestId("lesson").first();
    await source.scrollIntoViewIfNeeded();
    const box = await source.boundingBox();
    if (!box) throw new Error("cours introuvable");
    const from = { x: box.x + box.width / 2, y: box.y + 11 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x, from.y + 8, { steps: 2 });
    await expect(page.getByTestId("lesson-ghost")).toBeVisible();

    const moves: number[] = [];
    for (let i = 1; i <= 25; i++) {
      moves.push(
        await timed(async () => {
          await page.mouse.move(from.x + i * 9, from.y + 8 + i * 6);
          await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
        }),
      );
    }
    await expect(page.getByTestId("drag-tooltip")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(page.getByTestId("lesson-ghost")).toHaveCount(0);
    expect(report("retour visuel du glisser", moves)).toBeLessThan(perfLimit(100));
  });

  test("ouvre les référentiels avec 500 élèves", async ({ page }) => {
    await nav(page).getByRole("link", { name: "Le club" }).click();
    const tabs = page.getByRole("navigation", { name: "Fiches du club" });

    const students = page.getByRole("table", { name: "Élèves" }).locator("tbody tr");
    const list = await timed(async () => {
      await tabs.getByRole("link", { name: "Élèves" }).click();
      await expect(page.getByTestId("student-count")).toHaveText("500 élèves");
      await expect(students).toHaveCount(500);
    });
    expect(report("liste des 500 élèves", [list])).toBeLessThan(perfLimit(3_000));

    const search = await timed(async () => {
      await page.getByRole("searchbox", { name: "Rechercher un élève" }).fill("0700000123");
      await expect(page.getByTestId("student-count")).toHaveText("1 sur 500");
    });
    expect(report("recherche parmi 500 élèves", [search])).toBeLessThan(perfLimit(1_000));
    await expect(students.first()).toContainText("Côme 124");

    const clear = await timed(async () => {
      await page.getByRole("searchbox", { name: "Rechercher un élève" }).fill("");
      await expect(students).toHaveCount(500);
    });
    expect(report("retour à la liste complète", [clear])).toBeLessThan(perfLimit(1_500));

    const groupsHeader = page.getByRole("columnheader", { name: "Groupes" });
    const sort = await timed(async () => {
      await groupsHeader.getByRole("button").click();
      await expect(groupsHeader).toHaveAttribute("aria-sort", "ascending");
      await expect(students.first()).toContainText("Adultes 1");
    });
    expect(report("tri de 500 élèves", [sort])).toBeLessThan(perfLimit(1_500));

    const groups = page.getByRole("table", { name: "Groupes" }).locator("tbody tr");
    const groupList = await timed(async () => {
      await tabs.getByRole("link", { name: "Groupes" }).click();
      await expect(groups).toHaveCount(60);
    });
    expect(report("liste des 60 groupes", [groupList])).toBeLessThan(perfLimit(2_000));

    const detail = await timed(async () => {
      await page.getByRole("link", { name: "Galaxie 1", exact: true }).click();
      await expect(page.getByRole("heading", { level: 2, name: "Galaxie 1" })).toBeVisible();
      await expect(page.getByRole("table", { name: "Élèves du groupe" })).toBeVisible();
    });
    expect(report("fiche et composition d'un groupe", [detail])).toBeLessThan(perfLimit(2_000));

    const instructors = page.getByRole("table", { name: "Moniteurs" }).locator("tbody tr");
    const instructorList = await timed(async () => {
      await tabs.getByRole("link", { name: "Moniteurs" }).click();
      await expect(instructors).toHaveCount(20);
    });
    expect(report("liste des 20 moniteurs", [instructorList])).toBeLessThan(perfLimit(2_000));
  });
});
