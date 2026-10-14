/**
 * Données personnelles des élèves (RGPD, SPECS.md §11.6) : export des données
 * d'un élève et préparation de son effacement définitif.
 *
 * Une même personne figure une fois par saison : la duplication d'une saison
 * copie les élèves (§8.1). Les fiches d'une personne sont retrouvées par sa
 * clé d'identité (nom + prénom + date de naissance, sans casse ni accents),
 * celle de la détection des doublons à l'import (§9.1). L'export et
 * l'effacement portent sur toutes ses fiches, saisons archivées comprises.
 */
import type { Season, Student } from "@/db/schema";
import { normalizeText } from "./search";
import { identityKey } from "./studentImport";

/** Fiche d'un élève dans une saison, avec son niveau et ses groupes. */
export interface StudentRecord {
  student: Student;
  season: Pick<Season, "id" | "name" | "startDate" | "endDate" | "status">;
  levelLabel: string | null;
  groups: { name: string; levelLabel: string | null }[];
}

/** Fiches désignant la même personne que `student`. */
export function samePerson<T extends Pick<Student, "lastName" | "firstName" | "birthDate">>(
  student: Pick<Student, "lastName" | "firstName" | "birthDate">,
  candidates: readonly T[],
): T[] {
  const key = identityKey(student);
  return candidates.filter((c) => identityKey(c) === key);
}

/** Personne (toutes saisons confondues) pour la recherche RGPD. */
export interface Person {
  key: string;
  lastName: string;
  firstName: string;
  birthDate: string | null;
  /** Fiches de la personne, de la saison la plus récente à la plus ancienne. */
  records: { studentId: string; seasonName: string; seasonStartDate: string }[];
}

/** Regroupe les fiches d'élèves de toutes les saisons par personne, triées par nom. */
export function groupPeople(
  rows: readonly {
    studentId: string;
    lastName: string;
    firstName: string;
    birthDate: string | null;
    seasonName: string;
    seasonStartDate: string;
  }[],
): Person[] {
  const people = new Map<string, Person>();
  for (const row of rows) {
    const key = identityKey(row);
    const person = people.get(key) ?? {
      key,
      lastName: row.lastName,
      firstName: row.firstName,
      birthDate: row.birthDate,
      records: [],
    };
    person.records.push({
      studentId: row.studentId,
      seasonName: row.seasonName,
      seasonStartDate: row.seasonStartDate,
    });
    people.set(key, person);
  }
  return [...people.values()]
    .map((p) => ({
      ...p,
      records: [...p.records].sort((a, b) => b.seasonStartDate.localeCompare(a.seasonStartDate)),
    }))
    .sort(
      (a, b) =>
        normalizeText(a.lastName).localeCompare(normalizeText(b.lastName)) ||
        normalizeText(a.firstName).localeCompare(normalizeText(b.firstName)) ||
        (a.birthDate ?? "").localeCompare(b.birthDate ?? ""),
    );
}

const SEASON_STATUS_LABELS = { active: "active", archived: "archivée" } as const;

/** Document d'export des données d'une personne (JSON lisible, clés en français). */
export function buildStudentExport(records: readonly StudentRecord[], exportedAt: string) {
  const sorted = [...records].sort((a, b) => a.season.startDate.localeCompare(b.season.startDate));
  const first = sorted[0]?.student;
  return {
    document: "Données personnelles d'un élève — Planning Club",
    version: 1,
    exportéLe: exportedAt,
    personne: first
      ? { nom: first.lastName, prénom: first.firstName, dateDeNaissance: first.birthDate }
      : null,
    saisons: sorted.map(({ student, season, levelLabel, groups }) => ({
      saison: {
        nom: season.name,
        début: season.startDate,
        fin: season.endDate,
        statut: SEASON_STATUS_LABELS[season.status],
      },
      fiche: {
        nom: student.lastName,
        prénom: student.firstName,
        téléphone: student.phone,
        email: student.email,
        dateDeNaissance: student.birthDate,
        niveau: levelLabel,
        classementFFT: student.fftRanking,
        responsableLégal:
          student.guardianName || student.guardianPhone
            ? { nom: student.guardianName, téléphone: student.guardianPhone }
            : null,
        crééeLe: student.createdAt,
        modifiéeLe: student.updatedAt,
      },
      groupes: groups.map((g) => ({ nom: g.name, niveau: g.levelLabel })),
    })),
  };
}

/** Export JSON indenté, encodé en UTF-8. */
export function studentExportBytes(
  records: readonly StudentRecord[],
  exportedAt: string,
): Uint8Array {
  return new TextEncoder().encode(
    `${JSON.stringify(buildStudentExport(records, exportedAt), null, 2)}\n`,
  );
}

/** Nom proposé pour le fichier d'export : `donnees-dupont-lea.json`. */
export function studentExportFileName(student: Pick<Student, "lastName" | "firstName">): string {
  const slug = normalizeText(`${student.lastName} ${student.firstName}`)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `donnees-${slug || "eleve"}.json`;
}
