# Traçabilité spec UX v1.1 → lots → tests

> Référence : [spec UX v1.1](../.plan/ux-v1-1/spec.md) (89 user stories, bugs B1 à B12), [`.plan/ux-v1-1/lots.md`](../.plan/ux-v1-1/lots.md). État à la version 1.1.0 (lot L16, 17/10/2026). La traçabilité de la v1.0 (`docs/SPECS.md` → lots L0 à L8) reste dans [`TRACABILITE.md`](TRACABILITE.md) ; celle des disponibilités des élèves (lots L17 à L22) est dans [`TRACABILITE-V1.2.md`](TRACABILITE-V1.2.md).
>
> Chaque user story et chaque bug est rattaché au lot qui l'implémente et aux tests qui le vérifient. Ce qui ne peut pas être vérifié automatiquement renvoie à la recette manuelle ([`RECETTE.md`](RECETTE.md), sections 8 et 9).

**Légende** (comme pour la v1.0)

- `E:` Playwright (`e2e/*.spec.ts`), sous Chromium (moteur de WebView2) et WebKit (moteur de macOS, proche de WebKitGTK) — `pnpm test:e2e`. Nom du test entre guillemets, `›` sépare le `describe` du test.
- `V:` Vitest (`src/**/*.test.ts`) — `pnpm test`.
- `M:` recette manuelle (`docs/RECETTE.md`, numéro de ligne).
- *(L16)* : test ajouté ou complété par le lot L16 pour fermer un manque de couverture.

## Bugs B1 à B12

Tous vérifiés corrigés : chaque bug a au moins un test Playwright qui échouerait si le défaut revenait.

| Bug | Lot | Tests | Recette |
|---|---|---|---|
| B1 Élève saisi deux fois sans un mot | L12 | E: `doublons.spec.ts` « signale un élève déjà inscrit sans déplacer les boutons ni bloquer » ; V: `src/domain/duplicates.test.ts` « doublons d'élève › compare nom et prénom sans casse ni accents », « … › compare les dates seulement si les deux sont connues », « … › distingue la saison en cours des saisons passées… », « … › exclut la fiche éditée et attend nom et prénom » | M: 9.3 |
| B2 Mêmes initiales pour deux moniteurs | L12 | E: `doublons.spec.ts` « propose des initiales libres en un clic (B2) » ; V: `duplicates.test.ts` « initiales déjà prises (B2) › … », `src/domain/initials.test.ts` | M: 9.3 |
| B3 Focus sur la croix à l'ouverture des modales | L9 | E: `socle.spec.ts` « garde des modales › focus sur le premier champ, ou sur « Annuler » pour une suppression » (court, suppression, élève, moniteur *(L16)*), « Échap dans un champ date ne ferme pas… » (fermeture), « le panneau de cours garde sa saisie… » | M: 8.6 |
| B4 Raccourci « N » annoncé mais inopérant | L15 | E: `guidage.spec.ts` « tout le mode d'emploi, replié par défaut, touches du système » (pas de « N » seul, `Ctrl+N` / `⌘ N`) ; E: `planning.spec.ts` « annule et rétablit au clavier ; Suppr, Ctrl/Cmd+N et Échap » | M: 3.10 |
| B5 Deux courts du même nom | L12 | E: `doublons.spec.ts` « signale un nom de court déjà pris (B5) » ; V: `duplicates.test.ts` « nom de court déjà pris (B5) › … » | M: 9.3 |
| B6 Glisser 14 h → 18 h donne 14:00–18:15 | L11 | E: `referentiels.spec.ts` « attribue des couleurs distinctes aux moniteurs et saisit leurs disponibilités », « trace une plage dans les deux sens… » ; V: `src/domain/availabilityEditor.test.ts` « frise des disponibilités : plage glissée (B6) › finit à la limite de case la plus proche du pointeur » (et 4 autres) | M: 9.4 |
| B7 Panneau qui saute au survol d'un cours | L9 | E: `socle.spec.ts` « rien ne bouge sous le curseur › la barre de mode garde sa hauteur quand la pastille des hachures apparaît (B7) » *(L16 : pastille absente avant le survol)*, « « Créer le cours » reste en place… » ; E: `vocabulaire.spec.ts` « la barre de mode dit toujours la portée des changements » | M: 8.3 |
| B8 Hachures du mauvais moniteur | L11 | E: `planning.spec.ts` « range les moniteurs occupés à part et hachure le moniteur du panneau (B8) » ; E: `socle.spec.ts` « « Créer le cours » reste en place… » ; V: `src/features/planning/interaction.test.ts` « état des interactions › hachure le moniteur du panneau avant le survol, après le glisser (B8) » | |
| B9 Ascension rangée « pendant les vacances » | L11 | E: `semaines.spec.ts` « l'assistant propose les vacances de la zone B 2026-2027 et les jours fériés » ; V: `src/domain/schoolCalendar.test.ts` « … › jours fériés et périodes cochées (B9) › … » (6 cas) | |
| B10 Erreurs de formulaire qui ne s'effacent pas | L9 | E: `socle.spec.ts` « erreurs de champ › l'erreur d'un champ s'efface dès qu'il est modifié (B10) » (court) et, *(L16)*, « même règle dans le formulaire saison / moniteur / indisponibilité / groupe / élève / niveau (B10) », « l'erreur générale s'affiche en rouge dans la zone réservée, puis s'efface (B10) » (fermeture) ; V: `src/components/form/formState.test.ts` « effacement des erreurs de champ (B10) › … » | |
| B11 Création de saison non confirmée | L9 | E: `socle.spec.ts` « toast commun › confirme la création de la saison (B11) dans une région aria-live » ; E: `guidage.spec.ts` « nouvelle saison et changement de saison : aucune étape annoncée » | M: 9.2 |
| B12 Cases à cocher lues « on » | L9 | E: `socle.spec.ts` « cases à cocher › chaque case est reliée à son libellé (B12) », « toutes les cases des fiches et de l'import sont nommées par leur libellé (B12) » *(L16 : saison, court, moniteur, niveau, groupe, élève, assistant des fermetures, indisponibilité, import, suppression RGPD ; la fenêtre d'export d'une sauvegarde n'existe que dans l'application de bureau, M: 8.9)* ; E: `accessibilite.spec.ts` « contrastes suffisants et contrôles nommés » | M: 8.9 (VoiceOver sous WebKit) |

