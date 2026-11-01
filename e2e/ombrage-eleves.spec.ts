import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  demoClub,
  dragMouse,
  fixToday,
  GRAB_OFFSET,
  grabPoint,
  lesson,
  openFilters,
  openPlanning,
  type Point,
  readLessons,
  showDatedWeek,
  slotPoint,
} from "./support/planning";

/**
 * Ombrage des élèves pendant le glisser (lot L21, docs/SPECS.md §4.4) : en
 * déplaçant un cours, ou en créant un cours pour le groupe choisi dans le
 * filtre « Groupe », les créneaux où des élèves du groupe sont indisponibles
 * sont ombrés, plus fort quand ils sont plus nombreux. L'ombrage n'est pas une
 * hachure et s'affiche avec celles du moniteur ; il disparaît à la fin du geste.
 *
 * Club de démonstration : « Galaxie vert » (Léa, Tom, Zoé) le lundi à 10h00
 * avec Karim. Léa n'est disponible que le mercredi ; Tom et Zoé le mercredi et
 * le jeudi matin. Au déplacement du cours (1 h), l'ombrage se lit au haut du
 * fantôme : le jeudi, un cours qui commence à 11:00 au plus tard ne gêne que
 * Léa ; plus tard, il gêne les trois. À la création, le jeudi est découpé aux
 * bornes des plages : Léa le matin, les trois l'après-midi.
 *
 * L'ombrage est posé au début du geste, dans la même mise à jour que le
 * fantôme ou le cadre de sélection : une fois ceux-ci affichés, une absence
 * d'ombrage est acquise.
 */
const availability = {
  Léa: [[3, "08:00", "22:00"]],
  Tom: [
    [3, "08:00", "22:00"],
    [4, "08:00", "12:00"],
  ],
  Zoé: [
    [3, "08:00", "22:00"],
    [4, "08:00", "12:00"],
  ],
} satisfies Record<string, [number, string, string][]>;

function shades(page: Page): Locator {
  return page.getByTestId("student-shade");
}

/** Bandes ombrées d'un jour (1 = lundi). */
function shadesOf(page: Page, weekday: number): Locator {
  return shades(page).and(page.locator(`[data-weekday="${weekday}"]`));
}

/** Bande ombrée d'un jour qui commence à `HH:MM`. */
function shadeFrom(page: Page, weekday: number, time: string): Locator {
  const [h = 0, m = 0] = time.split(":").map(Number);
  return shadesOf(page, weekday).and(page.locator(`[data-start="${h * 60 + m}"]`));
}

/** Opacité affichée d'une bande : c'est l'intensité de l'ombrage. */
async function opacity(locator: Locator): Promise<number> {
  return Number(await locator.evaluate((el) => getComputedStyle(el).opacity));
}

/** Point de saisie qui pose le début du cours à l'heure visée. */
async function lessonTarget(page: Page, dayIndex: number, time: string): Promise<Point> {
  const point = await slotPoint(page, dayIndex, 0, time);
  return { x: point.x, y: point.y + GRAB_OFFSET };
}

