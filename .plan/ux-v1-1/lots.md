# Découpage de la v1.1 en lots

> Référence : [spec UX v1.1](spec.md) et `docs/SPECS.md` amendé — 16/10/2026

## Principes

- Mêmes principes que [lots de la V1](../v1/lots.md) : chaque lot laisse une application utilisable, règles du domaine testées (Vitest) avant l'interface qui les utilise.
- La CI automatique est suspendue : un lot est terminé quand `pnpm lint`, `pnpm typecheck`, `pnpm test` et `pnpm test:e2e` passent en local.
- Deux points de test seulement : parcours Playwright pour ce qui se voit, fonctions pures du domaine pour les règles. Pas de tests de composants isolés. Les tests qui figent l'ancien comportement sont mis à jour, pas contournés.
- Chaque lot amende la section de `docs/SPECS.md` qu'il touche.
- Chaque chantier est jugé avec les deux profils : rien de ce qui aide la débutante ne ralentit l'experte.
- Taille relative : **S** (quelques jours), **M** (environ 1 semaine), **L** (environ 2 semaines).

## Vue d'ensemble

```
L9 Socle ──┬──► L10 Vocabulaire ──► L14 Grille ──► L15 Guidage ──┐
           ├──► L11 Disponibilités et moniteurs ─────────────────┼──► L16 Release 1.1
           └──► L12 Doublons et âge ──► L13 Saisie en volume ─────┘
```

| Lot | Contenu | Taille | Dépend de | Bugs |
|---|---|---|---|---|
| L9 | Socle UX commun | M | — | B3, B7, B10, B11, B12 |
| L10 | Vocabulaire et bulles d'aide | M | L9 | |
| L11 | Disponibilités, moniteurs et fermetures | S | L9 | B6, B8, B9 |
| L12 | Doublons et alerte d'âge | M | L9 | B1, B2, B5 |
| L13 | Saisie des élèves en volume | M | L12 | |
| L14 | Lisibilité de la grille | L | L9, L10 | |
| L15 | Guidage et mode d'emploi | M | L10, L14 | B4 |
| L16 | Finitions et release 1.1 | S | tous | |

Après L9, trois branches indépendantes : L10 → L14 → L15, L11, L12 → L13. L11 et L12 ne touchent pas les mêmes écrans et peuvent avancer en parallèle de L10.

---

## L9 — Socle UX commun (M)

**Objectif** : plus rien ne bouge sous le curseur, les modales se comportent bien. Spec : « Composants communs ».

- **Zone de message réservée** : deux lignes toujours réservées, erreur générale en tête et en rouge, « + N autres avertissements » dépliable. Remplace le bloc d'erreur générale des formulaires ; branchée sur « Élève mineur… », les avertissements du créneau du panneau de cours et les compteurs de la fiche groupe.
- **Toast commun** : en bas à droite, un seul à la fois, succès ~4 s avec pause au survol, erreurs persistantes, `aria-live`, action facultative. Remplace le toast du planning, son bandeau d'erreur et les succès en ligne (« Modifications enregistrées. », messages au-dessus des tableaux).
- **B11** : création de saison confirmée par « Saison « X » créée », rechargement attendu.
- **Garde de modale** dans le composant de fenêtre commun et le panneau de cours : focus initial (B3), Échap en cascade, confirmation « Abandonner les modifications ? » seulement si la saisie a changé, y compris au changement de créneau du panneau.
- **Raison de bouton grisé** sur le bouton commun ; branchée sur « Ajouter un horaire », aperçu PDF, navigation des semaines, « Effacer les filtres ».
- **Éléments toujours présents** : « Effacer les filtres » grisé, résultats de recherche de la fiche groupe en liste superposée.
- **Barre de mode du planning à hauteur fixe** (B7) : informations en pastilles courtes, détail en bulle.
- **Tooltip commun** (survol ~300 ms et focus clavier) et **touches selon le système** (Ctrl/⌘, Alt/⌥, Suppr/⌫).
- **B10** : aide commune qui efface l'erreur d'un champ dès qu'il change, dans les sept formulaires.
- **B12** : lien explicite case à cocher / libellé dans le composant de saisie commun.

