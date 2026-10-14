import { expect, type Locator, type Page } from "@playwright/test";
import type { SeedPlanning } from "../../src/test/e2e";

/**
 * Outils des scénarios du planning. Hors de Tauri, la base est une base sql.js
 * en mémoire : la saison est créée par l'interface, puis les référentiels et
 * les cours sont insérés directement par `src/test/e2e.ts`, chargé dans la
 * page par Vite (même module, donc même base que l'application).
 */

/** Club de démonstration : 2 courts, 3 moniteurs (Marc sans aucune plage), 4 groupes. */
export const demoClub: SeedPlanning = {
  courts: [
    { name: "Court 1", kind: "indoor" },
    { name: "Court 2", kind: "outdoor" },
  ],
  instructors: [
    {
      firstName: "Julie",
      lastName: "Martin",
      initials: "JM",
      color: "#1D4ED8",
      availability: [
        [1, "16:00", "21:00"],
        [3, "09:00", "13:00"],
        [6, "08:30", "13:00"],
      ],
    },
    {
      firstName: "Karim",
      lastName: "Benali",
      initials: "KB",
      color: "#C2410C",
      availability: [
        [1, "09:00", "12:00"],
        [1, "17:00", "21:30"],
        [2, "09:00", "12:00"],
        [3, "13:00", "19:00"],
      ],
    },
    { firstName: "Marc", lastName: "Leroy", initials: "ML", color: "#7E22CE", availability: [] },
  ],
  groups: [
    { name: "Galaxie vert", maxSize: 8, students: ["Léa", "Tom", "Zoé"] },
    { name: "Ados perfectionnement", maxSize: 6, students: ["Hugo", "Lina"] },
    { name: "Adultes débutants", maxSize: 2, students: ["Anne", "Paul", "Rémi"] },
    { name: "Mini-tennis", maxSize: 6, students: ["Tom"] },
  ],
  lessons: [
    {
      weekday: 1,
      startTime: "10:00",
      durationMinutes: 60,
      court: "Court 1",
      group: "Galaxie vert",
      instructor: "Karim",
    },
    {
      weekday: 3,
      startTime: "10:00",
      durationMinutes: 90,
      court: "Court 2",
      group: "Ados perfectionnement",
      instructor: "Julie",
    },
  ],
};

export async function createSeason(page: Page) {
  await page.goto("/#/referentiels");
  const form = page.getByRole("form", { name: "Saison" });
  await form.getByLabel("Nom", { exact: true }).fill("2026-2027");
  await form.getByLabel("Date de début").fill("2026-09-01");
  await form.getByLabel("Date de fin").fill("2027-06-30");
  await form.getByLabel("Dimanche").uncheck();
  await form.getByRole("button", { name: "Créer la saison" }).click();
  await expect(page.getByText("Saison active")).toBeVisible();
}

/** Module d'outils de test, chargé dans la page (chemin servi par Vite). */
const E2E_MODULE = "/src/test/e2e.ts";

/** Crée la saison (lundi → samedi, 8h–22h), insère le club et ouvre le planning. */
export async function openPlanning(page: Page, spec: SeedPlanning = demoClub) {
  await createSeason(page);
  await seedPlanning(page, spec);
  await goToPlanning(page);
}

/** Insère les référentiels et les cours dans la saison active. */
export async function seedPlanning(page: Page, spec: SeedPlanning) {
  await page.evaluate(
    async ({ path, spec }) => {
      const tools = await import(/* @vite-ignore */ path);
      await tools.seedPlanning(spec);
    },
    { path: E2E_MODULE, spec },
  );
}

export async function goToPlanning(page: Page) {
  await page
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("link", { name: "Planning" })
    .click();
  await expect(page.getByTestId("planning-board")).toBeVisible();
}

export type StoredLesson = {
  group: string;
  instructor: string;
  court: string;
  weekday: number;
  startTime: string;
  durationMinutes: number;
};

/** Cours relus directement en base. */
export function readLessons(page: Page): Promise<StoredLesson[]> {
  return page.evaluate(async (path) => {
    const tools = await import(/* @vite-ignore */ path);
    return tools.readLessons();
  }, E2E_MODULE);
}

export type StoredPlanning = Awaited<ReturnType<typeof import("../../src/test/e2e").readPlanning>>;

/** Cours (avec dates d'effet), exceptions et fermetures relus en base. */
export function readPlanning(page: Page): Promise<StoredPlanning> {
  return page.evaluate(async (path) => {
    const tools = await import(/* @vite-ignore */ path);
    return tools.readPlanning();
  }, E2E_MODULE);
}

export function lesson(page: Page, group: string): Locator {
  return page.getByTestId("lesson").filter({ hasText: group });
}

export interface Point {
  x: number;
  y: number;
}

/** Coordonnées écran d'un créneau : jour (0 = lundi), court (0 = premier), heure `HH:MM`. */
export async function slotPoint(
  page: Page,
  dayIndex: number,
  courtIndex: number,
  time: string,
): Promise<Point> {
  const board = page.getByTestId("planning-board");
  const box = await board.boundingBox();
  if (!box) throw new Error("grille introuvable");
  const { columnWidth, hourHeight, dayStart, courts } = await board.evaluate((el) => ({
    columnWidth: Number(el.dataset.columnWidth),
    hourHeight: Number(el.dataset.hourHeight),
    dayStart: Number(el.dataset.dayStart),
    courts: Number(el.dataset.courts),
  }));
  const [h = 0, m = 0] = time.split(":").map(Number);
  return {
    x: box.x + (dayIndex * courts + courtIndex + 0.5) * columnWidth,
    y: box.y + ((h * 60 + m - dayStart) * hourHeight) / 60,
  };
}

/** Décalage vertical du point de saisie : 15 min (12 px). */
export const GRAB_OFFSET = 12;

/** Point de saisie d'un cours : 15 min sous son bord supérieur (hors poignée). */
export async function grabPoint(locator: Locator): Promise<Point> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("cours introuvable");
  // Le bloc commence 1 px sous l'heure de début ; 15 min = 12 px.
  return { x: box.x + box.width / 2, y: box.y + 11 };
}

/** Bord inférieur d'un cours (poignée de redimensionnement). */
export async function resizePoint(locator: Locator): Promise<Point> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("cours introuvable");
  return { x: box.x + box.width / 2, y: box.y + box.height - 3 };
}

/** Glisser à la souris, avec franchissement du seuil de démarrage puis étapes intermédiaires. */
export async function dragMouse(
  page: Page,
  from: Point,
  to: Point,
  options: { drop?: boolean } = {},
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y + 6, { steps: 2 });
  await page.mouse.move(to.x, to.y, { steps: 8 });
  if (options.drop !== false) await page.mouse.up();
}