## User stories

### Stabilité et modales (L9)

| # | Story (résumé) | Tests |
|---|---|---|
| 1 | Boutons immobiles quand un avertissement apparaît | E: `socle.spec.ts` « « Créer le cours » reste en place quand un avertissement apparaît ou au survol d'un cours », « les boutons du formulaire élève restent en place », « le tableau de la fiche groupe ne descend pas (recherche et alertes) » ; E: `doublons.spec.ts` « signale un élève déjà inscrit sans déplacer les boutons ni bloquer » |
| 2 | Zone de deux lignes réservée | V: `src/components/feedback/messages.test.ts` « zone de message réservée › … » ; E: positions des boutons (story 1) |
| 3 | « + N autres avertissements » dépliable | E: `socle.spec.ts` « « Créer le cours » reste en place… » ; E: `accessibilite.spec.ts` « écrans de la v1.1 › guidage, toasts, zone de message, bulle et garde des modales » *(L16)* ; V: `messages.test.ts` « … › au-delà de deux, remplace la dernière ligne par « + N autres » » |
| 4 | Erreur générale en rouge dans la zone, boutons immobiles | E: `socle.spec.ts` « l'erreur générale s'affiche en rouge dans la zone réservée, puis s'efface (B10) » *(L16)* ; V: `messages.test.ts` « … › met l'erreur générale en tête… » |
| 5 | Erreur de champ effacée à la correction | voir B10 |
| 6 | Confirmation brève en bas à droite | E: `socle.spec.ts` « un succès reste affiché tant qu'il est survolé, puis s'efface » (position *(L16)*), « toast commun du planning › un seul toast à la fois : le nouveau message remplace l'ancien » *(L16)* |
| 7 | Effacement après quelques secondes, pause au survol | E: `socle.spec.ts` « un succès reste affiché tant qu'il est survolé, puis s'efface » ; E: `accessibilite.spec.ts` « le toast est atteignable au clavier et reste affiché tant qu'il a le focus » *(L16)* |
| 8 | Erreur du planning persistante | E: `socle.spec.ts` « un échec d'enregistrement reste affiché jusqu'à sa fermeture » |
| 9 | Confirmations et erreurs annoncées | E: `socle.spec.ts` « confirme la création de la saison (B11) dans une région aria-live » (`polite`), « un échec d'enregistrement… » (`assertive`) ; M: 8.9 |
| 10 | « Saison « 2026-2027 » créée » | voir B11 |
| 11 | Barre de mode à hauteur fixe | voir B7 |
| 12 | « Effacer les filtres » toujours visible, grisé | E: `socle.spec.ts` « « Effacer les filtres » est toujours présent, grisé avec sa raison » |
| 13 | Résultats de recherche de la fiche groupe superposés | E: `socle.spec.ts` « le tableau de la fiche groupe ne descend pas (recherche et alertes) » |
| 14 | Curseur dans le premier champ | voir B3 |
| 15 | Fenêtre sans champ : focus sur le bouton non destructif | E: `socle.spec.ts` « focus sur le premier champ, ou sur « Annuler » pour une suppression » |
| 16 | Échap en cascade | E: `socle.spec.ts` « Échap dans un champ date ne ferme pas ; confirmation seulement si la saisie a changé » ; E: `vocabulaire.spec.ts` « le bouton de fermeture des fenêtres et des messages a sa bulle » ; E: `grille.spec.ts` « la fiche signale les avertissements et Échap la ferme seule » ; M: 8.7 (sélecteurs natifs ouverts) |
| 17 | Échap dans le panneau de cours | E: `socle.spec.ts` « le panneau de cours garde sa saisie : Échap, autre créneau, fermeture » |
| 18 | « Abandonner les modifications ? » | E: `socle.spec.ts` « Échap dans un champ date… », « le panneau de cours garde sa saisie… » ; V: `formState.test.ts` « saisie modifiée › … » |
| 19 | Fenêtre intacte fermée sans question | E: `socle.spec.ts` « Échap dans un champ date… », « le panneau de cours garde sa saisie… » ; M: 9.10 |
| 20 | « Continuer la saisie » par défaut | E: `socle.spec.ts` « Échap dans un champ date… » |
| 21 | Autre créneau : confirmation | E: `socle.spec.ts` « le panneau de cours garde sa saisie… » |
| 22 | Raison d'un bouton grisé | E: `socle.spec.ts` « « Effacer les filtres » est toujours présent, grisé avec sa raison », « les boutons grisés de la navigation et des disponibilités disent pourquoi » ; E: `referentiels.spec.ts` « un clic simple dans la frise remplit le formulaire… » ; V: `availabilityEditor.test.ts` « annonce des changements › grise « Ajouter » ou « Retirer »… » — *partiel* : la raison du bouton grisé de l'aperçu PDF (échec de production du PDF) n'est pas provoquée en e2e |
| 23 | Cases à cocher annoncées par leur libellé | voir B12 |

