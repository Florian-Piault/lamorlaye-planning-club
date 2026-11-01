# Spec — Disponibilités des élèves

## Problem Statement

Le responsable du club compose les groupes et place leurs cours sur la grille sans savoir quand les élèves peuvent venir. Il recueille ces contraintes au téléphone ou sur papier (« pas le mercredi matin », « seulement après 17 h ») et doit s'en souvenir au moment de composer un groupe ou de déplacer un cours. Les moniteurs ont des plages de disponibilité et Kairos le prévient quand il les place en dehors. Rien de tel n'existe pour les élèves : un cours déplacé de 17 h à 16 h peut perdre la moitié de son groupe sans que rien ne l'avertisse.

## Solution

Chaque élève peut avoir des plages de disponibilité hebdomadaires, sur le modèle de celles des moniteurs. Le responsable les saisit dans la fiche de l'élève ou en série, depuis la liste des élèves. Kairos s'en sert ensuite pour aider au placement, sans jamais bloquer :

- **Composition des groupes** : les élèves compatibles avec tous les cours du groupe passent en tête des candidats. Les autres portent un badge « hors disponibilités ». Les membres déjà inscrits qui sont incompatibles sont signalés.
- **Grille du planning** : un cours où des élèves du groupe sont indisponibles porte un avertissement, un seul par cours, par exemple « 3 élèves hors disponibilités », avec les noms dans le détail.
- **Pendant le glisser** : quand on crée ou déplace un cours, les créneaux où des élèves du groupe sont indisponibles sont ombrés, plus ou moins fort selon leur nombre.

Un élève sans aucune plage est considéré comme disponible partout. La saisie peut donc être progressive sans noyer la grille d'avertissements.

## User Stories

### Saisie dans la fiche

1. En tant que responsable, je veux une section de disponibilités dans la fiche de l'élève, afin d'y noter quand il peut venir.
2. En tant que responsable, je veux saisir ces plages avec la même frise que pour les moniteurs, afin de ne pas réapprendre un geste.
3. En tant que responsable, je veux poser plusieurs plages sur un même jour (par exemple 9 h–12 h et 14 h–18 h le samedi), afin de refléter les vraies contraintes.
4. En tant que responsable, je veux que deux plages contiguës ou chevauchantes d'un même jour soient fusionnées, comme pour les moniteurs, afin de garder une saisie propre.
5. En tant que responsable, je veux pouvoir effacer toutes les plages d'un élève, afin de le remettre « disponible partout ».
6. En tant que responsable, je veux qu'une fiche sans plage indique clairement que l'élève est considéré comme disponible partout, afin de ne pas confondre « non renseigné » et « jamais disponible ».
7. En tant que responsable, je veux que la modification des plages passe par la même garde de saisie que le reste de la fiche (confirmation à la fermeture si quelque chose a changé), afin de ne pas perdre ma saisie.
8. En tant que responsable, je veux pouvoir annuler et rétablir une modification des disponibilités, afin de corriger une erreur sans tout ressaisir.
9. En tant que responsable, je veux que la fiche d'un élève d'une saison terminée montre ses plages en lecture seule, afin de les consulter sans risque.

### Liste et saisie en série

10. En tant que responsable, je veux voir dans la liste des élèves si leurs disponibilités sont renseignées, afin de savoir qui relancer.
11. En tant que responsable, je veux filtrer la liste sur « disponibilités non renseignées », afin de retrouver rapidement ceux qui manquent.
12. En tant que responsable, je veux combiner ce filtre avec la recherche et les autres filtres de la liste (par exemple un groupe), afin de traiter un groupe à la fois.
13. En tant que responsable, je veux lancer une saisie en série depuis la liste filtrée, afin d'enchaîner les élèves sans rouvrir chaque fiche.
14. En tant que responsable, je veux que la saisie en série m'affiche la frise d'un seul élève à la fois, avec son nom et ses groupes, afin de savoir à qui je parle au téléphone.
15. En tant que responsable, je veux un bouton « Enregistrer et suivant », afin de passer à l'élève suivant de la liste filtrée en un geste.
16. En tant que responsable, je veux pouvoir passer un élève sans rien enregistrer, afin de revenir plus tard sur ceux que je n'ai pas encore joints.
17. En tant que responsable, je veux voir où j'en suis dans la série (par exemple « 4 / 23 »), afin d'estimer ce qui reste.
18. En tant que responsable, je veux que la série se termine proprement après le dernier élève, avec une confirmation, afin de savoir que c'est fini.
19. En tant que responsable, je veux pouvoir arrêter la série à tout moment sans perdre ce qui est déjà enregistré, afin de m'interrompre.
20. En tant qu'utilisateur expert, je veux enchaîner la saisie en série au clavier, afin d'aller vite.

