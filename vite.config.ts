/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Hôte fourni par la CLI Tauri pour le développement sur appareil distant (inutilisé ici).
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    // Moteurs web visés : WebKit (macOS), WebView2 (Windows), WebKitGTK (Linux).
    target: ["es2022", "safari16", "chrome110"],
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
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