### Guidage de la première utilisation (L15)

| # | Story (résumé) | Tests |
|---|---|---|
| 24 | Ordre des étapes sur les onglets | E: `guidage.spec.ts` « de la base vide au premier cours, puis le guidage disparaît » ; V: `src/domain/guidance.test.ts` « état des étapes du guidage › … » |
| 25 | Coche et étape suivante en couleur | E: `guidage.spec.ts` « de la base vide au premier cours… » (descriptions « Étape 1, faite », « la suivante ») ; E: `accessibilite.spec.ts` « écrans de la v1.1 › guidage, toasts… » (contrastes des pastilles) *(L16)* |
| 26 | Niveaux et Fermetures sans pastille | E: `guidage.spec.ts` « de la base vide au premier cours… » |
| 27 | Accueil « Avant de construire le planning » | E: `guidage.spec.ts` « de la base vide au premier cours… » (phrase cours / court / moniteur / groupe *(L16)*) |
| 28 | Un seul bouton vers l'étape suivante | E: `guidage.spec.ts` « de la base vide au premier cours… » |
| 29 | Toast « Étape suivante » | E: `guidage.spec.ts` « de la base vide au premier cours… », « pas d'« Étape suivante » dans une fenêtre ouverte », « données saisies d'un coup : ni toast d'étape ni pastille » ; V: `guidance.test.ts` « étape franchie (toast de première fois) › … », `src/components/feedback/suggestion.test.ts` |
| 30 | Guidage qui disparaît seul | E: `guidage.spec.ts` « de la base vide au premier cours… », « un cours ponctuel compte comme premier cours » ; V: `guidance.test.ts`, `src/db/repositories/seasons.test.ts` « guidage : comptes de la saison… » |