**Critères d'acceptation**
- Playwright : la position de « Créer le cours », des boutons du formulaire élève et du tableau de la fiche groupe ne change pas quand un avertissement apparaît ou au survol d'un cours.
- Playwright : focus sur le premier champ à l'ouverture des modales ; Échap dans un sélecteur de date ne ferme pas la modale ; fermeture directe si rien n'a changé, confirmation sinon.
- Les cases à cocher sont annoncées par leur libellé ; les toasts sont dans une région `aria-live`.

## L10 — Vocabulaire et bulles d'aide (M)

**Objectif** : l'application parle la langue du club. Spec : « Vocabulaire » ; détail dans [Vocabulaire et bulles d'aide](issues/09-vocabulaire-et-bulles.md) et l'[inventaire](issues/04-inventaire-jargon.md).

- « Planning habituel » / « Une semaine précise » (nommée par sa date), phrase de portée toujours visible dans la barre de mode.
- Plus d'« exception » ni d'« occurrence » à l'écran ; pastille « N cours changent plus tard dans la saison ».
- « Le club », « En cours / Terminée / Affichée », « Consultation seulement (saison terminée) », « horaire de disponibilité », et les libellés adoptés de l'inventaire.
- Tooltip commun sur tout bouton icône, à la place des `title` natifs ; libellé visible pour « Données personnelles » et « Retirer ».
- Section repliée « Détails techniques » sur Réglages, sauvegarde, RGPD et Import/Export ; « Exporter vers Excel » en bouton principal.
- `docs/SPECS.md` §2 : colonne « Libellé affiché » et termes manquants.

**Critères d'acceptation**
- Aucun des termes retirés n'apparaît dans l'interface (recherche dans le texte rendu des écrans principaux).
- Playwright : chaque bouton icône a un nom accessible et une bulle atteignable au clavier.

## L11 — Disponibilités, moniteurs et fermetures (S)

**Objectif** : corriger les bugs aux règles arbitrées. Spec : « Corrections de bugs » ; règles dans [Arbitrages métier des bugs](issues/13-arbitrages-bugs-metier.md). `docs/SPECS.md` §3.3, §3.8, §5.1 déjà amendés.

- **B6** : fin d'une plage glissée à la limite de case la plus proche du pointeur.
- **Frise** : seuil de glisser ; un clic simple pré-remplit le formulaire (case vide : heure + 1 h, « Ajouter » ; case disponible : plage entière, « Ajouter » et « Retirer »).
- Toast avec « Annuler » après chaque changement de disponibilité enregistré.
- **B8** : le moniteur du panneau passe avant le survol pour les hachures.
- **« Nouveau cours »** : trois groupes Disponibles / Occupés sur ce créneau (avec le cours) / Indisponibles ; cours édité exclu ; tous sélectionnables.
- **B9** : un jour férié n'est décoché que si une période cochée le couvre, calcul suivi en direct, badge nommant la période.

**Critères d'acceptation**
- Vitest : bornes de plage et clic sous le seuil ; choix des moniteurs (chevauchement partiel, cours édité exclu, occupé et indisponible) ; propositions de fermetures (pont coché ou non).
- Playwright : glisser 14 h → 18 h donne 14:00–18:00 (test existant mis à jour) ; un clic simple ne modifie aucune plage ; « Annuler » du toast restaure les plages.

## L12 — Doublons et alerte d'âge (M)