### Composition des groupes

21. En tant que responsable, je veux que les élèves compatibles avec tous les cours du groupe apparaissent en premier parmi les élèves à ajouter, afin de choisir les bons sans réfléchir.
22. En tant que responsable, je veux qu'un élève incompatible porte un badge « hors disponibilités », afin de le voir avant de l'ajouter.
23. En tant que responsable, je veux pouvoir ajouter quand même un élève incompatible, afin de gérer les arrangements particuliers.
24. En tant que responsable, je veux que les membres déjà inscrits qui sont incompatibles avec un cours du groupe soient signalés dans « Élèves du groupe », afin de repérer les problèmes existants.
25. En tant que responsable, je veux que le badge me dise sur quel cours l'élève coince (jour et heure), afin de juger s'il vaut mieux bouger le cours ou l'élève.
26. En tant que responsable, je veux que les élèves sans plage soient traités comme compatibles, afin de ne pas les pénaliser parce que je n'ai pas encore saisi leurs disponibilités.
27. En tant que responsable, je veux que tous les élèves soient présentés comme compatibles tant que le groupe n'a aucun cours, afin de pouvoir composer avant de planifier.

### Grille du planning

28. En tant que responsable, je veux qu'un cours signale les élèves de son groupe qui ne sont pas disponibles sur son créneau, afin de ne pas laisser passer un cours mal placé.
29. En tant que responsable, je veux un seul avertissement par cours, du type « 3 élèves hors disponibilités », afin que le panneau « Avertissements » reste lisible.
30. En tant que responsable, je veux voir les noms des élèves concernés dans la fiche du cours au survol et dans le panneau, afin de savoir qui appeler.
31. En tant que responsable, je veux que cet avertissement apparaisse aussi dans le panneau « Avertissements » de la semaine, avec la navigation vers le cours, comme les autres conflits.
32. En tant que responsable, je veux qu'un élève ne soit jugé disponible que si le cours tient entièrement dans une de ses plages, comme pour les moniteurs, afin d'avoir une seule règle dans l'application.
33. En tant que responsable, je veux que cet avertissement ne bloque jamais l'enregistrement, afin de garder la main.
34. En tant que responsable, je veux que les séances d'une semaine précise, les séances modifiées et les cours ponctuels soient contrôlés de la même façon, d'après leur jour de semaine, afin d'être prévenu aussi pour un rattrapage.
35. En tant que responsable, je veux qu'une séance annulée ne produise pas d'avertissement, afin de ne pas être alerté pour rien.

### Aide pendant le glisser

36. En tant que responsable, je veux que, pendant que je déplace un cours, les créneaux où des élèves de son groupe sont indisponibles soient ombrés, afin de trouver d'un coup d'œil un créneau qui convient à tous.
37. En tant que responsable, je veux que l'ombrage soit plus foncé quand plus d'élèves sont indisponibles, afin de choisir le créneau qui en gêne le moins.
38. En tant que responsable, je veux le même ombrage quand je crée un cours pour un groupe déjà choisi, afin d'être aidé dès la création.
39. En tant que responsable, je veux que cet ombrage se distingue des hachures du moniteur, afin de savoir si c'est le moniteur ou les élèves qui coincent.
40. En tant que responsable, je veux que l'ombrage disparaisse à la fin du geste, afin de retrouver une grille épurée.
41. En tant que responsable, je veux que la grille reste fluide pendant le glisser, même avec des groupes complets et des centaines d'élèves, afin que l'aide ne gêne pas le geste.

### Cycle de vie