### Mode d'emploi du planning (L15)

| # | Story (résumé) | Tests |
|---|---|---|
| 31 | Astuce selon le contexte | E: `guidage.spec.ts` « l'astuce change entre aucun cours, cours sélectionné et sinon », « saison terminée : astuce de consultation » |
| 32 | « + Nouveau cours » quand rien n'est placé | E: `guidage.spec.ts` « l'astuce change… » |
| 33 | Cours sélectionné : déplacer, durée, supprimer, annuler | E: `guidage.spec.ts` « l'astuce change… » (déplacer et durée *(L16)*, Suppr et Ctrl+Z) |
| 34 | « Tout le mode d'emploi » | E: `guidage.spec.ts` « tout le mode d'emploi, replié par défaut, touches du système » |
| 35 | « Les bases » puis « Pour aller plus vite » | E: `guidage.spec.ts` « tout le mode d'emploi… » |
| 36 | ⌘ et ⌥ sous macOS | V: `src/lib/keys.test.ts` « touches selon le système › … » ; E: `guidage.spec.ts` « tout le mode d'emploi… », « l'astuce change… » |
| 37 | Seul Ctrl/⌘ N annoncé | voir B4 |

### Vocabulaire et bulles d'aide (L10)

| # | Story (résumé) | Tests |
|---|---|---|
| 38 | « Planning habituel » / « Une semaine précise » | E: `vocabulaire.spec.ts` « la barre de mode dit toujours la portée des changements » ; E: `semaines.spec.ts` « passe de la semaine type à la semaine datée et navigue entre les semaines » |
| 39 | Phrase de portée toujours visible | E: `vocabulaire.spec.ts` « la barre de mode dit toujours la portée des changements », « la phrase de portée reste entière à côté des deux pastilles » |
| 40 | « Modifié / Annulé cette semaine », « Revenir au cours habituel » | E: `semaines.spec.ts` « un cours déplacé en semaine datée ne modifie ni la semaine type ni les autres semaines » (« Modifié cette semaine » *(L16)*), « annule une séance avec motif… » ; E: `vocabulaire.spec.ts` « aucun terme retiré n'apparaît sur les écrans principaux » ; V: `src/features/pdf/model.test.ts` |
| 41 | Pastille des cours qui changent plus tard | E: `planning.spec.ts` « liste les avertissements et navigue vers le cours concerné » ; V: `src/features/planning/grid/view.test.ts` « … cours qui évoluent dans la saison (pastille de la barre de mode) › … » |
| 42 | Menu « Le club » | E: `vocabulaire.spec.ts` « aucun terme retiré… » ; navigation de tous les parcours |
| 43 | « En cours », « Terminée », « Affichée » | E: `saisons.spec.ts` « duplique la saison, puis modifie la nouvelle sans effet sur l'ancienne » (« Affichée » *(L16)*) |
| 44 | « Horaires de disponibilité » | E: `referentiels.spec.ts` « attribue des couleurs distinctes… » ; E: `vocabulaire.spec.ts` « aucun terme retiré… » |
| 45 | Bulle au survol et au clavier sur chaque bouton icône | E: `vocabulaire.spec.ts` « chaque bouton icône a un nom accessible et une bulle atteignable au clavier », « le bouton de fermeture des fenêtres et des messages a sa bulle », « suit son bouton quand la page défile » ; E: `accessibilite.spec.ts` « le toast est atteignable au clavier… » *(L16)* ; M: 8.8 |
| 46 | Libellé visible des icônes rares | E: `vocabulaire.spec.ts` « les actions rares ont un libellé visible en plus de l'icône » |
| 47 | Réglages et Import/Export simples, détails repliés | E: `vocabulaire.spec.ts` « les réglages et les exports parlent simplement, détails techniques repliés », « aucun terme retiré… » |
| 48 | « Exporter vers Excel » | E: `vocabulaire.spec.ts` « les réglages et les exports… » ; E: `sorties.spec.ts` « documents PDF et exports de l'écran Import/Export » |