**Objectif** : signaler tôt, sans jamais bloquer. Spec : « Doublons et âge » ; détail dans [Doublons et alerte d'âge](issues/07-doublons-et-alerte-age.md).

- Domaine : détection de doublon d'élève (nom + prénom sans casse ni accents, dates comparées si les deux sont connues, toutes saisons, fiche éditée exclue), initiales prises, nom de court pris, âge et tranche au début de saison.
- Formulaire élève : « Ouvrir sa fiche » (saison en cours, sous la garde de modale) ou « Reprendre ses coordonnées » (saison passée) ; tranches et « hors tranche » dans la liste à cocher ; avertissement au cochage et à la saisie de la date.
- Homonymes : date de naissance et groupes affichés dès qu'un homonyme existe, toujours dans la confirmation de suppression.
- Moniteur (**B2**) : initiales prises, proposition appliquée en un clic. Court (**B5**) : nom déjà pris.
- Aperçu d'import : lignes hors tranche marquées et comptées.
- Messages dans la zone réservée de L9. `docs/SPECS.md` §7 et §8 amendés.

**Critères d'acceptation**
- Vitest : doublons avec et sans dates, dans la saison et dans une saison passée ; tranche d'âge aux bornes.
- Playwright : l'avertissement de doublon apparaît sans déplacer les boutons ; « Reprendre ses coordonnées » pré-remplit sans les groupes ; l'enregistrement reste possible.

## L13 — Saisie des élèves en volume (M)

**Objectif** : saisir 60 élèves sans corvée. Spec : « Saisie en volume » ; détail dans [Saisie des élèves en volume](issues/11-saisie-eleves-volume.md).

- **Migration** : téléphone de l'élève facultatif ; règle « élève ou responsable » dans la fiche et l'import ; affichage « (resp.) » ; exports à deux colonnes. `docs/SPECS.md` §3.5 amendé.
- Formulaire élève : « Enregistrer et ajouter un autre » (groupes et niveau gardés), Prénom avant Nom (aussi moniteur), niveau proposé depuis le premier groupe coché.
- Import : « Coller depuis Excel » à l'étape 1, détection de l'absence d'en-têtes (« Colonne A, B… »), même correspondance, aperçu et annulation ; niveau proposé depuis le groupe si la colonne est vide.
- Liens « Importer ou coller une liste » depuis l'onglet Élèves et la fiche groupe (groupe pré-affecté).
- Fiche groupe : champ d'ajout vidé avec focus conservé, Entrée et ↑/↓, « Créer « Prénom Nom » ».
- Création d'un groupe : on reste sur la liste, toast avec « Ajouter des élèves ».
- Les contrôles de L12 s'appliquent à tous ces chemins, y compris aux champs pré-remplis.

**Critères d'acceptation**
- Vitest : règle du téléphone (fiche et import) ; lecture d'un collage avec et sans en-têtes.
- Playwright : dix élèves d'un même groupe saisis à la suite sans recocher le groupe ; collage d'un tableau importé avec annulation possible ; ajout en chaîne au clavier dans la fiche groupe.
- Une base v1.0 existante migre sans perte.

## L14 — Lisibilité de la grille (L)

**Objectif** : une grille lisible à 960 px sur un club dense. Spec : « Grille » ; détail dans [Lisibilité de la grille](issues/12-lisibilite-grille.md), prototype (variante G) dans `.plan/ux-v1-1/prototypes/lisibilite-grille/`.

- Vue « Semaine / Jour », barre des jours (compte de cours, flèches) avec la navigation des semaines en semaine précise ; clic sur l'en-tête d'un jour.
- Panneau latéral repliable sans rail, rouvert à l'ouverture ou la création d'un cours.
- Menu de l'application réductible aux icônes, choix mémorisé.
- Une seule barre d'outils : barre haute masquée sur le Planning, sélecteur de saison dans l'en-tête, Annuler / Rétablir / PDF en icônes, menu « Filtres » avec compteur, pastilles moniteurs réduites, total d'heures retiré.
- Bandeau de mode sur une ligne fine (phrase de portée de L10 gardée).
- En-têtes de courts : vrai nom abrégé, icône soleil / maison, légende ; fiche du cours au survol.
- Régler l'en-tête qui tient encore sur deux lignes à 960 px.
- `docs/SPECS.md` §4.1 amendé.

**Critères d'acceptation**
- Playwright à 960 px sur le jeu de données de charge : en vue Jour, les noms des groupes ne sont pas tronqués sur une carte d'une heure ; l'en-tête tient sur une ligne.
- Playwright : panneau replié rouvert à la création d'un cours ; fiche au survol visible puis masquée au clic.
- Recette des gestes de la grille (créer, déplacer, redimensionner, dupliquer) en vue Jour et Semaine.

## L15 — Guidage et mode d'emploi (M)

**Objectif** : une nouvelle responsable sait par où commencer et comment se servir du planning. Spec : « Guidage et mode d'emploi » ; prototypes (variantes C) dans `.plan/ux-v1-1/prototypes/`.

- Domaine : état des étapes (Saison, Courts, Moniteurs, Groupes, Élèves, puis premier cours) calculé depuis la saison.
- Pastilles d'étape sur les onglets du club ; accueil « Avant de construire le planning » à la place des états vides ; toast à chaque première étape franchie avec « Étape suivante ».
- Astuce contextuelle en tête du panneau, bouton « Tout le mode d'emploi », texte « Les bases » puis « Pour aller plus vite » ; seul Ctrl/⌘ N annoncé (**B4**) ; touches selon le système.
- `docs/DEMARRAGE-RAPIDE.md` réécrit avec le guidage, le mode d'emploi et le vocabulaire.

**Critères d'acceptation**
- Vitest : état des étapes de la base vide au premier cours.
- Playwright : depuis une base vide, suivre l'accueil et les toasts jusqu'au premier cours ; le guidage a alors disparu.
- Playwright : l'astuce change entre aucun cours, cours sélectionné et sinon.

## L16 — Finitions et release 1.1 (S)

**Objectif** : une version 1.1 stable et livrée.

- Passe d'accessibilité sur les nouveaux écrans : contrastes clair et sombre, arrêts de tabulation, noms accessibles, Tooltip et toasts au clavier et au lecteur d'écran (VoiceOver sous WebKit pour B12).
- Recette manuelle sur les trois moteurs web (WebKit, WebView2, WebKitGTK) : grille en vue Jour, collage depuis Excel, toasts, modales.
- Rejeu du parcours des deux personas du test d'utilisabilité.
- Tableau de traçabilité spec v1.1 → lot → tests.
- Version 1.1.0 (`package.json`, configuration Tauri), installateurs publiés.

**Critères d'acceptation**
- Aucun bug bloquant ou majeur ouvert ; B1 à B12 vérifiés corrigés.
- Toutes les user stories de la spec sont couvertes par un lot et, quand elles sont observables, par un test.

---

## Risques et points d'attention

| Risque | Lot | Mitigation |
|---|---|---|
| Socle qui grossit et bloque tout le reste | L9 | Limiter L9 aux composants et à leur branchement sur les cas connus ; le reste des écrans adopte les composants dans leur lot. |
| Échap en cascade et sélecteurs date/heure natifs différents selon WebKit, WebView2, WebKitGTK | L9 | Tester tôt sur les trois moteurs ; repli : ignorer l'Échap de la modale pendant qu'un champ date/heure a le focus. |
| Migration du téléphone sur des bases réelles | L13 | Migration testée sur une sauvegarde v1.0 ; sauvegarde automatique avant migration. |
| Collage depuis Excel différent selon l'OS (tabulations, fins de ligne, cellules multilignes) | L13 | Jeux de collage réels des trois OS en tests du domaine. |
| Refonte de la barre et du panneau du planning qui casse les tests e2e existants | L14 | Adapter les aides de test du planning en premier ; garder les noms accessibles stables. |
| Renommages qui cassent les sélecteurs des tests | L10 | Mettre à jour les tests dans le même lot ; termes métier inchangés dans le code. |
