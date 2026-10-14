/**
 * Référentiel des niveaux (SPECS.md §3.5 bis) : liste ordonnée et modifiable,
 * pré-remplie à la création de la base (migration `0002_seed_levels`) avec
 * les niveaux Galaxie et des niveaux adultes.
 */
export const DEFAULT_LEVELS: readonly string[] = [
  "Galaxie blanc",
  "Galaxie violet",
  "Galaxie rouge",
  "Galaxie orange",
  "Galaxie vert",
  "Galaxie jaune",
  "Débutant",
  "Intermédiaire",
  "Confirmé",
  "Compétition",
];
