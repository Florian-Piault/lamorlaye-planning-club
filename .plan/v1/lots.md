# Découpage de la V1 en lots

> Référence : `docs/SPECS.md` v1.2 — 14/10/2026

## Principes

- Chaque lot se termine par une **version installable** sur les trois OS (CI verte) et apporte quelque chose d'utilisable ou de vérifiable.
- Les **règles métier** (`src/domain/`) sont développées et testées (Vitest) avant l'interface qui les utilise.
- La **sauvegarde** arrive dès que des données réelles peuvent être saisies (lot 1).
- Taille relative : **S** (quelques jours), **M** (environ 1 semaine), **L** (environ 2 semaines), pour un développeur assisté par Claude Code.

## Vue d'ensemble

```
L0 Socle ──► L1 Référentiels ──► L3 Grille semaine type ──► L4 Semaines datées ──► L8 Finitions
   │                               ▲                          │                      ▲
   └──► L2 Moteur métier ──────────┘                          ├──► L6 Sorties ───────┤
                                                              └──► L5 Import ────────┤
                                                                   L7 Saisons ───────┘
```

| Lot | Contenu | Taille | Dépend de | Jalon |
|---|---|---|---|---|
| L0 | Socle technique | M | — | |
| L1 | Référentiels + sauvegarde | L | L0 | Saisie des données réelles possible |
| L2 | Moteur métier | M | L0 | En parallèle de L1 |
| L3 | Grille semaine type | L | L1, L2 | **Jalon A** : la semaine type de la saison peut être construite |
| L4 | Semaines datées et exceptions | L | L3 | **Jalon B** : planning utilisable au quotidien |
| L5 | Import d'élèves | S | L1 | |
| L6 | Sorties (PDF, exports, heures) | M | L4 | **Jalon C** : diffusion aux moniteurs et élèves |
| L7 | Saisons et RGPD | S | L4 | |
| L8 | Finitions et release 1.0 | M | tous | **V1.0** |

L5 peut démarrer dès la fin de L1. L6 et L7 sont indépendants entre eux.

---

## L0 — Socle technique (M)

**Objectif** : une application vide, installable sur les trois OS, avec toute la chaîne d'outillage.

- Projet Tauri 2 + React + Vite + TypeScript strict, pnpm, Biome.
- Tailwind + shadcn/ui, thèmes clair et sombre suivant le système.
- Coque de l'application : barre latérale de navigation (Planning, Référentiels, Import/Export, Réglages) et écrans vides.
- Interface d'accès à la base avec deux implémentations : `tauri-plugin-sql` et sql.js (tests).
- Drizzle : schéma complet de la V1 (§3, avec UUID et `created_at`/`updated_at` partout), migration initiale appliquée au démarrage.
- Vitest et Playwright configurés, avec un test exemple de chaque type.
- GitHub Actions : vérification du code, tests, puis build en matrice → `.dmg` (Intel + Apple Silicon), `.msi`, `.AppImage`, `.deb`.
- Mode hors ligne strict (§12.2) : CSP, aucune permission HTTP, polices embarquées.

**Critères d'acceptation**
- Les installateurs produits par la CI s'installent et démarrent sur macOS, Windows et Linux.
- Le fichier SQLite est créé dans le dossier de données de l'application au premier lancement.
- Aucune requête réseau n'est émise (vérifiée avec un moniteur réseau).

## L1 — Référentiels et sauvegarde (L)

**Objectif** : saisir toutes les données de base du club. Spec : §3, §6, §8, §11.3.

- Saison : création simple (nom, dates, amplitude horaire, jours affichés) ; une seule saison active.
- Courts : nom, couvert/extérieur, ordre (glisser pour réordonner), actif.
- Moniteurs : fiche, **palette de 16 couleurs avec attribution automatique**, initiales, **plages de disponibilité hebdomadaires** (éditeur visuel par jour), **indisponibilités datées**.
- Niveaux : référentiel paramétrable, pré-rempli (Galaxie + niveaux adultes).
- Groupes : fiche (niveau, tranche d'âge, effectif max) et composition (ajout d'élèves par recherche).
- Élèves : fiche complète, appartenance à plusieurs groupes, recherche.
- Listes avec recherche et tri ; suppression avec confirmation ; archivage proposé si l'élément est utilisé.
- **Sauvegarde** : copie automatique à la fermeture (`VACUUM INTO`, 30 dernières conservées), export manuel, restauration.

