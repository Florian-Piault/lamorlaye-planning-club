import { defineConfig, devices } from "@playwright/test";

/**
 * Tests de bout en bout sur le front servi par Vite. Hors de Tauri, la base est
 * remplacée par sql.js (SQLite en mémoire). Les moteurs WebKit et Chromium
 * couvrent les webviews de macOS, Linux (WebKit) et Windows (Chromium).
 */
const port = 1420;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"], viewport: { width: 1366, height: 768 } },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: `http://localhost:${port}`,
    reuseExistingServer: !isCI,
    timeout: 60_000,
  },
});
