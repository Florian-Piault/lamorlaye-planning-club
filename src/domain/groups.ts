/**
 * Âge des élèves et alertes de composition des groupes (docs/SPECS.md §3.4, §7, §8).
 */

/** Âge en années révolues à la date de référence (`AAAA-MM-JJ`). */
export function ageOn(birthDate: string, referenceDate: string): number {
  const [by = 0, bm = 0, bd = 0] = birthDate.split("-").map(Number);
  const [ry = 0, rm = 0, rd = 0] = referenceDate.split("-").map(Number);
  const hadBirthday = rm > bm || (rm === bm && rd >= bd);
  return ry - by - (hadBirthday ? 0 : 1);
}

export function isMinor(birthDate: string | null | undefined, referenceDate: string): boolean {
  return Boolean(birthDate) && ageOn(birthDate as string, referenceDate) < 18;
}

export interface GroupLimits {
  maxSize: number;
  minAge: number | null;
  maxAge: number | null;
}

export interface GroupMember {
  birthDate: string | null;
}

export interface GroupAlerts {
  size: number;
  overCapacity: boolean;
  /** Nombre d'élèves dont l'âge est hors de la tranche du groupe. */
  outOfAgeRange: number;
  messages: string[];
}

/** L'âge est-il dans la tranche du groupe ? (vrai si la date de naissance est inconnue) */
export function isInAgeRange(
  limits: Pick<GroupLimits, "minAge" | "maxAge">,
  birthDate: string | null,
  referenceDate: string,
): boolean {
  if (!birthDate) return true;
  const age = ageOn(birthDate, referenceDate);
  if (limits.minAge !== null && age < limits.minAge) return false;
  if (limits.maxAge !== null && age > limits.maxAge) return false;
  return true;
}

/**
 * Alertes d'un groupe : effectif supérieur au maximum (« 9 / 8 élèves ») et
 * élèves hors tranche d'âge (« 1 élève hors tranche d'âge »). L'âge est
 * calculé à la date de référence (en pratique, le début de la saison).
 */
export function groupAlerts(
  limits: GroupLimits,
  members: readonly GroupMember[],
  referenceDate: string,
): GroupAlerts {
  const size = members.length;
  const overCapacity = size > limits.maxSize;
  const outOfAgeRange = members.filter(
    (m) => !isInAgeRange(limits, m.birthDate, referenceDate),
  ).length;
  const messages: string[] = [];
  if (overCapacity) messages.push(`${size} / ${limits.maxSize} élèves`);
  if (outOfAgeRange > 0) {
    messages.push(
      outOfAgeRange === 1
        ? "1 élève hors tranche d'âge"
        : `${outOfAgeRange} élèves hors tranche d'âge`,
    );
  }
  return { size, overCapacity, outOfAgeRange, messages };
}

/** « 6–8 ans », « 18 ans et plus », « jusqu'à 10 ans », ou « Tous âges ». */
export function describeAgeRange(minAge: number | null, maxAge: number | null): string {
  if (minAge !== null && maxAge !== null) return `${minAge}–${maxAge} ans`;
  if (minAge !== null) return `${minAge} ans et plus`;
  if (maxAge !== null) return `jusqu'à ${maxAge} ans`;
  return "Tous âges";
}
