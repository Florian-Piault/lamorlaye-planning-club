# Prototype : lisibilité de la grille

Ticket : [Lisibilité de la grille](../../issues/12-lisibilite-grille.md).

## Question

Comment rendre la grille du planning lisible quand elle est dense ou la fenêtre étroite (960 px) : cartes tronquées, dimanche caché, défilement horizontal ?

## Variantes

Premier tour, trois approches :

- **A. Tout tient en largeur** : la semaine entière sans défilement, contenu des cours adapté à la place (nom, abrégé, initiales, couleur seule).
- **B. Un jour à la fois** : bascule « Semaine / Jour », bande des jours avec le nombre de cours, en-tête de jour cliquable.
- **C. Zoom et accès aux jours** : la semaine défile, bande des jours qui amène au jour voulu, loupe à trois tailles, panneau latéral repliable.

Deuxième tour, base B + panneau repliable de C :

- **D. Tout repliable** : menu de l'application réductible aux icônes, filtres derrière un bouton « Filtres ».
- **E. Une seule barre** : barre haute masquée sur le Planning (saison dans l'en-tête), titre masqué, Annuler / Rétablir / PDF en icônes, filtres en menu déroulant, pastilles moniteurs réduites au prénom, bandeau de mode sur une ligne fine.
- **F. Plein écran** : un bouton masque menu, barre haute, filtres et panneau.

Troisième tour, base E, rail du panneau replié retiré ; place de la navigation des semaines datées :

- **G. Dans la barre des jours**, avant « Semaine / Jour ».
- **H. Dans le bandeau de mode**.
- **I. Flèches dans le choix du mode**, date et « Aujourd'hui » dans un menu.

Commun à toutes : en-têtes de courts au vrai nom (abrégé si étroit) avec icône soleil / maison et légende « couvert · extérieur », fiche complète du cours au survol à la place du `title` natif.

## Verdict

**Variante G** retenue (16/10/2026) : E (une seule barre, menu réductible, panneau repliable sans rail) avec la navigation des semaines dans la barre des jours. Détail dans la réponse du ticket.

## Relancer

```bash
git apply .plan/ux-v1-1/prototypes/lisibilite-grille/montage.patch
mkdir -p src/features/grid-prototype
cp .plan/ux-v1-1/prototypes/lisibilite-grille/GridPrototype.tsx src/features/grid-prototype/
pnpm dev
```

Ouvrir http://localhost:1420/?variant=G#/planning, cliquer « Données denses » dans la barre rose (5 courts, 4 moniteurs, ~70 cours sur 7 jours ; base en mémoire, perdue au rechargement). Changer de variante par les flèches de la barre rose ou Alt+←/→, pas en rechargeant la page. Fenêtre à 960 px pour retrouver le cas du ticket.
