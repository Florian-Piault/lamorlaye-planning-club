import { expect, type Page, test } from "@playwright/test";
import type { SeedLesson } from "../src/test/e2e";
import {
  focusByKeyboard,
  type IconButton,
  iconButtonsByKeyboard,
  visibleText,
} from "./support/a11y";
import { createSeason, demoClub, lesson, openPlanning, seedPlanning } from "./support/planning";
import { SCREENS, visit } from "./support/screens";

/**
 * Vocabulaire et bulles d'aide (lot L10) : l'application parle la langue du
 * club (« Planning habituel », « Une semaine précise », « Le club », « En
 * cours / Terminée »…), sans jargon technique hors des sections repliées
 * « Détails techniques » ; chaque bouton icône a un nom accessible et une
 * bulle d'aide atteignable au clavier.
 */

/** Club de démonstration, avec une fermeture et une indisponibilité (crayons et corbeilles). */
const club = {
  ...demoClub,
  closures: [{ label: "Vacances de la Toussaint", startDate: "2026-10-17", endDate: "2026-11-01" }],
  unavailabilities: [
    {
      instructor: "Julie",
      startsAt: "2026-11-09T00:00",
      endsAt: "2026-11-10T00:00",
      reason: "Tournoi",
    },
  ],
};

/** Termes retirés de l'interface (spec UX v1.1, Vocabulaire). */
const RETIRED: RegExp[] = [
  /saisons? actives?/i,
  /semaines? types?/i,
  /semaines? datées?/i,
  /exception/i,
  /occurrence/i,
  /hors vigueur/i,
  /version\(s\)/i,
  /référentiel/i,
  /archivée/i,
  /consultée/i,
  /lecture seule/i,
  /consultation seule\b/i,
  /\bplages?\b/i,
  /composition/i,
  /effectif/i,
  /amplitude/i,
  /de la grille/i,
  /bornes incluses/i,
  /dates d'effet/i,
  /correspondance/i,
  /hachur/i,
];

/** Détails techniques : seulement dans les sections repliées (et sur « À propos »). */
const TECHNICAL: RegExp[] = [
  /sqlite/i,
  /migrations?/i,
  /FileVault|BitLocker|LUKS/,
  /AES-256/,
  /UTF-8|Windows-1252/,
  /\bCSV\b/,
];

/** Termes interdits présents dans le texte visible, avec leur contexte. */
async function forbiddenTerms(page: Page, technical = true): Promise<string[]> {
  const text = await visibleText(page);
  return [...RETIRED, ...(technical ? TECHNICAL : [])].flatMap((pattern) => {
    const match = pattern.exec(text);
    if (!match) return [];
    return [`${pattern} : « …${text.slice(Math.max(0, match.index - 40), match.index + 40)}… »`];
  });
}

const modes = (page: Page) => page.getByRole("group", { name: "Mode d'affichage" });

