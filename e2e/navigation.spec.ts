import { expect, test } from "@playwright/test";

test.describe("coque de l'application", () => {
  test("navigue entre les écrans sans aucune requête externe", async ({ page, baseURL }) => {
    // Mode hors ligne strict (§11.2) : toute requête doit viser le serveur local.
    const externalRequests: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (!url.startsWith(baseURL ?? "") && !url.startsWith("data:") && !url.startsWith("blob:")) {
        externalRequests.push(url);
      }
    });

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Planning" })).toBeVisible();

    const nav = page.getByRole("navigation", { name: "Navigation principale" });
    for (const label of ["Référentiels", "Import/Export", "Réglages", "À propos", "Planning"]) {
      await nav.getByRole("link", { name: label }).click();
      await expect(page.getByRole("heading", { level: 1, name: label })).toBeVisible();
    }

    // La base sql.js a été ouverte et migrée au démarrage.
    await nav.getByRole("link", { name: "Réglages" }).click();
    await expect(page.getByTestId("storage-kind")).toHaveText("Base en mémoire (hors application)");
    await expect(page.getByText("0000_initial")).toBeVisible();

    // Écran « À propos » : version de package.json, données en mémoire hors application.
    await nav.getByRole("link", { name: "À propos" }).click();
    await expect(page.getByTestId("app-version")).toHaveText(/^\d+\.\d+\.\d+$/);
    await expect(page.getByTestId("database-location")).toHaveText(
      "Base en mémoire (hors application)",
    );

    expect(externalRequests).toEqual([]);
  });

  test("utilise la police embarquée", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Planning" })).toBeVisible();
    const loaded = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].some(
        (font) => font.family.replaceAll('"', "") === "Inter Variable" && font.status === "loaded",
      );
    });
    expect(loaded).toBe(true);
  });
});