### Doublons et alerte d'âge (L12)

| # | Story (résumé) | Tests |
|---|---|---|
| 49 | Élève déjà inscrit signalé | voir B1 |
| 50 | « Ouvrir sa fiche » | E: `doublons.spec.ts` « « Ouvrir sa fiche » remplace la saisie, après confirmation » |
| 51 | Enregistrer quand même | E: `doublons.spec.ts` « signale un élève déjà inscrit… » |
| 52 | « Reprendre ses coordonnées » | E: `doublons.spec.ts` « « Reprendre ses coordonnées » d'une saison passée, sans les groupes » ; V: `duplicates.test.ts` |
| 53 | Naissance et groupes des homonymes | E: `doublons.spec.ts` « signale un élève déjà inscrit… » ; V: `duplicates.test.ts` « … › rédige les messages et désigne les homonymes » |
| 54 | Initiales déjà prises | voir B2 |
| 55 | Court du même nom | voir B5 |
| 56 | Tranche d'âge et « hors tranche » | E: `doublons.spec.ts` « affiche les tranches et avertit d'un groupe hors tranche » ; V: `duplicates.test.ts`, `src/domain/groups.test.ts` |
| 57 | « Léa aura 11 ans… » | E: `doublons.spec.ts` « affiche les tranches et avertit d'un groupe hors tranche » |
| 58 | Lignes hors tranche dans l'aperçu d'import | E: `import.spec.ts` « marque et compte les lignes hors tranche d'âge sans bloquer l'import » ; V: `src/domain/studentImport.test.ts` |

### Saisie des élèves en volume (L13)

| # | Story (résumé) | Tests |
|---|---|---|
| 59 | « Enregistrer et ajouter un autre » | E: `saisie-volume.spec.ts` « saisit dix élèves d'un même groupe à la suite sans recocher le groupe » |
| 60 | Coller depuis Excel | E: `saisie-volume.spec.ts` « colle un tableau depuis Excel, l'importe puis annule l'import » ; V: `src/domain/importPaste.test.ts` ; M: 8.4 |
| 61 | Collage sans en-têtes | E: `saisie-volume.spec.ts` « colle une liste sans en-têtes depuis la fiche d'un groupe » ; V: `importPaste.test.ts`, `studentImport.test.ts` |
| 62 | « Importer ou coller une liste » | E: `saisie-volume.spec.ts` (les deux tests de collage) |
| 63 | Import depuis une fiche groupe | E: `saisie-volume.spec.ts` « colle une liste sans en-têtes depuis la fiche d'un groupe » ; V: `studentImport.test.ts` |
| 64 | Champ « Ajouter un élève » vidé, focus gardé | E: `saisie-volume.spec.ts` « ajoute des élèves en chaîne au clavier dans la fiche groupe » |
| 65 | Entrée et ↑ / ↓ | même test |
| 66 | « Créer « Léa Martin » » | même test ; V: `src/domain/students.test.ts` |
| 67 | Rester sur la liste après création d'un groupe | E: `saisie-volume.spec.ts` « reste sur la liste après la création d'un groupe » |
| 68 | Un seul téléphone suffit | E: `saisie-volume.spec.ts` « saisit dix élèves… » ; V: `students.test.ts`, `src/domain/validation.test.ts`, `studentImport.test.ts`, `src/db/migrations.test.ts` « migration 0005 : téléphone de l'élève facultatif › migre une base v1.0 sans perte » ; M: 8.1 |
| 69 | « (resp.) » | E: `saisie-volume.spec.ts` « saisit dix élèves… » (liste Élèves et fiche groupe *(L16)*) ; V: `students.test.ts` |
| 70 | Niveau proposé depuis le premier groupe | E: `saisie-volume.spec.ts` « saisit dix élèves… » ; V: `students.test.ts`, `studentImport.test.ts` |
| 71 | Prénom avant Nom | E: `saisie-volume.spec.ts` « saisit dix élèves… » ; E: `socle.spec.ts` « focus sur le premier champ… » (élève, moniteur *(L16)*) |

