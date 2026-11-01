# Découpage des disponibilités des élèves en lots

> Référence : [spec](spec.md) — 01/11/2026

## Principes

- Chaque lot laisse une application qui démarre et apporte quelque chose d'utilisable ou de vérifiable.
- **Commande de vérification** : un lot est terminé quand `pnpm check` passe en local (lint, typecheck, Vitest, Playwright).
- **Points de test** (spec, « Testing Decisions ») :
  - Les **parcours Playwright** couvrent ce qui se voit. Les données se posent par `seedPlanning` (`src/test/e2e.ts`), étendu en L17 pour accepter des plages par élève. Les aides vont dans `e2e/support/`.
  - Les **tests unitaires existants** de `conflicts`, `seasonDuplication` et `rgpd` reçoivent les nouveaux cas.
  - Pas de nouveau fichier de test unitaire dédié. La compatibilité d'un élève avec un groupe est testée dans le test existant de `availability` (ajouté en L17). Seule exception, en L20 : `src/features/referentiels/groupes/composition.test.ts`, pour la présentation de la composition (version des cours en vigueur, tri avant la coupe, alerte) ; le calcul de l'ombrage est prouvé par les parcours de la grille.
- **Règles avant écrans.** L17 pose le schéma, le dépôt, la règle « sans plage = disponible partout » et le 7e contrôle de conflit. Les lots d'écran ne touchent ensuite ni au schéma, ni au domaine, ni au store du planning. Cela les garde sur des fichiers disjoints.
- **Isolation** : chaque copie de travail lance ses e2e sur son propre `E2E_PORT`. Les tests ne touchent jamais la base réelle du poste.
- Chaque lot amende la section de `docs/SPECS.md` qu'il touche, ainsi que la traçabilité (`docs/TRACABILITE*.md`). Un lot qui s'écarte de la spec amende aussi `spec.md` dans le même commit.
- Ids de lot uniques dans le dépôt : commits `feat: L<n> — <Titre>`. Les lots déjà livrés vont de L0 à L16, ce découpage commence donc à L17.
- Taille relative : **S** (quelques jours), **M** (environ 1 semaine), **L** (environ 2 semaines).

## Vue d'ensemble

```
            ┌──► L18 Saisie dans la fiche ──► L19 Liste et saisie en série ──┐
L17 Règles ─┼──► L20 Composition des groupes ────────────────────────────────┼──► L22 Finitions
et données  └──► L21 Ombrage pendant le glisser ─────────────────────────────┘
```

| Lot | Contenu | Taille | Dépend de |
|---|---|---|---|
| L17 | Règles et données des disponibilités d'élève | M | — |
| L18 | Saisie dans la fiche élève | S | L17 |
| L19 | Liste des élèves et saisie en série | M | L18 |
| L20 | Aide à la composition des groupes | S | L17 |
| L21 | Ombrage pendant le glisser | M | L17 |
| L22 | Finitions | S | tous |

Vagues possibles :

1. L17 seul.
2. **L18**, **L20** et **L21** en parallèle. Ils touchent respectivement la fiche élève et la frise des moniteurs, la page du groupe, et les gestes de la grille.
3. L19, en série après L18 parce qu'il réutilise la section de disponibilités créée en L18.
4. L22.

`docs/SPECS.md` est touché par tous les lots, mais chacun n'édite que sa section. Les conflits de fusion restent locaux.

---

## L17 — Règles et données des disponibilités d'élève (M)

**Objectif** : les plages des élèves existent en base et le planning signale les cours où des élèves ne sont pas disponibles. Spec : user stories 28 à 35 et 42 à 45 ; « Implementation Decisions » : Schéma, Règle de disponibilité, Contrôle de conflit, Compatibilité, Duplication, RGPD et sauvegarde.

- **Migration** : nouvelle table des plages hebdomadaires d'élève (élève, jour 1 à 7, début, fin), calquée sur celle des moniteurs, dépendant de l'élève avec `ON DELETE CASCADE`. Aucune table existante n'est recréée. Mise à jour du schéma Drizzle et du snapshot.
- **Dépôt élèves** : lecture des plages d'un élève et de celles de la saison, remplacement des plages d'un élève (fusionnées par jour avant écriture, comme pour les moniteurs). Indicateur « renseignées » disponible pour la liste.
- **Domaine** :
  - La règle de couverture partagée avec les moniteurs s'applique aux élèves, avec la différence qu'un élève sans plage est disponible partout.
  - Fonction de compatibilité d'un élève avec les cours d'un groupe : elle donne les cours fautifs, et un groupe sans cours rend tout le monde compatible.
  - Fonction qui compte, pour un groupe, les élèves indisponibles sur un créneau. L20 et L21 s'en servent.
- **7e contrôle** dans `conflicts` : « élèves hors disponibilités ».
  - Il produit un seul conflit par créneau, avec le nombre d'élèves et leur liste.
  - Il s'applique aux cours du planning habituel et aux séances actives d'une semaine précise, y compris les séances modifiées et les cours ponctuels.
  - Une séance annulée est ignorée.