**Critères d'acceptation**
- Le responsable peut saisir 3 courts, 4 moniteurs avec leurs disponibilités, 15 groupes et 100 élèves sans quitter l'application.
- Un nouveau moniteur reçoit automatiquement une couleur non utilisée.
- Une sauvegarde exportée puis restaurée sur un autre poste redonne exactement les mêmes données.

## L2 — Moteur métier (M)

**Objectif** : toutes les règles de calcul en TypeScript pur, couvertes par des tests. Spec : §3.6–3.8, §5.4, §7, §10.

- **Génération des occurrences** d'une semaine datée : cours de la semaine type selon leurs dates d'effet, moins les fermetures, avec les exceptions appliquées (modification, annulation, remplacement, cours ponctuel).
- « **Appliquer à partir de** » : clôture d'un cours et création de sa nouvelle version.
- **Détection des conflits** (les 6 règles du §7), à la fois pour un cours seul (aperçu pendant un glisser) et pour une semaine entière.
- **Disponibilité** d'un moniteur sur un créneau (plages récurrentes + indisponibilités datées).
- **Calcul des heures** par moniteur sur une période (fermetures et annulations exclues, remplaçant crédité, cours ponctuels inclus).
- Utilitaires de dates : semaines ISO, fuseau Europe/Paris, changements d'heure.
- **Commandes inversibles** (`apply` / `revert`) pour chaque type de modification, et pile d'annulation.

**Critères d'acceptation**
- Couverture de tests ≥ 90 % sur `src/domain/`.
- Jeux de tests sur les cas limites : semaine de changement d'heure, fermeture couvrant une partie de semaine, exception sur un cours clôturé, remplacement suivi d'une annulation.
- Calcul des conflits d'une semaine de 150 cours en moins de 10 ms.

## L3 — Grille semaine type (L)

**Objectif** : construire la semaine type à la souris, comme dans la maquette validée. Spec : §4.1, §4.3, §4.4, §5.1–5.3, §6, §7. Référence : `maquettes/drag-and-drop.html`.

- Grille **jours × courts** (variante A), en-têtes et axe horaire figés, amplitude de la saison.
- Cours colorés (couleur du moniteur, initiales, effectif, ⚠).
- **Création** : sélection sur la grille → panneau pré-rempli ; bouton « Nouveau cours » → panneau vide ; moniteurs disponibles proposés en premier ; création rapide d'un groupe.
- **Glisser-déposer** (dnd-kit) : déplacer (pas de 15 min, changement de jour et de court), redimensionner, dupliquer avec Alt, déposer une pastille de moniteur sur un cours, aperçu fantôme avec avertissements en temps réel, Échap pour interrompre.
- **Hachures** des indisponibilités au survol, pendant un glisser et au clic sur une pastille.
- Légende avec le total d'heures de la semaine ; filtres par moniteur, court et groupe.
- Panneau « Avertissements » avec navigation vers le cours concerné.
- **Annuler / rétablir illimités** et raccourcis clavier (§11.5).

**Critères d'acceptation**
- Tous les gestes de la maquette sont reproduits et couverts par des scénarios Playwright.
- Chaque modification est en base immédiatement : on retrouve tout après avoir quitté et relancé l'application.
- Le retour visuel du glisser-déposer reste fluide avec 150 cours affichés.
- 🏁 **Jalon A** : le responsable construit la semaine type réelle du club.

## L4 — Semaines datées et exceptions (L)

**Objectif** : passer de la semaine type au planning réel, semaine par semaine. Spec : §3.7, §3.8, §4.2, §5.4, §5.5.

