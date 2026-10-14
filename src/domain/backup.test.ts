import { describe, expect, it } from "vitest";
import {
  type BackupInfo,
  backupPasswordProblem,
  describeBackupReason,
  encryptedExportFileName,
  exportFileName,
  formatDateTime,
  formatFileSize,
  sortBackups,
} from "./backup";

describe("sauvegardes", () => {
  it("décrit le motif d'une sauvegarde", () => {
    expect(describeBackupReason("fermeture")).toBe("À la fermeture");
    expect(describeBackupReason("manuelle")).toBe("Manuelle");
    expect(describeBackupReason("avant-restauration")).toBe("Avant restauration");
    expect(describeBackupReason("autre")).toBe("autre");
  });

  it("formate la taille d'un fichier", () => {
    expect(formatFileSize(512)).toBe("512 o");
    expect(formatFileSize(12_800)).toBe("12,5 Ko");
    expect(formatFileSize(3 * 1024 * 1024)).toBe("3 Mo");
  });

  it("propose un nom de fichier d'export horodaté", () => {
    expect(exportFileName(new Date(2026, 9, 4, 8, 5))).toBe("planning-club-2026-10-04-0805.db");
  });

  it("formate une date-heure en heure locale", () => {
    const local = new Date(2026, 9, 14, 18, 30);
    expect(formatDateTime(local.toISOString())).toBe("14/10/2026 à 18:30");
    expect(formatDateTime("n'importe quoi")).toBe("n'importe quoi");
  });

  it("trie les sauvegardes de la plus récente à la plus ancienne", () => {
    const backup = (createdAt: string): BackupInfo => ({
      name: createdAt,
      path: createdAt,
      size: 1,
      createdAt,
      reason: "fermeture",
    });
    expect(
      sortBackups([
        backup("2026-10-01T10:00:00Z"),
        backup("2026-10-03T10:00:00Z"),
        backup("2026-10-02T10:00:00Z"),
      ]).map((b) => b.createdAt),
    ).toEqual(["2026-10-03T10:00:00Z", "2026-10-02T10:00:00Z", "2026-10-01T10:00:00Z"]);
  });
});

describe("sauvegardes chiffrées", () => {
  it("propose un nom de fichier distinct", () => {
    expect(encryptedExportFileName(new Date(2026, 9, 14, 18, 30))).toBe(
      "planning-club-2026-10-14-1830.pcenc",
    );
  });

  it("vérifie le mot de passe et sa confirmation", () => {
    expect(backupPasswordProblem("court", "court")).toBe(
      "Le mot de passe doit comporter au moins 8 caractères.",
    );
    expect(backupPasswordProblem("assez long", "assez lonG")).toBe(
      "Les deux mots de passe ne sont pas identiques.",
    );
    expect(backupPasswordProblem("assez long", "assez long")).toBeNull();
  });
});