- **Store du planning** : charge les plages des élèves de la saison pour les contrôles. Le message s'affiche dans la fiche du cours au survol (avec les noms) et dans le panneau « Avertissements », avec la navigation existante.
- **Duplication de saison** : les plages sont recopiées avec les élèves.
- **RGPD** : l'export d'un élève contient ses plages, et la suppression définitive les emporte (par la cascade).
- **Aides de test** : `seedPlanning` accepte des plages par élève.
- `docs/SPECS.md` : glossaire (« Plage » étendue aux élèves), §3.5, §7 (nouvelle ligne du tableau), §11.6.

**Critères d'acceptation**
- Vitest (`conflicts`) :
  - un cours qui déborde d'une plage d'élève, même partiellement, produit un conflit ;
  - un cours couvert n'en produit pas ;
  - un élève sans plage n'en produit jamais ;
  - trois élèves indisponibles donnent un seul conflit qui les liste tous les trois ;
  - une séance annulée ne produit rien ;
  - un cours ponctuel hors plage produit le conflit.
- Vitest (`seasonDuplication`) : les plages d'un élève se retrouvent sur sa copie dans la nouvelle saison.
- Vitest (`rgpd`) : l'export d'un élève contient ses plages ; après suppression définitive, la saison ne contient plus aucune plage pour lui.
- Playwright (`seedPlanning` avec plages) : sur le planning habituel, le cours d'un groupe dont deux élèves ne sont disponibles que le samedi porte l'avertissement « 2 élèves hors disponibilités ». Le panneau « Avertissements » le liste, et la fiche au survol nomme les deux élèves.
- Playwright : sans aucune plage saisie, la grille du jeu de démonstration n'affiche aucun avertissement de ce type.

## L18 — Saisie dans la fiche élève (S)

**Objectif** : le responsable saisit et efface les disponibilités d'un élève depuis sa fiche. Spec : user stories 1 à 9 ; « Implementation Decisions » : Saisie, Vocabulaire.

- La frise des moniteurs devient un composant partagé qui ne connaît pas le type de personne (plages en entrée, plages en sortie). Le comportement côté moniteur ne change pas.
- Section « Disponible chaque semaine » dans la fiche élève, avec un texte d'état quand il n'y a aucune plage (« Aucun horaire : considéré disponible partout ») et une action pour tout effacer.
- Les plages s'enregistrent avec la fiche, sous la garde de saisie commune (confirmation à la fermeture si quelque chose a changé), et passent par l'historique annuler / rétablir.
- Lecture seule pour une saison terminée.
- `docs/SPECS.md` §3.5 et §8 : la fiche élève et sa section.

**Critères d'acceptation**
- Playwright :
  - poser une plage le mercredi de 14 h à 18 h puis enregistrer : elle est là à la réouverture ;
  - deux plages contiguës du même jour s'affichent fusionnées ;
  - « tout effacer » puis enregistrer : le texte « considéré disponible partout » réapparaît ;
  - fermer après une modification demande confirmation ;
  - annuler restaure les plages précédentes.
- Playwright : la saisie des disponibilités d'un moniteur se comporte comme avant (les parcours existants de `referentiels.spec.ts` passent sans changement).
- Playwright : la fiche d'un élève d'une saison terminée montre ses plages sans pouvoir les modifier.

## L19 — Liste des élèves et saisie en série (M)

**Objectif** : le responsable voit qui n'a pas de disponibilités et les saisit à la chaîne. Spec : user stories 10 à 20 ; « Implementation Decisions » : Liste des élèves, Saisie en série.

- **Liste** :
  - colonne « Disponibilités » (renseignées ou non) ;
  - filtre « Disponibilités non renseignées », combinable à la recherche et aux filtres existants.
- **Saisie en série** :
  - Un bouton de la liste la lance sur la liste telle qu'elle est filtrée à ce moment.
  - La fenêtre réutilise la section de L18 et affiche le nom de l'élève, ses groupes et la progression « n / N ».
  - Trois actions : « Enregistrer et suivant », « Passer » et « Terminer ».
  - Un toast de fin s'affiche après le dernier élève, et l'arrêt en cours de route conserve ce qui est déjà enregistré.
  - Tout se fait au clavier.
- `docs/SPECS.md` §8 : liste des élèves et saisie en série.

**Critères d'acceptation**
- Playwright (élèves posés par `seedPlanning`, certains avec des plages) :
  - le filtre « non renseignées » ne montre que les élèves sans plage ;
  - la série démarre sur le premier d'entre eux et affiche « 1 / N » ;
  - « Enregistrer et suivant » enregistre et passe au suivant ;
  - « Passer » n'enregistre rien ;
  - après le dernier élève, un toast confirme la fin ;
  - de retour sur la liste, les élèves saisis ne sont plus dans le filtre.
- Playwright : « Terminer » au milieu de la série garde les plages déjà enregistrées.
- Playwright : la série se parcourt au clavier, sans souris.

