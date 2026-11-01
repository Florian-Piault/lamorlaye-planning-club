# Recette manuelle — moteurs web et installateurs

> À dérouler **avant chaque version** (SPECS §12.2, lots L8, L16 et L22) sur les installateurs produits par la CI, sur les trois systèmes. Les tests automatiques (Vitest, Playwright sous Chromium et WebKit) ne couvrent ni les installateurs, ni les dialogues natifs, ni WebView2 et WebKitGTK eux-mêmes, ni la sauvegarde à la fermeture : c'est l'objet de cette liste.

## Mode opératoire

- Utiliser les artefacts du workflow (CI ou release en brouillon), jamais un build local.
- Partir d'un poste **sans** dossier de données (voir `docs/INSTALLATION.md`), puis refaire les points marqués ⟳ après une mise à jour par-dessus la version précédente.
- Couper le réseau (Wi-Fi désactivé) pendant toute la recette, sauf l'installation de WebView2 sur un Windows qui en serait dépourvu.
- Jeu de données : saisir le club de démonstration ci-dessous, ou restaurer la sauvegarde de recette de la version précédente.
- Noter pour chaque ligne : ✅ conforme, ❌ anomalie (avec capture et numéro de ticket), — sans objet.

Club de démonstration minimal : saison 2026-2027 (lundi → samedi, 8h–22h), 3 courts (dont un extérieur), 4 moniteurs avec disponibilités et une indisponibilité datée, 15 groupes, 100 élèves (import du fichier `e2e/fixtures/eleves-windows1252.csv` complété), semaine type d'une trentaine de cours, fermetures de la zone B via l'assistant.

## Environnements

| Poste | Système | Moteur web | Installateur | Testeur | Date | Résultat |
|---|---|---|---|---|---|---|
| Mac Apple Silicon | macOS 15 ou plus | WebKit (WKWebView) | `.dmg` aarch64 | | | |
| Mac Intel | macOS 13 ou plus | WebKit (WKWebView) | `.dmg` x64 | | | |
| PC | Windows 11 | WebView2 (Chromium) | `.exe` puis `.msi` | | | |
| PC | Windows 10 22H2 | WebView2 (Chromium) | `.exe` | | | |
| PC | Ubuntu 24.04 (GNOME) | WebKitGTK 4.1 | `.deb` puis `.AppImage` | | | |
| PC | Fedora (dernière) | WebKitGTK 4.1 | `.AppImage` | | | |

## 1. Installation et premier lancement

