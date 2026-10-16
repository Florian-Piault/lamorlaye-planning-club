import { expect, type Page, test } from "@playwright/test";
import {
  demoClub,
  dragMouse,
  GRAB_OFFSET,
  grabPoint,
  lesson,
  openPlanning,
  readPlanning,
  slotPoint,
} from "./support/planning";

/**
 * Semaines datées et exceptions (lot L4). Aujourd'hui : mercredi 04/11/2026,
 * semaine du 02/11. Club de démonstration : « Galaxie vert » le lundi à 10h00
 * (Court 1, Karim), « Ados perfectionnement » le mercredi à 10h00 (1 h 30,
 * Court 2, Julie).
 */

const MON = 0;
const TUE = 1;
const C1 = 0;
const C2 = 1;

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-04T10:00:00+01:00"));
});

function modeBar(page: Page) {
  return page.getByTestId("mode-bar");
}

async function openWeek(page: Page, spec = demoClub) {
  await openPlanning(page, spec);
  await page
    .getByRole("group", { name: "Mode d'affichage" })
    .getByRole("button", { name: "Une semaine précise" })
    .click();
  await expect(modeBar(page)).toContainText("Semaine du 2 novembre");
}

function panel(page: Page, name: string) {
  return page.getByRole("form", { name, exact: true });
}

