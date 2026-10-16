/**
 * Doublons et alerte d'âge (SPECS.md §7, §8 ; spec UX v1.1 « Doublons et
 * âge ») : signaler tôt, sans jamais bloquer l'enregistrement.
 *
 * - Élève : même nom + prénom (sans casse ni accents) ; si les deux dates de
 *   naissance sont connues, elles doivent aussi être égales (une date absente
 *   ne départage pas). Comparé aux élèves de toutes les saisons, fiche éditée
 *   exclue.
 * - Moniteur : initiales déjà prises dans la saison, avec la proposition de
 *   `suggestInitials`.
 * - Court : nom déjà pris dans la saison (sans casse ni accents).
 * - Tranche d'âge : âge au début de la saison, comme la fiche groupe et les
 *   conflits.
 */
import { ageOn, isInAgeRange } from "./groups";
import { suggestInitials } from "./initials";
import { normalizeText } from "./search";
import { formatDate } from "./time";

// ---------------------------------------------------------------------------
// Élèves
// ---------------------------------------------------------------------------

/** Identité saisie dans la fiche élève (date vide = inconnue). */
export interface StudentIdentityInput {
  lastName: string;
  firstName: string;
  birthDate: string | null;
}

/** Fiche d'élève d'une saison, comparée à la saisie. */
export interface StudentCandidate {
  id: string;
  seasonId: string;
  seasonName: string;
  seasonStartDate: string;
  lastName: string;
  firstName: string;
  birthDate: string | null;
  /** Noms des groupes de l'élève dans sa saison. */
  groups: readonly string[];
  /** Clé de nom pré-calculée au chargement (sinon calculée à chaque comparaison). */
  nameKey?: string;
}

/** Clé de nom d'un élève : nom + prénom, sans casse ni accents. */
export function nameKey(student: { lastName: string; firstName: string }): string {
  return `${normalizeText(student.lastName)}|${normalizeText(student.firstName)}`;
}

const knownDate = (value: string | null | undefined): string | null =>
  value && value.trim() !== "" ? value : null;

/**
 * Même personne probable : même nom et prénom ; dates de naissance égales
 * si les deux sont connues.
 */
export function isSameStudent(a: StudentIdentityInput, b: StudentIdentityInput): boolean {
  if (nameKey(a) !== nameKey(b)) return false;
  const da = knownDate(a.birthDate);
  const db = knownDate(b.birthDate);
  return da === null || db === null || da === db;
}

export interface StudentDuplicates<T extends StudentCandidate = StudentCandidate> {
  /** Fiches de la saison en cours. */
  inSeason: T[];
  /** Fiches des saisons antérieures, de la plus récente à la plus ancienne. */
  pastSeasons: T[];
}

/**
 * Doublons de la saisie parmi les élèves de toutes les saisons. Rien tant que
 * le nom ou le prénom est vide ; la fiche éditée (`excludeId`) est exclue.
 * Seules les saisons commencées avant la saison courante comptent comme
 * « passées » (une saison suivante n'a pas de coordonnées à reprendre).
 */
export function findStudentDuplicates<T extends StudentCandidate>(
  input: StudentIdentityInput,
  candidates: readonly T[],
  options: { seasonId: string; seasonStartDate: string; excludeId?: string | null },
): StudentDuplicates<T> {
  if (normalizeText(input.lastName) === "" || normalizeText(input.firstName) === "") {
    return { inSeason: [], pastSeasons: [] };
  }
  const key = nameKey(input);
  const date = knownDate(input.birthDate);
  const matches = candidates.filter((c) => {
    if (c.id === options.excludeId || (c.nameKey ?? nameKey(c)) !== key) return false;
    const other = knownDate(c.birthDate);
    return date === null || other === null || date === other;
  });
  return {
    inSeason: matches.filter((c) => c.seasonId === options.seasonId),
    pastSeasons: matches
      .filter((c) => c.seasonId !== options.seasonId && c.seasonStartDate < options.seasonStartDate)
      .sort((a, b) => b.seasonStartDate.localeCompare(a.seasonStartDate)),
  };
}

/** Précisions d'un élève : « né(e) le 03/05/2015, Galaxie vert » (vide si rien de connu). */
export function studentDetails(student: {
  birthDate: string | null;
  groups: readonly string[];
}): string {
  const parts: string[] = [];
  if (student.birthDate) parts.push(`né(e) le ${formatDate(student.birthDate)}`);
  if (student.groups.length > 0) parts.push(student.groups.join(", "));
  return parts.join(", ");
}

/**
 * Désignation d'un élève, avec date de naissance et groupes si demandé
 * (homonyme connu, confirmation de suppression) : « Martin Léa (né(e) le
 * 03/05/2015, Galaxie vert) ».
 */
export function describeStudent(
  student: {
    lastName: string;
    firstName: string;
    birthDate: string | null;
    groups: readonly string[];
  },
  withDetails = true,
): string {
  const name = `${student.lastName} ${student.firstName}`;
  const details = withDetails ? studentDetails(student) : "";
  return details ? `${name} (${details})` : name;
}

/** Clés de nom portées par plusieurs élèves d'une même liste (homonymes). */
export function homonymKeys(
  students: readonly { lastName: string; firstName: string }[],
): Set<string> {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const student of students) {
    const key = nameKey(student);
    if (seen.has(key)) repeated.add(key);
    seen.add(key);
  }
  return repeated;
}

