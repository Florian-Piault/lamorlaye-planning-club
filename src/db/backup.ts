import { invoke } from "@tauri-apps/api/core";
import type { BackupInfo } from "@/domain/backup";
import { ENCRYPTED_EXTENSION, encryptedExportFileName, exportFileName } from "@/domain/backup";

/**
 * Sauvegardes de la base (SPECS.md §11.3), disponibles uniquement dans
 * l'application de bureau : les copies, le chiffrement et le déchiffrement
 * sont faits côté Rust (`src-tauri/src/backup.rs`, `src-tauri/src/crypto.rs`).
 */

const PLAIN_FILTER = { name: "Sauvegarde Planning Club", extensions: ["db"] };
const ENCRYPTED_FILTER = {
  name: "Sauvegarde chiffrée Planning Club",
  extensions: [ENCRYPTED_EXTENSION],
};

export function backupsLocation(): Promise<string> {
  return invoke<string>("backups_location");
}

export function listBackups(): Promise<BackupInfo[]> {
  return invoke<BackupInfo[]>("backup_list");
}

export function createBackup(): Promise<BackupInfo> {
  return invoke<BackupInfo>("backup_create");
}

/**
 * Demande l'emplacement du fichier puis exporte une copie de la base,
 * chiffrée par `password` s'il est fourni (§11.6).
 * @returns le chemin du fichier exporté, ou `null` si l'utilisateur a annulé.
 */
export async function exportBackup(password: string | null = null): Promise<string | null> {
  const { save } = await import("@tauri-apps/plugin-dialog");
  const now = new Date();
  const destination = await save({
    title: password ? "Exporter une sauvegarde chiffrée" : "Exporter une sauvegarde",
    defaultPath: password ? encryptedExportFileName(now) : exportFileName(now),
    filters: [password ? ENCRYPTED_FILTER : PLAIN_FILTER],
  });
  if (!destination) return null;
  await invoke("backup_export", { destination, password });
  return destination;
}

/** Demande le fichier de sauvegarde à restaurer ; `null` si l'utilisateur a annulé. */
export async function chooseBackupFile(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    title: "Restaurer une sauvegarde",
    multiple: false,
    directory: false,
    filters: [{ name: "Sauvegardes Planning Club", extensions: ["db", ENCRYPTED_EXTENSION] }],
  });
  return typeof selected === "string" ? selected : null;
}

/** Le fichier choisi est-il une sauvegarde chiffrée (mot de passe à demander) ? */
export async function isEncryptedBackup(source: string): Promise<boolean> {
  const info = await invoke<{ encrypted: boolean }>("backup_inspect", { source });
  return info.encrypted;
}

/**
 * Restaure une sauvegarde (après une copie de l'état courant), puis recharge
 * l'interface pour rouvrir la base restaurée. Le mot de passe n'est utile
 * que pour une sauvegarde chiffrée ; un mauvais mot de passe est refusé.
 */
export async function restoreBackup(source: string, password: string | null = null): Promise<void> {
  await invoke("backup_restore", { source, password });
  window.location.reload();
}
