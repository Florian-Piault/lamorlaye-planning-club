# Recette manuelle — moteurs web et installateurs

> À dérouler **avant chaque version** (SPECS §12.2, lot L8) sur les installateurs produits par la CI, sur les trois systèmes. Les tests automatiques (Vitest, Playwright sous Chromium et WebKit) ne couvrent ni les installateurs, ni les dialogues natifs, ni WebView2 et WebKitGTK eux-mêmes, ni la sauvegarde à la fermeture : c'est l'objet de cette liste.

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
| 1.3 | Premier lancement : la fenêtre s'ouvre en 1440 × 900 environ, ne descend pas sous 1366 × 768, titre « Planning Club », icône correcte (Dock, barre des tâches, menu des applications). | | | |
| 1.4 | Le fichier `planning.db` est créé dans le dossier de données indiqué par l'écran **À propos** (et par `docs/INSTALLATION.md`). | | | |
| 1.5 | **À propos** : version 1.0.0 (identique au nom de l'installateur), version de Tauri, système et architecture corrects, chemins des données et des sauvegardes exacts. | | | |
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

## Critères de sortie

- Aucune anomalie **bloquante** (perte de données, application qui ne démarre pas, sauvegarde ou restauration impossible) ni **majeure** (geste principal du planning inutilisable sur un moteur, PDF faux) ouverte.
- Les anomalies mineures sont consignées dans les tickets et, le cas échéant, dans les notes de version (`CHANGELOG.md`).
- Le procès-verbal (tableau des environnements ci-dessus complété) est joint à la release.
