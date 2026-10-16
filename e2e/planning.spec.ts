import { expect, type Page, test } from "@playwright/test";
import type { SeedLesson } from "../src/test/e2e";
import {
  demoClub,
  dragMouse,
  GRAB_OFFSET,
  goToPlanning,
  grabPoint,
  lesson,
  openPlanning,
  readLessons,
  resizePoint,
  slotPoint,
} from "./support/planning";

/**
 * Grille de la semaine type (lot L3) : tous les gestes de la maquette
 * `maquettes/drag-and-drop.html`. Club de démonstration : lundi → samedi,
 * Court 1 (couvert) et Court 2 (extérieur) ; « Galaxie vert » le lundi à 10h00
 * sur le Court 1 avec Karim, « Ados perfectionnement » le mercredi à 10h00
 * (1 h 30) sur le Court 2 avec Julie.
 */

const MON = 0;
const TUE = 1;
const WED = 2;
const THU = 3;
const SAT = 5;
const C1 = 0;
const C2 = 1;

function panel(page: Page, name: "Nouveau cours" | "Modifier le cours") {
  return page.getByRole("form", { name });
}

function stored(group: string, values: Record<string, unknown>) {
  return expect.objectContaining({ group, ...values });
}

test.describe("grille semaine type", () => {
  test("affiche les jours, les courts et les cours colorés du moniteur", async ({ page }) => {
    await openPlanning(page);
    await expect(page.getByTestId("day-header")).toHaveText([
      /Lundi/,
      /Mardi/,
      /Mercredi/,
      /Jeudi/,
      /Vendredi/,
      /Samedi/,
    ]);
    const galaxie = lesson(page, "Galaxie vert");
    await expect(galaxie).toContainText("10h00–11h00");
    await expect(galaxie).toContainText("KB · 3/8");
    await expect(galaxie).toHaveCSS("background-color", "rgb(194, 65, 12)");
    await expect(galaxie).toHaveAttribute("title", /Court 1 \(couvert\)\nMoniteur : Karim Benali/);
    const legend = page.getByRole("group", { name: "Légende des moniteurs" });
    await expect(
      legend.getByRole("button", { name: "Julie Martin, 1h30 cette semaine" }),
    ).toBeVisible();
    await expect(
      legend.getByRole("button", { name: "Karim Benali, 1h cette semaine" }),
    ).toBeVisible();
    await expect(page.getByTestId("week-total")).toHaveText("Total : 2h30");
  });

  test("crée un cours par sélection sur la grille, moniteurs disponibles en tête", async ({
    page,
  }) => {
    await openPlanning(page);
    const from = await slotPoint(page, TUE, C1, "09:00");
    const to = await slotPoint(page, TUE, C1, "10:30");
    await dragMouse(page, { x: from.x, y: from.y + 2 }, { x: to.x, y: to.y - 2 }, { drop: false });
    await expect(page.getByTestId("selection-box")).toHaveText("9h00–10h30");
    await page.mouse.up();

    const form = panel(page, "Nouveau cours");
    await expect(form.getByLabel("Jour")).toHaveValue("2");
    await expect(form.getByLabel("Court")).toHaveValue(/.+/);
    await expect(form.getByLabel("Court").locator("option:checked")).toHaveText("Court 1");
    await expect(form.getByLabel("Début").locator("option:checked")).toHaveText("09:00");
    await expect(form.getByLabel("Durée").locator("option:checked")).toHaveText("1 h 30");
    await expect(page.getByTestId("lesson-draft")).toBeVisible();

    const instructor = form.getByLabel("Moniteur", { exact: true });
    await expect(instructor.locator('optgroup[label="Disponibles"] option')).toHaveText([
      "● Karim Benali",
    ]);
    await expect(
      instructor.locator('optgroup[label="Indisponibles sur ce créneau"] option'),
    ).toHaveText(["○ Marc Leroy (aucune disponibilité saisie)", "○ Julie Martin (indisponible)"]);

    await form.getByLabel("Rechercher un groupe").fill("mini");
    await expect(form.getByLabel("Groupe", { exact: true }).locator("option")).toHaveText([
      "— choisir —",
      "Mini-tennis (1/6)",
    ]);
    await form.getByLabel("Groupe", { exact: true }).selectOption({ label: "Mini-tennis (1/6)" });
    await instructor.selectOption({ label: "● Karim Benali" });
    await expect(form.getByRole("list", { name: "Avertissements du créneau" })).toBeEmpty();
    await form.getByRole("button", { name: "Créer le cours" }).click();

    await expect(form).toBeHidden();
    await expect(lesson(page, "Mini-tennis")).toContainText("9h00–10h30");
    await expect(page.getByTestId("toast")).toContainText("Création du cours");
    await expect
      .poll(() => readLessons(page))
      .toContainEqual(
        stored("Mini-tennis", {
          instructor: "Karim",
          court: "Court 1",
          weekday: 2,
          startTime: "09:00",
          durationMinutes: 90,
        }),
      );
  });

  test("crée un cours depuis le bouton, avec création rapide d'un groupe", async ({ page }) => {
    await openPlanning(page);
    await page.getByRole("button", { name: "Nouveau cours" }).click();
    const form = panel(page, "Nouveau cours");
    await expect(form.getByLabel("Groupe", { exact: true })).toHaveValue("");
    await expect(form.getByLabel("Moniteur", { exact: true })).toHaveValue("");
    await expect(form.getByLabel("Court")).toHaveValue("");

    await form.getByRole("button", { name: "Nouveau groupe" }).click();
    const dialog = page.getByRole("dialog", { name: "Nouveau groupe" });
    await dialog.getByLabel("Nom").fill("Galaxie jaune");
    await dialog.getByLabel("Effectif maximum").fill("6");
    await dialog.getByRole("button", { name: "Créer le groupe" }).click();
    await expect(dialog).toBeHidden();
    await expect(form.getByLabel("Groupe", { exact: true }).locator("option:checked")).toHaveText(
      "Galaxie jaune (0/6)",
    );

    await form.getByLabel("Jour").selectOption({ label: "Samedi" });
    await form.getByLabel("Court").selectOption({ label: "Court 2" });
    await form.getByLabel("Début").selectOption("540");
    await form.getByLabel("Durée").selectOption({ label: "1 h" });
    await form.getByLabel("Moniteur", { exact: true }).selectOption({ label: "● Julie Martin" });
    await form.getByRole("button", { name: "Créer le cours" }).click();

    await expect(lesson(page, "Galaxie jaune")).toContainText("9h00–10h00");
    await expect
      .poll(() => readLessons(page))
      .toContainEqual(
        stored("Galaxie jaune", { weekday: 6, startTime: "09:00", court: "Court 2" }),
      );
  });

  test("range les moniteurs occupés à part et hachure le moniteur du panneau (B8)", async ({
    page,
  }) => {
    await openPlanning(page);
    await page.getByRole("button", { name: "Nouveau cours" }).click();
    const form = panel(page, "Nouveau cours");
    const instructor = form.getByLabel("Moniteur", { exact: true });
    const group = (label: string) => instructor.locator(`optgroup[label="${label}"] option`);
    await form.getByLabel("Jour").selectOption({ label: "Lundi" });
    await form.getByLabel("Début").selectOption({ label: "10:30" });
    // Karim donne « Galaxie vert » de 10:00 à 11:00 : chevauchement partiel.
    await expect(group("Disponibles")).toHaveCount(0);
    await expect(group("Occupés sur ce créneau")).toHaveText([
      "◐ Karim Benali (Galaxie vert 10:00–11:00)",
    ]);
    await expect(group("Indisponibles sur ce créneau")).toHaveText([
      "○ Marc Leroy (aucune disponibilité saisie)",
      "○ Julie Martin (indisponible)",
    ]);
    // Tous restent sélectionnables ; le conflit est signalé.
    await instructor.selectOption({ label: "◐ Karim Benali (Galaxie vert 10:00–11:00)" });
    await expect(form.getByRole("list", { name: "Avertissements du créneau" })).toContainText(
      "Karim",
    );

    // Le moniteur du panneau passe avant le survol pour les hachures.
    await instructor.selectOption({ label: "○ Julie Martin (indisponible)" });
    await expect(page.getByTestId("hatch-info")).toHaveText("Hachures : Julie Martin");
    await lesson(page, "Galaxie vert").hover();
    await expect(page.getByTestId("hatch-info")).toHaveText("Hachures : Julie Martin");
    await form.getByRole("button", { name: "Fermer", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Abandonner les modifications ?" })
      .getByRole("button", { name: /Abandonner/ })
      .click();
    await expect(form).toBeHidden();

    // Le cours édité n'est pas compté : Karim reste disponible pour « Galaxie vert ».
    await lesson(page, "Galaxie vert").click();
    const edit = panel(page, "Modifier le cours");
    await expect(
      edit.getByLabel("Moniteur", { exact: true }).locator('optgroup[label="Disponibles"] option'),
    ).toHaveText(["● Karim Benali"]);
    await expect(
      edit
        .getByLabel("Moniteur", { exact: true })
        .locator('optgroup[label="Occupés sur ce créneau"] option'),
    ).toHaveCount(0);
  });

  test("avertit en temps réel dans le panneau ; un clic dans le vide le ferme", async ({
    page,
  }) => {
    await openPlanning(page);
    const galaxie = lesson(page, "Galaxie vert");
    await galaxie.click();
    const form = panel(page, "Modifier le cours");
    await expect(form.getByRole("list", { name: "Avertissements du créneau" })).toBeEmpty();
    await form.getByLabel("Jour").selectOption({ label: "Mercredi" });
    await form.getByLabel("Court").selectOption({ label: "Court 2" });
    await expect(form.getByRole("list", { name: "Avertissements du créneau" })).toContainText(
      "déjà occupé par Ados perfectionnement",
    );

    // Saisie modifiée : fermer le panneau demande confirmation (garde de modale).
    const empty = await slotPoint(page, SAT, C1, "15:00");
    await page.mouse.click(empty.x, empty.y);
    const discard = page.getByRole("dialog", { name: "Abandonner les modifications ?" });
    await discard.getByRole("button", { name: "Abandonner" }).click();
    await expect(form).toBeHidden();
    await expect(galaxie).not.toHaveAttribute("data-selected");
    await expect(galaxie).toContainText("10h00–11h00");
    expect(await readLessons(page)).toContainEqual(stored("Galaxie vert", { weekday: 1 }));
  });

  test("affiche en entier un cours qui déborde de l'amplitude", async ({ page }) => {
    await openPlanning(page, {
      ...demoClub,
      lessons: [
        {
          weekday: 6,
          startTime: "21:30",
          durationMinutes: 90,
          court: "Court 1",
          group: "Mini-tennis",
          instructor: "Julie",
        },
      ],
    });
    const board = await page.getByTestId("planning-board").boundingBox();
    const block = await lesson(page, "Mini-tennis").boundingBox();
    if (!board || !block) throw new Error("éléments introuvables");
    expect(block.y + block.height).toBeLessThanOrEqual(board.y + board.height);
    await expect(lesson(page, "Mini-tennis")).toContainText("21h30–23h00");
  });

  test("modifie un cours depuis le panneau et le supprime", async ({ page }) => {
    await openPlanning(page);
    await lesson(page, "Ados perfectionnement").click();
    const form = panel(page, "Modifier le cours");
    await expect(form.getByLabel("Jour").locator("option:checked")).toHaveText("Mercredi");
    await form.getByLabel("Durée").selectOption({ label: "2 h" });
    await form.getByLabel("Note").fill("Prévoir des balles neuves");
    await form.getByRole("button", { name: "Enregistrer" }).click();
    await expect(lesson(page, "Ados perfectionnement")).toContainText("10h00–12h00");
    await expect
      .poll(() => readLessons(page))
      .toContainEqual(stored("Ados perfectionnement", { durationMinutes: 120 }));

    await lesson(page, "Ados perfectionnement").click();
    await panel(page, "Modifier le cours").getByRole("button", { name: "Supprimer" }).click();
    await expect(lesson(page, "Ados perfectionnement")).toHaveCount(0);
    await expect.poll(async () => (await readLessons(page)).length).toBe(1);
  });

  test("déplace un cours au pas de 15 min, vers un autre jour et un autre court", async ({
    page,
  }) => {
    await openPlanning(page);
    const galaxie = lesson(page, "Galaxie vert");
    const target = await slotPoint(page, WED, C1, "14:15");
    // 4 px de plus (5 min) : le magnétisme ramène au quart d'heure.
    await dragMouse(
      page,
      await grabPoint(galaxie),
      { x: target.x, y: target.y + GRAB_OFFSET + 4 },
      {
        drop: false,
      },
    );
    const ghost = page.getByTestId("lesson-ghost");
    await expect(ghost).toHaveAttribute("data-weekday", "3");
    await expect(ghost).toHaveAttribute("data-start", String(14 * 60 + 15));
    await expect(ghost).not.toHaveAttribute("data-warning");
    await expect(page.getByTestId("drag-tooltip")).toContainText(
      "Mercredi · Court 1 · 14h15–15h15",
    );
    await expect(page.getByTestId("hatch").first()).toBeVisible();
    await page.mouse.up();

    await expect(ghost).toBeHidden();
    await expect(galaxie).toContainText("14h15–15h15");
    await expect
      .poll(() => readLessons(page))
      .toContainEqual(stored("Galaxie vert", { weekday: 3, startTime: "14:15", court: "Court 1" }));

    // Jeudi, Court 2 : Karim n'est pas disponible, avertissement en temps réel.
    const thursday = await slotPoint(page, THU, C2, "09:00");
    await dragMouse(
      page,
      await grabPoint(galaxie),
      { x: thursday.x, y: thursday.y + GRAB_OFFSET },
      {
        drop: false,
      },
    );
    await expect(ghost).toHaveAttribute("data-warning", "true");
    await expect(page.getByTestId("drag-tooltip")).toContainText("⚠ Hors disponibilités de Karim");
    await page.mouse.up();
    await expect(galaxie).toHaveAttribute("data-warning", "true");
    await expect
      .poll(() => readLessons(page))
      .toContainEqual(stored("Galaxie vert", { weekday: 4, startTime: "09:00", court: "Court 2" }));
    await expect(page.getByRole("list", { name: "Avertissements" })).toContainText(
      "Jeu 9h00 · Galaxie vert",
    );
  });

  test("redimensionne un cours par son bord inférieur", async ({ page }) => {
    await openPlanning(page);
    const ados = lesson(page, "Ados perfectionnement");
    const end = await slotPoint(page, WED, C2, "12:00");
    await dragMouse(page, await resizePoint(ados), end, { drop: false });
    await expect(page.getByTestId("drag-tooltip")).toContainText("Durée : 2h");
    await expect(page.getByTestId("lesson-ghost")).toHaveAttribute("data-duration", "120");
    await page.mouse.up();
    await expect(ados).toContainText("10h00–12h00");
    await expect
      .poll(() => readLessons(page))
      .toContainEqual(stored("Ados perfectionnement", { durationMinutes: 120 }));
  });

  test("duplique un cours en glissant avec Alt", async ({ page }) => {
    await openPlanning(page);
    const target = await slotPoint(page, MON, C2, "10:00");
    await dragMouse(
      page,
      await grabPoint(lesson(page, "Galaxie vert")),
      {
        x: target.x - 10,
        y: target.y + GRAB_OFFSET,
      },
      { drop: false },
    );
    await expect(page.getByTestId("drag-tooltip")).toContainText("Déplacement");
    await page.keyboard.down("Alt");
    await page.mouse.move(target.x, target.y + GRAB_OFFSET, { steps: 2 });
    await expect(page.getByTestId("drag-tooltip")).toContainText("Duplication (Alt)");
    await expect(page.getByTestId("drag-tooltip")).toContainText("⚠ Karim a déjà un cours à 10h00");
    await page.mouse.up();
    await page.keyboard.up("Alt");

    await expect(lesson(page, "Galaxie vert")).toHaveCount(2);
    await expect
      .poll(() => readLessons(page))
      .toEqual([
        stored("Galaxie vert", { weekday: 1, startTime: "10:00", court: "Court 1" }),
        stored("Galaxie vert", { weekday: 1, startTime: "10:00", court: "Court 2" }),
        stored("Ados perfectionnement", { weekday: 3 }),
      ]);
    await expect(page.getByRole("list", { name: "Avertissements" })).toContainText(
      "Karim a déjà un cours à 10h00",
    );

    // Le message de confirmation permet d'annuler l'action.
    await page.getByTestId("toast").getByRole("button", { name: "Annuler cette action" }).click();
    await expect(lesson(page, "Galaxie vert")).toHaveCount(1);
    await expect.poll(async () => (await readLessons(page)).length).toBe(2);
  });

  test("confie un cours à un moniteur en déposant sa pastille", async ({ page }) => {
    await openPlanning(page);
    const legend = page.getByRole("group", { name: "Légende des moniteurs" });
    const pill = legend.getByRole("button", { name: /^Julie Martin/ });
    const pillBox = await pill.boundingBox();
    const galaxie = lesson(page, "Galaxie vert");
    const lessonBox = await galaxie.boundingBox();
    if (!pillBox || !lessonBox) throw new Error("éléments introuvables");
    await dragMouse(
      page,
      { x: pillBox.x + pillBox.width / 2, y: pillBox.y + pillBox.height / 2 },
      { x: lessonBox.x + lessonBox.width / 2, y: lessonBox.y + lessonBox.height / 2 },
      { drop: false },
    );
    await expect(page.getByTestId("drag-chip")).toHaveText("Julie");
    await expect(page.getByTestId("drag-tooltip")).toContainText(
      "Confier « Galaxie vert » à Julie",
    );
    await expect(page.getByTestId("drag-tooltip")).toContainText("⚠ Hors disponibilités de Julie");
    await expect(page.getByTestId("hatch-info")).toHaveText("Hachures : Julie Martin");
    await page.mouse.up();

    await expect(galaxie).toContainText("JM · 3/8");
    await expect(
      legend.getByRole("button", { name: "Julie Martin, 2h30 cette semaine" }),
    ).toBeVisible();
    await expect
      .poll(() => readLessons(page))
      .toContainEqual(stored("Galaxie vert", { instructor: "Julie" }));
  });

  test("Échap interrompt un glisser sans rien modifier", async ({ page }) => {
    await openPlanning(page);
    const target = await slotPoint(page, WED, C1, "15:00");
    await dragMouse(page, await grabPoint(lesson(page, "Galaxie vert")), target, { drop: false });
    await expect(page.getByTestId("lesson-ghost")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("lesson-ghost")).toBeHidden();
    await expect(page.getByTestId("toast")).toHaveText("Déplacement interrompu");
    await page.mouse.up();

    // Sélection d'un créneau interrompue de même.
    const from = await slotPoint(page, TUE, C2, "09:00");
    await dragMouse(page, from, { x: from.x, y: from.y + 60 }, { drop: false });
    await expect(page.getByTestId("selection-box")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("selection-box")).toBeHidden();
    await page.mouse.up();
    await expect(panel(page, "Nouveau cours")).toBeHidden();

    await expect(lesson(page, "Galaxie vert")).toContainText("10h00–11h00");
    await expect(page.getByRole("button", { name: "Annuler", exact: true })).toBeDisabled();
    expect(await readLessons(page)).toContainEqual(
      stored("Galaxie vert", { weekday: 1, startTime: "10:00" }),
    );
  });

  test("annule et rétablit au clavier ; Suppr, Ctrl/Cmd+N et Échap", async ({ page }) => {
    await openPlanning(page);
    const galaxie = lesson(page, "Galaxie vert");
    const target = await slotPoint(page, TUE, C2, "11:00");
    await dragMouse(page, await grabPoint(galaxie), { x: target.x, y: target.y + GRAB_OFFSET });
    await expect(galaxie).toContainText("11h00–12h00");

    await page.keyboard.press("ControlOrMeta+z");
    await expect(galaxie).toContainText("10h00–11h00");
    await expect
      .poll(() => readLessons(page))
      .toContainEqual(stored("Galaxie vert", { weekday: 1, startTime: "10:00", court: "Court 1" }));
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(galaxie).toContainText("11h00–12h00");
    await expect
      .poll(() => readLessons(page))
      .toContainEqual(stored("Galaxie vert", { weekday: 2, startTime: "11:00", court: "Court 2" }));

    // Suppr supprime le cours sélectionné ; l'annulation le restaure.
    await galaxie.click();
    await expect(galaxie).toHaveAttribute("data-selected", "true");
    await page.keyboard.press("Delete");
    await expect(galaxie).toHaveCount(0);
    await expect.poll(async () => (await readLessons(page)).length).toBe(1);
    await page.getByRole("button", { name: "Annuler", exact: true }).click();
    await expect(galaxie).toHaveCount(1);
    await expect.poll(async () => (await readLessons(page)).length).toBe(2);
    await page.getByRole("button", { name: "Rétablir", exact: true }).click();
    await expect(galaxie).toHaveCount(0);
    await page.keyboard.press("ControlOrMeta+z");
    await expect(galaxie).toHaveCount(1);

    // Ctrl/Cmd+N ouvre le panneau « Nouveau cours » (§11.5), curseur dans le
    // premier champ ; Échap le ferme. N seul est sans effet (pas de raccourci
    // d'une seule lettre, WCAG 2.1.4).
    await page.keyboard.press("n");
    await expect(panel(page, "Nouveau cours")).toBeHidden();
    await page.keyboard.press("ControlOrMeta+n");
    await expect(panel(page, "Nouveau cours")).toBeVisible();
    await expect(panel(page, "Nouveau cours").getByLabel("Rechercher un groupe")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(panel(page, "Nouveau cours")).toBeHidden();
    await page.keyboard.press("ControlOrMeta+n");
    await expect(panel(page, "Nouveau cours")).toBeVisible();
  });

  test("hachure les indisponibilités au survol et au clic sur une pastille", async ({ page }) => {
    await openPlanning(page);
    const hatches = page.getByTestId("hatch");
    await expect(hatches).toHaveCount(0);

    await lesson(page, "Galaxie vert").hover();
    await expect(page.getByTestId("hatch-info")).toHaveText("Hachures : Karim Benali");
    // Lundi 8h–9h, 12h–17h, 21h30–22h ; mardi 8h–9h, 12h–22h ; mercredi 8h–13h, 19h–22h ;
    // jeudi, vendredi, samedi entiers.
    await expect(hatches).toHaveCount(10);
    await page.mouse.move(5, 5);
    await expect(hatches).toHaveCount(0);

    const legend = page.getByRole("group", { name: "Légende des moniteurs" });
    const marc = legend.getByRole("button", { name: /^Marc Leroy/ });
    await marc.click();
    await expect(marc).toHaveAttribute("aria-pressed", "true");
    await expect(hatches).toHaveCount(6);
    await expect(page.getByTestId("hatch-info")).toHaveText(
      "Hachures : Marc Leroy (aucune disponibilité)",
    );
    await marc.click();
    await expect(hatches).toHaveCount(0);

    // Un cours supprimé sous le pointeur ne laisse pas ses hachures.
    await lesson(page, "Galaxie vert").click();
    await expect(hatches).toHaveCount(10);
    await page.keyboard.press("Delete");
    await expect(lesson(page, "Galaxie vert")).toHaveCount(0);
    await expect(hatches).toHaveCount(0);
  });

  test("filtre par moniteur, court et groupe", async ({ page }) => {
    await openPlanning(page);
    const galaxie = lesson(page, "Galaxie vert");
    const ados = lesson(page, "Ados perfectionnement");

    const byInstructor = page.getByRole("group", { name: "Filtrer par moniteur" });
    await byInstructor.getByRole("button", { name: "Julie Martin" }).click();
    await expect(galaxie).toHaveAttribute("data-dimmed", "true");
    await expect(ados).not.toHaveAttribute("data-dimmed");
    await byInstructor.getByRole("button", { name: "Karim Benali" }).click();
    await expect(galaxie).not.toHaveAttribute("data-dimmed");
    await page.getByRole("button", { name: "Effacer les filtres" }).click();

    const byCourt = page.getByRole("group", { name: "Filtrer par court" });
    await byCourt.getByRole("button", { name: "Court 1" }).click();
    await expect(ados).toHaveAttribute("data-dimmed", "true");
    await expect(galaxie).not.toHaveAttribute("data-dimmed");
    await byCourt.getByRole("button", { name: "Court 1" }).click();
    await expect(ados).not.toHaveAttribute("data-dimmed");

    await page.getByLabel("Filtrer par groupe").selectOption({ label: "Ados perfectionnement" });
    await expect(galaxie).toHaveAttribute("data-dimmed", "true");
    await expect(ados).not.toHaveAttribute("data-dimmed");
    await expect(galaxie).toHaveCSS("opacity", "0.25");
  });

  test("liste les avertissements et navigue vers le cours concerné", async ({ page }) => {
    // Après « Appliquer à partir de », deux versions d'un cours coexistent :
    // seule celle en vigueur s'affiche, sans conflit avec l'autre.
    await page.clock.setFixedTime(new Date("2026-11-04T10:00:00+01:00"));
    const versions: SeedLesson[] = [
      { ...demoClub.lessons[0], effectiveTo: "2026-11-01" } as SeedLesson,
      { ...demoClub.lessons[0], effectiveFrom: "2026-11-02" } as SeedLesson,
    ];
    await openPlanning(page, {
      ...demoClub,
      lessons: [
        ...versions,
        demoClub.lessons[1] as SeedLesson,
        {
          weekday: 6,
          startTime: "21:00",
          durationMinutes: 60,
          court: "Court 2",
          group: "Adultes débutants",
          instructor: "Marc",
        },
      ],
    });
    await expect(lesson(page, "Galaxie vert")).toHaveCount(1);
    await expect(lesson(page, "Galaxie vert")).not.toHaveAttribute("data-warning");
    await expect(page.getByTestId("hidden-versions")).toHaveText("1 version(s) masquée(s)");

    await expect(page.getByRole("heading", { name: "Avertissements (1)" })).toBeVisible();
    const item = page.getByRole("list", { name: "Avertissements" }).getByRole("button");
    await expect(item).toHaveText(/Sam 21h00 · Adultes débutants/);
    await expect(item).toContainText("⚠ Aucune disponibilité saisie pour Marc");
    await expect(item).toContainText("⚠ 3 / 2 élèves");

    const adultes = lesson(page, "Adultes débutants");
    await expect(adultes).not.toBeInViewport({ ratio: 1 });
    await item.click();
    await expect(adultes).toBeInViewport({ ratio: 1 });
    await expect(adultes).toHaveAttribute("data-selected", "true");
    await expect(
      panel(page, "Modifier le cours").getByLabel("Groupe", { exact: true }),
    ).toHaveValue(/.+/);
  });

  test("enregistre chaque modification en base immédiatement", async ({ page }) => {
    await openPlanning(page);
    const target = await slotPoint(page, SAT, C1, "09:00");
    await dragMouse(page, await grabPoint(lesson(page, "Galaxie vert")), {
      x: target.x,
      y: target.y + GRAB_OFFSET,
    });
    await expect(lesson(page, "Galaxie vert")).toContainText("9h00–10h00");

    // L'écran est démonté puis rechargé depuis la base.
    await page
      .getByRole("navigation", { name: "Navigation principale" })
      .getByRole("link", { name: "Référentiels" })
      .click();
    await goToPlanning(page);
    await expect(lesson(page, "Galaxie vert")).toContainText("9h00–10h00");
    await expect(page.getByRole("button", { name: "Annuler", exact: true })).toBeDisabled();
    expect(await readLessons(page)).toEqual([
      stored("Ados perfectionnement", { weekday: 3, startTime: "10:00" }),
      stored("Galaxie vert", { weekday: 6, startTime: "09:00", court: "Court 1" }),
    ]);
  });

  test("reste fluide pendant un glisser avec 150 cours", async ({ page }) => {
    const courts = Array.from({ length: 10 }, (_, i) => ({
      name: `Court ${i + 1}`,
      kind: "indoor" as const,
    }));
    const lessons: SeedLesson[] = Array.from({ length: 150 }, (_, i) => ({
      weekday: (i % 6) + 1,
      startTime: `${String(8 + (Math.floor(i / 60) % 14) * 1).padStart(2, "0")}:00`,
      durationMinutes: 60,
      court: `Court ${(Math.floor(i / 6) % 10) + 1}`,
      group: (demoClub.groups[i % 4] as { name: string }).name,
      instructor: (demoClub.instructors[i % 3] as { firstName: string }).firstName,
    }));
    await openPlanning(page, { ...demoClub, courts, lessons });
    await expect(page.getByTestId("lesson")).toHaveCount(150);

    const source = page.getByTestId("lesson").first();
    const from = await grabPoint(source);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x, from.y + 8, { steps: 2 });
    await expect(page.getByTestId("lesson-ghost")).toBeVisible();

    // Les 150 cours ne doivent pas être redessinés pendant le glisser : seul
    // le fantôme (calque d'aperçu) change.
    await page.evaluate(() => {
      const target = window as unknown as { lessonMutations: number };
      target.lessonMutations = 0;
      new MutationObserver((records) => {
        target.lessonMutations += records.filter((r) =>
          (r.target as Element).closest?.('[data-testid="lesson"]'),
        ).length;
      }).observe(document.querySelector('[data-testid="planning-board"]') as Element, {
        subtree: true,
        attributes: true,
        childList: true,
        characterData: true,
      });
    });

    const moves = 30;
    const durations: number[] = [];
    for (let i = 1; i <= moves; i++) {
      const started = Date.now();
      await page.mouse.move(from.x + i * 7, from.y + 8 + i * 5);
      // Attend l'image suivante : le retour visuel est affiché.
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
      durations.push(Date.now() - started);
    }
    await expect(page.getByTestId("lesson-ghost")).toBeVisible();
    const mutations = await page.evaluate(
      () => (window as unknown as { lessonMutations: number }).lessonMutations,
    );
    await page.keyboard.press("Escape");
    await page.mouse.up();

    const average = durations.reduce((a, b) => a + b, 0) / moves;
    test.info().annotations.push({
      type: "performance",
      description: `${average.toFixed(1)} ms par mouvement (max ${Math.max(...durations)} ms)`,
    });
    expect(mutations).toBe(0);
    // §11.5 : retour visuel perçu comme instantané (< 100 ms).
    expect(average).toBeLessThan(100);
  });
});
