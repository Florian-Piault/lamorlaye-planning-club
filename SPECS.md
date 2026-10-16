# Spécifications — Planning Club de tennis

> Version 1.2 — 14/10/2026
> Statut : à valider

## 1. Objet

Application de bureau multiplateforme (macOS, Windows, Linux) permettant au responsable d'un club de tennis de construire et maintenir le planning des cours collectifs de la saison : constitution des groupes d'élèves, répartition des groupes entre moniteurs selon leurs disponibilités, affectation aux courts.

### 1.1 Périmètre V1

- Application **100 % hors ligne** : aucune requête réseau, aucun compte, aucune mise à jour automatique.
- Installée et utilisée sur **un seul poste**, par **un seul utilisateur** (le responsable). Pas d'authentification.
- Langue : français uniquement.

### 1.2 Hors périmètre V1

- Synchronisation multi-postes, version web, accès moniteurs/élèves.
- Envoi d'e-mails ou SMS.
- Facturation, gestion des adhésions, des paiements, de la réservation de courts libres.
- Saisie des présences et statistiques d'assiduité (feuille d'appel papier uniquement).
- Module de stages dédié (inscriptions, tarifs).
- Cours encadrés par plusieurs moniteurs.
- Génération automatique du planning (solveur).

## 2. Glossaire

Les termes métier sont ceux du code et du modèle de données ; l'interface affiche le libellé de la colonne « Libellé affiché » (spec UX v1.1, Vocabulaire). Aucun lexique n'est affiché dans l'application : les libellés se suffisent, avec une bulle d'aide sur les boutons icône.

| Terme | Libellé affiché | Définition |
|---|---|---|
| Saison | Saison | Période d'activité (ex. 01/09/2026 → 30/06/2027) ayant sa propre semaine type, ses fermetures et ses groupes. |
| Saison active / archivée / consultée | En cours / Terminée / Affichée | Une seule saison est active ; les précédentes sont archivées, en lecture seule (« Consultation seulement (saison terminée) »). La saison consultée est celle que montrent les écrans. |
| Référentiels | Le club (menu, page) ; Fiches du club (onglets) | Saison, courts, moniteurs, niveaux, groupes, élèves et fermetures de la saison. |
| Court | Court | Terrain sur lequel se déroule un cours. Un cours occupe un court. |
| Moniteur | Moniteur | Enseignant qui assure les cours. Identifié par une couleur. |
| Plage (de disponibilité) | Horaire de disponibilité ; section « Disponible chaque semaine » | Créneau hebdomadaire pendant lequel un moniteur peut assurer des cours. « Créneau » reste réservé aux cours. |
| Groupe | Groupe | Ensemble d'élèves suivant un même cours collectif. |
| Composition | Élèves du groupe | Élèves inscrits dans un groupe. |
| Effectif | Nombre d'élèves ; « Groupe trop plein » en cas de dépassement | Nombre d'élèves d'un groupe, comparé à son maximum. |
| Élève | Élève | Personne inscrite dans un ou plusieurs groupes. |
| Cours | Cours | Créneau hebdomadaire de la semaine type : jour, heure de début, durée, court, groupe, moniteur. |
| Semaine type | Planning habituel | Ensemble des cours récurrents, appliqué à toutes les semaines de la saison. Phrase de portée : « Vos changements valent pour toutes les semaines de la saison ». |
| Semaine datée | Une semaine précise, nommée par sa date (« Semaine du 2 novembre ») | Une semaine du calendrier, avec ses séances et leurs exceptions. Phrase de portée : « Vos changements ne concernent que cette semaine ». |
| Occurrence | Séance | Instance d'un cours à une date précise. |
| Exception | Non affiché : « Modifié cette semaine », « Annulé cette semaine », « Remplacement : … », « Revenir au cours habituel » | Modification d'une occurrence (déplacement, annulation, remplacement) ou cours ponctuel n'existant qu'une semaine. |
| Cours ponctuel | Cours ponctuel (« cette semaine seulement ») | Cours qui n'existe qu'une semaine (rattrapage, stage, séance d'essai), possible pendant une fermeture. |
| Version de cours hors vigueur | Pastille « N cours changent plus tard dans la saison » / « N cours ont changé » | Après « Appliquer à partir de cette semaine », version d'un cours qui ne s'applique pas à la date de référence du planning habituel. |
| Amplitude | Heures affichées ; « Le planning s'affiche à partir de / jusqu'à » | Heures de début et de fin de la grille du planning. |
| Période de fermeture | Période de fermeture | Plage de dates sans cours réguliers (vacances scolaires, jours fériés). |
| Étapes du guidage | Pastilles des onglets du club ; « Avant de construire le planning » ; « Étape suivante : … » | Saison, Courts, Moniteurs, Groupes, Élèves, puis premier cours : ordre de saisie d'une première utilisation (§4.5). |
| Mode d'emploi du planning | Astuce du panneau ; « Tout le mode d'emploi » / « Masquer le mode d'emploi » ; « Les bases », « Pour aller plus vite » | Aide intégrée au planning (§4.5), à la place de l'ancien aide-mémoire. |

Les informations techniques (stockage SQLite, emplacement, migrations, chiffrement AES-256, chiffrement du disque, formats CSV, encodages, séparateur) ne figurent que dans les sections repliées « Détails techniques » de Réglages (données, sauvegardes, données personnelles) et d'Import/Export ; l'export principal est « Exporter vers Excel », le CSV passe dans les détails.

## 3. Modèle de données

Tous les enregistrements portent un **UUID** comme identifiant ainsi que les champs `created_at` / `updated_at` (horodatage), afin de préparer une future synchronisation (voir §11).

### 3.1 Saison
- Nom (ex. « 2026-2027 »), date de début, date de fin.
- Statut : active / archivée (lecture seule).
- Amplitude horaire affichée (défaut 8h00 – 22h00), jours affichés (défaut lundi → dimanche, dimanche masquable).

### 3.2 Court
- Nom (ex. « Court 1 »), type : **couvert** / **extérieur** (informatif), ordre d'affichage, actif oui/non.

### 3.3 Moniteur
- Nom, prénom, téléphone, e-mail (optionnels hors nom/prénom).
- Couleur (voir §6), initiales (calculées, modifiables).
- Disponibilités :
  - **Plages hebdomadaires récurrentes** : jour + heure début + heure fin (plusieurs par jour possibles).
    - Saisie dans une frise : cliquer-glisser trace une plage (ou l'efface en partant d'une case disponible). Les deux extrémités (appui et relâchement) sont la limite de case (15 min) la plus proche du pointeur, dans les deux sens : glisser du repère « 14h » au repère « 18h », ou l'inverse, donne 14:00–18:00 ; la plage fait au moins une case. En deçà d'un seuil de quelques pixels, le geste est un clic simple (seul cas où la case cliquée entière compte). Un clic simple n'enregistre rien : il pré-remplit le formulaire « Jour / De / À » et y place le focus (case vide : l'heure cliquée plus une heure, bouton « Ajouter » ; case disponible : la plage entière, boutons « Ajouter » et « Retirer »).
    - Chaque modification enregistrée est annoncée par un toast avec « Annuler », qui rétablit les plages précédentes. Le toast décrit ce qui a réellement changé (retirer 10:00–20:00 d'une plage 14:00–18:00 annonce « 14:00–18:00 retiré ») ; un geste qui ne change rien n'enregistre ni n'annonce rien, et « Ajouter » (ou « Retirer ») est grisé quand il serait sans effet. Le toast est fermé quand on quitte la fiche du moniteur.
  - **Indisponibilités datées** : date/heure début → date/heure fin + motif libre (congé, maladie, tournoi…).
- Actif oui/non.

### 3.4 Groupe
- Nom, niveau (choisi dans le **référentiel des niveaux**), tranche d'âge (min/max, optionnelle), effectif maximum.
- Liste des élèves (relation N-N avec Élève).

### 3.5 Élève
- Prénom, nom (obligatoires ; saisis dans cet ordre, comme pour le moniteur ; les listes triées affichent « Martin Léa »).
- **Téléphone** (v1.1) : au moins un des deux, celui de l'élève **ou** celui du responsable légal, dans la fiche comme à l'import ; le téléphone de l'élève est facultatif quand le responsable en a un. Listes (élèves, fiche groupe) : téléphone de l'élève, sinon celui du responsable suivi de « (resp.) » ; les exports et la feuille d'appel gardent deux colonnes (élève, responsable).
- Date de naissance, niveau (référentiel), classement FFT (champ distinct, ex. « 30/2 »), e-mail.
- Pour les mineurs : nom et téléphone du responsable légal.
- **Niveau proposé** (v1.1) : celui du premier groupe coché, tant que l'utilisatrice n'a pas choisi le niveau (même modèle que les initiales suggérées du moniteur).
- Un élève peut appartenir à **plusieurs groupes**.

### 3.5 bis Référentiel des niveaux
- Liste ordonnée et modifiable dans les réglages (libellé, ordre, actif).
- Pré-remplie avec les niveaux Galaxie (blanc, violet, rouge, orange, vert, jaune) et des niveaux adultes (débutant, intermédiaire, confirmé, compétition).

### 3.6 Cours (semaine type)
- Jour de la semaine, heure de début, durée (pas de 15 min).
- Court, groupe, **un seul** moniteur.
- Date d'effet début / fin (permet un changement « à partir de » une semaine donnée, voir §5.4).
- Note libre.

### 3.7 Exception (sur une occurrence datée)
- Référence au cours et à la date d'occurrence, ou cours ponctuel autonome.
- Types :
  - **Modification** : nouveaux jour/heure/durée/court/moniteur pour cette seule semaine.
  - **Annulation** : motif (pluie, moniteur absent, autre + texte).
  - **Remplacement** : moniteur remplaçant.
  - **Cours ponctuel** : cours n'existant que cette semaine (rattrapage, stage, séance d'essai), avec groupe optionnel.

