# Journal des modifications

Toutes les évolutions notables de Kairos sont consignées ici. Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et la numérotation [SemVer](https://semver.org/lang/fr/).

## [Non publié]

## [1.1.0] - 2026-10-17

Corrections UX issues du test d'utilisabilité à deux personas (spec `.plan/ux-v1-1/spec.md`, lots L9 à L16 de `.plan/ux-v1-1/lots.md`). Le modèle métier ne change pas, à une exception près : le téléphone de l'élève devient facultatif (migration automatique, précédée d'une sauvegarde « Avant mise à jour »).

### Ajouté

- **Guidage de la première utilisation** (L15) : pastilles d'étape sur les onglets du club (Saison, Courts, Moniteurs, Groupes, Élèves), accueil « Avant de construire le planning » à la place des états vides, toast « Étape suivante » à chaque première étape franchie ; tout disparaît au premier cours placé.
- **Mode d'emploi du planning** (L15) : astuce d'une phrase en tête du panneau selon la situation, bouton « Tout le mode d'emploi » (« Les bases » puis « Pour aller plus vite »), touches affichées selon le système (Ctrl / ⌘, Alt / ⌥, Suppr / ⌫). Guide `docs/DEMARRAGE-RAPIDE.md` réécrit avec le guidage, le mode d'emploi et le nouveau vocabulaire.
- **Vue Jour** (L14) : barre des jours avec le nombre de cours, flèches, clic sur l'en-tête d'un jour ; navigation des semaines dans la même barre en semaine précise.
- Panneau latéral repliable (rouvert à l'ouverture ou à la création d'un cours) et menu de l'application réductible aux icônes, choix mémorisé (L14).
- Fiche du cours au survol : nom complet, horaire, court, moniteur, effectif et avertissements (L14).
- **Saisie en volume** (L13) : « Enregistrer et ajouter un autre » (groupes et niveau gardés), « Coller depuis Excel » dans l'import (avec ou sans ligne d'en-têtes), liens « Importer ou coller une liste » depuis l'onglet Élèves et la fiche groupe (groupe pré-affecté), ajout en chaîne au clavier dans la fiche groupe avec « Créer « Prénom Nom » », niveau proposé depuis le premier groupe coché.
- **Doublons et âge signalés tôt, jamais bloquants** (L12) : élève déjà inscrit (« Ouvrir sa fiche », ou « Reprendre ses coordonnées » d'une saison passée), initiales déjà prises avec proposition en un clic, nom de court déjà pris, tranche d'âge et « hors tranche » dans la fiche élève et l'aperçu d'import ; dès qu'un homonyme existe, l'élève est désigné avec sa date de naissance et ses groupes (recherche de la fiche groupe, confirmation de suppression).
- Toast commun en bas à droite (succès effacés après ~4 s, en pause au survol ou au focus ; erreurs persistantes ; action « Annuler » ou « Étape suivante »), zone de message réservée de deux lignes, raison affichée des boutons grisés, bulle d'aide commune au survol et au clavier sur tous les boutons icône (L9, L10).
- Annulation depuis le toast de chaque changement de disponibilité d'un moniteur ; un clic simple dans la frise pré-remplit le formulaire « Jour / De / À » (L11).
- Choix du thème clair, sombre ou système dans les Réglages.

### Modifié

- L'application s'appelle désormais **Kairos**, du nom du dieu grec du moment opportun : nouvelle icône (ses ailes, d'après la fresque de Salviati, sur un court en dur vert et bleu), nouveau titre de fenêtre, en-tête des PDF et noms proposés pour les sauvegardes exportées (`kairos-….db`, `kairos-….pcenc`) ; les sauvegardes automatiques gardent leur nom `planning-….db`. L'identifiant de l'application ne change pas : les données et les sauvegardes existantes restent en place.
- **Vocabulaire du club** (L10) : « Planning habituel » / « Une semaine précise » avec une phrase de portée toujours visible, « Modifié cette semaine », « Annulé cette semaine », « Revenir au cours habituel », « Le club », « En cours / Terminée / Affichée », « horaires de disponibilité » ; plus d'« exception » ni d'« occurrence » à l'écran ; pastille « N cours changent plus tard dans la saison » dans la barre de mode, détail en bulle ; détails techniques repliés dans les Réglages et l'Import/Export, « Exporter vers Excel » en bouton principal.
- Une seule barre d'outils sur le planning : sélecteur de saison dans l'en-tête, Annuler / Rétablir / PDF en icônes, menu « Filtres » avec compteur, pastilles de moniteurs réduites, total d'heures retiré ; bandeau de mode sur une ligne ; vrais noms des courts (abrégés si besoin) avec icône soleil ou maison (L14).
- Fenêtres : focus sur le premier champ, Échap en cascade, « Abandonner les modifications ? » seulement si la saisie a changé, « Continuer la saisie » par défaut ; même garde pour le panneau de cours, y compris au choix d'un autre créneau (L9).
- Moniteurs dans « Nouveau cours » rangés en trois groupes : disponibles, occupés sur ce créneau (avec le cours), indisponibles ; tous sélectionnables (L11).
- Téléphone de l'élève **ou** du responsable légal : un seul suffit, affiché « (resp.) » quand c'est celui du responsable ; les exports gardent les deux colonnes (L13).
- Prénom avant Nom dans les fiches élève et moniteur ; après la création d'un groupe, on reste sur la liste avec un toast « Ajouter des élèves » (L13).
- Accessibilité (L16) : anneaux de focus et icônes au contraste d'au moins 3:1, texte rouge et pastilles au contraste d'au moins 4,5:1 dans les deux thèmes ; focus visible des champs date et heure sous WebKit, des champs en erreur, des boutons grisés focalisés et du sélecteur de saison.

### Corrigé

- **B1** : un élève déjà inscrit est signalé dès la saisie du nom et du prénom (sans casse ni accents).
- **B2** : deux moniteurs aux mêmes initiales sont signalés, avec une proposition libre en un clic.
- **B3** : les fenêtres donnent le focus au premier champ (ou au bouton non destructif) au lieu de la croix.
- **B4** : seul Ctrl/⌘ N est annoncé pour créer un cours (le « N » seul ne fonctionnait pas).
- **B5** : un court du même nom qu'un court existant est signalé.
- **B6** : glisser de 14 h à 18 h dans les disponibilités donne 14:00–18:00 (et non 18:15) ; un simple clic ne crée plus 15 min.
- **B7** : la barre de mode du planning garde la même hauteur au survol d'un cours ; le panneau ne saute plus.
- **B8** : les hachures montrent le moniteur choisi dans le panneau, même si la souris est sur un autre cours.
- **B9** : l'assistant des fermetures ne décoche un jour férié que si une période cochée le couvre (l'Ascension n'est plus rangée « pendant les vacances ») ; le badge nomme la période.
- **B10** : l'erreur d'un champ s'efface dès qu'il est modifié, dans tous les formulaires.
- **B11** : la création d'une saison est confirmée par « Saison « X » créée ».
- **B12** : chaque case à cocher est annoncée par son libellé (et non « on ») par les lecteurs d'écran.

### Limites connues

- Les limites de la 1.0 demeurent (binaires non signés, pas de `.rpm`, calendrier scolaire embarqué jusqu'en 2027-2028).
- En thème sombre, les cases colorées de la frise des disponibilités et les cours de la grille ont, pour les couleurs de moniteur les plus foncées, un contraste inférieur à 3:1 avec le fond ; l'information est aussi donnée en texte (liste des horaires, libellés des cours).

## [1.0.0] - 2026-10-15

Première version, conforme à `docs/SPECS.md` v1.2 (lots L0 à L8 de `.plan/v1/lots.md`).

### Planning

- Grille de la semaine en jours × courts (§4.1), heures en lignes, en-têtes et axe horaire figés ; cours à la couleur du moniteur avec groupe, horaire, initiales et effectif ; infobulle détaillée.
- Semaine type et semaines datées avec bandeau de mode, navigation entre les semaines (boutons, ← / →, aujourd'hui, sélecteur de date) (§4.2).
- Création par sélection sur la grille ou par le bouton « Nouveau cours », moniteurs disponibles proposés en premier, création rapide d'un groupe (§5.1).
- Glisser-déposer (dnd-kit) : déplacer au pas de 15 min, redimensionner, dupliquer avec Alt, déposer une pastille de moniteur, aperçu fantôme avec avertissements en temps réel, Échap pour interrompre (§5.2).
- Déplacement d'un cours **au clavier** (Espace, flèches, Espace / Entrée) avec annonces en français pour les lecteurs d'écran.
- Annuler / rétablir illimités, raccourcis clavier du §11.5 (§5.3).
- Exceptions en semaine datée : modification, annulation avec motif, remplaçant, cours ponctuel et stage pendant une fermeture, duplication sur les jours suivants, rétablissement, « Appliquer à partir de cette semaine » (§5.4, §5.5).
- Six contrôles de conflits non bloquants, panneau « Avertissements » (§7) ; hachures des indisponibilités, filtres, légende avec total d'heures (§4.3, §4.4).

### Référentiels et saisons

- Saisons, courts (ordre par glisser-déposer), moniteurs (palette de 16 couleurs attribuées automatiquement, initiales, disponibilités hebdomadaires, indisponibilités datées), niveaux pré-remplis, groupes (composition par recherche ou glisser-déposer, alertes d'âge et d'effectif), élèves (§3, §6, §8).
- Suppression avec confirmation, archivage proposé pour un élément utilisé.
- Périodes de fermeture avec assistant (vacances de la zone B des années scolaires 2026-2027 et 2027-2028 et jours fériés, calendrier embarqué).
- Nouvelle saison par duplication ; saisons archivées en lecture seule, garanties jusque dans la base (§8.1).

### Import, sorties et heures

- Import d'élèves CSV (UTF-8 / Windows-1252, `;` ou `,`) et Excel, correspondance des colonnes mémorisée, aperçu des erreurs ligne par ligne, doublons ignorés ou mis à jour, import annulable (§9.1).
- PDF de la semaine (A4 / A3 paysage), planning par moniteur, feuilles d'appel ; aperçu puis ouverture dans le lecteur PDF du système (§9.2).
- Exports CSV / Excel des cours, groupes et élèves ; récapitulatif des heures par moniteur sur une période, avec détail et export CSV (§10).

### Données, sécurité et RGPD

- Base SQLite locale, enregistrement immédiat de chaque modification, migrations automatiques (§11.2, §11.3).
- Sauvegarde automatique à chaque fermeture (30 conservées), export et restauration d'une sauvegarde, chiffrement optionnel par mot de passe (AES-256-GCM, Argon2id) (§11.3, §11.6).
- Export des données d'un élève et suppression définitive, toutes saisons comprises (§11.6).
- Application strictement hors ligne : CSP restrictive, aucune permission réseau, police Inter embarquée (§11.2, §12.2).

### Finitions (lot L8)

- Écran « À propos » : version, système, emplacement des données et des sauvegardes, composants libres et licences.
- Accessibilité : focus visibles, contrastes vérifiés automatiquement en thèmes clair et sombre, raccourci « Nouveau cours » limité à Ctrl/Cmd + N (pas de raccourci d'une seule lettre).
- Performances vérifiées sur la volumétrie cible (10 courts, 20 moniteurs, 60 groupes, 500 élèves, 150 cours) ; liste des élèves allégée (lignes mémoïsées, fenêtres de confirmation créées à l'ouverture) ; écrans chargés à la demande (bundle principal ramené de 800 à 260 ko).
- Installateur Windows `.exe` sans droits administrateur en plus du `.msi` ; installateurs en français.
- Documentation : notice d'installation (binaires non signés), guide de démarrage rapide, recette manuelle, traçabilité spécifications → lots → tests.
- Release GitHub en brouillon avec les installateurs des trois OS à chaque tag `v*`.

### Limites connues

- Binaires non signés : avertissement de Gatekeeper (macOS) et SmartScreen (Windows) au premier lancement, voir `docs/INSTALLATION.md`.
- Pas de paquet `.rpm` : sous Fedora, utiliser l'AppImage.
- Le calendrier des vacances scolaires embarqué couvre les années scolaires 2026-2027 et 2027-2028 ; au-delà, saisir les fermetures à la main ou installer une version plus récente.