42. En tant que responsable, je veux que les plages des élèves soient recopiées quand je duplique une saison, afin de ne pas tout ressaisir chaque année.
43. En tant que responsable, je veux que l'export RGPD d'un élève contienne ses disponibilités, afin de remettre à la famille toutes les données qui la concernent.
44. En tant que responsable, je veux que la suppression définitive d'un élève efface aussi ses disponibilités, afin de respecter l'effacement demandé.
45. En tant que responsable, je veux que les sauvegardes et restaurations incluent les disponibilités des élèves, afin de ne rien perdre.

## Implementation Decisions

- **Vocabulaire.** Le terme métier est « Élève », pas « adhérent ». On reprend la notion de « Plage (de disponibilité) » du glossaire et on l'étend aux élèves. Les libellés affichés s'alignent sur ceux des moniteurs (« Disponible chaque semaine », « Horaire de disponibilité »). Le badge et l'avertissement disent « hors disponibilités ». Il faut mettre à jour le glossaire et les §3.5, §4.4, §7, §8 et §11.6 de `docs/SPECS.md`.
- **Schéma.** Une nouvelle table de plages hebdomadaires d'élève, calquée sur celle des moniteurs : élève, jour de semaine (1 à 7), heure de début, heure de fin. Elle dépend de l'élève avec suppression en cascade et s'ajoute par une migration qui ne recrée aucune table existante. Pas d'indisponibilités datées pour les élèves. Comme les autres tables d'une saison, elle est en lecture seule dans une saison terminée (déclencheurs de la migration), sauf pour l'effacement RGPD (L17).
- **Règle de disponibilité.** Elle est partagée avec les moniteurs. Les plages sont des intervalles semi-ouverts `[début, fin[` en minutes, fusionnés par jour. Un créneau est couvert s'il tient entièrement dans une plage du même jour. Un élève sans aucune plage est disponible partout. C'est la seule différence avec les moniteurs, qui eux sont indisponibles partout quand ils n'ont pas de plage.
- **Contrôle de conflit.** On ajoute un 7e contrôle aux conflits du §7, « élèves hors disponibilités ». Il porte sur les créneaux du planning (cours du planning habituel ou séances actives d'une semaine précise) et produit **un seul conflit par créneau**. Ce conflit indique le nombre d'élèves concernés et leur liste. Le message type est « N élève(s) hors disponibilités ». Partout où il s'affiche (fiche au survol, panneau « Avertissements », panneau du cours, infobulle du glisser, description accessible du cours), il est suivi des noms : « 2 élèves hors disponibilités : Léa Martin, Tom Petit », triés par nom puis prénom (amendé en L17 : un seul endroit pour les noms, plutôt qu'un détail propre à la fiche). Le contrôle n'est jamais bloquant.
- **Compatibilité d'un élève avec un groupe.** Un élève est compatible si chaque cours du groupe dans le planning habituel, à la date de référence de celui-ci, tient dans ses plages. Un groupe sans cours rend tout le monde compatible. L'incompatibilité indique le ou les cours qui coincent.
- **Composition.** Les candidats compatibles passent en tête, dans l'ordre actuel à l'intérieur de chaque catégorie. Les incompatibles portent un badge avec le cours fautif. Un membre incompatible est signalé dans « Élèves du groupe », à côté des alertes d'âge et d'effectif existantes. L'ajout reste toujours possible.
- **Ombrage de la grille.** Pendant un glisser (déplacement ou création), on calcule pour le groupe du cours le nombre d'élèves indisponibles sur chaque créneau visible. On l'affiche comme un ombrage gradué, visuellement distinct des hachures du moniteur (§4.4). Les deux aides peuvent s'afficher ensemble. Le calcul ne doit pas dégrader la fluidité du glisser exigée au §11.5.
  Amendé en L21 :
  - le « groupe déjà choisi » de la création est le filtre « Groupe » de la grille : la sélection d'un créneau n'est ombrée que si un groupe y est choisi, et le panneau « Nouveau cours » s'ouvre avec ce groupe ;
  - l'ombrage est calculé une fois, au début du geste, sur toute la largeur du jour (tous les courts) et sur les jours affichés et ouverts (pas de teinte sur un jour fermé). Au **déplacement**, la durée du cours est connue : pour chaque heure de début possible, au pas de la grille, on compte les élèves gênés par un cours de cette durée commençant là, et l'ombrage se lit au haut du fantôme. À la **création**, la durée n'est connue qu'au relâché : la journée est découpée aux bornes des plages des élèves, et un morceau indique combien d'élèves sont indisponibles à ce moment, pas pour un cours entier qui le déborderait ;
  - paliers d'intensité : 1, 2, 3 ou 4, 5 élèves et plus ; aplat ambré sans motif, avec une pastille « Zones ombrées : élèves de … » ;
  - pas d'ombrage au redimensionnement ni au glisser d'une pastille de moniteur ; pas de pastille quand aucune bande n'est visible ;
  - avec un groupe choisi dans le filtre, la sélection d'un créneau montre aussi les avertissements de ce groupe dans l'infobulle (§5.1).