/** « Un élève Martin Léa (né(e) le 03/05/2015, Galaxie vert) existe déjà » */
export function inSeasonDuplicateMessage(existing: StudentCandidate): string {
  return `Un élève ${describeStudent(existing)} existe déjà`;
}

/** « Léa Martin était inscrit(e) en 2025-2026. » */
export function pastSeasonDuplicateMessage(existing: StudentCandidate): string {
  return `${existing.firstName} ${existing.lastName} était inscrit(e) en ${existing.seasonName}.`;
}

/** Coordonnées reprises d'une fiche d'une saison passée (jamais les groupes). */
export interface ReusableDetails {
  phone: string;
  email: string | null;
  birthDate: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  levelId: string | null;
  fftRanking: string | null;
}

const REUSABLE_FIELDS = [
  "phone",
  "email",
  "birthDate",
  "guardianName",
  "guardianPhone",
  "levelId",
  "fftRanking",
] as const satisfies readonly (keyof ReusableDetails)[];

/**
 * Valeurs de formulaire après « Reprendre ses coordonnées » : téléphone,
 * e-mail, naissance, responsable légal, niveau et classement de la fiche
 * source remplacent la saisie lorsqu'ils sont connus ; le reste est gardé.
 */
export function reuseDetails<V extends Record<keyof ReusableDetails, string>>(
  values: V,
  source: ReusableDetails,
): V {
  const next = { ...values };
  // Liste fermée : la fiche source porte d'autres champs (nom, groupes…) jamais repris.
  for (const key of REUSABLE_FIELDS) {
    const value = source[key];
    if (typeof value === "string" && value.trim() !== "") next[key] = value as V[typeof key];
  }
  return next;
}

// ---------------------------------------------------------------------------
// Moniteurs (B2)
// ---------------------------------------------------------------------------

export interface InitialsOwner {
  initials: string;
  firstName: string;
  lastName: string;
}

export interface InitialsConflict {
  /** Moniteur qui porte déjà ces initiales. */
  owner: InitialsOwner;
  /** Initiales libres proposées (null si aucune proposition utile). */
  proposal: string | null;
  message: string;
}

/**
 * Initiales déjà prises par un autre moniteur de la saison :
 * « JM est déjà utilisé par Jean Martin. Utiliser JMo ? »
 */
export function initialsConflict(
  values: { initials: string; firstName: string; lastName: string },
  others: readonly InitialsOwner[],
): InitialsConflict | null {
  const typed = values.initials.trim();
  if (typed === "") return null;
  const owner = others.find((o) => o.initials.trim().toUpperCase() === typed.toUpperCase());
  if (!owner) return null;
  const suggested = suggestInitials(
    values.firstName,
    values.lastName,
    others.map((o) => o.initials),
  );
  const proposal =
    suggested !== "" && suggested.toUpperCase() !== typed.toUpperCase() ? suggested : null;
  const taken = `${typed} est déjà utilisé par ${owner.firstName} ${owner.lastName}.`;
  return { owner, proposal, message: proposal ? `${taken} Utiliser ${proposal} ?` : taken };
}

// ---------------------------------------------------------------------------
// Courts (B5)
// ---------------------------------------------------------------------------

/** Court de la saison portant déjà ce nom (sans casse ni accents), fiche éditée exclue. */
export function courtWithSameName<T extends { id: string; name: string }>(
  name: string,
  courts: readonly T[],
  excludeId?: string | null,
): T | null {
  const key = normalizeText(name);
  if (key === "") return null;
  return courts.find((c) => c.id !== excludeId && normalizeText(c.name) === key) ?? null;
}

/** « Un court « Court 2 » existe déjà » */
export function courtNameMessage(court: { name: string }): string {
  return `Un court « ${court.name} » existe déjà`;
}

// ---------------------------------------------------------------------------
// Tranche d'âge
// ---------------------------------------------------------------------------

export interface AgeRange {
  minAge: number | null;
  maxAge: number | null;
}

/** Tranche d'âge du groupe, ou null s'il n'en a pas (« 6–8 ans », « 18 ans et plus »…). */
export function ageRangeLabel(range: AgeRange): string | null {
  if (range.minAge !== null && range.maxAge !== null) return `${range.minAge}–${range.maxAge} ans`;
  if (range.minAge !== null) return `${range.minAge} ans et plus`;
  if (range.maxAge !== null) return `${range.maxAge} ans et moins`;
  return null;
}

/**
 * Le groupe est-il hors tranche pour cet élève ? Faux sans date de naissance
 * ou sans tranche. Âge calculé à la date de début de la saison.
 */
export function isOutOfAgeRange(
  range: AgeRange,
  birthDate: string | null | undefined,
  seasonStartDate: string,
): boolean {
  const date = knownDate(birthDate);
  return date !== null && !isInAgeRange(range, date, seasonStartDate);
}

/**
 * Avertissement d'un groupe hors tranche, ou null :
 * « Léa aura 11 ans, Galaxie vert est pour les 6–8 ans ».
 */
export function ageRangeWarning(
  student: { firstName: string; birthDate: string | null | undefined },
  group: AgeRange & { name: string },
  seasonStartDate: string,
): string | null {
  if (!isOutOfAgeRange(group, student.birthDate, seasonStartDate)) return null;
  const age = ageOn(student.birthDate as string, seasonStartDate);
  const who = student.firstName.trim() || "L'élève";
  return `${who} aura ${age} ans, ${group.name} est pour les ${ageRangeLabel(group)}`;
}
