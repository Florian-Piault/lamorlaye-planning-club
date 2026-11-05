/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import packageJson from "./package.json" with { type: "json" };

// Hôte fourni par la CLI Tauri pour le développement sur appareil distant (inutilisé ici).
const host = process.env.TAURI_DEV_HOST;
const e2e = Boolean(process.env.E2E);
const perf = Boolean(process.env.PERF);

/** Taille maximale (octets) du bundle principal, chargé au démarrage. */
const ENTRY_CHUNK_LIMIT = 500 * 1024;

/**
 * Les écrans sont chargés à la demande (`React.lazy`, voir `App.tsx`). Seuls
 * dépassent 500 ko des modules chargés à l'usage : le moteur PDF
 * (@react-pdf, ~1,4 Mo, à l'ouverture d'un aperçu) et SheetJS. Le seuil
 * général de Vite est donc relevé, mais le bundle principal reste surveillé.
 */
function entryChunkLimit(): Plugin {
  return {
    name: "planning-club:entry-chunk-limit",
    apply: "build",
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === "chunk" && chunk.isEntry && chunk.code.length > ENTRY_CHUNK_LIMIT) {
          this.warn(
            `Bundle principal ${chunk.fileName} : ${Math.round(chunk.code.length / 1024)} ko (> 500 ko). Chargez l'écran ou la dépendance à la demande.`,
          );
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), entryChunkLimit()],
  define: {
    // Version affichée par l'écran « À propos » hors de Tauri (tests, navigateur).
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Les messages d'erreur de Rust restent visibles dans le terminal.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    // Serveur lancé par Playwright (`E2E`) : sans surveillance des fichiers, une
    // modification pendant la suite ne recharge pas la page testée.
    hmr: !e2e,
    watch: e2e ? null : { ignored: ["**/src-tauri/**"] },
  },
  build: {
    // Moteurs web visés : WebKit (macOS), WebView2 (Windows), WebKitGTK (Linux).
    target: ["es2022", "safari16", "chrome110"],
    // Moteur PDF chargé à la demande (voir `entryChunkLimit`).
    chunkSizeWarningLimit: 1600,
  },
  test: {
    // jsdom seulement pour les fichiers qui l'annoncent (`// @vitest-environment jsdom`).
    environment: "node",
    // Mesures de temps (`*.perf.test.ts`) à part : `pnpm test:perf` (`PERF`).
    include: perf ? ["src/**/*.perf.test.ts"] : ["src/**/*.test.{ts,tsx}"],
    exclude: perf ? [] : ["src/**/*.perf.test.ts"],
    setupFiles: ["./src/test/setup.ts"],
    // Le dernier lancement garde son détail, échecs compris, même si la sortie a
    // été filtrée : un échec isolé reste identifiable après coup.
    reporters: ["default", ["json", { outputFile: ".vite/vitest-last-run.json" }]],
    // Couverture des règles métier, de la logique pure de la grille et de la
    // mise en forme des PDF (`pnpm test:coverage`) : seuil de 90 % (lots L2, L3, L6).
    coverage: {
      provider: "v8",
      include: [
        "src/domain/**/*.ts",
        "src/features/planning/grid/**/*.ts",
        "src/features/pdf/model.ts",
        "src/features/pdf/render.ts",
      ],
      exclude: ["src/**/*.test.ts"],
      reporter: ["text", "html"],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
});
