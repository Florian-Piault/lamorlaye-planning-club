# Prototype — thème, couleurs et barre latérale

## Question

Le thème shadcn d'origine est sobre : à quoi doivent ressembler la coque de
l'application (barre latérale, en-têtes de page) et la palette pour un rendu
plus travaillé ?

## Itérations

1. **A Club house** (sidebar vert gazon pleine hauteur), **B Terre battue**
   (panneaux flottants, fond sable), **C Court central** (rail d'icônes +
   barre haute). Retour : panneaux flottants de B et barre haute de C
   appréciés ; boutons de B trop arrondis ; couleurs « bof », C la moins
   mauvaise. Fichiers : `iteration-1/`.
2. Structure commune panneaux flottants + barre haute, angles resserrés
   (6 px boutons, 12 px panneaux) : **D Court bleu**, **E Graphite & sapin**
   (barre haute pleine largeur), **F Aubergine & sauge**. Fichiers :
   `iteration-2.patch`.

## Verdict

- Disposition de **F** : panneaux flottants, barre haute (fil d'Ariane +
  saison) en tête du panneau de contenu, entrée active pleine couleur.
- Couleurs de **D** : gris froid, panneaux blancs, bleu court en primaire,
  jaune balle réservé à la pastille de saison active.
- Pas de point sur l'entrée active de la navigation.

Intégré dans `src/index.css`, `src/components/layout/AppShell.tsx` et
`src/components/layout/Page.tsx`.

## Relancer

Depuis le commit qui précède l'intégration (parent du commit ajoutant ce
dossier) :

```bash
git apply .plan/theme-visuel/prototypes/theme-sidebar/iteration-2.patch
pnpm dev
```

Puis `http://localhost:1420/#/planning?variant=D` (`0`, `D`, `E`, `F` ; ←/→
pour basculer). Pour l'itération 1, remplacer les deux fichiers
`AppShell.prototype.*` par ceux de `iteration-1/` et brancher
`ShellA/B/C` dans `AppShell.tsx`.

Base de démo (en mémoire, perdue au rechargement) : créer la saison dans
Référentiels, puis dans la console
`await (await import("/src/test/e2e.ts")).seedVolume()`.