| # | Vérification | macOS | Windows | Linux |
|---|---|---|---|---|
| 1.1 | La procédure de `docs/INSTALLATION.md` (Gatekeeper : clic droit › Ouvrir ou *Ouvrir quand même* ; SmartScreen : *Informations complémentaires › Exécuter quand même* ; AppImage `chmod +x` / `apt install ./…deb`) aboutit sans autre manipulation. | | | |
| 1.2 | Windows `.exe` : installation **sans** demande de droits administrateur. `.msi` : installation pour tous les utilisateurs. | — | | — |
| 1.3 | Premier lancement : la fenêtre s'ouvre en 1440 × 900 environ, ne descend pas sous 1366 × 768, titre « Kairos », icône correcte (Dock, barre des tâches, menu des applications). | | | |
| 1.4 | Le fichier `planning.db` est créé dans le dossier de données indiqué par l'écran **À propos** (et par `docs/INSTALLATION.md`). | | | |
| 1.5 | **À propos** : version 1.1.0 (identique au nom de l'installateur), version de Tauri, système et architecture corrects, chemins des données et des sauvegardes exacts. | | | |
| 1.6 | Hors ligne strict : avec un moniteur réseau (Little Snitch / LuLu, Moniteur de ressources, `nethogs` ou `ss -tp`), **aucune** connexion sortante au démarrage ni pendant la recette. | | | |
| 1.7 ⟳ | Mise à jour par-dessus la version précédente : les données sont conservées, les migrations s'appliquent (Réglages › *Migrations appliquées au démarrage*). | | | |

## 2. Polices et affichage

| # | Vérification | macOS | Windows | Linux |
|---|---|---|---|---|
| 2.1 | Toute l'interface utilise la police **Inter** embarquée (comparer les « a », « g », chiffres avec une capture de référence), y compris hors ligne et sans Inter installée sur le système. | | | |
| 2.2 | Accents et caractères spéciaux affichés correctement : « Élèves », « Désigner un remplaçant », « ⚠ », « ☀ », « ⇄ », « ✎ », guillemets « ». | | | |
| 2.3 | Thème **clair** puis **sombre** (changer le réglage du système pendant que l'application est ouverte) : bascule immédiate, textes lisibles, bandeaux de mode bleu / vert lisibles, hachures visibles. | | | |
| 2.4 | À 1366 × 768 : grille utilisable (défilement horizontal, en-têtes des jours et axe horaire figés), panneau latéral entièrement accessible. | | | |
| 2.5 | Mise à l'échelle 125 % / 150 % (Windows, Linux HiDPI) et écran Retina (macOS) : pas de flou ni de texte tronqué. | | | |

## 3. Glisser-déposer et clavier dans la grille

| # | Vérification | macOS | Windows | Linux |
|---|---|---|---|---|
| 3.1 | Sélection d'un créneau vide à la souris → panneau « Nouveau cours » pré-rempli (jour, heure, durée, court). | | | |
| 3.2 | Déplacer un cours : magnétisme au quart d'heure, changement de jour et de court, fantôme et infobulle d'avertissements en temps réel, retour visuel fluide. | | | |
| 3.3 | **Alt / Option** pendant le glisser : duplication ; relâcher Alt avant de déposer : simple déplacement. | | | |
| 3.4 | Redimensionner par le bord inférieur (curseur ↕). | | | |
| 3.5 | Glisser une pastille de moniteur de la légende sur un cours : changement de moniteur. | | | |
| 3.6 | **Échap** pendant un glisser : rien n'est modifié. Bouton relâché hors de la fenêtre : le geste s'arrête proprement. | | | |
| 3.7 | Pavé tactile (glisser à deux doigts / tap-glisser) et souris : mêmes comportements. | | | |
| 3.8 | Au clavier : Tab jusqu'à un cours, **Espace**, flèches (↑ ↓ 15 min, ← → court, Maj + ← → jour), **Espace** pour déposer ; **Échap** annule ; **Entrée** ouvre le détail. Contour de focus bien visible. | | | |
| 3.9 | Lecteur d'écran (VoiceOver, Narrateur, Orca) : les cours sont annoncés (« cours déplaçable », groupe, horaire, court, moniteur), le début, la fin et l'annulation d'un déplacement sont annoncés en français. | | | |
| 3.10 | Raccourcis : Ctrl/Cmd + N, Suppr, Ctrl/Cmd + Z, Ctrl/Cmd + Maj + Z, ← / → en semaine datée, Ctrl/Cmd + P. Aucun raccourci du système n'est déclenché à la place (pas de nouvelle fenêtre, pas d'impression du navigateur). | | | |
| 3.11 | Glisser-déposer de la liste des courts (réordonnancement) et d'un élève sur la composition d'un groupe. | | | |
| 3.12 | Avec la volumétrie cible (150 cours, 500 élèves — restaurer la sauvegarde de recette « charge ») : affichage d'une semaine et retour du glisser perçus comme instantanés. | | | |

## 4. PDF

| # | Vérification | macOS | Windows | Linux |
|---|---|---|---|---|
| 4.1 | **Aperçu** du PDF de la semaine (Ctrl/Cmd + P) affiché dans la fenêtre d'aperçu (iframe `blob:`), pages navigables, sans erreur de CSP. | | | |
| 4.2 | Formats A4 et A3 paysage ; semaine type et semaine datée (séances annulées, remplacements, bandes « Fermé »). | | | |
| 4.3 | Enregistrement par le dialogue natif puis **ouverture dans le lecteur PDF du système** (Aperçu, Edge / Acrobat, Evince / Okular) et impression. | | | |
| 4.4 | PDF par moniteur (un fichier et tous en lot) et feuilles d'appel (tous les groupes). | | | |
| 4.5 | Le même PDF généré sur les trois OS est identique (comparer visuellement, ou la taille et le nombre de pages) ; impression **noir et blanc** : initiales lisibles. | | | |

## 5. Dialogues de fichiers, import et exports

| # | Vérification | macOS | Windows | Linux |
|---|---|---|---|---|
| 5.1 | Dialogue « Ouvrir » natif pour l'import : filtres CSV / Excel, navigation vers une clé USB, noms de fichiers accentués. | | | |
| 5.2 | Import d'un CSV Windows-1252 et d'un Excel (.xlsx) d'environ 300 lignes : accents corrects, moins de 5 secondes, lignes invalides signalées. | | | |
| 5.3 | Dialogue « Enregistrer sous » natif pour les exports CSV / Excel et les PDF : nom proposé, extension ajoutée, remplacement d'un fichier existant confirmé. Les CSV s'ouvrent correctement dans Excel / LibreOffice (accents, séparateur `;`). | | | |
| 5.4 | Annuler un dialogue ne produit ni erreur ni fichier. | | | |

## 6. Sauvegardes et chiffrement

| # | Vérification | macOS | Windows | Linux |
|---|---|---|---|---|
| 6.1 | **Sauvegarde à la fermeture** : quitter par le bouton de fermeture de la fenêtre, puis par Cmd + Q / Alt + F4 / menu ; à chaque fois, un fichier `planning-…_fermeture.db` apparaît dans `sauvegardes/` et dans la liste de *Réglages* au lancement suivant. | | | |
| 6.2 | Rotation : au-delà de 30 sauvegardes, les plus anciennes sont supprimées (copier 31 fichiers factices nommés comme des sauvegardes, puis fermer l'application). | | | |
| 6.3 | **Exporter une sauvegarde** non chiffrée sur une clé USB, puis la **restaurer** sur un autre poste (autre OS si possible) : données identiques ; une sauvegarde « avant-restauration » est créée. | | | |
| 6.4 | Export **chiffré** (mot de passe de 8 caractères ou plus, saisi deux fois) : le fichier `.pcenc` n'est pas lisible comme base SQLite (ouvrir avec un éditeur : aucun nom d'élève en clair). | | | |
| 6.5 | Restauration d'une sauvegarde chiffrée : mot de passe demandé ; un mauvais mot de passe est refusé avec un message clair, sans rien modifier ; le bon mot de passe restaure les données. | | | |
| 6.6 | Restauration d'un fichier qui n'est pas une sauvegarde (PDF, texte) : refusée sans dommage. | | | |
| 6.7 | Fermeture brutale (forcer à quitter / tuer le processus) pendant la saisie : au relancement, les modifications déjà faites sont présentes (enregistrement immédiat). | | | |

## 7. Saisons, RGPD et lecture seule

| # | Vérification | macOS | Windows | Linux |
|---|---|---|---|---|
| 7.1 | Duplication de la saison, modification de la nouvelle : l'ancienne (archivée) est inchangée et non modifiable depuis tous les écrans. | | | |
| 7.2 | Export des données d'un élève (dialogue « Enregistrer sous ») et suppression définitive, y compris dans les saisons archivées. | | | |

## 8. Nouveautés de la v1.1 (lot L16)

> Les parcours sont automatisés sous Chromium et WebKit (Playwright, voir `docs/TRACABILITE-V1.1.md`) ; cette liste vérifie ce que ni l'un ni l'autre ne garantit dans les webviews réelles : sélecteurs natifs, presse-papiers du système, lecteurs d'écran, application installée.

| # | Vérification | macOS | Windows | Linux |
|---|---|---|---|---|
| 8.1 ⟳ | **Sauvegarde avant migration** : installer la 1.1 par-dessus une 1.0 contenant des élèves ; au premier lancement, une sauvegarde `…_avant-migration.db` apparaît dans `sauvegardes/` et dans *Réglages* (« Avant mise à jour ») ; aucun élève ni téléphone perdu ; un élève peut ensuite être enregistré avec le seul téléphone du responsable. | | | |
| 8.2 | **Vue Jour** à 1366 × 768 puis fenêtre réduite à ~960 px : barre des jours (compte de cours, flèches, dimanche atteignable), noms des groupes entiers sur un cours d'une heure, en-tête du planning sur une ligne ; clic sur l'en-tête d'un jour en vue Semaine. | | | |
| 8.3 | **Gestes de la grille en vue Jour et en vue Semaine** : créer par sélection, déplacer, redimensionner, dupliquer avec Alt / Option ; panneau replié rouvert à la création ou à l'ouverture d'un cours ; menu de l'application réduit, retrouvé au relancement. | | | |
| 8.4 | **Collage depuis Excel** (Excel et LibreOffice Calc, sur chaque OS) : copier 10 lignes avec en-têtes, dont une cellule sur deux lignes et une cellule vide, puis 5 lignes sans en-têtes ; « Coller depuis Excel » › « Lire le tableau » : séparateur tabulation reconnu, accents corrects, colonnes « Colonne A, B… » sans en-têtes, aperçu, import puis annulation. Refaire depuis la fiche d'un groupe : élèves affectés au groupe. | | | |
| 8.5 | **Toasts** : en bas à droite, au-dessus d'une fenêtre ouverte ; un succès disparaît après ~4 s mais reste tant qu'il est survolé ; une erreur reste jusqu'à « Masquer le message » ; « Annuler » d'un changement de disponibilité restaure les horaires ; au clavier, Tab depuis le dernier contrôle atteint l'action du toast, Entrée la déclenche. | | | |
| 8.6 | **Modales** : focus sur le premier champ à l'ouverture ; fermeture directe d'une fiche non modifiée ; « Abandonner les modifications ? » sinon, avec « Continuer la saisie » par défaut (Entrée) ; panneau de cours modifié puis autre créneau sélectionné : confirmation. | | | |
| 8.7 | **Échap dans les champs date et heure** (fiche élève « Date de naissance », nouvelle fermeture « Du », indisponibilité « À partir de ») : avec le calendrier ou le sélecteur natif **ouvert**, Échap le ferme sans fermer la fenêtre ni perdre la saisie ; calendrier fermé, un deuxième Échap ferme la fenêtre (ou demande confirmation si la saisie a changé). Anneau de focus visible sur chaque segment (jour, mois, année) au clavier. | | | |
| 8.8 | **Bulles d'aide** : survol (~300 ms) et focus clavier (Tab ; ⌥ Tab sous macOS) sur les boutons icône de la barre d'outils, de la barre des jours et du menu réduit ; Échap ferme la bulle seule ; la bulle suit son bouton quand la page défile. | | | |
| 8.9 | **Lecteur d'écran** — VoiceOver (macOS, **B12**), Narrateur (Windows), Orca (Linux) : chaque case à cocher (jours de la saison, « Actif », groupes de la fiche élève, propositions de l'assistant des fermetures, « La première ligne contient des élèves », « Protéger la sauvegarde par un mot de passe » de la fenêtre d'export) est annoncée par son libellé, jamais « on » ; les toasts sont lus (succès poli, erreur immédiate) ; un avertissement de doublon ou d'âge est annoncé sans déplacer le focus ; les bulles sont lues comme description des boutons icône. | | | |
| 8.10 | **Thèmes clair et sombre** sur les nouveaux écrans (accueil du guidage, toasts, zone de message, menu Filtres, fiche au survol, mode d'emploi, collage) : textes lisibles, anneaux de focus visibles. | | | |
| 8.11 | **Touches selon le système** dans l'application installée : l'astuce du panneau et « Tout le mode d'emploi » affichent ⌘, ⌥ et ⌫ sous macOS, Ctrl, Alt et Suppr sous Windows et Linux ; seul Ctrl/⌘ N est annoncé pour créer un cours (B4), et il fonctionne. | | | |

## 9. Rejeu des personas du test d'utilisabilité

> À mener par deux personnes (ou une seule, en jouant les deux profils), sur la 1.1 installée, chronomètre en main ; noter chaque hésitation, clic à côté ou message incompris. Critère : rien de ce qui aide Monique ne ralentit Alex.
>
> **Systèmes** : chaque parcours est joué au moins une fois sous **Windows (WebView2)**, et au moins une fois sous **macOS (WebKit)** ou **Linux (WebKitGTK)** ; noter le système et le moteur dans la colonne « Poste » (ex. « Win 11 / WebView2 »).

**Monique, bénévole débutante** (base vide, sans consigne autre que « préparez le planning de la saison ») :

| # | Étape | Attendu | Poste | Résultat |
|---|---|---|---|---|
| 9.1 | Ouvrir l'application pour la première fois. | L'accueil « Avant de construire le planning » dit quoi faire ; un seul bouton, « Créer la saison ». | | |
| 9.2 | Créer la saison 2026-2027. | Toast « Saison « 2026-2027 » créée » avec « Étape suivante : Courts » ; pastille de l'onglet Saison cochée. | | |
| 9.3 | Suivre les étapes : 2 courts (dont un du même nom par erreur), 3 moniteurs (deux aux mêmes initiales), 2 groupes avec tranche d'âge, 10 élèves dont un saisi deux fois et un hors tranche. | Chaque doublon et l'âge sont signalés à la saisie, sans bloquer ni déplacer les boutons ; « Enregistrer et ajouter un autre » enchaîne les élèves. | | |
| 9.4 | Saisir les horaires de disponibilité d'un moniteur dans la frise (un glisser 14 h → 18 h, un clic simple, une fausse manœuvre annulée). | 14:00–18:00 ; le clic ne crée rien et pré-remplit le formulaire ; « Annuler » du toast répare. | | |
| 9.5 | Placer le premier cours avec « + Nouveau cours ». | L'astuce l'indique ; moniteurs disponibles en tête ; le guidage disparaît ensuite de lui-même. | | |
| 9.6 | Modifier un cours pour une seule semaine, puis revenir au cours habituel. | « Une semaine précise », phrase de portée lue et comprise ; « Modifié cette semaine », « Revenir au cours habituel ». | | |
| 9.7 | Fermer une fiche modifiée par erreur avec Échap dans un champ date. | Le calendrier se ferme seul ; la fenêtre demande confirmation, rien n'est perdu. | | |

**Alex, expert qui saisit vite** (club de démonstration restauré, consignes chronométrées) :

| # | Étape | Attendu | Poste | Résultat |
|---|---|---|---|---|
| 9.8 | Coller 60 élèves depuis un tableur, sans en-têtes, dans un groupe. | Import en moins de 2 minutes, sans créer de fichier. | | |
| 9.9 | Ajouter 5 élèves existants à un groupe au clavier seul (champ « Ajouter un élève », ↑ ↓, Entrée). | Le champ se vide et garde le focus ; aucune souris. | | |
| 9.10 | Ouvrir puis fermer 10 fiches sans les modifier. | Aucune question de confirmation. | | |
| 9.11 | Créer, déplacer, dupliquer (Alt) et supprimer des cours ; Ctrl/⌘ N, Suppr, Ctrl/⌘ Z. | Raccourcis annoncés conformes au système ; aucune confirmation superflue ; vue Jour pour lire les groupes. | | |
| 9.12 | Réduire le menu, replier le panneau, filtrer par moniteur. | Grille lisible à 960 px ; « Filtres, N actifs » ; choix du menu retrouvé au relancement. | | |

## 10. Disponibilités des élèves (lot L22)

> Les parcours sont automatisés sous Chromium et WebKit (Playwright, voir `docs/TRACABILITE-V1.2.md`). La copie, le chiffrement et la restauration d'une base qui contient des plages d'élève sont vérifiés côté Rust (`cargo test`, `src-tauri/src/backup.rs` : `sauvegarde_et_restaure_les_plages_des_eleves`), hors `pnpm check`. Cette liste vérifie le parcours complet dans l'application installée : dialogues natifs, rechargement après restauration, migration d'une vraie base.
>
> **Préparation** : dans la saison en cours, un groupe d'**exactement trois élèves**, tous **sans horaire** de disponibilité, avec un seul cours au planning habituel, par exemple « Galaxie vert » le mercredi de 14 h à 15 h. Noter le nom des trois élèves.

| # | Vérification | macOS | Windows | Linux |
|---|---|---|---|---|
| 10.1 ⟳ | **Mise à jour par-dessus la 1.1** contenant des élèves : une sauvegarde `…_avant-migration.db` apparaît (« Avant mise à jour ») ; *Réglages* › *Migrations appliquées au démarrage* liste `0006_student_availabilities` ; aucun élève perdu ; la colonne « Disponibilités » de l'onglet Élèves dit « Non renseignées » pour tous ; la grille n'affiche **aucun** avertissement « hors disponibilités ». | | | |
| 10.2 | **Saisie en série** : *Le club* › *Élèves*, filtre « Groupe » sur le groupe préparé et case « Disponibilités non renseignées », puis « Saisir les disponibilités en série ». Pour les trois élèves, au clavier : un horaire chacun (par exemple le jeudi de 17:00 à 19:00 pour tous, et en plus le mercredi de 14:00 à 16:00 pour un seul), ⌘ ↩ / Ctrl+Entrée. Toast « Saisie en série terminée : 3 élèves enregistrés. » ; les trois élèves quittent le filtre et passent à « Renseignées ». | | | |
| 10.3 | **Avertissement et ombrage** : *Planning*, planning habituel. Le cours du mercredi porte « 2 élèves hors disponibilités : … » (fiche au survol, panneau « Avertissements »). Faire glisser ce cours sans le lâcher : les jours sont ombrés en aplat ambré, plus foncé là où plus d'élèves sont gênés, avec la pastille « Zones ombrées : élèves de … » ; le jeudi à 17:00 n'est pas ombré. Déposer le cours le jeudi à 17:00 : ombrage et pastille disparaissent, l'avertissement aussi (survol et panneau). Refaire le glisser au clavier (Espace, flèches, Espace). | | | |
| 10.4 | Ramener le cours au mercredi de 14:00 à 15:00 (glisser ou panneau du cours) : il porte de nouveau « 2 élèves hors disponibilités : … ». **Exporter une sauvegarde** non chiffrée (*Réglages* › *Sauvegardes* › *Exporter une sauvegarde*, dialogue natif, sur une clé USB). Effacer ensuite les horaires d'un des deux élèves cités (« Effacer tous les horaires », Enregistrer) : il redevient « Non renseignées » et le cours ne porte plus que « 1 élève hors disponibilités : … ». **Restaurer** le fichier exporté : une sauvegarde « avant-restauration » est créée, l'application se recharge ; l'élève est de nouveau « Renseignées », sa fiche montre ses horaires dans la frise et la liste, et le cours porte de nouveau « 2 élèves hors disponibilités », avec les deux mêmes noms. | | | |
| 10.5 | Même parcours que 10.4 avec un **export chiffré** (`.pcenc`, mot de passe) : un mauvais mot de passe est refusé sans rien modifier (toujours « 1 élève hors disponibilités ») ; le bon restaure les horaires des trois élèves (« Renseignées » pour les trois, « 2 élèves hors disponibilités » sur le cours). | | | |
| 10.6 | **Sauvegarde à la fermeture** : avec le cours du mercredi à « 2 élèves hors disponibilités », quitter l'application, puis la relancer. Effacer les horaires d'un des deux élèves cités (« Effacer tous les horaires », Enregistrer) : « Non renseignées », et « 1 élève hors disponibilités » sur le cours. *Restaurer une sauvegarde* en choisissant le dernier fichier `planning-…_fermeture.db` du dossier `sauvegardes/` : l'élève est de nouveau « Renseignées », sa fiche montre ses horaires, et le cours porte de nouveau « 2 élèves hors disponibilités ». | | | |
| 10.7 | **Saison suivante et RGPD** : dupliquer la saison : dans la nouvelle, les trois élèves gardent leurs horaires ; dans l'ancienne (terminée), leur fiche les montre sans pouvoir les modifier. Exporter les données personnelles d'un des élèves (dialogue « Enregistrer sous ») : le fichier contient ses « disponibilités » pour chaque saison. | | | |
| 10.8 | **Lecteur d'écran** (VoiceOver, Narrateur, Orca) dans la saisie en série : le nom de l'élève et « élève n / N » sont annoncés à chaque élève, le premier compris ; une erreur d'écriture est lue. | | | |

## Critères de sortie

- Aucune anomalie **bloquante** (perte de données, application qui ne démarre pas, sauvegarde ou restauration impossible) ni **majeure** (geste principal du planning inutilisable sur un moteur, PDF faux) ouverte.
- Les anomalies mineures sont consignées dans les tickets et, le cas échéant, dans les notes de version (`docs/CHANGELOG.md`).
- Le procès-verbal (tableau des environnements ci-dessus complété) est joint à la release.
