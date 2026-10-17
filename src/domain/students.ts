/**
 * Règles de la fiche élève communes à la saisie, à l'import et aux listes
 * (docs/SPECS.md §3.5 ; spec UX v1.1 « Saisie en volume ») :
 *
 * - téléphone : au moins un des deux, celui de l'élève **ou** celui du
 *   responsable légal ; les listes affichent celui de l'élève, sinon celui du
 *   responsable suivi de « (resp.) » ;
 * - niveau proposé depuis le premier groupe coché, tant que l'utilisatrice ne
 *   l'a pas choisi (même modèle que les initiales suggérées) ;
 * - « Créer « Léa Martin » » depuis la recherche de la fiche groupe : prénom
 *   et nom découpés dans le texte saisi.
 */

/** Message de la règle du téléphone (fiche et import). */
export const MISSING_PHONE_MESSAGE =
  "Renseignez le téléphone de l'élève ou celui du responsable légal.";

export interface StudentPhones {
  phone: string | null | undefined;
  guardianPhone: string | null | undefined;
}

const filled = (value: string | null | undefined): value is string =>
  typeof value === "string" && value.trim() !== "";

/** L'élève peut-il être joint : téléphone de l'élève ou du responsable légal ? */
export function hasContactPhone(student: StudentPhones): boolean {
  return filled(student.phone) || filled(student.guardianPhone);
}

/** Numéro à appeler : celui de l'élève, sinon celui du responsable légal. */
export function contactPhone(student: StudentPhones): { number: string; guardian: boolean } | null {
  if (filled(student.phone)) return { number: student.phone.trim(), guardian: false };
  if (filled(student.guardianPhone)) {
    return { number: student.guardianPhone.trim(), guardian: true };
  }
  return null;
}

/** Téléphone affiché dans les listes : « 06 11 22 33 44 », « 06 99 88 77 66 (resp.) » ou « — ». */
export function formatContactPhone(student: StudentPhones): string {
  const contact = contactPhone(student);
  if (!contact) return "—";
  return contact.guardian ? `${contact.number} (resp.)` : contact.number;
}

/**
 * Niveau proposé : celui du premier groupe coché (dans l'ordre des coches)
 * qui en a un ; `null` si aucun.
 */
export function suggestLevel(
  groupIds: readonly string[],
  groups: readonly { id: string; levelId: string | null }[],
): string | null {
  const byId = new Map(groups.map((g) => [g.id, g.levelId]));
  for (const id of groupIds) {
    const levelId = byId.get(id);
    if (levelId) return levelId;
  }
  return null;
}

/**
 * Prénom et nom d'un texte saisi « Léa Martin » : le premier mot est le
 * prénom, le reste le nom (« Léa De la Tour » → Léa / De la Tour). Un seul
 * mot donne le prénom.
 */
export function splitFullName(text: string): { firstName: string; lastName: string } {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const [firstName = "", ...rest] = words;
  return { firstName, lastName: rest.join(" ") };
}
