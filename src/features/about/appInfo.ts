import type { SqlDriver } from "@/db";

/** Informations de l'écran « À propos » (commande Rust `app_info`, `src-tauri/src/about.rs`). */
export interface AppInfo {
  version: string;
  tauriVersion: string | null;
  os: string | null;
  arch: string | null;
  /** Dossier de données de l'application (`null` hors application de bureau). */
  dataDir: string | null;
  /** Fichier SQLite, ou description de la base en mémoire. */
  database: string;
  /** Dossier des sauvegardes automatiques (`null` hors application de bureau). */
  backupsDir: string | null;
}

/**
 * Dans l'application de bureau, les informations viennent de Tauri ; dans un
 * navigateur (développement, tests), la version est celle de `package.json`.
 */
export async function loadAppInfo(driver: SqlDriver): Promise<AppInfo> {
  if (driver.kind === "tauri") {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<AppInfo>("app_info");
  }
  return {
    version: __APP_VERSION__,
    tauriVersion: null,
    os: null,
    arch: null,
    dataDir: null,
    database: "Base en mémoire (hors application)",
    backupsDir: null,
  };
}

const OS_NAMES: Record<string, string> = {
  macos: "macOS",
  windows: "Windows",
  linux: "Linux",
};

/** « macOS (aarch64) », ou `null` hors application de bureau. */
export function systemLabel(info: Pick<AppInfo, "os" | "arch">): string | null {
  if (!info.os) return null;
  const name = OS_NAMES[info.os] ?? info.os;
  return info.arch ? `${name} (${info.arch})` : name;
}

export interface ThirdPartyComponent {
  name: string;
  usage: string;
  license: string;
}

/**
 * Principaux composants libres embarqués dans l'application, avec leur
 * licence (relevée dans leurs paquets ; à tenir à jour avec les dépendances).
 */
export const THIRD_PARTY_COMPONENTS: readonly ThirdPartyComponent[] = [
  { name: "Tauri", usage: "Conteneur de l'application de bureau", license: "Apache-2.0 ou MIT" },
  { name: "React", usage: "Interface", license: "MIT" },
  { name: "React Router", usage: "Navigation entre les écrans", license: "MIT" },
  { name: "dnd-kit", usage: "Glisser-déposer du planning", license: "MIT" },
  { name: "Drizzle ORM", usage: "Accès à la base de données", license: "Apache-2.0" },
  { name: "SQLite / sql.js", usage: "Base de données locale", license: "Domaine public / MIT" },
  { name: "Zod", usage: "Validation des données", license: "MIT" },
  { name: "@react-pdf/renderer", usage: "Documents PDF", license: "MIT" },
  { name: "SheetJS Community Edition", usage: "Lecture et écriture Excel", license: "Apache-2.0" },
  { name: "Papa Parse", usage: "Lecture des fichiers CSV", license: "MIT" },
  { name: "Tailwind CSS", usage: "Mise en forme", license: "MIT" },
  { name: "Lucide", usage: "Icônes", license: "ISC" },
  { name: "Inter", usage: "Police de caractères", license: "SIL Open Font License 1.1" },
  {
    name: "RustCrypto (AES-GCM, Argon2)",
    usage: "Chiffrement des sauvegardes",
    license: "Apache-2.0 ou MIT",
  },
];