### 3.8 Période de fermeture
- Libellé, date début, date fin. Les occurrences tombant dans une fermeture sont automatiquement suspendues (non affichées comme actives, non comptées dans les heures).
- Assistant de pré-remplissage avec les vacances scolaires **zone B** et jours fériés français, à partir d'un calendrier embarqué dans l'application (pas d'accès internet). Les dates proposées restent modifiables.
  - Les ponts du calendrier scolaire (ex. « Pont de l'Ascension ») comptent comme des vacances et sont proposés cochés.
  - Un jour férié n'est décoché par défaut que si une période **cochée** le couvre ; il se recoche quand on décoche cette période. Son badge nomme la période (« compris dans Pont de l'Ascension »).

## 4. Vue semaine

### 4.1 Disposition (variante A retenue)

Maquette de référence : `maquettes/vue-semaine.html`, onglet A ; lisibilité à 960 px : prototype retenu (variante G) dans `.plan/ux-v1-1/prototypes/lisibilite-grille/`.

- **Heures en lignes** (amplitude de la saison, graduations à l'heure et à la demi-heure).
- **Jours en colonnes**, chaque jour étant **subdivisé en sous-colonnes, une par court**. Séparateur marqué entre deux jours.
  - En-tête d'un jour : son nom (« Lundi », « Lundi 02/11 » en semaine datée), raccourci si la colonne est étroite (« Lun. 02/11 », « Lu »). En vue Semaine, un clic sur l'en-tête affiche ce jour seul.
  - En-tête d'un court : son **vrai nom**, abrégé si la colonne est étroite (« Terre battue 1 » → « TB1 », « Central » → « Cent. », « Court 2 » → « C2 »), précédé d'une icône **soleil** (extérieur) ou **maison** (couvert) ; nom complet et nature en bulle. La légende « couvert · extérieur » est dans la barre des jours.
- **Vue Semaine / Jour** : la vue Semaine dessine tous les jours affichés ; la vue Jour un seul, avec des courts plus larges (88 px au moins) pour que le nom d'un groupe tienne sur une carte d'une heure. La vue est retrouvée en revenant sur l'écran (par saison, le temps de la session) ; « Jour » depuis la vue Semaine rouvre le dernier jour vu, sinon aujourd'hui s'il est dans la semaine précise affichée, sinon le premier jour. Activé au clavier, l'en-tête d'un jour passe le focus à la pastille de ce jour. Un cours sélectionné qui n'est plus dessiné (autre jour) n'est plus sélectionné : Suppr ne supprime jamais un cours invisible.
- **Barre des jours**, au-dessus de la grille : en semaine datée, la navigation des semaines (§4.2) en tête, séparée par un filet ; la bascule « Semaine / Jour » ; une pastille par jour avec son nombre de cours (séances annulées exclues) — le dimanche, s'il est affiché, est toujours atteignable ; en vue Jour, les flèches jour précédent / suivant (en boucle) ; la légende des courts ; le bouton « Replier le panneau » / « Afficher le panneau ».
- Chaque cours est un bloc coloré à la **couleur du moniteur** affichant : nom du groupe, horaire, initiales/nom du moniteur, effectif (`inscrits / max`). Le nom passe sur deux lignes si la carte est assez haute (une heure et demie ou plus).
- **Fiche du cours au survol**, à la place de l'infobulle native : nom complet du groupe, jour et horaire, court, moniteur, effectif, état de la séance, note et avertissements (en rouge), liseré à la couleur du moniteur. Elle apparaît après un court délai (~400 ms), à côté du cours, sans rien déplacer ; elle disparaît au clic, au défilement, à la sortie du cours ou à Échap, et ne s'affiche pas pendant un glisser. Les lecteurs d'écran ont le même détail : le nom du cours (groupe, jour et horaire, court, moniteur, état, nombre d'avertissements) et sa description (lignes de la fiche et texte des avertissements).
- Défilement horizontal si la largeur de la fenêtre ne suffit pas (vue Semaine, ou vue Jour avec beaucoup de courts) ; en-têtes et axe horaire figés.
- **Une seule barre d'outils**, sur une ligne : sur le Planning, la barre haute de l'application (fil d'Ariane, saison) est masquée ; le titre « Planning » est réservé aux lecteurs d'écran. Dans l'ordre : sélecteur de mode (§4.2), « + Nouveau cours » (avec son libellé) — ou, en saison terminée, la pastille « Consultation seulement » (raison en bulle) —, Annuler, Rétablir et PDF en icônes avec leur bulle, menu « Filtres » (§4.3), légende des moniteurs (§4.3), sélecteur de saison compact (nom seul, saison complète en bulle). Quand la barre est étroite (moins de 50rem, par exemple à 960 px avec le menu déplié), « Filtres » se réduit à son icône et à son compteur, la saison à son nom, les boutons se resserrent. Le menu « Filtres » reste dans la zone de contenu (décalé vers la gauche, rétréci si besoin).
- **Panneau latéral repliable** (bouton de la barre des jours) : replié, il disparaît entièrement, sans rail, et la grille prend sa place. Il se rouvre de lui-même, le temps d'un cours ouvert ou créé (clic, sélection sur la grille, « Nouveau cours », Ctrl/⌘ N, avertissement) ; « Replier le panneau » ferme alors ce cours (sous la garde du panneau). Le choix vaut pour la session.
- **Menu de l'application réductible aux icônes** (bouton « Réduire le menu » / « Déplier le menu » en bas du menu), pour toute l'application : libellés en bulle au survol, toujours annoncés. Choix mémorisé sur le poste (préférence locale).

### 4.2 Navigation et modes

- Sélecteur de mode « Planning habituel » / « Une semaine précise », toujours visible dans la barre d'outils.
- Bandeau de couleur distinct, sur une **seule ligne fine à hauteur fixe** : nom du mode ou de la semaine et phrase de portée (tronquée si besoin) ; les informations ponctuelles (versions de cours masquées, moniteur dont les indisponibilités sont hachurées) y sont des pastilles courtes, détail en bulle ; rien ne bouge en dessous au survol d'un cours :
  - **Semaine type** : édition des cours récurrents de la saison.
  - **Semaine du JJ/MM/AAAA** : vue d'une semaine datée (occurrences + exceptions), navigation semaine précédente / suivante / aujourd'hui / sélecteur de date, **en tête de la barre des jours** (§4.1) ; le jour affiché en vue Jour est gardé d'une semaine à l'autre.
- En semaine datée : les occurrences annulées sont affichées grisées et barrées ; les remplacements portent un indicateur (icône) et la couleur du remplaçant ; les périodes de fermeture apparaissent comme une bande grisée « Fermé — Vacances de … ».

### 4.3 Filtres

- Filtrer par moniteur(s), court(s), groupe : les cours non concernés sont estompés. Les filtres sont dans un **menu déroulant « Filtres »** de la barre d'outils, dont le bouton affiche le nombre de filtres actifs ; le menu se ferme par Échap, un clic au-dehors ou un second clic. « Effacer les filtres » y est toujours présent, grisé avec sa raison (« Aucun filtre actif ») tant qu'aucun filtre n'est actif.
- Légende des moniteurs : pastilles réduites à la couleur et au prénom (sous 60rem de barre, comme à 960 px : un rond à la couleur du moniteur portant ses initiales, pour qu'un maximum reste visible sans défiler), toujours cliquables (§4.4) et glissables (§5.2), sur une ligne qui défile si la place manque ; nom complet et heures de la semaine affichée en bulle. Le total d'heures n'est plus dans la barre : il reste dans l'écran « Heures » (§10).

### 4.4 Affichage des disponibilités

- La grille reste épurée par défaut.
- Au **survol ou au déplacement d'un cours**, ou au **clic sur un moniteur de la légende**, les créneaux où ce moniteur est **indisponible** sont hachurés.
- Un seul moniteur est hachuré à la fois, par ordre de priorité : celui du cours glissé, celui choisi dans le panneau du cours ouvert, celui du cours survolé, celui épinglé dans la légende.

### 4.5 Guidage et mode d'emploi (v1.1)

Prototypes retenus (variantes C) : `.plan/ux-v1-1/prototypes/guidage-premiere-utilisation/` et `.plan/ux-v1-1/prototypes/mode-emploi-planning/`.

- **État des étapes** (domaine, `src/domain/guidance.ts`) : Saison, Courts, Moniteurs, Groupes, Élèves, puis premier cours, calculé à partir des comptes de la **saison affichée** (courts, moniteurs, groupes, élèves, cours du planning habituel et cours ponctuels). Une étape est faite dès qu'elle compte au moins une fiche ; l'étape suivante est la première non faite. Rien n'est mémorisé ni masquable : l'état est relu à chaque changement de saison et après chaque écriture en base. Le guidage est **complet** au premier cours placé : pastilles et accueil disparaissent. Aucun guidage sur une saison terminée.
- **Pastilles d'étape** sur les onglets Saison, Courts, Moniteurs, Groupes, Élèves de « Le club » : numéro d'ordre, coche une fois l'étape faite, étape suivante en couleur ; aucune sur Niveaux et Fermetures (facultatifs). Le nom de l'onglet ne change pas : l'état (« Étape 2, faite », « Étape 3, la suivante ») est sa description accessible.
- **Accueil « Avant de construire le planning »**, à la place des états vides « Aucune saison » (Planning, onglets du club, Heures, Import/Export) et « Aucun court » (Planning) : une phrase sur le lien cours / court / moniteur / groupe, les cinq étapes du club dans l'ordre avec leur coche, **un seul bouton** vers l'étape suivante, et « Niveaux et fermetures sont facultatifs et peuvent attendre ». Sur le Planning, il occupe la page tant qu'un court, un moniteur ou un groupe manque (les élèves ne sont pas nécessaires pour placer un cours) ; ensuite, l'astuce « aucun cours placé » prend le relais jusqu'au premier cours.
- **Toast de première fois** : quand exactement une étape vient d'être faite dans la saison (ou que la première saison vient d'être créée), la suite « Étape suivante : Courts » (écran de l'étape suivante) est proposée au toast commun, selon des règles pures (`src/components/feedback/suggestion.ts`) : la confirmation de l'écran affichée depuis moins de 1,5 s et sans action (« Saison « 2026-2027 » créée », « Léa Martin ajouté(e) »…) la reçoit ; sans toast affiché, elle attend 1,5 s la confirmation de l'écran pour y figurer dès l'affichage, puis s'affiche seule (« Premier court ajouté », « Premier moniteur ajouté »…) ; un toast qui a déjà son action (« Ajouter des élèves » après la création d'un groupe) ou une erreur la garde, et la suite s'affiche après lui, à la fin de son délai ou après son action (dans les 10 s), pas s'il est fermé exprès. Un toast portant la suite reste 8 s (en pause au survol et au focus) ; le fermer ou suivre la suite la retire. Rien n'est proposé pendant qu'une fenêtre modale est ouverte (« Enregistrer et ajouter un autre »), et la suite affichée disparaît à l'ouverture d'une fenêtre, pour ne jamais quitter une saisie. Rien n'est annoncé quand plusieurs étapes sont faites d'un coup (sauvegarde restaurée, duplication de saison), au changement de saison affichée (nouvelle saison vierge comprise), ni pour le premier cours (le guidage disparaît) ; un import d'élèves seul fait l'étape Élèves et est annoncé. Si les comptes ne peuvent être lus, l'état précédent est gardé, et sans état connu le guidage s'éteint.
- **Mode d'emploi du planning**, en tête du panneau latéral (au-dessus des Avertissements), à la place de l'ancien aide-mémoire :
  - une **astuce** d'une phrase, de hauteur réservée (les Avertissements ne bougent pas), selon la situation : aucun cours placé (ni cours du planning habituel ni cours ponctuel) (« Commencez par + Nouveau cours en haut : jour, heure, court, groupe et moniteur, puis Créer le cours. ») ; un cours sélectionné (glisser pour déplacer, tirer le bas pour la durée, Suppr/⌫ le supprime, Ctrl/⌘ Z annule) ; sinon (« Cliquez un cours pour le modifier », avec la portée du Planning habituel ou d'Une semaine précise). En saison terminée : consultation seulement ;
  - un bouton bien visible « Tout le mode d'emploi » / « Masquer le mode d'emploi » (icône livre, chevron, bordure), **replié à chaque ouverture du planning** ;
  - le texte complet : **Les bases** (numérotées : « + Nouveau cours », cliquer un cours pour le modifier ou le supprimer, Planning habituel contre Une semaine précise, bouton Annuler), puis **Pour aller plus vite** (glisser pour créer, déplacer, tirer le bas, Alt/⌥ + glisser, pastille d'un moniteur, survol et zones rayées, Ctrl/⌘ N, Suppr/⌫, Ctrl/⌘ Z et Ctrl/⌘ ⇧ Z, « Échap annule le déplacement en cours », ← → dans une semaine précise) ;
  - touches selon le système (§11.5) ; pour créer un cours, **seul Ctrl/⌘ N** est annoncé (B4).

## 5. Création et édition des cours

### 5.1 Création

Deux points d'entrée ouvrant le **même panneau latéral** d'édition :

1. **Sélection à la souris sur la grille** : cliquer-glisser verticalement dans la sous-colonne d'un court. Jour, heure de début, durée et court sont pré-remplis.
2. **Bouton « Nouveau cours »** : panneau vide.

Le panneau contient : groupe (liste avec recherche + création rapide d'un groupe), moniteur, jour, heure de début, durée, court, note. La liste des moniteurs présente trois groupes, dans cet ordre :

1. **Disponibles** sur le créneau ;
2. **Occupés sur ce créneau** : un autre cours leur est déjà affecté sur tout ou partie du créneau, affiché sur la ligne (« Galaxie vert 17:00–18:00 ») ; le cours en cours d'édition n'est pas compté ;
3. **Indisponibles** : hors de leurs disponibilités ; s'ils ont aussi un cours sur le créneau, la ligne le mentionne.

Tous restent sélectionnables ; le conflit est signalé (§7). Les hachures (§4.4) ne couvrent que les créneaux hors disponibilités, pas les cours déjà affectés.

### 5.2 Glisser-déposer

- **Déplacer** un cours : change jour, heure et court (magnétisme au pas de 15 min).
- **Redimensionner** par le bord inférieur : change la durée.
- **Dupliquer** : glisser avec Alt/Option.
- **Changer de moniteur** : glisser la pastille d'un moniteur depuis la légende et la déposer sur un cours (ou via le panneau).
- Aperçu fantôme pendant le déplacement, avec affichage des avertissements en temps réel.

### 5.3 Annulation / rétablissement

- Annuler / rétablir **illimités** pendant la session (Ctrl/Cmd+Z, Ctrl/Cmd+Maj+Z), couvrant toutes les modifications du planning (création, déplacement, redimensionnement, suppression, changement de moniteur, exceptions).

### 5.4 Portée des modifications

- En mode **Semaine type** : la modification s'applique à toute la saison.
- En mode **Semaine datée** : la modification crée une **exception** pour cette seule semaine.
- Action **« Appliquer à partir de cette semaine »** (menu du cours en semaine datée) : clôt le cours d'origine à la veille de la semaine courante (date d'effet de fin) et crée une nouvelle version du cours avec les nouvelles valeurs, effective à partir de cette semaine.

### 5.5 Exceptions en semaine datée

Accessibles par clic droit / menu du cours :
- Modifier pour cette semaine (ou glisser-déposer directement).
- Annuler cette séance (motif obligatoire).
- Désigner un remplaçant.
- Créer un cours ponctuel (sélection sur la grille ou bouton « Nouveau cours » en mode semaine datée). C'est possible **y compris pendant une période de fermeture**, ce qui sert pour les **stages de vacances** : la bande « Fermé » reste visible en fond, et les cours ponctuels s'affichent par-dessus.
- **Dupliquer sur les jours suivants** (cours ponctuel) : copie le cours aux mêmes heure, court et moniteur sur les N jours suivants (ex. stage du lundi au vendredi), en sautant les jours non affichés.
- Rétablir l'occurrence d'origine (supprime l'exception).

## 6. Couleurs

- Palette prédéfinie d'environ **16 couleurs** nettement distinctes, toutes lisibles avec un texte blanc (contraste ≥ 4,5:1).
- À la création d'un moniteur, attribution **automatique** de la première couleur non utilisée ; modifiable ensuite dans la palette.
- Les **initiales du moniteur** sont toujours affichées sur le cours (accessibilité daltoniens, impression noir et blanc).

## 7. Conflits et avertissements

Aucun conflit n'est bloquant : tout est autorisé mais **signalé** (bordure rouge + icône ⚠ sur le cours, détail dans la fiche du cours au survol et le panneau).

| Contrôle | Message type |
|---|---|
| Court déjà occupé sur tout ou partie du créneau | « Court 2 déjà occupé par Galaxie vert (14h00–15h30) » |
| Moniteur ayant déjà un cours sur le créneau | « Karim a déjà un cours à 17h00 » |
| Moniteur hors de ses disponibilités (récurrentes ou datées) | « Hors disponibilités de Marc » |
| Élève inscrit dans deux cours simultanés | « 2 élèves ont un autre cours sur ce créneau » |
| Effectif du groupe supérieur au maximum | « 9 / 8 élèves » |
| Âge d'un élève hors tranche du groupe | « 1 élève hors tranche d'âge » |
| Groupe hors tranche coché dans la fiche élève (ou date qui met hors tranche un groupe coché) | « Léa aura 11 ans, Galaxie vert est pour les 6–8 ans » |
| Élève déjà inscrit dans la saison (même nom + prénom sans casse ni accents ; dates comparées si les deux sont connues) | « Un élève Martin Léa (né(e) le 03/05/2015, Galaxie vert) existe déjà » + « Ouvrir sa fiche » |
| Élève inscrit seulement dans une saison passée (information) | « Léa Martin était inscrit(e) en 2025-2026. » + « Reprendre ses coordonnées » |
| Initiales déjà prises par un moniteur de la saison | « JM est déjà utilisé par Jean Martin. Utiliser JMo ? » (proposition appliquée en un clic) |
| Nom de court déjà pris dans la saison (sans casse ni accents) | « Un court « Court 2 » existe déjà » |

Dans les fiches (élève, moniteur, court), ces messages s'affichent dans la zone de message réservée, sans déplacer les boutons. Ils ne bloquent jamais l'enregistrement : vrais homonymes, initiales ou noms volontairement identiques restent possibles.

Un panneau **« Avertissements »** liste tous les conflits de la semaine affichée, avec navigation vers le cours concerné.

## 8. Gestion des référentiels

Écrans de liste + fiche (création, modification, suppression avec confirmation, recherche) pour : courts, moniteurs (dont disponibilités), groupes (dont composition), élèves, périodes de fermeture, saisons, niveaux.

Les onglets Saison, Courts, Moniteurs, Groupes et Élèves portent la pastille d'étape du guidage de la première utilisation, et l'accueil « Avant de construire le planning » remplace l'état vide « Aucune saison » (§4.5).

- Composition d'un groupe : ajout d'élèves par recherche ou glisser-déposer depuis la liste des élèves ; affichage de l'effectif et des alertes (âge, effectif).
- **Saisie en volume** (v1.1) :
  - fiche élève : « Enregistrer et ajouter un autre » (en création) enregistre, confirme par un toast « Léa Martin ajouté(e) » et rouvre une fiche vide qui **garde les groupes cochés et le niveau** ; Entrée enregistre comme « Créer l'élève » ;
  - fiche groupe, champ « Ajouter un élève » : vidé après chaque ajout, focus conservé ; Entrée ajoute le résultat unique ou celui en surbrillance (↑/↓) ; sans résultat, « Créer « Léa Martin » » (ou Entrée) ouvre la fiche élève pré-remplie (premier mot : prénom, reste : nom), groupe coché et niveau proposé, puis revient à la fiche du groupe ;
  - liens « Importer ou coller une liste » sur l'onglet Élèves et sur la fiche groupe (§9.1) ;
  - création d'un groupe : on reste sur la liste ; toast « Groupe « Galaxie vert » créé » avec « Ajouter des élèves », qui ouvre la fiche, curseur dans le champ d'ajout ;
  - les contrôles de doublon et d'âge ci-dessous s'appliquent à tous ces chemins, champs pré-remplis compris.
- **Alerte d'âge dans la fiche élève** : l'âge est calculé au début de la saison (comme la fiche groupe et les conflits). La liste à cocher des groupes affiche la tranche de chacun (« Galaxie vert · 6–8 ans ») et une mention discrète « hors tranche » pour l'élève saisi ; l'ordre est inchangé et tous restent cochables. Sans date de naissance : tranches affichées, aucune mention. Cocher un groupe hors tranche, ou saisir une date qui met hors tranche un groupe coché, affiche l'avertissement du §7.
- **Doublons d'élève** : vérifiés dès que nom et prénom sont saisis, en création comme en modification, contre les élèves de toutes les saisons (fiche modifiée exclue). Doublon dans la saison : avertissement et lien « Ouvrir sa fiche », qui remplace la saisie par la fiche existante (après « Abandonner les modifications ? » si la saisie a changé). Doublon seulement dans une saison passée (en création) : « Reprendre ses coordonnées » pré-remplit téléphone, e-mail, naissance, responsable légal, niveau et classement depuis la saison la plus récente où l'élève figure, **jamais ses groupes**.
- **Homonymes** : un élève désigné seul (résultats de recherche et ajout dans la fiche groupe) porte sa date de naissance et ses groupes dès qu'un homonyme existe dans la saison ; la confirmation de suppression d'un élève les donne toujours.
- Suppression d'un moniteur, d'un court ou d'un groupe utilisé par des cours : proposer l'archivage (inactif) plutôt que la suppression.

### 8.1 Saisons

- Création d'une saison vierge ou **par duplication** de la précédente : copie des courts, moniteurs (avec disponibilités récurrentes), groupes, élèves et semaine type ; **les exceptions, indisponibilités datées et fermetures ne sont pas copiées**.
- Les saisons passées restent consultables en **lecture seule**.

## 9. Import / export

### 9.1 Import d'élèves
- Formats : CSV (séparateur `;` ou `,`, encodage UTF-8 ou Windows-1252 détecté) et Excel (.xlsx).
- **Collage depuis un tableur** (v1.1) : l'étape 1 propose « Coller depuis Excel » à côté du choix du fichier. Le texte collé suit la lecture des fichiers texte (tabulations d'Excel, fins de ligne Windows / macOS / Linux, cellules multilignes entre guillemets, dont les lignes deviennent « , ») ; correspondance, aperçu et import annulable sont inchangés (libellé « Import de 3 élèves (tableau collé) »). **Sans ligne d'en-têtes** — aucune cellule de la première ligne ne ressemble à un en-tête connu —, la case « La première ligne contient des élèves » est cochée (modifiable) et les colonnes sont nommées « Colonne A », « Colonne B »…, avec une valeur d'exemple, à associer à l'étape suivante.
- Lancé depuis la fiche d'un groupe, l'import y inscrit les élèves si la liste n'a pas de colonne Groupe(s).
- Validation de la fiche élève (§3.5) : nom, prénom, et téléphone de l'élève **ou** du responsable légal (au moins une des deux colonnes associée) ; colonne Niveau vide : niveau du premier groupe affecté qui en a un.
- Assistant : choix du fichier (ou collage) → **correspondance colonnes / champs** → aperçu avec erreurs ligne par ligne → import.
- Détection des doublons (nom + prénom + date de naissance) : ignorer ou mettre à jour.
- Tranche d'âge (§8) : l'aperçu marque « Hors tranche » les lignes dont un groupe affecté est hors de la tranche d'âge (âge au début de la saison), avec l'avertissement du §7, et les compte en tête ; l'import n'est pas bloqué.

### 9.2 Exports et impressions
- **PDF / impression de la vue semaine** (semaine type ou datée), A4 ou A3 paysage, couleurs + initiales.
- **PDF par moniteur** : planning personnel de la semaine (ou de la semaine type) avec cours, courts, groupes, effectifs.
- **Feuille d'appel par groupe** (PDF) : liste des élèves, téléphones, contact du responsable légal, colonnes de présence vierges.
- **Export CSV / Excel** : cours, groupes, élèves, heures moniteurs.

## 10. Récapitulatif des heures

- Total des heures **par moniteur** pour la semaine affichée (dans la légende) et pour une **période choisie** (date début → date fin, raccourcis « mois en cours », « saison »).
- Calcul basé sur les occurrences réelles : périodes de fermeture et annulations exclues, remplacements attribués au remplaçant, cours ponctuels inclus.
- Détail consultable par moniteur ; export CSV.

## 11. Exigences non fonctionnelles

### 11.1 Plateformes et installation
- macOS (versions récentes, Intel et Apple Silicon), Windows 10/11, Linux (distributions courantes de type Ubuntu/Debian, Fedora).
- Installateurs natifs : `.dmg` (macOS), `.msi` ou `.exe` (Windows), `.AppImage` et `.deb` (Linux). Installation sans droits administrateur si possible.
- Binaires non signés en V1, avec une notice d'installation ; signature prévue en cas de diffusion plus large (voir §12.2).

### 11.2 Hors ligne
- Aucune connexion réseau, ni au démarrage ni en fonctionnement (pas de télémétrie, de polices ou de ressources distantes, ni de vérification de mise à jour).
- Mises à jour : par installation manuelle d'une nouvelle version, avec **migration automatique** du schéma de données.

### 11.3 Stockage et sauvegarde
- Données stockées dans une base locale unique (SQLite, voir §12) dans le dossier de données utilisateur de l'OS.
- **Sauvegarde automatique horodatée à chaque fermeture** ; conservation des 30 dernières.
- **Sauvegarde automatique avant migration** (v1.1) : au démarrage d'une nouvelle version, une base existante dont le schéma doit évoluer est d'abord copiée (motif « Avant mise à jour ») ; une base neuve ou déjà à jour ne l'est pas. Si la copie échoue, **rien n'est migré** : la base reste intacte, l'écran d'ouverture affiche « Impossible de sauvegarder avant la mise à jour : » suivi de la cause, avec « Réessayer » (nouvel essai complet, aussi au prochain démarrage).
- Bouton **« Exporter une sauvegarde »** (fichier unique, ex. vers une clé USB) et **« Restaurer une sauvegarde »** (avec confirmation et sauvegarde préalable de l'état courant).
- Enregistrement immédiat de chaque modification (pas de bouton « Enregistrer »).

### 11.4 Évolutivité
- UUID et horodatages sur tous les enregistrements (§3) pour permettre en V2 une synchronisation ou une consultation web par les moniteurs, sans refonte du modèle.

### 11.5 Performances et ergonomie
- Volumétrie cible : 10 courts, 20 moniteurs, 60 groupes, 500 élèves, 150 cours dans la semaine type.
- Affichage d'une semaine et retour visuel du glisser-déposer instantanés (< 100 ms perçus).
- Résolution minimale : 1366 × 768. Thèmes clair et sombre suivant le réglage du système.
- Raccourcis clavier : Suppr (supprimer le cours sélectionné), Ctrl/Cmd+Z / Maj+Z, Ctrl/Cmd+N (nouveau cours), ← / → (semaine précédente / suivante), Ctrl/Cmd+P (imprimer). Les touches annoncées à l'écran suivent le système : ⌘, ⌥, ⇧, ⌫ sur macOS ; Ctrl, Alt, Maj, Suppr ailleurs. Aucun raccourci d'une seule lettre : pour créer un cours, seul Ctrl/⌘ N existe et est annoncé (bulle de « + Nouveau cours », mode d'emploi du §4.5 ; B4).
- **Rien ne bouge sous le curseur** (v1.1) :
  - les avertissements et l'erreur générale d'un formulaire s'affichent dans une **zone de message réservée** de deux lignes, toujours présente au-dessus des boutons (vide = blanc) ; l'erreur passe en tête, en rouge ; au-delà de deux messages, la dernière ligne devient « + N autres avertissements », dépliable au clic. Elle accueille aussi « Élève mineur… », les avertissements du créneau du panneau de cours et les alertes de la fiche groupe ;
  - une erreur sous un champ apparaît après validation et s'efface dès que le champ est modifié ;
  - les confirmations sont un **toast** commun en bas à droite : un seul à la fois, succès effacé après ~4 s (en pause au survol), erreur affichée jusqu'à sa fermeture, action facultative (« Annuler cette action ») ; région `aria-live`. Plus de message de succès en ligne ; la création d'une saison est confirmée par « Saison « 2026-2027 » créée », une fois la saison relue ;
  - les résultats de recherche de la fiche groupe s'affichent en liste superposée ;
  - un bouton grisé dit pourquoi : raison en petit texte à côté (place réservée) et en bulle, bouton toujours focalisable (« Ajouter la plage », enregistrement de l'aperçu PDF, semaines précédente / suivante, « Effacer les filtres ») ;
  - bulle d'aide commune : au survol après ~300 ms et au focus clavier, fermée par Échap.
- **Fenêtres (modales) et panneau de cours** (v1.1) :
  - à l'ouverture, le curseur est dans le premier champ ; sans champ, sur le bouton non destructif (« Annuler » d'une suppression). Le panneau de cours le fait à la création d'un cours ;
  - Échap en cascade : le premier Échap dans un champ date ou heure reste au sélecteur, le suivant s'adresse à la fenêtre ; dans le panneau de cours, Échap tapé dans un champ ne ferme pas le panneau ;
  - si la saisie diffère de son état à l'ouverture, toute fermeture (Échap, croix, Annuler ; pour le panneau de cours, aussi le choix d'un autre cours ou d'un autre créneau, ou le changement de semaine) demande « Abandonner les modifications ? » avec « Continuer la saisie » (par défaut) et « Abandonner » ; une saisie intacte se ferme sans question ;
  - chaque case à cocher est reliée explicitement à son libellé (annoncée par son libellé).

### 11.6 Données personnelles (RGPD)
- Données d'élèves (dont mineurs) stockées uniquement en local sur le poste du responsable.
- Fonctions de suppression définitive d'un élève et d'export de ses données.
- Recommandation : chiffrement du disque du poste (FileVault / BitLocker / LUKS) ; option de chiffrement des fichiers de sauvegarde exportés par mot de passe.

## 12. Choix technique

Développement : un développeur assisté par Claude Code, principalement en TypeScript.

### 12.1 Pile retenue

| Couche | Choix | Justification |
|---|---|---|
| Conteneur desktop | **Tauri 2** | Installateur d'environ 10 Mo, peu de mémoire, permissions fines (accès réseau interdit). Rust limité à la configuration et aux plugins officiels. |
| Interface | **React + Vite**, TypeScript strict | Écosystème le plus riche ; modèle Tauri par défaut. |
| Composants / style | **shadcn/ui** (Radix) + **Tailwind CSS** | Composants accessibles dont le code est intégré au projet ; thèmes clair et sombre. |
| Grille de planning | **Composant sur mesure** + **dnd-kit** | Maîtrise totale des gestes (sous-colonnes par court, Alt pour dupliquer, dépôt d'une pastille, hachures) ; dnd-kit apporte l'accessibilité clavier et le défilement automatique. Référence : `maquettes/drag-and-drop.html`. |
| État / annulation | **Zustand** + **commandes inversibles** | Saison ouverte chargée en mémoire ; chaque action = commande `apply` / `revert`, écrite en base dans une transaction ; pile d'annulation illimitée en mémoire. |
| Base de données | **SQLite** via `tauri-plugin-sql` | Fichier unique local, dans le dossier de données de l'application. |
| Accès aux données | **Drizzle ORM** (pilote `sqlite-proxy`) + **drizzle-kit** | Requêtes typées, migrations versionnées appliquées au démarrage (§11.2). |
| Règles métier | TypeScript pur (`src/domain/`) | Conflits, récurrences et exceptions, fermetures, calcul des heures : sans dépendance à React ni à Tauri, testables isolément. |
| Dates | **date-fns** (+ `@date-fns/tz`) | Fuseau Europe/Paris, semaines ISO, changements d'heure. |
| Formulaires / validation | **React Hook Form** + **Zod** | Schémas partagés entre formulaires, import et base. |
| PDF | **@react-pdf/renderer** | Rendu identique sur les trois OS, A4 ou A3 paysage, polices embarquées ; enregistrement via `tauri-plugin-dialog` et `tauri-plugin-fs`, ouverture dans le lecteur PDF du système pour imprimer. |
| Excel / CSV | **SheetJS CE** (installé depuis `cdn.sheetjs.com`, pas npm) + **PapaParse** | Lecture .xlsx/.xls/.ods et CSV (détection du séparateur et de l'encodage) ; exports. |
| Tests | **Vitest** (domaine, composants avec Testing Library) + **Playwright** | Tests de bout en bout sur le front servi par Vite, la base étant remplacée par **sql.js** (SQLite en mémoire). Les tests de bout en bout dans Tauri même ne sont pas disponibles sur macOS. |
| Outillage | **pnpm**, **Biome** (vérification et formatage) | Un seul projet, pas de monorepo. |
| Build / CI | **GitHub Actions** + `tauri-action` | Matrice macOS (Intel + Apple Silicon), Windows, Linux → `.dmg`, `.msi`, `.AppImage`, `.deb`. |

### 12.2 Contraintes d'implémentation

- **Hors ligne garanti** :
  - CSP Tauri restrictive (`default-src 'self'`, pas de `connect-src` externe) ;
  - aucune permission HTTP ;
  - pas de `tauri-plugin-updater` ;
  - polices et ressources embarquées dans l'application.
- **Sauvegardes** : copie cohérente de la base par `VACUUM INTO` vers un fichier horodaté à la fermeture et avant toute migration d'une base existante (§11.3, commande `backup_before_migration`, appelée par le front avant `migrate`). La restauration remplace le fichier après avoir sauvegardé l'état courant.
- **Abstraction de la base** : l'accès SQLite passe par une interface unique, avec une implémentation Tauri (`tauri-plugin-sql`) et une implémentation sql.js pour les tests. Cela prépare aussi une future version web.
- **Moteurs web** : WebKit (macOS), WebView2 (Windows) et WebKitGTK (Linux). Le glisser-déposer, les polices et l'impression sont à valider sur les trois en CI ou à la main avant chaque version.
- **Signature** : pas de signature en V1. La notice d'installation documente le contournement des alertes (macOS : clic droit puis « Ouvrir » ; Windows : « Informations complémentaires » puis « Exécuter quand même »). La signature (Apple Developer + Azure Trusted Signing) sera ajoutée en cas de diffusion plus large.

### 12.3 Organisation du code (indicative)

```
src/
  domain/        règles métier pures (conflits, occurrences, heures) + tests Vitest
  db/            schéma Drizzle, migrations, interface d'accès (Tauri / sql.js)
  store/         stores Zustand, commandes inversibles, pile d'annulation
  features/
    planning/    grille semaine, glisser-déposer, panneau cours
    referentiels/ courts, moniteurs, groupes, élèves, niveaux, saisons, fermetures
    import-export/ assistant d'import, exports CSV/Excel
    pdf/         documents @react-pdf
  components/ui/ composants shadcn
src-tauri/       configuration Tauri, capacités, icônes
e2e/             scénarios Playwright
```

## 13. Décisions complémentaires

- **Niveaux** : référentiel paramétrable (voir §3.4).
- **Un seul moniteur par cours** : pas de co-animation. Pour un groupe encadré par deux moniteurs, on crée deux cours sur deux courts.
- **Stages pendant les vacances** : gérés comme des cours ponctuels pendant une période de fermeture (voir §5.5). Pas de module de stage dédié.
- **Présences** : sur la feuille d'appel papier uniquement, sans saisie dans l'application en V1.