- Sélecteur de mode **Semaine type / Semaine du JJ/MM** avec bandeau coloré ; navigation entre semaines (boutons, ← / →, sélecteur de date, « aujourd'hui »).
- Exceptions : modifier pour une seule semaine (y compris par glisser-déposer), annuler avec motif, désigner un remplaçant, cours ponctuel, rétablir l'occurrence d'origine.
- « **Appliquer à partir de cette semaine** ».
- Affichage : occurrences annulées grisées et barrées, remplacements signalés, bandes « Fermé ».
- **Périodes de fermeture** : saisie, plus un assistant de pré-remplissage avec les vacances de la zone B et les jours fériés (calendrier embarqué, à mettre à jour à chaque version).
- **Stages** : cours ponctuels pendant les fermetures, et action « Dupliquer sur les jours suivants ».
- Indisponibilités datées des moniteurs prises en compte dans les hachures et les avertissements.

**Critères d'acceptation**
- Un cours déplacé en semaine datée ne modifie ni la semaine type ni les autres semaines.
- Après « Appliquer à partir de », les semaines précédentes sont inchangées et les suivantes reflètent la modification.
- Les vacances de la zone B de la saison 2026-2027 sont proposées correctement par l'assistant.
- 🏁 **Jalon B** : planning utilisable au quotidien.

## L5 — Import d'élèves (S)

**Objectif** : éviter de saisir des centaines d'élèves à la main. Spec : §9.1.

- Assistant : choix du fichier (CSV ou Excel) → correspondance entre colonnes et champs (mémorisée) → aperçu avec erreurs ligne par ligne → import.
- Détection de l'encodage (UTF-8 / Windows-1252) et du séparateur.
- Doublons (nom + prénom + date de naissance) : ignorer ou mettre à jour.
- Option : rattacher les élèves importés à un groupe d'après une colonne.
- L'import entier est une seule commande, annulable.

**Critères d'acceptation**
- Un export Excel typique de 300 adhérents s'importe en moins de 5 secondes, accents compris.
- Les lignes invalides sont signalées et ne bloquent pas l'import des autres.

## L6 — Sorties : PDF, exports et heures (M)

**Objectif** : diffuser le planning sans internet. Spec : §9.2, §10.

- PDF (@react-pdf) :
  - **semaine** (type ou datée), A4 ou A3 paysage ;
  - **planning par moniteur** (un fichier ou tous en lot) ;
  - **feuilles d'appel** par groupe.
- Aperçu avant enregistrement, puis ouverture dans le lecteur PDF du système.
- Exports CSV / Excel : cours, groupes, élèves.
- Écran **Récapitulatif des heures** : période au choix (raccourcis mois et saison), détail par moniteur, export CSV.

**Critères d'acceptation**
- Les PDF sont identiques sur les trois OS et restent lisibles imprimés en noir et blanc (initiales visibles).
- Le total d'heures correspond aux tests du moteur sur une période comprenant des vacances, une annulation et un remplacement.
- 🏁 **Jalon C** : diffusion aux moniteurs et aux élèves.

## L7 — Saisons et RGPD (S)

**Objectif** : préparer la saison suivante et respecter le RGPD. Spec : §8.1, §11.6.

- **Nouvelle saison par duplication** (courts, moniteurs avec leurs disponibilités récurrentes, groupes, élèves et semaine type ; sans exceptions, indisponibilités datées ni fermetures).
- Sélecteur de saison ; saisons archivées en lecture seule.
- RGPD : suppression définitive d'un élève (y compris dans ses groupes) et export de ses données.
- Option de chiffrement par mot de passe des sauvegardes exportées.

**Critères d'acceptation**
- La saison dupliquée est modifiable sans aucun effet sur la saison d'origine.
- Une saison archivée ne peut être modifiée par aucun écran.

## L8 — Finitions et release 1.0 (M)

**Objectif** : une version stable, documentée et livrée.

- Tests de charge sur la volumétrie cible (§11.5) : 10 courts, 20 moniteurs, 60 groupes, 500 élèves, 150 cours.
- Recette manuelle sur les trois moteurs web (WebKit, WebView2, WebKitGTK) : glisser-déposer, polices, PDF, dialogues de fichiers.
- Accessibilité : navigation au clavier dans la grille (dnd-kit), contrastes, focus visibles.
- Écran « À propos » (version, emplacement des données et des sauvegardes).
- **Notice d'installation** pour les trois OS, binaires non signés (§12.2).
- Guide de démarrage rapide : créer une saison, saisir les référentiels, construire la semaine type.
- Version 1.0 publiée (installateurs dans une release GitHub).

**Critères d'acceptation**
- Aucun bug bloquant ou majeur ouvert.
- Toutes les sections de `docs/SPECS.md` sont couvertes (tableau de traçabilité spec → lot → tests).

---

## Risques et points d'attention

| Risque | Lot | Mitigation |
|---|---|---|
| Différences de rendu ou de glisser-déposer entre WebKitGTK, WebKit et WebView2 | L3 | Tester tôt sur Linux, dès les premiers gestes de L3 ; build CI à chaque commit. |
| Complexité des exceptions combinées à « Appliquer à partir de » | L2, L4 | Modèle et tests figés en L2 avant toute interface. |
| `tauri-plugin-sql` et Drizzle `sqlite-proxy` (transactions) | L0 | Prototype de transaction et de migration en L0 ; repli possible : commandes Rust dédiées. |
| Calendrier des vacances embarqué devenu obsolète | L4 | Données sous forme de fichier versionné, mis à jour à chaque version ; saisie manuelle toujours possible. |
| Installation de SheetJS hors npm | L5 | Version figée (URL du tarball dans `package.json`) et vérification de l'empreinte dans le fichier de verrouillage. |
