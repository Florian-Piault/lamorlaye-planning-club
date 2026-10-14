import { invoke } from "@tauri-apps/api/core";
import type { BackupInfo } from "@/domain/backup";
import { exportFileName } from "@/domain/backup";

/**
 * Sauvegardes de la base (SPECS.md §11.3), disponibles uniquement dans
 * l'application de bureau : les copies sont faites côté Rust
 * (`src-tauri/src/backup.rs`).
 */

const FILE_FILTERS = [{ name: "Sauvegarde Planning Club", extensions: ["db"] }];

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
 * Demande l'emplacement du fichier puis exporte une copie de la base.
 * @returns le chemin du fichier exporté, ou `null` si l'utilisateur a annulé.
 */
export async function exportBackup(): Promise<string | null> {
  const { save } = await import("@tauri-apps/plugin-dialog");
  const destination = await save({
    title: "Exporter une sauvegarde",
    defaultPath: exportFileName(new Date()),
    filters: FILE_FILTERS,
  });
  if (!destination) return null;
  await invoke("backup_export", { destination });
  return destination;
}

/** Demande le fichier de sauvegarde à restaurer ; `null` si l'utilisateur a annulé. */
export async function chooseBackupFile(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    title: "Restaurer une sauvegarde",
    multiple: false,
    directory: false,
    filters: FILE_FILTERS,
  });
  return typeof selected === "string" ? selected : null;
}

/**
 * Restaure une sauvegarde (après une copie de l'état courant), puis recharge
 * l'interface pour rouvrir la base restaurée.
 */
export async function restoreBackup(source: string): Promise<void> {
  await invoke("backup_restore", { source });
  window.location.reload();
}