test.describe("vocabulaire", () => {
  test("aucun terme retiré n'apparaît sur les écrans principaux", async ({ page }) => {
    test.setTimeout(90_000);
    await openPlanning(page, club);
    for (const screen of SCREENS) {
      await visit(page, screen.path);
      await screen.ready(page);
      expect(await forbiddenTerms(page, screen.path !== "/#/a-propos"), screen.path).toEqual([]);
    }

    // Planning : une semaine précise, avec le panneau d'une séance ouvert.
    await visit(page, "/#/planning");
    await modes(page).getByRole("button", { name: "Une semaine précise" }).click();
    await expect(page.getByTestId("mode-bar")).toHaveAttribute("data-mode", "dated");
    await lesson(page, "Galaxie vert").first().click();
    await expect(page.getByRole("form", { name: "Modifier pour cette semaine" })).toBeVisible();
    expect(await forbiddenTerms(page), "semaine précise").toEqual([]);

    // Fenêtre « Nouvelle saison » (texte de la duplication).
    await visit(page, "/#/referentiels/saison");
    await page.getByRole("button", { name: "Nouvelle saison" }).click();
    await expect(page.getByRole("dialog", { name: "Nouvelle saison" })).toBeVisible();
    expect(await forbiddenTerms(page), "nouvelle saison").toEqual([]);
    await page.keyboard.press("Escape");

    // Fiches d'un moniteur et d'un groupe.
    await visit(page, "/#/referentiels/moniteurs");
    await page.getByRole("link", { name: /Julie/ }).first().click();
    await expect(page.getByText("Disponible chaque semaine")).toBeVisible();
    expect(await forbiddenTerms(page), "fiche moniteur").toEqual([]);
    await visit(page, "/#/referentiels/groupes");
    await page.getByRole("link", { name: "Galaxie vert" }).click();
    await expect(page.getByText("Élèves du groupe").first()).toBeVisible();
    expect(await forbiddenTerms(page), "fiche groupe").toEqual([]);

    // Panneau « Nouveau cours » (moniteurs disponibles, occupés, indisponibles).
    await visit(page, "/#/planning");
    await modes(page).getByRole("button", { name: "Planning habituel" }).click();
    await page.getByRole("button", { name: "Nouveau cours" }).click();
    await expect(page.getByRole("form", { name: "Nouveau cours" })).toBeVisible();
    expect(await forbiddenTerms(page), "nouveau cours").toEqual([]);
    await page.getByRole("button", { name: "Fermer le panneau" }).click();

    // Formulaires avec avertissements : doublon d'élève, initiales déjà prises.
    await visit(page, "/#/referentiels/eleves");
    await page.getByRole("button", { name: "Nouvel élève" }).click();
    const student = page.getByRole("dialog", { name: "Nouvel élève" });
    await student.getByLabel("Nom", { exact: true }).fill("Test");
    await student.getByLabel("Prénom").fill("Léa");
    await expect(student.getByRole("list", { name: "Messages" })).toContainText("existe déjà");
    expect(await forbiddenTerms(page), "doublon d'élève").toEqual([]);
    await student.getByRole("button", { name: "Annuler" }).click();
    await page.getByRole("button", { name: "Abandonner" }).click();

    // Saisie en série (L13) : fiche suivante après « Enregistrer et ajouter un autre ».
    await page.getByRole("button", { name: "Nouvel élève" }).click();
    await student.getByLabel("Prénom").fill("Jules");
    await student.getByLabel("Nom", { exact: true }).fill("Petit");
    await student.getByLabel("Téléphone du responsable").fill("0611223344");
    await student.getByLabel("Galaxie vert").check();
    await student.getByRole("button", { name: "Enregistrer et ajouter un autre" }).click();
    await expect(page.getByTestId("toast")).toContainText("Jules Petit ajouté(e)");
    expect(await forbiddenTerms(page), "ajouter un autre élève").toEqual([]);
    await student.getByRole("button", { name: "Annuler" }).click();

    // Collage depuis Excel (L13), sans en-têtes : zone de collage puis choix des colonnes.
    await visit(page, "/#/import-export?import");
    await page.getByRole("button", { name: "Coller depuis Excel" }).click();
    await expect(page.getByLabel("Tableau à coller")).toBeVisible();
    expect(await forbiddenTerms(page), "zone de collage").toEqual([]);
    await page.getByLabel("Tableau à coller").fill("Martin\tLéo\t0611223344\n");
    await page.getByRole("button", { name: "Lire le tableau" }).click();
    await expect(page.getByLabel("La première ligne contient des élèves")).toBeChecked();
    expect(await forbiddenTerms(page), "collage sans en-têtes").toEqual([]);
    await visit(page, "/#/referentiels/moniteurs");
    await page.getByRole("button", { name: "Nouveau moniteur" }).click();
    const instructor = page.getByRole("dialog", { name: "Nouveau moniteur" });
    await instructor.getByLabel("Prénom").fill("Jean");
    await instructor.getByLabel("Nom", { exact: true }).fill("Morel");
    await instructor.getByLabel("Initiales").fill("jm");
    await expect(instructor.getByRole("list", { name: "Messages" })).toContainText("déjà utilisé");
    expect(await forbiddenTerms(page), "initiales prises").toEqual([]);
  });

  test("la barre de mode dit toujours la portée des changements", async ({ page }) => {
    await openPlanning(page, club);
    const bar = page.getByTestId("mode-bar");
    await expect(modes(page).getByRole("button", { name: "Planning habituel" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(bar).toContainText("Planning habituel");
    await expect(page.getByTestId("mode-scope")).toHaveText(
      "Vos changements valent pour toutes les semaines de la saison",
    );

    await modes(page).getByRole("button", { name: "Une semaine précise" }).click();
    await expect(bar).toContainText(/Semaine du \d+(er)? [a-zéû]+/);
    await expect(page.getByTestId("mode-scope")).toHaveText(
      "Vos changements ne concernent que cette semaine",
    );
    // Au survol d'un cours, la phrase reste en place.
    const scope = await page.getByTestId("mode-scope").boundingBox();
    await lesson(page, "Galaxie vert").first().hover();
    expect(await page.getByTestId("mode-scope").boundingBox()).toEqual(scope);
  });

  test("les réglages et les exports parlent simplement, détails techniques repliés", async ({
    page,
  }) => {
    await openPlanning(page, club);
    await visit(page, "/#/reglages");
    await expect(page.getByTestId("storage-kind")).toBeVisible();
    const details = page.getByTestId("technical-details");
    await expect(details.first()).not.toHaveAttribute("open");
    await expect(page.getByText(/Migrations appliquées/)).toBeHidden();
    await details.first().getByText("Détails techniques").click();
    await expect(page.getByText(/Migrations appliquées/)).toBeVisible();

    await visit(page, "/#/import-export");
    await expect(page.getByRole("button", { name: "Exporter vers Excel : cours" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Exporter cours en CSV" })).toBeHidden();
    await expect(page.getByText("À partir d'un fichier Excel ou d'un export")).toBeVisible();
  });
});

/** Vérifie les boutons icône relevés : nom, bulle commune, aucune bulle native. */
function expectHelpful(buttons: IconButton[], where: string) {
  for (const button of buttons) {
    expect(button.name, `${where} : nom accessible`).not.toBe("");
    expect(button.tooltip, `${where} : bulle de « ${button.name} »`).toBeTruthy();
    expect(button.title, `${where} : title natif de « ${button.name} »`).toBeNull();
  }
}

/** Écrans à boutons icône, avec quelques boutons attendus (le relevé n'est pas vide). */
const ICON_SCREENS: { path: string; open?: (page: Page) => Promise<void>; expected: string[] }[] = [
  {
    path: "/#/referentiels/courts",
    expected: ["Déplacer Court 1", "Modifier Court 1", "Supprimer Court 1"],
  },
  { path: "/#/referentiels/niveaux", expected: ["Modifier Galaxie blanc"] },
  { path: "/#/referentiels/eleves", expected: ["Modifier Test Anne", "Supprimer Test Anne"] },
  {
    path: "/#/referentiels/fermetures",
    expected: ["Modifier Vacances de la Toussaint", "Supprimer Vacances de la Toussaint"],
  },
  {
    path: "/#/referentiels/moniteurs",
    open: async (page) => {
      await page.getByRole("link", { name: /Julie/ }).first().click();
      await expect(page.getByText("Disponible chaque semaine")).toBeVisible();
    },
    expected: ["Retirer lundi", "Modifier l'indisponibilité", "Supprimer l'indisponibilité"],
  },
  {
    path: "/#/planning",
    open: async (page) => {
      await modes(page).getByRole("button", { name: "Une semaine précise" }).click();
      await lesson(page, "Galaxie vert").first().click();
      await expect(page.getByRole("form", { name: "Modifier pour cette semaine" })).toBeVisible();
    },
    expected: ["Semaine précédente", "Semaine suivante", "Fermer le panneau"],
  },
  {
    path: "/#/planning",
    open: async (page) => {
      await modes(page).getByRole("button", { name: "Planning habituel" }).click();
      await lesson(page, "Galaxie vert").first().click();
      await expect(page.getByRole("form", { name: "Modifier le cours" })).toBeVisible();
    },
    expected: ["Fermer le panneau", "Nouveau groupe"],
  },
];

test.describe("bulles d'aide des boutons icône", () => {
  test("chaque bouton icône a un nom accessible et une bulle atteignable au clavier", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await openPlanning(page, club);
    for (const screen of ICON_SCREENS) {
      await visit(page, screen.path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await screen.open?.(page);
      // Écran prêt : le premier bouton attendu est affiché.
      await expect(
        page.getByRole("button", { name: new RegExp(`^${screen.expected[0]}`) }).first(),
      ).toBeVisible();
      await page.locator("body").click({ position: { x: 1, y: 1 } });
      const buttons = await iconButtonsByKeyboard(page, 250);
      expectHelpful(buttons, screen.path);
      const names = buttons.map((b) => b.name);
      for (const expected of screen.expected) {
        expect(
          names.some((n) => n.startsWith(expected)),
          `${screen.path} : « ${expected} » dans ${names.join(", ")}`,
        ).toBe(true);
      }
    }
  });

  test("le bouton de fermeture des fenêtres et des messages a sa bulle", async ({ page }) => {
    await openPlanning(page, club);
    await visit(page, "/#/referentiels/courts");
    await page.getByRole("button", { name: "Nouveau court" }).click();
    const dialog = page.getByRole("dialog", { name: "Nouveau court" });
    await expect(dialog).toBeVisible();
    const inDialog = await iconButtonsByKeyboard(page, 12, "Shift+Tab");
    expectHelpful(inDialog, "fenêtre");
    expect(inDialog).toContainEqual({ name: "Fermer", tooltip: "Fermer (Échap)", title: null });
    // Échap ferme d'abord la bulle, puis la fenêtre.
    await dialog.getByRole("button", { name: "Fermer" }).focus();
    await expect(page.getByRole("tooltip")).toHaveText("Fermer (Échap)");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // Toast : « Masquer le message ».
    await page.clock.install();
    await visit(page, "/#/referentiels/saison");
    const form = page.getByRole("form", { name: "Saison" });
    await form.getByLabel("Nom", { exact: true }).fill("2026-2027 bis");
    await form.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByTestId("toast")).toHaveText("Modifications enregistrées.");
    // Le toast suit le contenu de la page : on y arrive en avançant depuis « Enregistrer ».
    const inToast = await iconButtonsByKeyboard(page, 40);
    expect(inToast).toContainEqual({
      name: "Masquer le message",
      tooltip: "Masquer le message",
      title: null,
    });
  });

  test("les actions rares ont un libellé visible en plus de l'icône", async ({ page }) => {
    await openPlanning(page, club);
    await visit(page, "/#/referentiels/eleves");
    await expect(
      page.getByRole("button", { name: "Données personnelles de Test Anne" }),
    ).toHaveText("Données personnelles");
    await visit(page, "/#/referentiels/groupes");
    await page.getByRole("link", { name: "Galaxie vert" }).click();
    await expect(page.getByRole("button", { name: /^Retirer .* du groupe$/ }).first()).toHaveText(
      "Retirer",
    );
  });
});

test.describe("saison terminée", () => {
  test("aucun terme retiré n'apparaît en consultant une saison terminée", async ({ page }) => {
    test.setTimeout(90_000);
    await createSeason(page);
    await seedPlanning(page, club);
    await page.getByRole("button", { name: "Nouvelle saison" }).click();
    const dialog = page.getByRole("dialog", { name: "Nouvelle saison" });
    await dialog.getByRole("button", { name: "Dupliquer la saison" }).click();
    await expect(dialog).toBeHidden();
    await page.getByLabel("Saison affichée").selectOption({ label: "2026-2027 (terminée)" });
    await expect(page.getByTestId("read-only-banner")).toContainText(
      "consultation seulement (saison terminée)",
    );
    const screens: { path: string; ready: (p: Page) => Promise<void> }[] = [
      { path: "/#/planning", ready: (p) => expect(p.getByTestId("lesson").first()).toBeVisible() },
      {
        path: "/#/referentiels/saison",
        ready: (p) =>
          expect(p.getByText("Consultation seulement (saison terminée) :")).toBeVisible(),
      },
      {
        path: "/#/referentiels/courts",
        ready: (p) => expect(p.getByText("Court 2")).toBeVisible(),
      },
      {
        path: "/#/referentiels/moniteurs",
        ready: (p) => expect(p.getByRole("table", { name: "Moniteurs" })).toBeVisible(),
      },
      {
        path: "/#/referentiels/niveaux",
        ready: (p) => expect(p.getByText("Modifiables depuis la saison en cours")).toBeVisible(),
      },
      {
        path: "/#/referentiels/groupes",
        ready: (p) => expect(p.getByRole("table", { name: "Groupes" })).toBeVisible(),
      },
      {
        path: "/#/referentiels/eleves",
        ready: (p) => expect(p.getByRole("table", { name: "Élèves" })).toBeVisible(),
      },
      {
        path: "/#/referentiels/fermetures",
        ready: (p) => expect(p.getByText("Vacances de la Toussaint")).toBeVisible(),
      },
      {
        path: "/#/import-export",
        ready: (p) => expect(p.getByTestId("import-read-only")).toBeVisible(),
      },
    ];
    for (const screen of screens) {
      await visit(page, screen.path);
      await screen.ready(page);
      expect(await forbiddenTerms(page), `${screen.path} (saison terminée)`).toEqual([]);
    }
    await visit(page, "/#/planning");
    await expect(page.getByTestId("mode-scope")).toHaveText(
      "Consultation seulement (saison terminée)",
    );
  });
});

test.describe("barre de mode à 960 px", () => {
  test.use({ viewport: { width: 960, height: 720 } });

  test("la phrase de portée reste entière à côté des deux pastilles", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-11-04T10:00:00+01:00"));
    const first = demoClub.lessons[0] as SeedLesson;
    await openPlanning(page, {
      ...demoClub,
      lessons: [
        { ...first, effectiveTo: "2026-11-01" },
        { ...first, effectiveFrom: "2026-11-02" },
        { ...(demoClub.lessons[1] as SeedLesson), effectiveFrom: "2027-01-04" },
      ],
    });
    await page.getByRole("button", { name: /^Marc Leroy,/ }).click();
    const bar = page.getByTestId("mode-bar");
    const pills = [page.getByTestId("later-changes"), page.getByTestId("hatch-info")];
    for (const pill of pills) await expect(pill).toBeVisible();
    const scope = page.getByTestId("mode-scope");
    await expect(scope).toHaveText("Vos changements valent pour toutes les semaines de la saison");
    const [barBox, scopeBox] = [await bar.boundingBox(), await scope.boundingBox()];
    if (!barBox || !scopeBox) throw new Error("barre de mode introuvable");
    expect(scopeBox.x + scopeBox.width).toBeLessThanOrEqual(barBox.x + barBox.width);
    for (const pill of pills) {
      const box = await pill.boundingBox();
      expect(box?.x ?? 0).toBeGreaterThanOrEqual(scopeBox.x + scopeBox.width);
    }
    // La phrase n'est pas coupée : sa largeur utile tient dans sa boîte.
    expect(
      await scope.evaluate(
        (el) =>
          (el.parentElement as HTMLElement).scrollWidth <=
          (el.parentElement as HTMLElement).clientWidth + 1,
      ),
    ).toBe(true);
  });
});

test.describe("bulle au clavier", () => {
  test.use({ viewport: { width: 1366, height: 420 } });

  test("suit son bouton quand la page défile", async ({ page }) => {
    await openPlanning(page, club);
    await visit(page, "/#/referentiels/eleves");
    await expect(page.getByRole("table", { name: "Élèves" })).toBeVisible();
    await page.locator("body").click({ position: { x: 1, y: 1 } });
    const button = await focusByKeyboard(page, /^Modifier Test /, 80);
    const bubble = page.getByRole("tooltip");
    await expect(bubble).toHaveText("Modifier");
    const before = await bubble.boundingBox();
    await page.mouse.move(700, 300);
    await page.mouse.wheel(0, 120);
    await expect(bubble).toBeVisible();
    await expect.poll(async () => (await bubble.boundingBox())?.y).not.toBe(before?.y);
    const [b, t] = [await button.boundingBox(), await bubble.boundingBox()];
    expect(Math.abs((t?.y ?? 0) - ((b?.y ?? 0) + (b?.height ?? 0)))).toBeLessThan(12);
  });
});
