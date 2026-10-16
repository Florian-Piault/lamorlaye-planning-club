import { expect, type Page } from "@playwright/test";

/** Écrans principaux, avec un repère attendu une fois chargés. */
export const SCREENS: { path: string; ready: (page: Page) => Promise<void> }[] = [
  { path: "/#/planning", ready: (p) => expect(p.getByTestId("lesson").first()).toBeVisible() },
  {
    path: "/#/referentiels/saison",
    ready: (p) => expect(p.getByRole("form", { name: "Saison" })).toBeVisible(),
  },
  {
    path: "/#/referentiels/courts",
    ready: (p) => expect(p.getByRole("button", { name: "Modifier Court 2" })).toBeVisible(),
  },
  {
    path: "/#/referentiels/moniteurs",
    ready: (p) => expect(p.getByRole("table", { name: "Moniteurs" })).toBeVisible(),
  },
  {
    path: "/#/referentiels/niveaux",
    ready: (p) => expect(p.getByRole("button", { name: "Modifier Galaxie blanc" })).toBeVisible(),
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
    ready: (p) => expect(p.getByRole("heading", { level: 1, name: "Le club" })).toBeVisible(),
  },
  {
    path: "/#/heures",
    ready: (p) => expect(p.getByRole("heading", { level: 1, name: "Heures" })).toBeVisible(),
  },
  {
    path: "/#/import-export",
    ready: (p) => expect(p.getByRole("heading", { level: 1, name: "Import/Export" })).toBeVisible(),
  },
  {
    path: "/#/reglages",
    ready: (p) => expect(p.getByTestId("storage-kind")).toBeVisible(),
  },
  {
    path: "/#/a-propos",
    ready: (p) => expect(p.getByTestId("app-version")).toBeVisible(),
  },
];

/** Change d'écran sans recharger la page (la base sql.js est en mémoire). */
export async function visit(page: Page, path: string) {
  await page.evaluate((hash) => {
    window.location.hash = hash;
  }, path.slice(1));
}
