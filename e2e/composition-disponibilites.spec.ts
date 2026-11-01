import { expect, type Page, test } from "@playwright/test";
import type { SeedPlanning } from "../src/test/e2e";
import { createSeason, fixToday, seedPlanning } from "./support/planning";
import { visit } from "./support/screens";

/**
 * Aide à la composition des groupes (lot L20, docs/SPECS.md §8) : parmi les
 * élèves à ajouter, les compatibles avec tous les cours du groupe passent en
 * tête ; les autres portent le badge « hors disponibilités », avec en bulle le
 * cours qui coince. L'ajout reste possible, et le membre incompatible est
 * signalé dans la zone de messages réservée de « Élèves du groupe ».
 *
 * « Mercredi » a un cours le mercredi de 14h00 à 15h00 ; « Réserve » et
 * « Sans cours » n'en ont pas. Les élèves s'appellent tous « Test » : la
 * recherche « test » les propose tous, par ordre alphabétique.
 */
const club: SeedPlanning = {
  courts: [{ name: "Court 1", kind: "indoor" }],
  instructors: [
    {
      firstName: "Julie",
      lastName: "Martin",
      initials: "JM",
      color: "#1D4ED8",
      availability: [[3, "13:00", "19:00"]],
    },
  ],
  groups: [
    { name: "Mercredi", maxSize: 8, students: ["Aaron"] },
    // Alice passe en premier dans l'ordre alphabétique, mais elle n'est libre que le samedi.
    { name: "Réserve", maxSize: 8, students: ["Alice", "Bruno", "Chloé"] },
    { name: "Sans cours", maxSize: 8, students: [] },
  ],
  lessons: [
    {
      weekday: 3,
      startTime: "14:00",
      durationMinutes: 60,
      court: "Court 1",
      group: "Mercredi",
      instructor: "Julie",
    },
  ],
  studentAvailability: {
    Alice: [[6, "09:00", "12:00"]],
    Bruno: [[3, "13:00", "18:00"]],
    // Chloé n'a aucune plage : disponible partout.
  },
};

async function openGroup(page: Page, name: string) {
  await fixToday(page);
  await createSeason(page);
  await seedPlanning(page, club);
  await visit(page, "/#/referentiels/groupes");
  await page.getByRole("link", { name, exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}

function search(page: Page) {
  return page.getByLabel("Ajouter un élève (nom, prénom, téléphone)", { exact: true });
}

test.describe("composition d'un groupe selon les disponibilités", () => {
  test("les candidats compatibles passent en tête ; l'incompatible porte le badge et sa bulle cite le cours", async ({
    page,
  }) => {
    await openGroup(page, "Mercredi");
    await search(page).fill("test");

    const options = page.getByRole("listbox", { name: "Élèves trouvés" }).getByRole("option");
    // Bruno (libre le mercredi après-midi) et Chloé (sans plage) avant Alice.
    await expect(options).toHaveText([/^Test Bruno/, /^Test Chloé/, /^Test Alice/]);
    await expect(options.nth(2)).toHaveAccessibleName(
      "Test Alice, hors disponibilités : mercredi 14:00–15:00",
    );
    const badges = page.getByTestId("unavailable-badge");
    await expect(badges).toHaveCount(1);
    await expect(options.nth(2).getByTestId("unavailable-badge")).toHaveText("hors disponibilités");

    await badges.hover();
    await expect(page.getByRole("tooltip")).toHaveText(
      "Hors disponibilités : mercredi 14:00–15:00",
    );

    // Au clavier, sans survol : le cours en cause se lit dans l'option active.
    await page.mouse.move(5, 5);
    await expect(page.getByRole("tooltip")).toBeHidden();
    await search(page).press("ArrowDown");
    await search(page).press("ArrowDown");
    await search(page).press("ArrowDown");
    await expect(options.nth(2)).toHaveAttribute("aria-selected", "true");
    await expect(search(page)).toHaveAttribute(
      "aria-activedescendant",
      (await options.nth(2).getAttribute("id")) ?? "",
    );
    await expect(options.nth(2).getByTestId("blocking-lessons")).toBeVisible();
    await expect(options.nth(2).getByTestId("blocking-lessons")).toHaveText(
      "Cours en cause : mercredi 14:00–15:00",
    );
  });

  test("l'élève incompatible peut être ajouté ; il est signalé sans que les boutons bougent", async ({
    page,
  }) => {
    await openGroup(page, "Mercredi");
    const members = page.getByRole("table", { name: "Élèves du groupe" });
    const alerts = page.getByRole("list", { name: "Alertes" });
    const importButton = page.getByRole("link", { name: "Importer ou coller une liste" });
    const removeAaron = page.getByRole("button", { name: "Retirer Test Aaron du groupe" });
    await expect(alerts).toBeEmpty();
    const before = [await importButton.boundingBox(), await removeAaron.boundingBox()];

    await search(page).fill("alice");
    await page.getByRole("option", { name: /^Test Alice/ }).click();
    await expect(members.getByRole("row", { name: /Test Alice/ })).toBeVisible();
    await expect(page.getByTestId("group-size")).toHaveText("2 / 8");
    await expect(alerts).toHaveText("1 élève hors disponibilités : Alice Test");

    const after = [await importButton.boundingBox(), await removeAaron.boundingBox()];
    expect(after.map((box) => box?.y)).toEqual(before.map((box) => box?.y));
    expect(before.every((box) => box !== null)).toBe(true);
  });

  test("l'élève incompatible s'ajoute aussi par Entrée", async ({ page }) => {
    await openGroup(page, "Mercredi");
    const members = page.getByRole("table", { name: "Élèves du groupe" });
    await search(page).fill("alice");
    await expect(
      page.getByRole("option", { name: /^Test Alice, hors disponibilités/ }),
    ).toBeVisible();
    await search(page).press("Enter");
    await expect(members.getByRole("row", { name: /Test Alice/ })).toBeVisible();
    await expect(page.getByTestId("group-size")).toHaveText("2 / 8");
    await expect(page.getByRole("list", { name: "Alertes" })).toHaveText(
      "1 élève hors disponibilités : Alice Test",
    );
    // Champ vidé, focus gardé pour l'élève suivant.
    await expect(search(page)).toHaveValue("");
    await expect(search(page)).toBeFocused();
  });

  test("sur un groupe sans cours, aucun candidat ne porte le badge", async ({ page }) => {
    await openGroup(page, "Sans cours");
    await search(page).fill("test");
    const options = page.getByRole("listbox", { name: "Élèves trouvés" }).getByRole("option");
    // Alice (libre seulement le samedi) est proposée comme les autres.
    await expect(options).toHaveText([/^Test Aaron/, /^Test Alice/, /^Test Bruno/, /^Test Chloé/]);
    await expect(page.getByTestId("unavailable-badge")).toHaveCount(0);
    await expect(options.nth(1)).toHaveAccessibleName("Test Alice");
  });
});