test.describe("semaines datées", () => {
  test("passe de la semaine type à la semaine datée et navigue entre les semaines", async ({
    page,
  }) => {
    await openPlanning(page);
    await expect(modeBar(page)).toHaveAttribute("data-mode", "type");
    await expect(page.getByTestId("day-header").first()).toHaveText(/^LundiC1/);
    // ← / → sont sans effet en semaine type.
    await page.keyboard.press("ArrowRight");
    await expect(modeBar(page)).toHaveAttribute("data-mode", "type");

    const modes = page.getByRole("group", { name: "Mode d'affichage" });
    await modes.getByRole("button", { name: "Une semaine précise" }).click();
    await expect(modeBar(page)).toHaveAttribute("data-mode", "dated");
    await expect(modeBar(page)).toContainText("Semaine du 2 novembre");
    await expect(page.getByTestId("day-header").first()).toHaveText(/^Lundi 02\/11C1/);

    await page.keyboard.press("ArrowRight");
    await expect(modeBar(page)).toContainText("Semaine du 9 novembre");
    await expect(page.getByTestId("day-header").nth(2)).toHaveText(/^Mercredi 11\/11C1/);
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(modeBar(page)).toContainText("Semaine du 26 octobre");

    await page.getByRole("button", { name: "Semaine suivante" }).click();
    await page.getByRole("button", { name: "Semaine suivante" }).click();
    await expect(modeBar(page)).toContainText("Semaine du 9 novembre");
    await page.getByRole("button", { name: "Semaine précédente" }).click();
    await expect(modeBar(page)).toContainText("Semaine du 2 novembre");

    await page.getByLabel("Aller à la date").fill("2026-12-16");
    await expect(modeBar(page)).toContainText("Semaine du 14 décembre");
    await page.getByRole("button", { name: "Aujourd'hui" }).click();
    await expect(modeBar(page)).toContainText("Semaine du 2 novembre");

    // Début de saison : pas de semaine précédente.
    await page.getByLabel("Aller à la date").fill("2026-09-01");
    await expect(modeBar(page)).toContainText("Semaine du 31 août");
    await expect(page.getByRole("button", { name: "Semaine précédente" })).toBeDisabled();
    await page.getByLabel("Aller à la date").blur();
    await page.keyboard.press("ArrowLeft");
    await expect(modeBar(page)).toContainText("Semaine du 31 août");

    await modes.getByRole("button", { name: "Planning habituel" }).click();
    await expect(modeBar(page)).toHaveAttribute("data-mode", "type");
    await expect(page.getByTestId("day-header").first()).toHaveText(/^LundiC1/);
  });

  test("un cours déplacé en semaine datée ne modifie ni la semaine type ni les autres semaines", async ({
    page,
  }) => {
    await openWeek(page);
    const galaxie = lesson(page, "Galaxie vert");
    const target = await slotPoint(page, TUE, C2, "11:00");
    await dragMouse(page, await grabPoint(galaxie), { x: target.x, y: target.y + GRAB_OFFSET });
    await expect(galaxie).toContainText("11h00–12h00");
    await expect(galaxie).toHaveAttribute("data-modified", "true");
    await expect(page.getByTestId("toast")).toContainText(
      "Modification de la séance du 02/11/2026",
    );

    const stored = await readPlanning(page);
    expect(stored.lessons).toContainEqual(
      expect.objectContaining({ group: "Galaxie vert", weekday: 1, startTime: "10:00" }),
    );
    expect(stored.exceptions).toEqual([
      expect.objectContaining({
        kind: "modification",
        occurrenceDate: "2026-11-02",
        date: "2026-11-03",
        startTime: "11:00",
      }),
    ]);

    await page.keyboard.press("ArrowRight");
    await expect(modeBar(page)).toContainText("Semaine du 9 novembre");
    await expect(galaxie).toContainText("10h00–11h00");
    await expect(galaxie).not.toHaveAttribute("data-modified");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(galaxie).toContainText("10h00–11h00");

    await page.getByRole("button", { name: "Planning habituel" }).click();
    await expect(galaxie).toContainText("10h00–11h00");

    // Annuler (Ctrl/Cmd+Z) supprime l'exception.
    await page.getByRole("button", { name: "Une semaine précise" }).click();
    await page.getByRole("button", { name: "Aujourd'hui" }).click();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(galaxie).toContainText("10h00–11h00");
    await expect.poll(async () => (await readPlanning(page)).exceptions).toEqual([]);
  });

  test("« Appliquer à partir de cette semaine » : semaines précédentes inchangées, suivantes modifiées", async ({
    page,
  }) => {
    await openWeek(page);
    const ados = lesson(page, "Ados perfectionnement");
    await ados.click();
    const form = panel(page, "Modifier pour cette semaine");
    await expect(form.getByLabel("Jour").locator("option:checked")).toHaveText("Mercredi 04/11");
    await form.getByLabel("Début").selectOption(String(14 * 60));
    await form.getByRole("button", { name: "Appliquer à partir de cette semaine" }).click();
    await expect(page.getByTestId("toast")).toContainText(
      "Modification à partir de la semaine du 02/11/2026",
    );
    await expect(ados).toContainText("14h00–15h30");

    await expect
      .poll(async () =>
        (await readPlanning(page)).lessons.filter((l) => l.group !== "Galaxie vert"),
      )
      .toEqual([
        expect.objectContaining({
          startTime: "10:00",
          effectiveFrom: "2026-09-01",
          effectiveTo: "2026-11-01",
        }),
        expect.objectContaining({
          startTime: "14:00",
          effectiveFrom: "2026-11-02",
          effectiveTo: null,
        }),
      ]);

    await page.keyboard.press("ArrowLeft");
    await expect(modeBar(page)).toContainText("Semaine du 26 octobre");
    await expect(ados).toContainText("10h00–11h30");
    await page.getByLabel("Aller à la date").fill("2027-03-17");
    await expect(ados).toContainText("14h00–15h30");
    // Semaine type : versions en vigueur aujourd'hui.
    await page.getByRole("button", { name: "Planning habituel" }).click();
    await expect(ados).toHaveCount(1);
    await expect(ados).toContainText("14h00–15h30");
  });

  test("annule une séance avec motif, désigne un remplaçant puis rétablit l'occurrence d'origine", async ({
    page,
  }) => {
    await openWeek(page);
    const galaxie = lesson(page, "Galaxie vert");
    const legend = page.getByRole("group", { name: "Légende des moniteurs" });
    await galaxie.click();

    // Motif « Autre » sans précision : refusé.
    const cancel = page.getByRole("form", { name: "Annuler cette séance" });
    await cancel.getByLabel("Motif").selectOption({ label: "Autre" });
    await cancel.getByRole("button", { name: "Annuler la séance" }).click();
    await expect(cancel.getByRole("alert")).toHaveText("Précisez le motif de l'annulation.");
    await cancel.getByLabel("Motif").selectOption({ label: "Pluie" });
    await cancel.getByRole("button", { name: "Annuler la séance" }).click();

    await expect(galaxie).toHaveAttribute("data-cancelled", "true");
    await expect(galaxie).toHaveCSS("text-decoration-line", "line-through");
    await expect(galaxie).toHaveAttribute("title", /Annulé cette semaine : Pluie/);
    await expect(
      legend.getByRole("button", { name: "Karim Benali, 0h cette semaine" }),
    ).toBeVisible();
    await expect
      .poll(async () => (await readPlanning(page)).exceptions)
      .toEqual([expect.objectContaining({ kind: "cancellation", cancellationReason: "rain" })]);
    await expect(page.getByRole("list", { name: "État de la séance" })).toContainText(
      "Annulé cette semaine : Pluie",
    );
    await page.getByRole("button", { name: "Revenir au cours habituel" }).click();
    await expect(galaxie).not.toHaveAttribute("data-cancelled");

    // Remplaçant : Julie (indisponible le lundi matin, signalé).
    await galaxie.click();
    const replace = page.getByRole("form", { name: "Désigner un remplaçant" });
    await replace.getByLabel("Remplaçant").selectOption({ label: "○ Julie Martin (indisponible)" });
    await replace.getByRole("button", { name: "Désigner le remplaçant" }).click();
    await expect(galaxie).toHaveAttribute("data-replaced", "true");
    await expect(galaxie).toContainText("JM · 3/8");
    await expect(galaxie).toHaveCSS("background-color", "rgb(29, 78, 216)");
    await expect(galaxie.getByTestId("lesson-marker")).toHaveText("⇄");
    await expect(galaxie).toHaveAttribute(
      "title",
      /Remplacement : Julie Martin au lieu de Karim Benali/,
    );
    await expect(galaxie).toHaveAttribute("data-warning", "true");
    await expect(galaxie).toHaveAttribute("title", /⚠ Hors disponibilités de Julie/);
    await expect(
      legend.getByRole("button", { name: "Julie Martin, 2h30 cette semaine" }),
    ).toBeVisible();
    // La semaine type n'a pas changé.
    expect((await readPlanning(page)).lessons).toContainEqual(
      expect.objectContaining({ group: "Galaxie vert", instructor: "Karim" }),
    );

    await galaxie.click();
    await page.getByRole("button", { name: "Revenir au cours habituel" }).click();
    await expect(galaxie).not.toHaveAttribute("data-replaced");
    await expect(galaxie).toContainText("KB · 3/8");
    await expect.poll(async () => (await readPlanning(page)).exceptions).toEqual([]);
  });

  test("confie une séance à un remplaçant en déposant sa pastille", async ({ page }) => {
    await openWeek(page);
    const legend = page.getByRole("group", { name: "Légende des moniteurs" });
    const pill = await legend.getByRole("button", { name: /^Julie Martin/ }).boundingBox();
    const block = await lesson(page, "Galaxie vert").boundingBox();
    if (!pill || !block) throw new Error("éléments introuvables");
    await dragMouse(
      page,
      { x: pill.x + pill.width / 2, y: pill.y + pill.height / 2 },
      { x: block.x + block.width / 2, y: block.y + block.height / 2 },
    );
    await expect(lesson(page, "Galaxie vert")).toHaveAttribute("data-replaced", "true");
    await expect
      .poll(async () => (await readPlanning(page)).exceptions)
      .toEqual([expect.objectContaining({ kind: "replacement", instructor: "Julie" })]);
  });

  test("crée un stage (cours ponctuel) pendant une fermeture et le duplique sur les jours suivants", async ({
    page,
  }) => {
    await openWeek(page, {
      ...demoClub,
      closures: [
        { label: "Vacances de la Toussaint", startDate: "2026-10-17", endDate: "2026-11-01" },
      ],
    });
    await page.keyboard.press("ArrowLeft");
    await expect(modeBar(page)).toContainText("Semaine du 26 octobre");
    const bands = page.getByTestId("closure-band");
    await expect(bands).toHaveCount(6);
    await expect(bands.first()).toHaveText("Fermé — Vacances de la Toussaint");
    await expect(page.getByTestId("lesson")).toHaveCount(0);

    const from = await slotPoint(page, MON, C1, "09:00");
    const to = await slotPoint(page, MON, C1, "12:00");
    await dragMouse(page, { x: from.x, y: from.y + 2 }, { x: to.x, y: to.y - 2 });
    const form = panel(page, "Nouveau cours ponctuel");
    await expect(form.getByLabel("Jour").locator("option:checked")).toHaveText("Lundi 26/10");
    await form.getByLabel("Groupe (facultatif)").selectOption({ label: "Mini-tennis (1/6)" });
    await form.getByLabel("Moniteur", { exact: true }).selectOption({ label: "● Karim Benali" });
    await form.getByRole("button", { name: "Créer le cours ponctuel" }).click();

    const stage = lesson(page, "Mini-tennis");
    await expect(stage).toHaveCount(1);
    await expect(stage).toHaveAttribute("data-one-off", "true");
    await expect(stage).toContainText("9h00–12h00");

    await stage.click();
    const duplicate = page.getByRole("form", { name: "Dupliquer sur les jours suivants" });
    await duplicate.getByLabel("Nombre de jours").fill("4");
    await duplicate.getByRole("button", { name: "Dupliquer" }).click();
    await expect(stage).toHaveCount(5);
    await expect(page.getByTestId("toast")).toContainText("Duplication sur les 4 jours suivants");
    await expect
      .poll(async () => (await readPlanning(page)).exceptions.map((e) => [e.kind, e.date]))
      .toEqual([
        ["one_off", "2026-10-26"],
        ["one_off", "2026-10-27"],
        ["one_off", "2026-10-28"],
        ["one_off", "2026-10-29"],
        ["one_off", "2026-10-30"],
      ]);
    // Semaine type inchangée.
    await page.getByRole("button", { name: "Planning habituel" }).click();
    await expect(page.getByTestId("lesson")).toHaveCount(2);
  });

  test("prend en compte les indisponibilités datées dans les hachures et les avertissements", async ({
    page,
  }) => {
    await openPlanning(page, {
      ...demoClub,
      unavailabilities: [
        {
          instructor: "Karim",
          startsAt: "2026-11-02T00:00",
          endsAt: "2026-11-03T00:00",
          reason: "Tournoi",
        },
      ],
    });
    const galaxie = lesson(page, "Galaxie vert");
    const hatches = page.getByTestId("hatch");
    // Semaine type : seules les plages récurrentes comptent.
    await expect(galaxie).not.toHaveAttribute("data-warning");
    await galaxie.hover();
    await expect(hatches).toHaveCount(10);
    await page.mouse.move(5, 5);

    await page.getByRole("button", { name: "Une semaine précise" }).click();
    await expect(galaxie).toHaveAttribute("data-warning", "true");
    await expect(page.getByRole("list", { name: "Avertissements" })).toContainText(
      "Lun 02/11 10h00 · Galaxie vert",
    );
    await expect(page.getByRole("list", { name: "Avertissements" })).toContainText(
      "Hors disponibilités de Karim",
    );
    // Le lundi entier est hachuré (une seule bande au lieu de trois).
    await galaxie.hover();
    await expect(hatches).toHaveCount(8);
    await page.mouse.move(5, 5);

    await page.keyboard.press("ArrowRight");
    await expect(galaxie).not.toHaveAttribute("data-warning");
  });
});