### Lisibilité de la grille (L14)

| # | Story (résumé) | Tests |
|---|---|---|
| 72 | Un seul jour à la fois | E: `grille.spec.ts` « l'en-tête tient sur une ligne et la vue Jour ne tronque pas les noms », « bascule entre la semaine et un jour… », « gestes de la grille en vue Jour › … » ; V: `src/features/planning/grid/dayView.test.ts` ; M: 8.2, 8.3 |
| 73 | Barre des jours avec le nombre de cours | E: `grille.spec.ts` « bascule entre la semaine et un jour… » ; V: `dayView.test.ts` |
| 74 | Clic sur l'en-tête d'un jour | E: `grille.spec.ts` « bascule entre la semaine et un jour… », « l'en-tête d'un jour s'active au clavier et passe le focus à sa pastille » |
| 75 | Semaines dans la barre des jours | E: `grille.spec.ts` « en semaine précise, la navigation des semaines ouvre la barre des jours » |
| 76 | Panneau repliable, rouvert seul | E: `grille.spec.ts` « le panneau replié se rouvre à la création et à l'ouverture d'un cours » |
| 77 | Menu réduit aux icônes, mémorisé | E: `grille.spec.ts` « le menu de l'application se réduit aux icônes, choix mémorisé » ; V: `src/app/sidebar.test.ts` |
| 78 | Une seule barre d'outils, menu « Filtres » | E: `grille.spec.ts` « l'en-tête tient sur une ligne… », « saison terminée : l'en-tête tient aussi sur une ligne » ; E: `planning.spec.ts` « filtre par moniteur, court et groupe » ; V: `dayView.test.ts` |
| 79 | Vrai nom des courts, soleil ou maison | E: `grille.spec.ts` « les courts portent leur vrai nom, une icône et leur nature en bulle » ; V: `dayView.test.ts` |
| 80 | Fiche du cours au survol | E: `grille.spec.ts` « la fiche au survol montre le détail du cours, puis disparaît au clic », « la fiche signale les avertissements et Échap la ferme seule » ; V: `src/features/planning/hoverCard.test.ts` |

### Bugs aux règles métier arbitrées (L11)

| # | Story (résumé) | Tests |
|---|---|---|
| 81 | 14 h → 18 h donne 14:00–18:00 | voir B6 |
| 82 | Clic simple qui pré-remplit sans modifier | E: `referentiels.spec.ts` « un clic simple dans la frise remplit le formulaire, « Annuler » rétablit les plages » ; V: `availabilityEditor.test.ts` « frise des disponibilités : clic simple › … » |
| 83 | Clic sur un horaire existant : plage entière, « Retirer » | même test e2e ; V: `availabilityEditor.test.ts` « … › sur une case disponible, propose la plage entière » |
| 84 | « Annuler » depuis le toast | E: `referentiels.spec.ts` « un clic simple dans la frise… », « trace une plage dans les deux sens, annonce ce qui change et annule le dernier changement » |
| 85 | Moniteurs en trois groupes | E: `planning.spec.ts` « range les moniteurs occupés à part et hachure le moniteur du panneau (B8) », « crée un cours par sélection sur la grille, moniteurs disponibles en tête » ; V: `view.test.ts` « choix du moniteur › en trois groupes… › … » |
| 86 | Moniteur occupé choisi avec avertissement | E: `planning.spec.ts` « range les moniteurs occupés à part… (B8) » |
| 87 | Hachures du moniteur du panneau | voir B8 |
| 88 | Jour férié décoché seulement si une période cochée le couvre | voir B9 |
| 89 | Badge nommant la période | E: `semaines.spec.ts` « l'assistant propose les vacances de la zone B 2026-2027 et les jours fériés » ; V: `schoolCalendar.test.ts` |

