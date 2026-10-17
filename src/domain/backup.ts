/**
 * Sauvegardes (SPECS.md §11.3, §12.2).
 *
 * La copie elle-même (`VACUUM INTO`) et la rotation des 30 dernières copies
 * automatiques sont faites côté Rust (`src-tauri/src/backup.rs`), afin de
 * fonctionner même lorsque l'interface est déjà fermée. Ce module regroupe
 * les règles d'affichage et de nommage utilisées par l'interface.
 */

/** Motifs de sauvegarde, tels qu'encodés dans le nom de fichier par le Rust. */
export const backupReasons = ["fermeture", "manuelle", "avant-restauration"] as const;
export type BackupReason = (typeof backupReasons)[number];

/** Nombre de sauvegardes automatiques conservées (doit rester aligné avec le Rust). */
export const BACKUPS_KEPT = 30;

export interface BackupInfo {
  name: string;
  path: string;
  size: number;
  /** Date de création (ISO 8601, UTC). */
  createdAt: string;
  reason: string;
}

export function describeBackupReason(reason: string): string {
  switch (reason) {
    case "fermeture":
      return "À la fermeture";
    case "manuelle":
      return "Manuelle";
    case "avant-restauration":
      return "Avant restauration";
    case "avant-migration":
      return "Avant mise à jour";
    default:
      return reason;
  }
}

/** Taille lisible : « 512 o », « 12,5 Ko », « 3,2 Mo ». */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  const units = ["Ko", "Mo", "Go"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} ${units[unit]}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Nom proposé pour une sauvegarde exportée : `kairos-2026-10-14-1830.db`. */
export function exportFileName(now: Date): string {
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `kairos-${date}-${pad(now.getHours())}${pad(now.getMinutes())}.db`;
}

/** Extension des sauvegardes chiffrées par mot de passe (§11.6). */
export const ENCRYPTED_EXTENSION = "pcenc";

/** Nom proposé pour une sauvegarde chiffrée : `kairos-2026-10-14-1830.pcenc`. */
export function encryptedExportFileName(now: Date): string {
  return exportFileName(now).replace(/\.db$/, `.${ENCRYPTED_EXTENSION}`);
}

/** Longueur minimale du mot de passe d'une sauvegarde chiffrée. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Problème du mot de passe choisi pour chiffrer une sauvegarde, ou `null`.
 * Aucune récupération n'est possible en cas d'oubli : il est saisi deux fois.
 */
export function backupPasswordProblem(password: string, confirmation: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Le mot de passe doit comporter au moins ${MIN_PASSWORD_LENGTH} caractères.`;
  }
  if (password !== confirmation) return "Les deux mots de passe ne sont pas identiques.";
  return null;
}

/** Date et heure locales lisibles : « 14/10/2026 à 18:30 ». */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} à ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** Sauvegardes de la plus récente à la plus ancienne. */
export function sortBackups(backups: readonly BackupInfo[]): BackupInfo[] {
  return [...backups].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