test.describe("périodes de fermeture", () => {
  test("l'assistant propose les vacances de la zone B 2026-2027 et les jours fériés", async ({
    page,
  }) => {
    await openPlanning(page);
    await page
      .getByRole("navigation", { name: "Navigation principale" })
      .getByRole("link", { name: "Le club" })
      .click();
    await page
      .getByRole("navigation", { name: "Fiches du club" })
      .getByRole("link", { name: "Fermetures" })
      .click();
    await page.getByRole("button", { name: "Vacances et jours fériés…" }).click();
    const dialog = page.getByRole("dialog", { name: "Vacances scolaires et jours fériés" });
    await expect(dialog).toContainText("Zone B");

    const checkbox = (name: string) => dialog.getByRole("checkbox", { name, exact: true });
    for (const name of [
      "Vacances de la Toussaint du 17/10/2026 au 01/11/2026",
      "Vacances de Noël du 19/12/2026 au 03/01/2027",
      "Vacances d'hiver du 20/02/2027 au 07/03/2027",
      "Vacances de printemps du 17/04/2027 au 02/05/2027",
      "Pont de l'Ascension du 06/05/2027 au 09/05/2027",
      "Armistice 1918 (férié) le 11/11/2026",
      "Lundi de Pâques (férié) le 29/03/2027",
      "Lundi de Pentecôte (férié) le 17/05/2027",
    ]) {
      await expect(checkbox(name)).toBeChecked();
    }
    // Jours fériés compris dans une période cochée : proposés mais décochés.
    for (const name of [
      "Toussaint (férié) le 01/11/2026",
      "Noël (férié) le 25/12/2026",
      "Ascension (férié) le 06/05/2027",
    ]) {
      await expect(checkbox(name)).not.toBeChecked();
    }
    const ascension = dialog
      .getByTestId("closure-proposal")
      .filter({ hasText: "Ascension (férié)" });
    await expect(ascension).toContainText("compris dans Pont de l'Ascension");
    // Le calcul suit la sélection : décocher le pont recoche l'Ascension (B9).
    const pont = checkbox("Pont de l'Ascension du 06/05/2027 au 09/05/2027");
    await pont.uncheck();
    await expect(checkbox("Ascension (férié) le 06/05/2027")).toBeChecked();
    await expect(ascension).not.toContainText("compris dans");
    await pont.check();
    await expect(checkbox("Ascension (férié) le 06/05/2027")).not.toBeChecked();
    await expect(ascension).toContainText("compris dans Pont de l'Ascension");
    // Début des vacances d'été : après la fin de la saison.
    await expect(checkbox("Vacances d'été du 03/07/2027 au 01/09/2027")).toBeDisabled();
    await expect(
      dialog.getByTestId("closure-proposal").filter({ hasText: "Vacances d'été" }),
    ).toContainText("hors saison");

    // Les dates restent modifiables avant l'ajout.
    await dialog.getByLabel("Fin — Pont de l'Ascension").fill("2027-05-08");
    await dialog.getByRole("button", { name: "Ajouter 8 fermetures" }).click();
    await expect(dialog).toBeHidden();

    const list = page.getByRole("list", { name: "Périodes de fermeture" });
    await expect(list.getByRole("listitem")).toHaveCount(8);
    await expect(list).toContainText("Vacances d'hiver du 20/02/2027 au 07/03/2027");
    await expect(list).toContainText("Pont de l'Ascension du 06/05/2027 au 08/05/2027");
    expect((await readPlanning(page)).closures).toContainEqual({
      label: "Vacances de printemps",
      startDate: "2027-04-17",
      endDate: "2027-05-02",
    });

    // Rouvert, l'assistant signale ce qui est déjà saisi.
    await page.getByRole("button", { name: "Vacances et jours fériés…" }).click();
    await expect(checkbox("Vacances de Noël du 19/12/2026 au 03/01/2027")).not.toBeChecked();
    await expect(
      dialog.getByTestId("closure-proposal").filter({ hasText: "Vacances de Noël" }),
    ).toContainText("déjà saisie");
    await dialog.getByRole("button", { name: "Annuler" }).click();

    // Saisie manuelle, modification et suppression.
    await page.getByRole("button", { name: "Nouvelle fermeture" }).click();
    const form = page.getByRole("form", { name: "Période de fermeture" });
    await form.getByLabel("Libellé").fill("Tournoi du club");
    await form.getByLabel("Du").fill("2027-06-12");
    await form.getByRole("button", { name: "Enregistrer" }).click();
    await expect(list).toContainText("Tournoi du club le 12/06/2027");
    await page.getByRole("button", { name: "Modifier Tournoi du club" }).click();
    await form.getByLabel("Au").fill("2027-06-13");
    await form.getByRole("button", { name: "Enregistrer" }).click();
    await expect(list).toContainText("Tournoi du club du 12/06/2027 au 13/06/2027");
    await page.getByRole("button", { name: "Supprimer Tournoi du club" }).click();
    const confirm = page.getByRole("dialog", { name: "Supprimer Tournoi du club ?" });
    await expect(confirm).toContainText("Supprimer la fermeture « Tournoi du club » ?");
    await confirm.getByRole("button", { name: "Supprimer", exact: true }).click();
    await expect(list.getByRole("listitem")).toHaveCount(8);

    // Le planning affiche les bandes « Fermé ».
    await page
      .getByRole("navigation", { name: "Navigation principale" })
      .getByRole("link", { name: "Planning" })
      .click();
    await page.getByRole("button", { name: "Une semaine précise" }).click();
    await page.getByLabel("Aller à la date").fill("2027-02-24");
    await expect(page.getByTestId("closure-band")).toHaveCount(6);
    await expect(page.getByTestId("closure-band").first()).toHaveText("Fermé — Vacances d'hiver");
    await expect(page.getByTestId("lesson")).toHaveCount(0);
  });
});