- **Saisie.** Une section de disponibilités dans la fiche élève réutilise la frise des moniteurs. Le composant doit donc pouvoir servir aux deux sans connaître le type de personne. Les plages s'enregistrent avec le reste de la fiche, sous la même garde de saisie, et passent par l'historique annuler / rétablir. Amendé en L18 : cet historique est celui de la fiche ouverte (boutons « Défaire la modification » et « Refaire la modification » de la section, sans raccourci, nommés ainsi pour ne pas se confondre avec le bouton « Annuler » de la fenêtre), pas celui du planning (§5.3), puisque rien n'est enregistré avant « Enregistrer ». **Limite** : l'historique ne vaut que tant que la fiche est ouverte ; rien ne s'annule après « Enregistrer ». Les plages s'écrivent dans la même transaction que l'identité et les groupes. La section figure aussi dans la fiche de création, après la zone de messages (qui reste sous les champs qu'elle concerne) ; l'action d'effacement s'appelle « Effacer tous les horaires ».
- **Saisie en série.** Elle se lance depuis la liste des élèves et parcourt la liste telle qu'elle est filtrée au moment du lancement. Une fenêtre montre la frise d'un élève à la fois, avec trois actions : « Enregistrer et suivant », passer, et terminer. Elle affiche un compteur de progression et un toast de fin.
  Amendé en L19 :
  - la fenêtre s'appelle « Saisie des disponibilités en série » ; elle reprend la section « Disponible chaque semaine » de la fiche (historique défaire / refaire propre à chaque élève) et affiche « Élève n / N » ;
  - « Enregistrer et suivant » écrit les plages aussitôt (`replaceStudentAvailabilities`), sans toucher à l'identité ni aux groupes ; raccourci ⌘ ↩ / Ctrl+Entrée. Plages inchangées : rien n'est écrit et l'élève compte comme passé. Pendant l'écriture, la fenêtre ne se ferme pas et les boutons sont grisés ;
  - « Passer » et « Terminer » passent par la garde de saisie commune : si les plages de l'élève affiché ont changé, « Abandonner les modifications ? » d'abord. Échap et la croix valent « Terminer » ;
  - le toast dresse un bilan, après le dernier élève (« Saisie en série terminée : 3 élèves enregistrés, 2 passés. ») comme sur un arrêt (« Saisie en série arrêtée : … », rien si aucun geste) ;
  - les plages de la saison sont lues une fois, au lancement (bouton de lancement grisé pendant cette lecture) ; la frise d'un élève déjà renseigné est pré-remplie.
- **Liste des élèves.** Une colonne indique si les disponibilités sont renseignées ou non. Un filtre « non renseignées » se combine aux filtres existants. Amendé en L19 : la liste n'avait que la recherche, qui porte aussi sur les noms des groupes mais ne sépare pas « Galaxie vert » de « Galaxie orange ». L19 ajoute donc un filtre « Groupe » (liste déroulante) ; recherche, groupe et case « Disponibilités non renseignées » se combinent.
- **Duplication de saison.** Les plages des élèves sont recopiées avec les élèves, comme les plages hebdomadaires des moniteurs.
- **RGPD et sauvegarde.** L'export des données d'un élève inclut ses plages, la suppression définitive les emporte, et la sauvegarde ou restauration les couvre.
- **Import.** L'import CSV, Excel ou par collage n'est pas modifié.

## Testing Decisions

