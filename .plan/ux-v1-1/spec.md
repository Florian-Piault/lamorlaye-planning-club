# Spec — Corrections UX v1.1 (retours personas)

Synthèse de la carte [Corrections UX v1.1](map.md) : chaque décision renvoie au ticket qui en garde le détail. Source : le [test d'utilisabilité à deux personas](https://claude.ai/artifact/FpvQwdukveg58QyMz4QVH1), Alex (expert, saisit vite) et Monique (bénévole débutante).

## Problem Statement

Kairos fait ce qu'il promet, mais la responsable bénévole d'un club de tennis s'y perd ou s'y fait piéger :

- **Rien n'est stable sous le curseur** : un avertissement, un bandeau ou un compteur qui apparaît fait descendre les boutons, et elle clique à côté (le bouton « Créer le cours » saute de ~17 px). Les modales ouvrent le focus sur la croix, Échap dans un sélecteur de date ferme toute la fenêtre et efface la saisie, sans confirmation.
- **Elle ne sait pas par où commencer** : un planning vide ne dit pas qu'il faut d'abord une saison, des courts, des moniteurs et des groupes ; l'aide-mémoire du planning est un pavé qui annonce un raccourci qui ne marche pas.
- **Le vocabulaire est celui du développeur** : « semaine type », « semaine datée », « exception », « occurrence », « référentiels », « amplitude », « hors vigueur », SQLite, AES-256 ; les boutons icône n'ont qu'un `title` natif lent et inaccessible au clavier.
- **Les doublons passent sans un mot** : même élève saisi deux fois, mêmes initiales pour deux moniteurs, deux courts du même nom ; un enfant coché dans un groupe hors de sa tranche d'âge n'est signalé qu'après coup.
- **Saisir 60 élèves est une corvée** : un formulaire qui se referme après chaque élève, aucun collage depuis Excel, un champ d'ajout de la fiche groupe qui ne se vide pas, un téléphone exigé même quand seul le parent en a un.
- **La grille est illisible sur un portable** : à 960 px, le menu et le panneau prennent plus de la moitié de la largeur, les bandeaux plus de 300 px de hauteur, les courts s'appellent « C1, C2 ».
- **Des bugs** : glisser de 14 h à 18 h dans les disponibilités donne 14:00–18:15, un simple clic y crée 15 min par mégarde, les hachures montrent le mauvais moniteur, un moniteur déjà en cours est dit « disponible », l'Ascension est rangée « pendant les vacances », les erreurs de formulaire ne s'effacent pas, la création d'une saison n'est pas confirmée, les cases à cocher sont lues « on ».

## Solution

Un lot v1.1 qui ne change pas le modèle métier mais rend l'application stable, guidante et parlante, sans ralentir l'expert :

- **Stabilité** : une zone de message réservée commune, un toast commun pour les succès et les erreurs du planning, une barre de mode à hauteur fixe, des éléments conditionnels toujours présents ; des modales qui donnent le focus au premier champ, traitent Échap en cascade et ne demandent confirmation que si la saisie a changé ; une raison visible pour tout bouton grisé.
- **Guidage fondu dans la navigation** : pastilles d'étape sur les onglets du club, accueil « Avant de construire le planning » à la place des états vides, toast à chaque étape franchie ; tout s'efface une fois les données saisies.
- **Mode d'emploi du planning** : une astuce selon le contexte, le texte complet sur demande.
- **Mots simples** : « Planning habituel » / « Une semaine précise », « Le club », « En cours / Terminée », plus d'« exception » ni d'« occurrence » à l'écran ; Tooltip commun sur toute icône ; détails techniques repliés.
- **Doublons et âge signalés tôt**, jamais bloquants.
- **Saisie en volume** : « Enregistrer et ajouter un autre », collage tableur dans l'import, champ d'ajout de la fiche groupe efficace, téléphone élève ou responsable.
- **Grille lisible** : vue un jour à la fois, panneau et menu repliables, une seule barre d'outils, vrais noms de courts, fiche du cours au survol.
- **Bugs B1 à B12 corrigés**, avec les règles métier arbitrées.

## User Stories

### Stabilité et modales

1. En tant que responsable du club, je veux que les boutons restent à leur place quand un avertissement apparaît, afin de ne pas cliquer à côté.
2. En tant que responsable, je veux voir les avertissements d'un formulaire toujours au même endroit, dans une zone de deux lignes réservée, afin de savoir où regarder.
3. En tant que responsable, je veux qu'au-delà de deux avertissements une ligne « + N autres avertissements » se déplie au clic, afin que rien ne bouge sans que je l'aie demandé.
4. En tant que responsable, je veux que l'erreur générale d'un formulaire s'affiche en rouge dans cette même zone, au-dessus des boutons, afin de la voir sans que les boutons se déplacent.
5. En tant que responsable, je veux qu'une erreur sous un champ s'efface dès que je corrige ce champ, afin de savoir que ma correction est prise en compte (B10).
6. En tant que responsable, je veux une confirmation brève en bas à droite après chaque enregistrement, afin de savoir que c'est fait sans que l'écran bouge.
7. En tant que responsable, je veux que ces confirmations disparaissent seules après quelques secondes mais restent tant que je les survole, afin d'avoir le temps de les lire.
8. En tant que responsable, je veux qu'une erreur du planning reste affichée jusqu'à ce que je la ferme, afin de ne pas la manquer.
9. En tant qu'utilisatrice d'un lecteur d'écran, je veux que les confirmations et erreurs soient annoncées, afin d'être informée comme les autres.
10. En tant que responsable, je veux que la création d'une saison soit confirmée par « Saison « 2026-2027 » créée », afin de ne pas croire qu'il ne s'est rien passé (B11).
11. En tant que responsable, je veux que la barre de mode du planning garde toujours la même hauteur, afin que le panneau latéral ne saute pas au survol d'un cours (B7).
12. En tant que responsable, je veux que « Effacer les filtres » soit toujours visible, grisé quand aucun filtre n'est actif, afin que la barre ne change pas de forme.
13. En tant que responsable, je veux que les résultats de recherche de la fiche groupe s'affichent dans une liste superposée, afin que le tableau ne descende pas.
14. En tant que responsable, je veux que le curseur soit dans le premier champ à l'ouverture d'une fenêtre, afin de taper tout de suite (B3).
15. En tant que responsable, je veux qu'une fenêtre sans champ mette le focus sur le bouton non destructif, afin de ne pas supprimer par erreur avec Entrée.
16. En tant que responsable, je veux qu'Échap ferme d'abord le calendrier ou la liste ouverte, et seulement ensuite la fenêtre, afin de ne pas perdre ma saisie.
17. En tant que responsable, je veux qu'Échap tapé dans un champ du panneau de cours ne ferme pas le panneau, afin de ne pas perdre le cours en cours de saisie.
18. En tant que responsable, je veux qu'on me demande « Abandonner les modifications ? » si je ferme une fenêtre dont j'ai changé la saisie, afin de ne pas la perdre par mégarde.
19. En tant qu'experte, je veux qu'une fenêtre que je n'ai pas modifiée se ferme sans question, afin de ne pas être ralentie.
20. En tant que responsable, je veux que la confirmation propose « Continuer la saisie » par défaut, afin qu'un Entrée réflexe ne jette rien.
21. En tant que responsable, je veux que choisir un autre créneau alors que le panneau de cours est modifié me demande confirmation, afin de ne pas perdre le cours commencé.
22. En tant que responsable, je veux lire pourquoi un bouton est grisé, à côté du bouton et au survol, afin de savoir quoi faire pour l'activer.
23. En tant qu'utilisatrice d'un lecteur d'écran, je veux que chaque case à cocher soit annoncée par son libellé, afin de savoir ce que je coche (B12).

### Guidage de la première utilisation

24. En tant que nouvelle responsable, je veux voir sur les onglets du club l'ordre des étapes (Saison, Courts, Moniteurs, Groupes, Élèves), afin de savoir par où commencer.
25. En tant que nouvelle responsable, je veux qu'une coche remplace le numéro d'une étape faite et que l'étape suivante soit en couleur, afin de voir où j'en suis.
26. En tant que nouvelle responsable, je veux que Niveaux et Fermetures ne portent pas de pastille, afin de comprendre qu'ils peuvent attendre.
27. En tant que nouvelle responsable, je veux qu'un planning vide m'accueille par « Avant de construire le planning », avec le lien cours / court / moniteur / groupe et les étapes cochées, afin de comprendre ce qui manque.
28. En tant que nouvelle responsable, je veux un seul bouton vers l'étape suivante, afin de ne pas hésiter.
29. En tant que nouvelle responsable, je veux un toast à chaque étape franchie pour la première fois, avec un lien « Étape suivante », afin d'enchaîner.
30. En tant qu'experte, je veux que tout ce guidage disparaisse de lui-même une fois les données saisies et le premier cours placé, afin de ne rien avoir à fermer.

### Mode d'emploi du planning

31. En tant que responsable, je veux une astuce d'une phrase en tête du panneau, qui change selon ce que je fais, afin d'apprendre au bon moment.
32. En tant que nouvelle responsable, je veux que l'astuce me dise de commencer par « + Nouveau cours » quand aucun cours n'est placé, afin de créer mon premier cours.
33. En tant que responsable, je veux que l'astuce m'explique, quand un cours est sélectionné, comment le déplacer, changer sa durée, le supprimer et annuler, afin de le modifier sans chercher.
34. En tant que responsable, je veux un bouton bien visible « Tout le mode d'emploi », afin de lire l'ensemble quand je le souhaite.
35. En tant que responsable, je veux que le mode d'emploi commence par « Les bases » puis « Pour aller plus vite », afin de ne pas être noyée.
36. En tant qu'utilisatrice Mac, je veux voir ⌘ et ⌥ là où Windows voit Ctrl et Alt, afin que les raccourcis annoncés soient les miens.
37. En tant que responsable, je veux que seul Ctrl/⌘ N soit annoncé pour créer un cours, afin de ne pas essayer un « N » seul qui ne marche pas (B4).

### Vocabulaire et bulles d'aide

38. En tant que responsable, je veux choisir entre « Planning habituel » et « Une semaine précise », afin de comprendre ce que je modifie.
39. En tant que responsable, je veux une phrase toujours visible qui dit si mes changements valent pour toute la saison ou pour cette semaine seulement, afin de ne pas me tromper de portée.
40. En tant que responsable, je veux lire « Modifié cette semaine », « Annulé cette semaine » et « Revenir au cours habituel », afin de comprendre sans connaître « exception » ni « occurrence ».
41. En tant que responsable, je veux que les cours qui changent plus tard dans la saison soient signalés par une pastille en mots simples, afin de comprendre pourquoi ils n'apparaissent pas.
42. En tant que responsable, je veux que le menu s'appelle « Le club », afin de reconnaître où sont mes fiches.
43. En tant que responsable, je veux lire « En cours », « Terminée » et « Affichée » pour les saisons, afin de savoir laquelle je consulte.
44. En tant que responsable, je veux saisir des « horaires de disponibilité » d'un moniteur, afin de ne pas confondre avec les créneaux des cours.
45. En tant que responsable, je veux une bulle d'aide au survol et au clavier sur chaque bouton icône, afin de savoir ce qu'il fait.
46. En tant que responsable, je veux un libellé visible à côté des icônes rares (données personnelles, retirer du groupe), afin de ne pas deviner.
47. En tant que responsable, je veux que Réglages et Import/Export parlent simplement, avec les détails techniques repliés, afin de ne pas être effrayée.
48. En tant que responsable, je veux un bouton « Exporter vers Excel », afin d'exporter sans savoir ce qu'est un CSV.

### Doublons et alerte d'âge

49. En tant que responsable, je veux être avertie dès que je saisis le nom et le prénom d'un élève qui existe déjà cette saison, afin de ne pas le créer deux fois (B1).
50. En tant que responsable, je veux un lien « Ouvrir sa fiche » vers l'élève existant, afin de le compléter plutôt que de le dupliquer.
51. En tant que responsable, je veux pouvoir enregistrer quand même, afin de gérer de vrais homonymes.
52. En tant que responsable, je veux, pour un élève inscrit une saison passée, un bouton « Reprendre ses coordonnées », afin de ne pas tout ressaisir.
53. En tant que responsable, je veux voir date de naissance et groupes d'un élève partout où un homonyme existe, afin de choisir le bon.
54. En tant que responsable, je veux être avertie que des initiales sont déjà prises, avec une proposition en un clic, afin de distinguer deux moniteurs sur la grille (B2).
55. En tant que responsable, je veux être avertie qu'un court du même nom existe, afin de ne pas le créer deux fois (B5).
56. En tant que responsable, je veux voir la tranche d'âge de chaque groupe dans la liste à cocher, avec « hors tranche » pour l'élève saisi, afin de choisir le bon groupe.
57. En tant que responsable, je veux un avertissement « Léa aura 11 ans, Galaxie vert est pour les 6–8 ans » au cochage ou à la saisie de la date, afin de corriger tout de suite.
58. En tant que responsable, je veux que l'aperçu d'import marque et compte les lignes hors tranche, afin de les repérer avant d'importer.

### Saisie des élèves en volume

59. En tant que responsable, je veux « Enregistrer et ajouter un autre » qui garde les groupes cochés et le niveau, afin d'enchaîner les élèves d'un même groupe.
60. En tant que responsable, je veux coller un tableau copié depuis Excel dans l'import, afin de ne pas créer de fichier.
61. En tant que responsable, je veux que le collage sans ligne d'en-têtes soit reconnu et ses colonnes nommées « Colonne A, B… » avec un aperçu, afin de les associer quand même.
62. En tant que responsable, je veux « Importer ou coller une liste » depuis l'onglet Élèves et depuis la fiche groupe, afin de trouver l'import là où j'en ai besoin.
63. En tant que responsable, je veux que l'import lancé depuis une fiche groupe affecte les élèves à ce groupe, afin de ne pas ajouter une colonne Groupe.
64. En tant que responsable, je veux que le champ « Ajouter un élève » de la fiche groupe se vide après chaque ajout et garde le focus, afin d'en ajouter plusieurs à la suite.
65. En tant qu'experte, je veux qu'Entrée ajoute le résultat unique ou celui en surbrillance, afin de ne pas prendre la souris.
66. En tant que responsable, je veux « Créer « Léa Martin » » quand l'élève cherché n'existe pas, afin de le créer déjà affecté au groupe.
67. En tant que responsable, je veux rester sur la liste après avoir créé un groupe, avec un lien « Ajouter des élèves », afin de créer plusieurs groupes d'affilée.
68. En tant que responsable, je veux qu'un seul téléphone suffise, celui de l'élève ou celui du responsable, afin d'inscrire un enfant sans téléphone.
69. En tant que responsable, je veux voir le téléphone du responsable suivi de « (resp.) » quand l'élève n'en a pas, afin de savoir qui j'appelle.
70. En tant que responsable, je veux que le niveau soit proposé depuis le premier groupe coché tant que je ne l'ai pas choisi, afin de gagner un champ.
71. En tant que responsable, je veux saisir le prénom avant le nom, afin de suivre l'ordre naturel.

### Lisibilité de la grille

72. En tant que responsable sur un portable, je veux afficher un seul jour à la fois, afin de lire les noms des groupes.
73. En tant que responsable, je veux une barre des jours avec le nombre de cours de chaque jour, afin d'aller au jour chargé.
74. En tant que responsable, je veux cliquer l'en-tête d'un jour en vue Semaine pour l'afficher seul, afin de zoomer d'un geste.
75. En tant que responsable, je veux naviguer entre les semaines dans la même barre que les jours, afin de garder l'en-tête simple.
76. En tant que responsable, je veux replier le panneau latéral, et qu'il se rouvre seul quand j'ouvre ou crée un cours, afin de donner la place à la grille.
77. En tant que responsable, je veux réduire le menu de l'application aux icônes, choix mémorisé, afin de gagner de la largeur partout.
78. En tant que responsable, je veux une seule barre d'outils sur le planning, filtres dans un menu, afin de gagner de la hauteur.
79. En tant que responsable, je veux voir le vrai nom des courts, abrégé si besoin, avec une icône soleil ou maison, afin de reconnaître les courts sans légende.
80. En tant que responsable, je veux une fiche du cours au survol, afin de lire le nom complet, l'horaire, le moniteur, l'effectif et les avertissements.

### Bugs aux règles métier arbitrées

81. En tant que responsable, je veux que glisser de 14 h à 18 h dans les disponibilités donne 14:00–18:00, afin d'obtenir ce que j'ai tracé (B6).
82. En tant que responsable, je veux qu'un simple clic dans la frise ne modifie rien mais pré-remplisse le formulaire « Jour / De / À », afin de ne pas créer 15 min par mégarde.
83. En tant que responsable, je veux qu'un clic sur un horaire existant reprenne toute la plage avec « Retirer », afin de la corriger au clavier.
84. En tant que responsable, je veux pouvoir annuler depuis le toast chaque changement de disponibilité, afin de réparer une fausse manœuvre.
85. En tant que responsable, je veux voir dans « Nouveau cours » les moniteurs disponibles, puis ceux déjà occupés sur ce créneau avec leur cours, puis les indisponibles, afin de choisir en connaissance de cause.
86. En tant que responsable, je veux pouvoir choisir quand même un moniteur occupé, avec un avertissement, afin de gérer un cas particulier.
87. En tant que responsable, je veux que les hachures montrent le moniteur choisi dans le panneau, même si la souris est restée sur un autre cours, afin de lire les bonnes indisponibilités (B8).
88. En tant que responsable, je veux que l'assistant des fermetures ne décoche un jour férié que si une période cochée le couvre, et le recoche si je décoche cette période, afin de ne pas oublier l'Ascension (B9).
89. En tant que responsable, je veux que le badge d'un jour férié nomme la période qui le couvre, afin de comprendre pourquoi il est décoché.

## Implementation Decisions

### Composants communs (socle, à faire en premier)

- **Zone de message réservée** : nouveau composant de l'interface commune. Hauteur fixe de deux lignes toujours réservée à l'emplacement du message, vide = blanc. Reçoit une liste ordonnée de messages typés (erreur, avertissement, information) ; l'erreur générale passe en tête, en rouge. Au-delà de deux, la dernière ligne devient « + N autres avertissements », dépliable au clic. Remplace l'actuel bloc d'erreur générale des formulaires et accueille : « Élève mineur… », avertissements du créneau du panneau de cours, compteurs de la fiche groupe, doublons, tranches d'âge. Détail : [Principe anti-décalage et règles des modales](issues/06-stabilite-et-modales.md).
- **Toast commun** à toute l'application, remplaçant celui du planning : en bas à droite, un seul visible (le nouveau remplace l'ancien), succès effacés après ~4 s avec pause au survol, erreurs persistantes jusqu'à fermeture, région `aria-live`. Interface : un message, un type, une action facultative (libellé + effet : « Annuler », « Étape suivante : … », « Ajouter des élèves »). Les messages de succès en ligne (« Modifications enregistrées. », `<output>` au-dessus des tableaux) disparaissent ; le bandeau d'erreur du planning devient un toast d'erreur.
- **Garde de modale** dans le composant de fenêtre commun (couvre les 15 modales) et appliquée au panneau de cours : focus initial sur le premier champ après l'ouverture native (sinon bouton principal non destructif) ; Échap en cascade (sous-élément ouvert d'abord) ; suivi « dirty » (saisie différente de l'état à l'ouverture) qui déclenche « Abandonner les modifications ? » — « Continuer la saisie » (focus, Entrée) / « Abandonner » — pour tout moyen de fermer, et pour le panneau de cours aussi au choix d'un autre créneau. Le composant de fenêtre gagne de quoi déclarer l'état modifié.
- **Raison de bouton grisé** : le bouton commun reçoit une raison de désactivation, affichée en petit texte visible (dans une zone réservée) et en bulle. Cas connus : « Ajouter un horaire », aperçu PDF, navigation des semaines, « Effacer les filtres ».
- **Tooltip commun** : survol ~300 ms et focus clavier, sur tout bouton icône ; remplace les `title` natifs. Sert aussi à la fiche du cours au survol et aux pastilles de la barre de mode. Détail : [Vocabulaire et bulles d'aide](issues/09-vocabulaire-et-bulles.md).
- **Effacement des erreurs de champ** : aide commune utilisée par les sept formulaires, qui efface l'erreur d'un champ dès qu'il change (B10).
- **Cases à cocher** : lien explicite entre la case et son libellé (identifiant généré) dans le composant de saisie commun (B12).
- **Touches selon le système** : une aide unique qui rend Ctrl/⌘, Alt/⌥, Suppr/⌫ selon la plateforme, utilisée par l'astuce, le mode d'emploi et les bulles.

### Guidage et mode d'emploi

- **Étapes du guidage** : Saison, Courts, Moniteurs, Groupes, Élèves ; étape faite = au moins un enregistrement dans la saison ; le guidage se clôt au premier cours placé. Un module du domaine calcule l'état des étapes à partir des comptes de la saison ; l'interface l'utilise pour les pastilles d'onglet, l'accueil du planning et les toasts de première fois (avec action « Étape suivante »). Rien n'est mémorisé ni masquable. Prototype retenu (variante C) : [archive](prototypes/guidage-premiere-utilisation/README.md) ; détail : [Guidage de la première utilisation](issues/08-guidage-premiere-utilisation.md).
- **Accueil « Avant de construire le planning »** : remplace les états vides « Aucune saison » et « Aucun court » tant qu'une étape avant le planning manque ; un seul bouton vers l'étape suivante.
- **Mode d'emploi** : astuce contextuelle en tête du panneau latéral (trois états : aucun cours placé, cours sélectionné, sinon), bouton « Tout le mode d'emploi » / « Masquer le mode d'emploi » replié à chaque ouverture, texte en deux parties « Les bases » puis « Pour aller plus vite ». Remplace l'aide-mémoire actuel ; seul Ctrl/⌘ N annoncé (B4). Prototype retenu (variante C) : [archive](prototypes/mode-emploi-planning/README.md) ; détail : [Mode d'emploi du planning](issues/10-mode-emploi-planning.md).

### Vocabulaire

- Termes métier inchangés dans le code et le modèle ; seuls les libellés affichés changent. Table de correspondance et libellés adoptés : [Vocabulaire et bulles d'aide](issues/09-vocabulaire-et-bulles.md), libellés relevés dans l'[Inventaire des libellés techniques et des icônes sans aide](issues/04-inventaire-jargon.md).
- Phrase de portée toujours visible dans la barre de mode.
- Section repliée « Détails techniques » sur Réglages, sauvegarde, RGPD et Import/Export ; export principal « Exporter vers Excel », CSV dans les détails.

### Doublons et âge

- **Détection de doublon d'élève** (domaine) : nom + prénom sans casse ni accents ; dates de naissance comparées seulement si les deux sont connues ; sur toutes les saisons, fiche éditée exclue. Résultat distinguant « dans la saison en cours » (lien « Ouvrir sa fiche », sous la garde « dirty ») et « seulement dans une saison passée » (« Reprendre ses coordonnées » depuis la saison la plus récente : téléphone, e-mail, naissance, responsable, niveau, classement ; pas les groupes). S'appuie sur le rapprochement d'identité existant du RGPD et de l'import. Désignation d'un élève avec date de naissance et groupes dès qu'un homonyme existe, toujours dans la confirmation de suppression.
- **Initiales** déjà prises dans la saison : avertissement avec la proposition de la suggestion d'initiales existante, appliquée en un clic. **Nom de court** déjà pris (sans casse ni accents) : avertissement.
- **Tranche d'âge** : âge au début de saison (comme la fiche groupe et les conflits) ; liste à cocher du formulaire élève avec tranche et mention « hors tranche », ordre inchangé ; avertissement au cochage et à la saisie de la date ; aperçu d'import avec lignes marquées et compteur. Clé de doublon de l'import inchangée.
- Aucun contrôle bloquant. Détail : [Doublons et alerte d'âge](issues/07-doublons-et-alerte-age.md).

### Saisie en volume

- Formulaire élève : « Enregistrer et ajouter un autre » (groupes et niveau gardés, toast « Léa Martin ajoutée ») ; Prénom avant Nom (aussi pour le moniteur) ; niveau proposé depuis le premier groupe coché tant qu'il n'est pas choisi (même modèle que les initiales suggérées).
- **Téléphone** : au moins un des deux, élève ou responsable légal, dans la validation de la fiche et de l'import. **Migration** : la colonne du téléphone de l'élève devient nullable. Affichage (liste, fiche groupe) : téléphone de l'élève sinon celui du responsable suivi de « (resp.) » ; les exports gardent deux colonnes.
- **Collage tableur** : l'étape 1 de l'import propose « Coller depuis Excel » ; le texte collé suit la même lecture que les fichiers texte (détection du séparateur), puis correspondance, aperçu et commande d'import annulable inchangés. Le format de fichier gagne une variante « collé ». Détection de l'absence d'en-têtes (aucune cellule de la 1ʳᵉ ligne ne ressemble à un en-tête connu) avec case modifiable et colonnes « Colonne A, B… ».
- Liens « Importer ou coller une liste » depuis l'onglet Élèves et la fiche groupe ; depuis la fiche, groupe pré-affecté en l'absence de colonne Groupe.
- Fiche groupe : champ d'ajout vidé avec focus conservé, Entrée et ↑/↓, « Créer « Prénom Nom » » qui ouvre le formulaire pré-rempli avec le groupe coché et revient à la fiche. Création d'un groupe : on reste sur la liste, toast avec « Ajouter des élèves ».
- Détail : [Saisie des élèves en volume](issues/11-saisie-eleves-volume.md), faits dans [État de la saisie des élèves et de l'import](issues/03-saisie-eleves-et-import.md).

### Grille

- Vue « Semaine / Jour » avec barre des jours (compte de cours par jour, flèches, dimanche toujours atteignable) ; en semaine précise, la navigation des semaines ouvre cette barre ; clic sur l'en-tête d'un jour en vue Semaine. La vue Semaine garde le défilement horizontal.
- Panneau latéral repliable sans rail, rouvert à l'ouverture ou la création d'un cours ; menu de l'application réductible aux icônes, choix mémorisé (préférence locale).
- Une seule barre d'outils : barre haute masquée sur le Planning (sélecteur de saison dans l'en-tête, titre réservé aux lecteurs d'écran), Annuler / Rétablir / PDF en icônes, filtres dans un menu « Filtres » avec compteur, pastilles moniteurs réduites (couleur + prénom), total d'heures retiré de la barre.
- Bandeau de mode sur une ligne fine à hauteur fixe ; informations en pastilles courtes avec détail en bulle.
- En-têtes de courts : vrai nom abrégé selon la largeur, icône soleil / maison, nom complet au survol, légende « couvert · extérieur ». Fiche du cours au survol (après un court délai, disparaît au clic ou au défilement).
- Prototype retenu (variante G) : [archive](prototypes/lisibilite-grille/README.md) ; détail : [Lisibilité de la grille](issues/12-lisibilite-grille.md).

### Corrections de bugs

Causes et points de correction : [Causes des bugs mécaniques](issues/02-causes-bugs-mecaniques.md) ; règles arbitrées : [Arbitrages métier des bugs](issues/13-arbitrages-bugs-metier.md).

- **B6** : la fin d'une plage glissée est la limite de case la plus proche du pointeur, plus « dernière case survolée + 15 min ».
- **Frise des disponibilités** : seuil de glisser de quelques pixels ; en deçà, le clic pré-remplit le formulaire (case vide : heure cliquée + 1 h, « Ajouter » ; case disponible : plage entière, « Ajouter » et « Retirer »). Chaque changement enregistré produit un toast avec « Annuler » qui restaure les plages précédentes ; pas d'historique.
- **B8** : l'état d'interaction du planning gagne le moniteur du panneau, prioritaire juste après le glisser, avant le survol et l'épinglage.
- **Moniteurs dans « Nouveau cours »** : le calcul des choix de moniteurs reçoit les cours du créneau (cours édité exclu) et rend trois groupes : Disponibles, Occupés sur ce créneau (avec le cours), Indisponibles (prioritaire si les deux ; la ligne mentionne alors le cours). Tous sélectionnables, conflit signalé. Hachures inchangées.
- **B9** : dans les propositions de l'assistant des fermetures, un jour férié est « compris dans » une période seulement si cette période est cochée ; le calcul suit la sélection en direct ; le badge nomme la période.
- **B11** : plus de « Modifications enregistrées. » à la création, rechargement attendu, toast « Saison « X » créée » (et toast d'étape du guidage).
- **B3, B4, B7, B10, B12** : couverts par les composants communs et le mode d'emploi ci-dessus.

### Amendements de `SPECS.md`

- Déjà faits (ticket des arbitrages) : §3.3 (frise, clic, annulation), §3.8 (ponts et jours fériés), §5.1 (trois groupes de moniteurs).
- À faire avec les lots concernés : §2 (colonne « Libellé affiché » et termes manquants), §3.5 (téléphone élève ou responsable), §4.1 (vue Jour, vrais noms de courts), §7 (doublons d'élève, d'initiales et de court), §8 (alerte d'âge dans le formulaire et l'import, reprise des coordonnées).

## Testing Decisions

- **Ce qu'est un bon test** : il décrit un comportement observable par l'utilisatrice ou une règle du domaine, jamais la structure interne d'un composant. Les tests de l'interface trouvent les éléments par leur rôle et leur nom accessible, comme les tests e2e existants ; ceux du domaine appellent les fonctions pures avec des données de saison.
- **Deux points de test, déjà en place, aucun nouveau** :
  1. **Parcours dans le navigateur (Playwright, base en mémoire)**, point principal pour tout ce qui se voit :
     - stabilité de la mise en page : position des boutons mesurée avant et après l'apparition d'un avertissement, au survol d'un cours (barre de mode), à l'ajout d'un membre dans un groupe ; débordement « + N autres » ;
     - modales : focus initial (premier champ, bouton non destructif), Échap en cascade dans un sélecteur de date, confirmation seulement si modifiée, panneau de cours et changement de créneau ;
     - toasts : succès, erreur persistante, action « Annuler » (disponibilités), annonce `aria-live` ;
     - guidage depuis une base vide jusqu'au premier cours ; astuce et mode d'emploi ;
     - doublons et tranches d'âge dans les formulaires et l'aperçu d'import ; collage tableur avec et sans en-têtes ; ajout en chaîne dans la fiche groupe ;
     - grille : vue Jour, panneau et menu repliés, en-têtes de courts, fiche au survol ;
     - accessibilité : noms accessibles (cases à cocher, boutons icône), contrastes et arrêts de tabulation sur les nouveaux écrans, Tooltip au clavier.
  2. **Fonctions pures du domaine (vitest)**, pour les règles et leurs cas limites : détection de doublon d'élève (dates connues ou non, saisons), initiales et noms de court, âge et tranche, état des étapes du guidage, propositions de fermetures (férié et période cochée ou non, ponts), choix des moniteurs en trois groupes (chevauchement partiel, cours édité exclu, occupé et indisponible), règle du téléphone (fiche et import), lecture d'un collage (séparateur, absence d'en-têtes), bornes d'une plage glissée et clic sous le seuil.
- **Pas de tests de composants React isolés.**
- **Prior art** : les spécifications e2e des référentiels, du planning, de l'import et d'accessibilité (aides de contraste, arrêts de tabulation et contrôles sans nom déjà disponibles) ; les tests du domaine sur la disponibilité des moniteurs, le calendrier scolaire, l'import d'élèves, la lecture de fichier d'import, les initiales, les groupes, les conflits et la validation. Les tests existants qui figent l'ancien comportement (glisser des disponibilités à +15 min, libellés renommés) sont mis à jour, pas contournés.

## Out of Scope

- Frictions secondaires hors des chantiers : réglages métier (durée par défaut d'un cours, pas de la grille, zone scolaire), déplacement d'un cours aux flèches, poignée de redimensionnement, Ctrl+N qui reprend le contexte, Alt+glisser et import non testés jusqu'au bout.
- B13 (aperçu PDF noir) : ne se reproduit pas dans l'application de bureau ([Vérifier l'aperçu PDF dans l'application de bureau](issues/05-verifier-apercu-pdf.md)).
- Lexique affiché dans l'application ; historique Annuler / Rétablir complet dans l'éditeur des disponibilités ; hachures sur les cours déjà affectés.
- Variantes de prototypes non retenues (carte et bandeau de guidage masquables, aide flottante, grille tenant en largeur, loupe, plein écran…).
- Le découpage en lots (`LOTS-V1.1.md`) : fait à partir de cette spec, pas dedans.

## Further Notes

- **Ordre suggéré pour le découpage** : le socle commun (zone réservée, toast, garde de modale, raison de bouton grisé, Tooltip, touches selon le système, erreurs de champ, cases à cocher) précède tout le reste, car guidage, doublons, saisie en volume, disponibilités et grille s'appuient dessus. La migration du téléphone est indépendante.
- **Point à régler à l'implémentation** : à 960 px, l'en-tête du planning tient encore sur deux lignes (pastilles moniteurs et saison passent à la ligne) ; à résoudre dans le lot de la grille, dans l'esprit de la variante G.
- **Documentation** : `docs/DEMARRAGE-RAPIDE.md` est à réécrire avec le guidage, le mode d'emploi et le nouveau vocabulaire, dans le lot qui les livre.
- Chaque chantier se juge avec les deux profils : rien de ce qui aide Monique ne doit ralentir Alex (pas de confirmation sur une saisie intacte, guidage qui s'efface, raccourcis gardés).
