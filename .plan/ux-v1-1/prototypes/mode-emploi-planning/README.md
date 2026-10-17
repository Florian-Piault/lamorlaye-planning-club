# Prototype : mode d'emploi du planning

Ticket : [Mode d'emploi du planning](../../issues/10-mode-emploi-planning.md).

## Question

Que dit le mode d'emploi du planning, dans quel ordre, et comment se replie-t-il, en partant de « + Nouveau cours » plutôt que des gestes experts ?

## Variantes

- **A. Section repliable du panneau** : « Mode d'emploi » en tête du panneau latéral, ouvert tant qu'aucun cours n'est placé, replié ensuite ; repli mémorisé ; « Pour aller plus vite » replié à l'intérieur.
- **B. Bouton « Aide » + feuille** : bouton dans la barre d'outils, feuille flottante à deux colonnes « Les bases » / « Pour aller plus vite », ouverte d'elle-même la première fois sur un planning vide.
- **C. Astuce selon le contexte** : une astuce en tête du panneau qui change selon l'état (aucun cours, cours sélectionné, sinon), et un bouton « Tout le mode d'emploi » qui déplie le texte complet.

Commun aux trois : « Les bases » (numérotées, depuis « + Nouveau cours »), « Pour aller plus vite » (gestes et raccourcis, Ctrl ou ⌘ selon le système), vocabulaire du ticket [Vocabulaire et bulles d'aide](../../issues/09-vocabulaire-et-bulles.md).

## Verdict

**Variante C** retenue (16/10/2026), avec un bouton « Tout le mode d'emploi » qui se voit cliquable (icône livre, chevron, bordure). Détail dans la réponse du ticket.

## Relancer

```bash
git apply .plan/ux-v1-1/prototypes/mode-emploi-planning/montage.patch
mkdir -p src/features/help-prototype
cp .plan/ux-v1-1/prototypes/mode-emploi-planning/HelpPrototype.tsx src/features/help-prototype/
pnpm dev
```

Ouvrir http://localhost:1420/?variant=C#/planning, cliquer « Données de démo » dans la barre rose (base en mémoire en navigateur). Alt+←/→ change de variante ; « Simuler : aucun cours » montre l'état de première utilisation.