## Exigences transverses du lot L16

| Exigence (lots v1.1, L16) | Vérification |
|---|---|
| Passe d'accessibilité : contrastes clair et sombre | E: `accessibilite.spec.ts` « écrans principaux, thème clair / sombre › contrastes suffisants et contrôles nommés » (textes et, depuis L16, icônes à 3:1) ; « écrans de la v1.1, thème clair / sombre › guidage, toasts, zone de message, bulle et garde des modales », « … › planning : barre des jours, Filtres, fiche au survol, mode d'emploi, menu réduit », « … › frise, fiche groupe, collage et initiales déjà prises » (accueil du guidage, pastilles d'étape, toasts de succès et d'erreur, bulle, zone de message dépliée, garde de modale, vue Jour, menu Filtres, fiche au survol, mode d'emploi, menu réduit, semaine précise, frise, combobox de la fiche groupe, collage, correspondance, aperçu d'import, initiales) |
| Arrêts de tabulation, focus visibles et contrastés | E: `accessibilite.spec.ts` « focus visible › thème clair / sombre › chaque arrêt de tabulation est visible (…) » (4 écrans, contraste ≥ 3:1 depuis L16, ⌥ Tab sous WebKit) ; « focus sur les écrans de la v1.1, thème clair / sombre › indicateurs de focus visibles et contrastés » (accueil du guidage, vue Jour, fiche groupe, fiche moniteur, collage, fiche élève, fiche élève après un enregistrement refusé) |
| Noms accessibles | E: `accessibilite.spec.ts` (tous les relevés ci-dessus, `unnamedControls`) ; E: `vocabulaire.spec.ts` « chaque bouton icône a un nom accessible… » |
| Tooltip et toasts au clavier | E: `vocabulaire.spec.ts` « chaque bouton icône a un nom accessible et une bulle atteignable au clavier », « le bouton de fermeture des fenêtres et des messages a sa bulle » ; E: `accessibilite.spec.ts` « le toast est atteignable au clavier et reste affiché tant qu'il a le focus » |
| Lecteur d'écran (VoiceOver sous WebKit pour B12) | E: régions `aria-live`, noms des cases (voir B12) ; M: 8.9 |
| Recette sur WebKit, WebView2, WebKitGTK | M: `RECETTE.md` §8 (grille en vue Jour, collage depuis Excel, toasts, modales, Échap dans les champs date et heure, sauvegarde avant migration) |
| Rejeu des deux personas | M: `RECETTE.md` §9 (Monique 9.1–9.7, Alex 9.8–9.12) |
| Version 1.1.0 | V: `src/app/version.test.ts` (versions de `package.json`, `tauri.conf.json` et `Cargo.toml` alignées) ; `docs/CHANGELOG.md` |

### Défauts d'accessibilité corrigés par L16

Ratios calculés sur les jetons de `src/index.css` et la palette Tailwind (conversion oklch → sRGB), puis mesurés dans la page par `e2e/support/a11y.ts`, qui compose les fonds et les opacités de tous les ancêtres (seuls les éléments estompés exprès, marqués `data-faded`, et les éléments inertes sont ignorés ; les fonds en image ou en dégradé sont signalés comme non mesurés, aucun à ce jour).

