/**
 * Guidage de la première utilisation (spec UX v1.1, docs/SPECS.md §4.5) : état des
 * étapes Saison, Courts, Moniteurs, Groupes, Élèves, puis premier cours,
 * calculé à partir des comptes de la saison consultée. Rien n'est mémorisé :
 * une étape est faite dès que la saison compte au moins un enregistrement, et
 * le guidage se clôt de lui-même au premier cours placé.
 */

export const GUIDANCE_STEPS = [
  "saison",
  "courts",
  "moniteurs",
  "groupes",
  "eleves",
  "planning",
] as const;

export type GuidanceStepKey = (typeof GUIDANCE_STEPS)[number];

/** Étapes saisies dans « Le club », avant le planning (pastilles des onglets, accueil). */
export const CLUB_STEPS: readonly GuidanceStepKey[] = GUIDANCE_STEPS.slice(0, -1);

/**
 * Étapes nécessaires pour placer un cours (court, moniteur, groupe) : tant
 * que l'une manque, l'accueil « Avant de construire le planning » occupe la page.
 */
const PLANNING_PREREQUISITES: readonly GuidanceStepKey[] = [
  "saison",
  "courts",
  "moniteurs",
  "groupes",
];

/** Comptes de la saison consultée. */
export interface SeasonCounts {
  courts: number;
  instructors: number;
  groups: number;
  students: number;
  lessons: number;
}

export interface GuidanceStep {
  key: GuidanceStepKey;
  /** Numéro d'ordre (1 pour la saison). */
  number: number;
  done: boolean;
}

export interface Guidance {
  /** Saison consultée, `null` si aucune saison n'a encore été créée. */
  seasonId: string | null;
  steps: readonly GuidanceStep[];
  /** Première étape à faire, `null` une fois tout fait. */
  next: GuidanceStepKey | null;
  /** Toutes les étapes faites, premier cours compris : le guidage disparaît. */
  complete: boolean;
  /** Court, moniteur et groupe saisis : un cours peut être placé. */
  planningReady: boolean;
}

const LABELS: Record<GuidanceStepKey, string> = {
  saison: "Saison",
  courts: "Courts",
  moniteurs: "Moniteurs",
  groupes: "Groupes",
  eleves: "Élèves",
  planning: "Planning",
};

/** Appel à l'action quand l'étape est la suivante (bouton de l'accueil). */
const ACTIONS: Record<GuidanceStepKey, string> = {
  saison: "Créer la saison",
  courts: "Ajouter vos courts",
  moniteurs: "Ajouter vos moniteurs",
  groupes: "Créer vos groupes",
  eleves: "Inscrire vos élèves",
  planning: "Placer un premier cours",
};

/** Confirmation affichée la première fois que l'étape est franchie. */
const DONE_MESSAGES: Record<GuidanceStepKey, string> = {
  saison: "Saison créée",
  courts: "Premier court ajouté",
  moniteurs: "Premier moniteur ajouté",
  groupes: "Premier groupe créé",
  eleves: "Premier élève inscrit",
  planning: "Premier cours placé",
};

export const stepLabel = (key: GuidanceStepKey): string => LABELS[key];
export const stepAction = (key: GuidanceStepKey): string => ACTIONS[key];
export const stepDoneMessage = (key: GuidanceStepKey): string => DONE_MESSAGES[key];

/** Libellé de l'action du toast vers l'étape suivante. */
export const nextStepLabel = (key: GuidanceStepKey): string => `Étape suivante : ${LABELS[key]}`;

function isDone(key: GuidanceStepKey, seasonId: string | null, counts: SeasonCounts | null) {
  if (!seasonId) return false;
  if (key === "saison") return true;
  if (!counts) return false;
  switch (key) {
    case "courts":
      return counts.courts > 0;
    case "moniteurs":
      return counts.instructors > 0;
    case "groupes":
      return counts.groups > 0;
    case "eleves":
      return counts.students > 0;
    case "planning":
      return counts.lessons > 0;
  }
}

/** État des étapes pour la saison consultée (`null` : aucune saison). */
export function guidanceOf(seasonId: string | null, counts: SeasonCounts | null): Guidance {
  const steps = GUIDANCE_STEPS.map((key, index) => ({
    key,
    number: index + 1,
    done: isDone(key, seasonId, counts),
  }));
  const doneKeys = new Set(steps.filter((s) => s.done).map((s) => s.key));
  const next = steps.find((s) => !s.done)?.key ?? null;
  return {
    seasonId,
    steps,
    next,
    complete: next === null,
    planningReady: PLANNING_PREREQUISITES.every((key) => doneKeys.has(key)),
  };
}

/** Deux états identiques (pour ne pas redessiner l'interface à chaque écriture). */
export function sameGuidance(a: Guidance | null, b: Guidance): boolean {
  return (
    a !== null &&
    a.seasonId === b.seasonId &&
    a.steps.every((step, index) => step.done === b.steps[index]?.done)
  );
}

/**
 * Étape franchie entre deux états, pour le toast « première fois » avec
 * « Étape suivante » ; `null` s'il n'y a rien à annoncer :
 *
 * - dans la même saison, exactement une étape vient d'être faite (plusieurs
 *   d'un coup : sauvegarde restaurée, données de test… rien n'est annoncé ;
 *   un import d'élèves ne franchit que l'étape Élèves et est annoncé) ;
 * - la première saison vient d'être créée (aucune saison avant, seule l'étape
 *   Saison faite après) ; changer de saison consultée n'annonce rien ;
 * - le premier cours n'est pas annoncé : le toast du planning (avec
 *   « Annuler cette action ») reste affiché, et le guidage disparaît ;
 * - une étape faite alors que le guidage est déjà complet n'est pas annoncée.
 */
export function crossedStep(before: Guidance | null, after: Guidance): GuidanceStepKey | null {
  if (!before || after.complete) return null;
  const fresh = after.steps.filter((step, index) => step.done && !before.steps[index]?.done);
  if (fresh.length !== 1) return null;
  const key = (fresh[0] as GuidanceStep).key;
  if (key === "planning") return null;
  if (before.seasonId === after.seasonId) return key;
  return before.seasonId === null && key === "saison" ? key : null;
}
