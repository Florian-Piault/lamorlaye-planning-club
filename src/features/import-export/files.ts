import { invoke } from "@tauri-apps/api/core";

/**
 * Choix du fichier d'import dans l'application de bureau : le dialogue
 * « Ouvrir » est affiché côté Rust (`import_choose_file`), qui conserve le
 * chemin choisi ; `import_read_file` lit ensuite ce fichier-là uniquement
 * (`src-tauri/src/import.rs`). Le front ne manipule donc jamais de chemin.
 * Hors de Tauri (développement, tests), l'écran utilise un champ
 * `<input type="file">`.
 */

export interface SelectedFile {
  name: string;
  bytes: Uint8Array;
}

/** Extensions acceptées (mêmes que `ALLOWED_EXTENSIONS` côté Rust). */
export const IMPORT_EXTENSIONS = ["csv", "txt", "tsv", "xlsx", "xls"] as const;

/** Valeur de l'attribut `accept` du champ fichier. */
export const IMPORT_ACCEPT = IMPORT_EXTENSIONS.map((e) => `.${e}`).join(",");

/** Demande le fichier à importer ; `null` si l'utilisateur a annulé. */
export async function chooseImportFile(): Promise<SelectedFile | null> {
  const name = await invoke<string | null>("import_choose_file");
  if (name === null) return null;
  const buffer = await invoke<ArrayBuffer>("import_read_file");
  return { name, bytes: new Uint8Array(buffer) };
}

/** Octets d'un fichier choisi par un champ `<input type="file">`. */
export async function readBrowserFile(file: File): Promise<SelectedFile> {
  return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) };
}
