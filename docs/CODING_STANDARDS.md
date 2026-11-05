# Règles de relecture

Règles de jugement appliquées à chaque diff relu. Les règles mécaniques sont dans `biome.json` et `biome-plugins/` : `pnpm lint` les vérifie.

## Tests

- **Deux points de test.** Les parcours Playwright (`e2e/`) couvrent ce qui se voit. Les fonctions pures, testées en Vitest, couvrent les règles. La logique d'un composant qui mérite un test est extraite en fonction pure (exemples : `src/components/feedback/suggestion.ts`, `src/features/planning/hoverCard.ts`).
- **Le test suit le critère d'acceptation.** Il décrit le comportement attendu par la spec ou le lot, pas celui que le code livre. Quand un test échoue sur un comportement voulu, le code est faux, sauf si la spec a changé, et alors `docs/SPECS.md` change avec le test.
- **Chaque assertion peut échouer.** Une assertion vraie quel que soit le code (`toBeGreaterThanOrEqual(0)`, compte d'éléments jamais provoqué, contrôle sur une liste vide, hauteur d'un élément de hauteur fixe) ne prouve rien. Chaque action (`fill`, `click`) est suivie de l'`expect` qui prouve son effet.
- **Les aides de test échouent sur zéro élément.** Une aide qui parcourt des éléments (`e2e/support/a11y.ts`) vérifie d'abord qu'elle en a trouvé.
- **Une absence se prouve après le délai réel.** Pour montrer qu'un élément n'apparaît pas, on avance `page.clock` ou on attend le délai réel de l'interface, en le justifiant par `biome-ignore`.
- **Les mesures de temps vont dans les `*.perf.*`**, avec des seuils exprimés par `perfLimit` (`src/test/perf.ts`).

## Accessibilité

- **Le nom accessible commence par le texte visible** (WCAG 2.5.3). `aria-label` complète le libellé affiché, il ne le remplace pas.
- **Chaque message apparu est annoncé une seule fois** : zone `aria-live` ou `role="status"`, pas de double annonce par la bulle et par la zone.
- **Le focus survit aux changements d'écran.** Après une fermeture, une suppression ou un nouveau rendu, il revient sur un élément logique : le déclencheur, ou l'élément suivant.
- **Échap ferme d'abord le sous-élément le plus récent** (bulle, menu, fiche), avec `preventDefault`. Un gestionnaire parent respecte `event.defaultPrevented`.
- **Bulles d'aide** : composant `Tooltip` (`src/components/ui/tooltip.tsx`), avec `describe={false}` quand le texte est déjà annoncé.

## Interface

- **Rien ne bouge sous le curseur.** Un contenu de hauteur variable (message, astuce, erreur) occupe une place réservée ou s'affiche en surimpression.
- **Les libellés affichés suivent le glossaire** de `docs/SPECS.md` §2.
- **Les messages passent par les composants communs** : `Toast`, `MessageZone` et `messages.ts` (`src/components/feedback/`). Un toast avec une action reste ouvert pendant cette action.

## Documentation

- **Chaque lot amende `docs/SPECS.md`** à la section qu'il touche, et la traçabilité (`docs/TRACABILITE*.md`) cite les tests qui prouvent chaque exigence. `pnpm check:trace` vérifie que les tests cités existent ; la relecture juge s'ils prouvent bien l'exigence.
- **Les parcours propres à Tauri** (dialogues de fichiers, commandes Rust), hors d'atteinte de Playwright, ont une ligne de recette manuelle dans `docs/RECETTE.md`.