| Défaut | Avant | Après |
|---|---|---|
| Anneau de focus des boutons, champs et liens (`ring-ring/50`) | 2,12:1 (fond, clair) à 2,49:1 (carte, sombre) | `ring-ring/75` : 3,30:1 à 4,23:1 |
| Contour par défaut des éléments focalisables (`outline-ring/50`) | 2,12:1 | `outline-ring/75` : ≥ 3,30:1 |
| Anneau de focus des boutons du toast (`ring-ring` sur fond sombre ou rouge) | 2,88:1 / 2,52:1 (succès), 1,04:1 / 2,20:1 (erreur) | `ring-current` : 15,3:1 / 17,2:1 (succès), 6,42:1 (erreur) |
| Champs date et heure sans aucun focus visible sous WebKit (`:focus-visible` non reconnu sur leurs segments) | aucun indicateur (1,22:1, bordure seule) | anneau sur `:focus` : 5,33:1 (clair), 6,84:1 (sombre) |
| Texte rouge (`--destructive` clair) sur le fond des fenêtres : astérisques des champs obligatoires, erreurs | 4,14:1 | `oklch(0.55 0.22 27)` : 4,70:1 (fond), 5,43:1 (carte) ; blanc sur bouton rouge 5,43:1 |
| Compteur de la pastille du jour affiché (barre des jours) | 3,98:1 | pastille inversée : 5,98:1 (clair), 6,66:1 (sombre) |
| Icône « couvert » (maison) des en-têtes de courts et de la légende (`opacity-70`) | 2,95:1 (clair) | opacité pleine : 4,76:1 |
| Icône « extérieur » (soleil, `amber-600`) | 2,76:1 sur le fond gris | `amber-700` : 4,37:1 (fond), 5,05:1 (carte) |
| Icônes de tri inactives des tableaux (`opacity-40`) | 2,12:1 (sombre) | `text-muted-foreground` sans opacité : 5,50:1 (clair), 6,92:1 (sombre) ; tri actif en `text-foreground` |
| Champ en erreur focalisé (`aria-invalid:ring-destructive/20` l'emportait sur l'anneau de focus) | 1,28:1 (clair), 1,42:1 (sombre) | `aria-invalid:focus:ring-destructive/75` : 3,68:1 à 4,19:1 |
| Bouton grisé focalisable (`aria-disabled`, raison affichée) : anneau atténué par `opacity-50` | 1,79:1 à 1,92:1 | opacité pleine au focus clavier (`aria-disabled:focus-visible:opacity-100`) : ≥ 3,30:1 |
| Sélecteur « Saison affichée » de l'en-tête : liste native transparente, aucun indicateur sur le rendu visible | aucun | anneau sur le rendu visible (`group-has-[select:focus-visible]`) : ≥ 3,30:1 |
| Initiales sur les pastilles de couleur de la fiche moniteur (`opacity-90`) | 4,48:1 (blanc sur Orange) | opacité pleine : ≥ 4,9:1 |

Limite connue, non corrigée : en thème sombre, les couleurs de moniteur les plus foncées de la palette (Marine `#1E3A8A`, Brun `#78350F`, Bordeaux, Indigo…) ont un contraste de 1,7:1 à 3:1 avec le fond des cartes, dans la frise des disponibilités et sur les cours de la grille. L'information n'est pas portée par la seule couleur (liste « Horaires de disponibilité », libellés et description des cours) ; une bordure claire en thème sombre est à étudier hors de la v1.1.

## Stories non couvertes

Aucune story ni aucun bug n'est sans lot ni sans test. Couvertures partielles restantes, toutes de faible risque :

- **Story 22** : la raison du bouton grisé de l'aperçu PDF n'est pas provoquée (il faudrait faire échouer la production du PDF) ; le composant commun est testé sur quatre autres boutons.
- **Story 16** : Échap avec un calendrier natif réellement ouvert n'est pas observable par Playwright (les trois moteurs ne l'exposent pas) — repli assumé et recette M: 8.7.
- **Story 9 et B12** : l'annonce effective par un lecteur d'écran relève de la recette (M: 8.9) ; les tests vérifient les régions `aria-live` et les noms accessibles.
- **B8** : les hachures elles-mêmes ne sont pas comptées, seule leur pastille (moniteur affiché) l'est.
