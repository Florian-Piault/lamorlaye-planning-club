import { defineConfig } from "drizzle-kit";

/**
 * Génération des migrations : `pnpm db:generate`.
 * Les fichiers SQL produits dans `src/db/migrations` sont embarqués dans
 * l'application et appliqués au démarrage (voir `src/db/migrate.ts`).
 */
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  casing: "snake_case",
});
