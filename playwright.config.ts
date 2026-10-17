import { defineConfig, devices } from "@playwright/test";

/**
 * Tests de bout en bout sur le front servi par Vite. Hors de Tauri, la base est
 * remplacée par sql.js (SQLite en mémoire). Les moteurs WebKit et Chromium
 * couvrent les webviews de macOS, Linux (WebKit) et Windows (Chromium).
 */
// Port surchargeable (E2E_PORT) pour lancer plusieurs copies de travail en parallèle.
const port = Number(process.env.E2E_PORT ?? 1420);
const isCI = Boolean(process.env.CI);
// Mesures de temps (`*.perf.spec.ts`) à part : `pnpm test:perf` (`PERF`).
const perf = Boolean(process.env.PERF);

export default defineConfig({
  testDir: "./e2e",
  testMatch: perf ? "**/*.perf.spec.ts" : "**/*.spec.ts",
  testIgnore: perf ? [] : "**/*.perf.spec.ts",
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
    command: `pnpm dev --port ${port}`,
    // Sans rechargement à chaud (voir `vite.config.ts`).
    env: { E2E: "1" },
    url: `http://localhost:${port}`,
    reuseExistingServer: !isCI,
    timeout: 60_000,
  },
});
