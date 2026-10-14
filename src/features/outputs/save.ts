import { invoke, isTauri } from "@tauri-apps/api/core";

/**
 * Enregistrement des documents produits (PDF, CSV, Excel).
 *
 * Dans l'application de bureau, le contenu est envoyé à la commande Rust
 * `output_save` (`src-tauri/src/output.rs`), qui affiche le dialogue
 * « Enregistrer » et écrit le fichier à l'emplacement choisi, et seulement
 * là ; `output_open_last` ouvre ensuite ce fichier dans l'application par
 * défaut du système (lecteur PDF, tableur). Le front ne manipule jamais de
 * chemin et n'a aucun accès général au système de fichiers.
 *
 * Hors de Tauri (développement, tests Playwright), le document est proposé
 * en téléchargement par le navigateur.
 */

/** Types de document ; `json` : export des données personnelles d'un élève (RGPD). */
export type OutputKind = "pdf" | "csv" | "xlsx" | "json";

export const MIME_TYPES: Record<OutputKind, string> = {
  pdf: "application/pdf",
  csv: "text/csv;charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  json: "application/json;charset=utf-8",
};

export interface OutputFile {
  /** Nom proposé, avec son extension. */
  name: string;
  kind: OutputKind;
  bytes: Uint8Array;
}

export interface SavedOutput {
  /** Nom du fichier enregistré. */
  name: string;
  /** Le fichier peut être ouvert dans l'application par défaut du système. */
  canOpen: boolean;
}

/** Enregistre le document ; `null` si l'utilisateur a annulé. */
export async function saveOutput(file: OutputFile): Promise<SavedOutput | null> {
  if (isTauri()) {
    const name = await invoke<string | null>("output_save", file.bytes, {
      headers: { "x-output-kind": file.kind, "x-output-name": encodeURIComponent(file.name) },
    });
    return name === null ? null : { name, canOpen: true };
  }
  downloadFile(file);
  return { name: file.name, canOpen: false };
}

/** Ouvre le dernier document enregistré (application de bureau uniquement). */
export function openLastOutput(): Promise<void> {
  return invoke("output_open_last");
}

/** Téléchargement par le navigateur (hors de l'application de bureau). */
export function downloadFile(file: OutputFile): void {
  const blob = new Blob([file.bytes as BlobPart], { type: MIME_TYPES[file.kind] });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
