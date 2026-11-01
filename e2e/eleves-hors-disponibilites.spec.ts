import { expect, type Page, test } from "@playwright/test";
import {
  demoClub,
  fixToday,
  hoverLesson,
  lesson,
  openPlanning,
  showDatedWeek,
} from "./support/planning";

/**
 * Disponibilités des élèves sur la grille (lot L17, docs/SPECS.md §7, contrôle 7) :
 * un cours dont des élèves du groupe sont hors de leurs plages porte un seul
 * avertissement, « N élèves hors disponibilités », avec leurs noms dans la
 * fiche au survol et dans le panneau « Avertissements ». Un élève sans plage
 * est disponible partout. Club de démonstration : « Galaxie vert » (Léa, Tom,
 * Zoé) le lundi à 10h00, « Ados perfectionnement » (Hugo, Lina) le mercredi à
 * 10h00 ; les élèves s'appellent tous « Test ».
 */

function warnings(page: Page) {
  return page.getByRole("list", { name: "Avertissements" });
}

test.describe("élèves hors disponibilités", () => {
  test("le cours signale en un seul avertissement les élèves disponibles le samedi seulement", async ({
    page,
  }) => {
    await openPlanning(page, {
      ...demoClub,
      studentAvailability: {
        Léa: [[6, "09:00", "12:00"]],
        Tom: [[6, "09:00", "12:00"]],
        // Hugo est disponible pendant le cours des Ados : rien à signaler.
        Hugo: [[3, "09:00", "12:00"]],
      },
    });
    const galaxie = lesson(page, "Galaxie vert");
    await expect(galaxie).toHaveAttribute("data-warning", "true");
    await expect(galaxie).toHaveAccessibleDescription(
      /Avertissement : 2 élèves hors disponibilités : Léa Test, Tom Test$/,
    );
    await expect(lesson(page, "Ados perfectionnement")).not.toHaveAttribute("data-warning");

    // Panneau « Avertissements » : une seule entrée, un seul message, avec les noms.
    await expect(page.getByRole("heading", { name: "Avertissements (1)" })).toBeVisible();
    const item = warnings(page).getByRole("button");
    await expect(item).toHaveCount(1);
    await expect(item).toHaveText(
      "Lun 10h00 · Galaxie vert⚠ 2 élèves hors disponibilités : Léa Test, Tom Test",
    );

    // Fiche au survol : les deux élèves sont nommés, Zoé (sans plage) ne l'est pas.
    const card = await hoverLesson(page, galaxie);
    await expect(card.locator("p.text-destructive")).toHaveText([
      "⚠ 2 élèves hors disponibilités : Léa Test, Tom Test",
    ]);
    await expect(card).not.toContainText("Zoé");

    // Navigation existante : le panneau mène au cours.
    await page.mouse.move(5, 5);
    await item.click();
    await expect(galaxie).toHaveAttribute("data-selected", "true");
  });

  test("en semaine précise, la séance modifiée et le cours ponctuel sont contrôlés, la séance annulée non", async ({
    page,
  }) => {
    // Mercredi 04/11/2026 : la semaine affichée est celle du 2 novembre, hors vacances.
    await fixToday(page);
    await openPlanning(page, {
      ...demoClub,
      studentAvailability: {
        // Galaxie vert (lundi 10h00) : couvert pour Léa et Tom…
        Léa: [[1, "09:00", "12:00"]],
        Tom: [[1, "09:00", "12:00"]],
        // …Ados perfectionnement (mercredi 10h00) : Lina n'y est pas disponible.
        Hugo: [[3, "09:00", "12:00"]],
        Lina: [[6, "09:00", "12:00"]],
      },
      exceptions: [
        // La séance du lundi passe au mardi : Léa et Tom n'y sont plus disponibles.
        {
          kind: "modification",
          group: "Galaxie vert",
          occurrenceDate: "2026-11-02",
          date: "2026-11-03",
          startTime: "10:00",
        },
        // Séance du mercredi annulée : Lina n'y est pas, mais rien ne doit le dire.
        { kind: "cancellation", group: "Ados perfectionnement", occurrenceDate: "2026-11-04" },
      ],
      // Rattrapage le samedi : Lina est disponible, Hugo non.
      oneOffs: [
        {
          group: "Ados perfectionnement",
          date: "2026-11-07",
          startTime: "10:00",
          durationMinutes: 60,
          court: "Court 1",
          instructor: "Julie",
        },
      ],
    });

    // Planning habituel : seul le cours du mercredi gêne Lina.
    await expect(page.getByRole("heading", { name: "Avertissements (1)" })).toBeVisible();
    await expect(warnings(page).getByRole("button")).toHaveText([
      /Ados perfectionnement⚠ 1 élève hors disponibilités : Lina Test$/,
    ]);

    await showDatedWeek(page);
    await expect(page.getByTestId("mode-bar")).toContainText("Semaine du 2 novembre");
    const galaxie = lesson(page, "Galaxie vert");
    await expect(galaxie).toHaveAttribute("data-modified", "true");
    await expect(galaxie).toHaveAttribute("data-warning", "true");
    await expect(galaxie).toHaveAccessibleDescription(
      /Avertissement : 2 élèves hors disponibilités : Léa Test, Tom Test$/,
    );

    // Panneau : la séance modifiée et le cours ponctuel, pas la séance annulée.
    await expect(page.getByRole("heading", { name: "Avertissements (2)" })).toBeVisible();
    const items = warnings(page).getByRole("button");
    await expect(items).toHaveText([
      /Galaxie vert⚠ 2 élèves hors disponibilités : Léa Test, Tom Test$/,
      /Ados perfectionnement⚠ 1 élève hors disponibilités : Hugo Test$/,
    ]);
    await expect(page.getByText(/Lina Test/)).toHaveCount(0);

    // Fiche au survol du cours ponctuel.
    const ados = lesson(page, "Ados perfectionnement").and(page.locator("[data-warning]"));
    await expect(ados).toHaveCount(1);
    const card = await hoverLesson(page, ados);
    await expect(card.locator("p.text-destructive")).toHaveText([
      "⚠ 1 élève hors disponibilités : Hugo Test",
    ]);

    // Le panneau mène à la séance modifiée, dont le panneau du cours répète l'avertissement.
    await page.mouse.move(5, 5);
    await items.first().click();
    await expect(galaxie).toHaveAttribute("data-selected", "true");
    await expect(page.getByRole("form", { name: "Modifier pour cette semaine" })).toContainText(
      "2 élèves hors disponibilités : Léa Test, Tom Test",
    );
  });

  test("sans aucune plage saisie, le club de démonstration n'a aucun avertissement d'élève", async ({
    page,
  }) => {
    await openPlanning(page);
    await expect(lesson(page, "Galaxie vert")).toBeVisible();
    await expect(lesson(page, "Ados perfectionnement")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Avertissements (0)" })).toBeVisible();
    await expect(page.getByTestId("lesson").and(page.locator("[data-warning]"))).toHaveCount(0);
    await expect(page.getByText(/hors disponibilités/)).toHaveCount(0);
  });
});