- Un bon test vérifie un comportement observable par le responsable ou par l'appelant d'un module : ce qu'affiche l'écran, ce que contient la liste des conflits, ce que produit la duplication. Il ne teste pas la forme interne des données ni l'enchaînement des fonctions.
- **Point de test principal : les e2e Playwright.** Les données se posent par `seedPlanning`, qu'on étend pour accepter des plages par élève. Les aides vont dans `e2e/support/`. Scénarios couverts :
  - saisie et effacement des plages dans la fiche ;
  - indicateur et filtre de la liste ;
  - saisie en série : enchaînement, passage, fin, interruption ;
  - tri et badge des candidats, et signalement des membres dans la composition ;
  - avertissement agrégé sur un cours, dans la fiche au survol et dans le panneau « Avertissements » ;
  - avertissement sur une séance modifiée ou un cours ponctuel en semaine précise ;
  - ombrage pendant le glisser ;
  - reprise des plages à la duplication de saison (prouvée en L17 par les tests du dépôt `seasonDuplication`, sur une vraie base SQLite ; aucun écran ne montre les plages avant L18).
  
  Modèles existants : `e2e/referentiels.spec.ts`, `e2e/grille.spec.ts`, `e2e/planning.spec.ts`, `e2e/saisons.spec.ts`, `e2e/saisie-volume.spec.ts`.
- **Tests unitaires existants des conflits.** On ajoute à ceux de `conflicts` les cas du 7e contrôle :
  - couverture totale ou partielle du créneau ;
  - élève sans plage ;
  - agrégation par créneau ;
  - séance annulée ignorée.
- **Tests unitaires existants de duplication et de RGPD.** Ceux de `seasonDuplication` et de `rgpd` s'étendent pour vérifier la reprise des plages et leur présence dans l'export.
- **Aucun nouveau module de test dédié.** La compatibilité d'un élève avec un groupe (`incompatibleLessons`) est une fonction pure : ses cas (cours fautifs, groupe sans cours, élève sans plage) s'ajoutent au test existant de `availability`, comme le veut `docs/CODING_STANDARDS.md` (amendé en L17). Exception (amendé en L20) : la présentation de la composition, extraite en fonctions pures dans `src/features/referentiels/groupes/composition.ts`, a son test `composition.test.ts` : choix de la version des cours en vigueur (« Appliquer à partir de ») et date ramenée dans la saison, tri des candidats avant la coupe à 8, texte joint de plusieurs cours fautifs, accord et tri accentué de l'alerte des membres. Autre exception (amendé en L19) : le parcours de la saisie en série, extrait en fonctions pures dans `src/features/referentiels/eleves/series.ts`, a son test `series.test.ts` (progression, enchaînement, arrêt au dernier élève, bilan accordé du toast). Le gel de la série au lancement est prouvé par l'e2e. Le calcul de l'ombrage est couvert par les e2e de la grille (`e2e/ombrage-eleves.spec.ts`) ; amendé en L21, ses règles pures (découpage, paliers, groupe ombré selon le geste) ont aussi des cas dans les tests existants `grid/view.test.ts` et `interaction.test.ts`.
- Performance : on vérifie l'ombrage sur le jeu `seedVolume` si le scénario de charge existant (`e2e/charge.perf.spec.ts`) s'y prête.

## Out of Scope

- Saisie des disponibilités par les élèves eux-mêmes, et tout accès externe à l'application.
- Indisponibilités datées des élèves (vacances, stages, absence ponctuelle).
- Disponibilités dans l'import CSV, Excel ou par collage, ainsi que dans les exports.
- Saisie grossière par jours ou demi-journées.
- Copie des mêmes plages vers plusieurs élèves à la fois.
- Recherche de créneau ou carte de chaleur dédiée, en dehors de l'ombrage pendant le glisser.
- Génération ou proposition automatique de planning (toujours hors périmètre, §1.2).
- Tout contrôle bloquant.

## Further Notes

- Le comportement par défaut diffère de celui des moniteurs : un élève sans plage est disponible partout, un moniteur sans plage est indisponible partout. Il faut le dire dans la fiche élève, pour éviter qu'on croie que la règle est la même.
- Les quelque 300 élèves existants n'ont aucune plage à la mise en service. La grille ne doit donc montrer aucun nouvel avertissement tant que rien n'est saisi.
- Le guidage (§4.5) n'est pas modifié : renseigner les disponibilités des élèves ne devient pas une étape obligatoire.