## L20 — Aide à la composition des groupes (S)

**Objectif** : en composant un groupe, le responsable voit d'abord les élèves disponibles pour ses cours. Spec : user stories 21 à 27 ; « Implementation Decisions » : Composition, Compatibilité.

- Dans la recherche d'élèves à ajouter, les compatibles passent en tête, dans l'ordre actuel à l'intérieur de chaque catégorie.
- Les incompatibles portent un badge « hors disponibilités », avec en bulle le cours qui coince (jour et heure). L'ajout reste possible.
- Dans « Élèves du groupe », les membres incompatibles sont signalés à côté des alertes d'âge et d'effectif existantes, dans la zone de message réservée.
- `docs/SPECS.md` §8 : composition d'un groupe.

**Critères d'acceptation**
- Playwright : un groupe a un cours le mercredi de 14 h à 15 h. Parmi les candidats, l'élève disponible le mercredi après-midi et l'élève sans plage apparaissent avant l'élève disponible seulement le samedi, qui porte le badge. Sa bulle cite « mercredi 14:00 ».
- Playwright : l'élève incompatible peut être ajouté ; il est alors signalé dans « Élèves du groupe », et les boutons ne bougent pas.
- Playwright : sur un groupe sans cours, aucun candidat ne porte le badge.

## L21 — Ombrage pendant le glisser (M)

**Objectif** : en déplaçant ou en créant un cours, le responsable voit quels créneaux gênent des élèves du groupe. Spec : user stories 36 à 41 ; « Implementation Decisions » : Ombrage de la grille.

- Pendant le déplacement d'un cours, ou la création d'un cours pour un groupe déjà choisi, les créneaux visibles où des élèves du groupe sont indisponibles sont ombrés. L'intensité dépend du nombre d'élèves, par paliers.
- Cet ombrage se distingue visuellement des hachures du moniteur (§4.4), et les deux peuvent s'afficher ensemble.
- L'ombrage disparaît à la fin du geste.
- Le calcul se fait une fois par geste, pas à chaque mouvement du pointeur.
- `docs/SPECS.md` §4.4 : ombrage des élèves.

**Critères d'acceptation**
- Playwright : pendant le glisser d'un cours dont un élève n'est disponible que le mercredi, la colonne du jeudi est ombrée et celle du mercredi ne l'est pas. Avec trois élèves indisponibles, le palier est plus foncé qu'avec un seul. Au relâchement, plus aucun créneau n'est ombré.
- Playwright : l'ombrage n'est pas une hachure (classe ou attribut distinct), et il coexiste avec les hachures du moniteur pendant le même geste.
- Mesure dans `e2e/charge.perf.spec.ts` sur `seedVolume` avec des plages d'élève : la fluidité du glisser reste sous le seuil `perfLimit` existant.

## L22 — Finitions (S)

**Objectif** : la fonction est documentée et prête à livrer. Spec : « Further Notes ».

- `docs/CHANGELOG.md` : entrée pour les disponibilités des élèves.
- `docs/DEMARRAGE-RAPIDE.md` : un paragraphe sur la saisie (fiche, saisie en série), en signalant qu'un élève sans plage est disponible partout.
- `docs/TRACABILITE*.md` : chaque user story relevée avec le test qui la prouve.
- `docs/RECETTE.md` : recette manuelle de la sauvegarde puis de la restauration d'une base contenant des plages d'élève (parcours Tauri).
- Revue de cohérence des libellés avec le glossaire.

**Vérification à la main**
- Saisir les plages de trois élèves d'un même groupe, en série, puis déplacer leur cours : l'ombrage guide vers un créneau commun, et l'avertissement disparaît une fois le cours bien placé.
- Exporter une sauvegarde, la restaurer : les plages sont toujours là.
- `pnpm check` passe.

## Risques

- **Pas de test unitaire de l'ombrage** (choix de la spec) : L21 en dépend. La compatibilité, elle, est testée en Vitest dans `availability` depuis L17. `docs/CODING_STANDARDS.md` demande que la logique qui mérite un test soit une fonction pure testée en Vitest. Si les e2e de L21 deviennent fragiles ou lents à diagnostiquer, il faut ajouter les cas aux tests de `conflicts` ou de `availability` existants et amender la spec.
- **Performance de l'ombrage** (L21) : un groupe complet sur une semaine visible, avec 300 élèves en base, recalculé pendant le glisser. Le précalcul une fois par geste est la parade. Si le seuil n'est pas tenu, on se replie sur un ombrage par colonne de jour plutôt que par créneau.
- **Frise partagée** (L18) : rendre la frise indépendante du type de personne peut régresser la saisie des moniteurs. Les parcours existants de `referentiels.spec.ts` font barrière ; L18 ne doit pas toucher à leurs attentes.
- **Bruit d'avertissements à la mise en service** (L17) : la règle « sans plage = disponible » l'évite. Un test e2e vérifie qu'aucun nouvel avertissement n'apparaît sans saisie.