test.describe("ombrage des élèves pendant le glisser", () => {
  test("le déplacement d'un cours ombre les jours où ses élèves sont indisponibles, plus fort à trois qu'à une", async ({
    page,
  }) => {
    await openPlanning(page, { ...demoClub, studentAvailability: availability });
    const galaxie = lesson(page, "Galaxie vert");
    await expect(galaxie).toBeVisible();
    await expect(shades(page)).toHaveCount(0);

    // Glisser sans relâcher, jusqu'au jeudi 15h00.
    await dragMouse(page, await grabPoint(galaxie), await lessonTarget(page, 3, "15:00"), {
      drop: false,
    });
    const ghost = page.getByTestId("lesson-ghost");
    await expect(ghost).toHaveAttribute("data-weekday", "4");
    await expect(ghost).toHaveAttribute("data-start", String(15 * 60));

    // Mercredi : tous disponibles, rien n'est ombré.
    await expect(shadesOf(page, 3)).toHaveCount(0);
    // Jeudi : un cours d'une heure gêne Léa seule jusqu'à 11:00, les trois après.
    await expect(shadesOf(page, 4)).toHaveCount(2);
    const morning = shadeFrom(page, 4, "08:00");
    const afternoon = shadeFrom(page, 4, "11:15");
    await expect(morning).toHaveAttribute("data-count", "1");
    await expect(afternoon).toHaveAttribute("data-count", "3");
    expect(Number(await afternoon.getAttribute("data-tier"))).toBeGreaterThan(
      Number(await morning.getAttribute("data-tier")),
    );
    expect(await opacity(afternoon)).toBeGreaterThan(await opacity(morning));

    // La bande couvre la colonne du jeudi, tous ses courts.
    const header = page.getByTestId("day-header").nth(3);
    await expect(header).toContainText("Jeudi");
    const [headerBox, bandBox] = [await header.boundingBox(), await afternoon.boundingBox()];
    if (!headerBox || !bandBox) throw new Error("colonne du jeudi introuvable");
    expect(Math.abs(bandBox.x - headerBox.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(bandBox.width - headerBox.width)).toBeLessThanOrEqual(2);
    // Lundi, mardi, vendredi, samedi : personne n'a de plage, les trois sont gênés.
    for (const weekday of [1, 2, 5, 6]) {
      await expect(shadesOf(page, weekday)).toHaveCount(1);
      await expect(shadesOf(page, weekday)).toHaveAttribute("data-count", "3");
    }
    await expect(page.getByTestId("shade-info")).toHaveText(
      "Zones ombrées : élèves de Galaxie vert",
    );

    // Relâché : le cours est déplacé, plus rien n'est ombré.
    await page.mouse.up();
    await expect(shades(page)).toHaveCount(0);
    await expect(page.getByTestId("shade-info")).toHaveCount(0);
    await expect
      .poll(() => readLessons(page))
      .toContainEqual(expect.objectContaining({ group: "Galaxie vert", weekday: 4 }));
  });

  test("l'ombrage n'est pas une hachure et s'affiche avec celles du moniteur", async ({ page }) => {
    await openPlanning(page, { ...demoClub, studentAvailability: availability });
    const galaxie = lesson(page, "Galaxie vert");
    await dragMouse(page, await grabPoint(galaxie), await lessonTarget(page, 3, "15:00"), {
      drop: false,
    });
    await expect(page.getByTestId("lesson-ghost")).toBeVisible();

    // Pendant le même geste : hachures de Karim et ombrage des élèves.
    const hatches = page.getByTestId("hatch");
    await expect(hatches.first()).toBeVisible();
    await expect(shades(page).first()).toBeVisible();
    await expect(page.getByTestId("hatch-info")).toHaveText("Zones rayées : Karim Benali");
    await expect(page.getByTestId("shade-info")).toHaveText(
      "Zones ombrées : élèves de Galaxie vert",
    );

    // Hachure : motif rayé ; ombrage : aplat sans motif.
    const hatchImages = await hatches.evaluateAll((els) =>
      els.map((el) => getComputedStyle(el).backgroundImage),
    );
    for (const image of hatchImages) expect(image).toContain("repeating-linear-gradient");
    const shadeImages = await shades(page).evaluateAll((els) =>
      els.map((el) => getComputedStyle(el).backgroundImage),
    );
    expect(shadeImages).toHaveLength(6);
    for (const image of shadeImages) expect(image).toBe("none");
    // Le jeudi après-midi (Karim indisponible) est à la fois hachuré et ombré.
    const thursday = await page.getByTestId("day-header").nth(3).boundingBox();
    if (!thursday) throw new Error("colonne du jeudi introuvable");
    const hatchXs = await hatches.evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect().x),
    );
    expect(hatchXs.some((x) => Math.abs(x - thursday.x) <= 2)).toBe(true);
    await expect(shadesOf(page, 4)).toHaveCount(2);

    // Échap interrompt le geste : hachures et ombrage disparaissent.
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(page.getByTestId("lesson-ghost")).toHaveCount(0);
    await expect(shades(page)).toHaveCount(0);
    await expect(hatches).toHaveCount(0);
  });

  test("la création d'un cours pour le groupe choisi dans le filtre est ombrée, pas sans groupe choisi", async ({
    page,
  }) => {
    await openPlanning(page, { ...demoClub, studentAvailability: availability });
    const form = page.getByRole("form", { name: /^Nouveau cours/ });
    const group = form.getByLabel("Groupe", { exact: true });

    // Sans groupe choisi : la sélection d'un créneau n'ombre rien.
    const from = await slotPoint(page, 3, 1, "15:00");
    const to = await slotPoint(page, 3, 1, "16:00");
    await dragMouse(page, from, to, { drop: false });
    await expect(page.getByTestId("selection-box")).toBeVisible();
    await expect(page.getByTestId("drag-tooltip")).toContainText(/^Nouveau cours/);
    await expect(page.getByTestId("drag-tooltip")).not.toContainText("hors disponibilités");
    await expect(shades(page)).toHaveCount(0);
    await page.mouse.up();
    await expect(form).toBeVisible();
    await expect(group).toHaveValue("");
    await page.getByRole("button", { name: "Fermer le panneau" }).click();
    await expect(form).toBeHidden();

    // Groupe choisi dans le filtre : même geste, ombré pour ses élèves.
    const menu = await openFilters(page);
    await menu
      .getByLabel("Filtrer par groupe", { exact: true })
      .selectOption({ label: "Galaxie vert" });
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await dragMouse(page, from, to, { drop: false });
    await expect(page.getByTestId("selection-box")).toBeVisible();
    await expect(page.getByTestId("drag-tooltip")).toContainText("Nouveau cours : Galaxie vert");
    // Les avertissements du groupe choisi s'affichent pendant la sélection (§5.1).
    await expect(page.getByTestId("drag-tooltip")).toContainText("3 élèves hors disponibilités");
    await expect(shadesOf(page, 3)).toHaveCount(0);
    await expect(shadesOf(page, 4)).toHaveCount(2);
    await expect(page.getByTestId("shade-info")).toHaveText(
      "Zones ombrées : élèves de Galaxie vert",
    );

    // Relâché : plus d'ombrage, le panneau s'ouvre avec le groupe choisi.
    await page.mouse.up();
    await expect(shades(page)).toHaveCount(0);
    await expect(form).toBeVisible();
    await expect(group.locator("option:checked")).toHaveText("Galaxie vert (3/8)");
  });

  test("le déplacement au clavier ombre aussi, jusqu'à la fin du geste", async ({ page }) => {
    await openPlanning(page, { ...demoClub, studentAvailability: availability });
    const galaxie = lesson(page, "Galaxie vert");
    await galaxie.focus();
    await page.keyboard.press("Space");
    const ghost = page.getByTestId("lesson-ghost");
    await expect(ghost).toBeVisible();
    await expect(page.getByTestId("drag-tooltip")).toContainText("Déplacement au clavier");
    await expect(shadesOf(page, 3)).toHaveCount(0);
    await expect(shadesOf(page, 4)).toHaveCount(2);
    await expect(shadeFrom(page, 4, "11:15")).toHaveAttribute("data-count", "3");
    await expect(page.getByTestId("shade-info")).toHaveText(
      "Zones ombrées : élèves de Galaxie vert",
    );

    // Échap interrompt le déplacement : plus d'ombrage, le cours n'a pas bougé.
    await page.keyboard.press("Escape");
    await expect(ghost).toHaveCount(0);
    await expect(shades(page)).toHaveCount(0);
    await expect(page.getByTestId("shade-info")).toHaveCount(0);
    await expect(galaxie).toContainText("10h00–11h00");
  });

  test("sans bande visible, pas de pastille, même si des élèves ont des plages", async ({
    page,
  }) => {
    // Hugo, disponible toute la journée du lundi au samedi : aucun créneau ne le gêne.
    const allWeek = [1, 2, 3, 4, 5, 6].map(
      (d) => [d, "08:00", "22:00"] as [number, string, string],
    );
    await openPlanning(page, { ...demoClub, studentAvailability: { Hugo: allWeek } });
    await dragMouse(
      page,
      await grabPoint(lesson(page, "Ados perfectionnement")),
      await lessonTarget(page, 3, "15:00"),
      { drop: false },
    );
    await expect(page.getByTestId("lesson-ghost")).toHaveAttribute("data-weekday", "4");
    await expect(page.getByTestId("hatch").first()).toBeVisible();
    await expect(shades(page)).toHaveCount(0);
    await expect(page.getByTestId("shade-info")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.mouse.up();
  });

  test("les jours fermés ne sont pas ombrés", async ({ page }) => {
    // Jeudi 05/11 fermé, dans la semaine du jour (02/11).
    await fixToday(page);
    await openPlanning(page, {
      ...demoClub,
      studentAvailability: availability,
      closures: [{ label: "Pont", startDate: "2026-11-05", endDate: "2026-11-05" }],
    });
    await showDatedWeek(page);
    await expect(page.getByTestId("closure-band")).toHaveCount(1);
    await expect(page.getByTestId("closure-band")).toHaveAttribute("data-weekday", "4");
    await dragMouse(
      page,
      await grabPoint(lesson(page, "Galaxie vert")),
      await lessonTarget(page, 1, "15:00"),
      { drop: false },
    );
    await expect(page.getByTestId("lesson-ghost")).toHaveAttribute("data-weekday", "2");
    // Lundi, mardi, vendredi, samedi ombrés ; ni le mercredi (tous disponibles) ni le jeudi fermé.
    for (const weekday of [1, 2, 5, 6]) await expect(shadesOf(page, weekday)).toHaveCount(1);
    await expect(shadesOf(page, 4)).toHaveCount(0);
    await expect(shades(page)).toHaveCount(4);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(shades(page)).toHaveCount(0);
  });

  test("sans plage pour aucun élève du groupe, le glisser n'ombre rien", async ({ page }) => {
    await openPlanning(page);
    await dragMouse(
      page,
      await grabPoint(lesson(page, "Galaxie vert")),
      await lessonTarget(page, 3, "15:00"),
      { drop: false },
    );
    await expect(page.getByTestId("lesson-ghost")).toHaveAttribute("data-weekday", "4");
    await expect(page.getByTestId("hatch").first()).toBeVisible();
    await expect(shades(page)).toHaveCount(0);
    await expect(page.getByTestId("shade-info")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(page.getByTestId("lesson-ghost")).toHaveCount(0);
  });
});
