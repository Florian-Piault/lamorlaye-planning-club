# Traçabilité spécifications → lots → tests

> Référence : `docs/SPECS.md` v1.2 (14/10/2026), `.plan/v1/lots.md`. État à la version 1.0.0 (lot L8). Pour la v1.1 (spec UX, lots L9 à L16), voir [`TRACABILITE-V1.1.md`](TRACABILITE-V1.1.md).
>
> Chaque section et sous-section des spécifications est rattachée au(x) lot(s) qui l'implémentent et aux tests qui la vérifient. Quand une exigence ne peut pas être vérifiée automatiquement, la justification et la vérification de remplacement (recette manuelle `docs/RECETTE.md`, relecture de configuration) sont indiquées.

**Légende des tests**

- `V:` Vitest (`src/**/*.test.ts(x)`, base sql.js en mémoire pour `src/db/**`) — `pnpm test`, couverture ≥ 90 % du domaine, de la grille et de la mise en forme des PDF (`pnpm test:coverage`).
- `E:` Playwright (`e2e/*.spec.ts`), exécutés sous Chromium (moteur de WebView2) et WebKit (moteur de macOS, proche de WebKitGTK) — `pnpm test:e2e`.
- `R:` Rust (`src-tauri/src/*.rs`, modules `tests`) — `cargo test`.
- `M:` recette manuelle (`docs/RECETTE.md`, numéro de ligne).
- `C:` vérification par la CI ou la configuration (`.github/workflows/`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/`).

## 1. Objet

| Section | Exigence | Lots | Vérification |
|---|---|---|---|
| §1 | Application de bureau multiplateforme de planning des cours collectifs | L0–L8 | C: matrice de build macOS (Intel, Apple Silicon), Windows, Linux (`ci.yml`, `release.yml`) ; M: 1.1–1.3 |
| §1.1 | 100 % hors ligne, aucune requête réseau, aucun compte | L0 | E: `navigation.spec.ts` « navigue entre les écrans sans aucune requête externe », « utilise la police embarquée » ; C: CSP et capacités sans HTTP ; M: 1.6 |
| §1.1 | Un seul poste, un seul utilisateur, pas d'authentification | L0 | Par construction (aucun écran de connexion, base locale) ; E: `navigation.spec.ts` (accès direct aux écrans) |
| §1.1 | Langue : français uniquement | L0–L8 | Tous les scénarios E: vérifient des libellés français ; installateurs en français (`tauri.conf.json` : WiX `fr-FR`, NSIS `French`) |
| §1.2 | Hors périmètre V1 (synchronisation, e-mails, facturation, présences, module de stages, co-animation, solveur) | — | Non implémenté volontairement ; aucune dépendance réseau (C: capacités). La co-animation est exclue par le modèle (un seul `instructor_id` par cours, V: `src/db/db.test.ts`) |

## 2. Glossaire

| Section | Lots | Vérification |
|---|---|---|
| §2 | — | Terminologie reprise à l'identique dans l'interface, le code (`src/domain/`) et les tests ; pas de test propre (définitions). |

## 3. Modèle de données

| Section | Exigence | Lots | Tests |
|---|---|---|---|
| §3 | UUID et `created_at` / `updated_at` sur tous les enregistrements | L0 | V: `src/db/db.test.ts` « crée toutes les tables du modèle avec UUID et horodatages » |
| §3.1 | Saison : nom, dates, statut active / archivée, amplitude, jours affichés | L1, L7 | V: `src/db/repositories/seasons.test.ts` (une seule saison active, garantie en base), `src/domain/validation.test.ts`, `src/db/readOnly.test.ts` ; E: `referentiels.spec.ts` « crée la saison… », `saisons.spec.ts` |
| §3.2 | Court : nom, couvert / extérieur, ordre, actif | L1 | V: `src/db/repositories/referentiels.test.ts` (courts), `src/domain/usage.test.ts` (réordonnancement) ; E: `referentiels.spec.ts` « crée la saison, les courts et les réordonne par glisser-déposer » |
| §3.3 | Moniteur : coordonnées, couleur, initiales, plages hebdomadaires, indisponibilités datées, actif | L1, L2, L4 | V: `referentiels.test.ts` (moniteurs), `src/domain/initials.test.ts`, `src/domain/availability.test.ts`, `src/domain/instructorAvailability.test.ts`, `src/domain/unavailability.test.ts` ; E: `referentiels.spec.ts` « attribue des couleurs distinctes… et saisit leurs disponibilités », `semaines.spec.ts` « prend en compte les indisponibilités datées… » |
| §3.4 | Groupe : niveau, tranche d'âge, effectif maximum, élèves (N-N) | L1 | V: `referentiels.test.ts` (groupes et élèves), `src/domain/groups.test.ts` ; E: `referentiels.spec.ts` « compose un groupe… » |
| §3.5 | Élève : champs obligatoires et facultatifs, responsable légal, plusieurs groupes | L1 | V: `referentiels.test.ts` « inscrit un élève dans plusieurs groupes… », `validation.test.ts` ; E: `referentiels.spec.ts` |
| §3.5 bis | Référentiel des niveaux paramétrable et pré-rempli | L1 | V: `seasons.test.ts` (niveaux pré-remplis, ajout, réordonnancement), `referentiels.test.ts` « signale l'utilisation d'un niveau… » ; E: `accessibilite.spec.ts` (écran Niveaux) |
| §3.6 | Cours : jour, heure, durée (pas de 15 min), court, groupe, un moniteur, dates d'effet, note | L2, L3 | V: `src/domain/commands.test.ts` (cours de la semaine type), `src/domain/occurrences.test.ts`, `validation.test.ts` ; E: `planning.spec.ts` |
| §3.7 | Exceptions : modification, annulation (motif), remplacement, cours ponctuel | L2, L4 | V: `commands.test.ts` (exceptions, cours ponctuels), `occurrences.test.ts` (exceptions, cas limites), `src/features/planning/grid/actions.test.ts` ; E: `semaines.spec.ts` |
| §3.8 | Périodes de fermeture : occurrences suspendues, non comptées ; assistant zone B et jours fériés, calendrier embarqué | L2, L4 | V: `occurrences.test.ts` (périodes de fermeture), `src/domain/hours.test.ts`, `src/domain/schoolCalendar.test.ts`, `commands.test.ts` (périodes de fermeture) ; E: `semaines.spec.ts` « l'assistant propose les vacances de la zone B 2026-2027… » |

## 4. Vue semaine

| Section | Exigence | Lots | Tests |
|---|---|---|---|
| §4.1 | Variante A : heures en lignes, jours × courts en colonnes, séparateur de jours, bloc coloré (groupe, horaire, initiales, effectif), infobulle, défilement avec en-têtes et axe figés | L3 | V: `src/features/planning/grid/geometry.test.ts` (colonnes jour × court, placement, conversion), `grid/items.test.ts`, `grid/view.test.ts` ; E: `planning.spec.ts` « affiche les jours, les courts et les cours colorés du moniteur », « affiche en entier un cours qui déborde de l'amplitude » ; E: `charge.perf.spec.ts` (150 cours, 10 courts) |
| §4.2 | Sélecteur de mode avec bandeau, semaine datée, navigation précédente / suivante / aujourd'hui / date ; annulées grisées et barrées, remplacements signalés, bande « Fermé » | L4 | V: `grid/items.test.ts` (modes de l'écran Planning) ; E: `semaines.spec.ts` « passe de la semaine type à la semaine datée et navigue… », « annule une séance… », « crée un stage… pendant une fermeture » ; E: `charge.perf.spec.ts` (navigation sur 12 semaines dont les vacances de Noël) |
| §4.3 | Filtres moniteur / court / groupe (estompage) ; légende avec total d'heures de la semaine | L3 | V: `grid/view.test.ts` (filtres, semaine type) ; E: `planning.spec.ts` « filtre par moniteur, court et groupe », « affiche les jours… » (légende) |
| §4.4 | Hachures des indisponibilités au survol, pendant un glisser, au clic sur une pastille | L3, L4 | V: `geometry.test.ts` (hachures), `src/features/planning/interaction.test.ts` ; E: `planning.spec.ts` « hachure les indisponibilités… », `semaines.spec.ts` (indisponibilités datées), `accessibilite.spec.ts` (pastille activée au clavier) |

## 5. Création et édition des cours

| Section | Exigence | Lots | Tests |
|---|---|---|---|
| §5.1 | Sélection sur la grille ou bouton « Nouveau cours » → même panneau ; groupe avec recherche et création rapide ; moniteurs disponibles en tête | L3 | V: `grid/view.test.ts` (choix du moniteur), `geometry.test.ts` (gestes) ; E: `planning.spec.ts` « crée un cours par sélection sur la grille… », « crée un cours depuis le bouton, avec création rapide d'un groupe » |
| §5.2 | Déplacer (15 min, jour, court), redimensionner, dupliquer (Alt), pastille de moniteur, aperçu fantôme et avertissements en temps réel ; accessibilité clavier de dnd-kit (§12.1) | L3, L8 | V: `geometry.test.ts` (magnétisme, gestes, **déplacement au clavier**), `grid/actions.test.ts` ; E: `planning.spec.ts` « déplace un cours au pas de 15 min… », « redimensionne… », « duplique… avec Alt », « confie un cours… pastille », « Échap interrompt… », « reste fluide pendant un glisser avec 150 cours » ; E: `accessibilite.spec.ts` « déplace un cours par pas de 15 min, de court et de jour, avec annonces » ; M: 3.1–3.9 |
| §5.3 | Annuler / rétablir illimités (Ctrl/Cmd+Z, Ctrl/Cmd+Maj+Z) pour toutes les modifications | L2, L3 | V: `src/domain/history.test.ts`, `commands.test.ts` (mutations inverses), `src/features/planning/store.test.ts` ; E: `planning.spec.ts` « annule et rétablit au clavier ; Suppr, Ctrl/Cmd+N et Échap », `accessibilite.spec.ts` (annulation d'un déplacement au clavier) |
| §5.4 | Portée : semaine type = toute la saison ; semaine datée = exception ; « Appliquer à partir de cette semaine » | L2, L4 | V: `commands.test.ts` (« Appliquer à partir de cette semaine »), `grid/actions.test.ts` (semaine type / semaine datée / « Appliquer à partir de ») ; E: `semaines.spec.ts` « un cours déplacé en semaine datée ne modifie ni la semaine type ni les autres semaines », « « Appliquer à partir de cette semaine » : semaines précédentes inchangées… » |
| §5.5 | Exceptions par menu : modifier, annuler (motif obligatoire), remplaçant, cours ponctuel y compris pendant une fermeture, dupliquer sur les jours suivants (jours non affichés sautés), rétablir | L4 | V: `grid/actions.test.ts` (cours ponctuels et stages, fermetures, cas combinés), `commands.test.ts` ; E: `semaines.spec.ts` « annule une séance avec motif, désigne un remplaçant puis rétablit… », « confie une séance à un remplaçant en déposant sa pastille », « crée un stage… et le duplique sur les jours suivants » |

## 6. Couleurs

| Section | Exigence | Lots | Tests |
|---|---|---|---|
| §6 | Palette de 16 couleurs lisibles avec du blanc (≥ 4,5:1) | L1 | V: `src/domain/colors.test.ts` (palette, contraste de chaque couleur) ; E: `accessibilite.spec.ts` (contrastes des cours dans la grille, thèmes clair et sombre) |
| §6 | Attribution automatique de la première couleur libre, modifiable | L1 | V: `colors.test.ts` (attribution), `referentiels.test.ts` « attribue automatiquement une couleur non utilisée… » ; E: `referentiels.spec.ts` |
| §6 | Initiales toujours affichées (daltonisme, impression N&B) | L1, L3, L6 | V: `initials.test.ts`, `src/features/pdf/model.test.ts` ; E: `planning.spec.ts` (« KB · 3/8 ») ; M: 4.5 |

## 7. Conflits et avertissements

| Section | Exigence | Lots | Tests |
|---|---|---|---|
| §7 | Six contrôles non bloquants (court, moniteur occupé, hors disponibilités, élève en double, effectif, âge), bordure rouge + ⚠, infobulle | L2, L3 | V: `src/domain/conflicts.test.ts` (les six contrôles, chevauchements, semaine datée, aperçu pendant un glisser, cas limites), `grid/view.test.ts` (avertissements) ; E: `planning.spec.ts` « avertit en temps réel dans le panneau… » |
| §7 | Panneau « Avertissements » avec navigation vers le cours | L3 | E: `planning.spec.ts` « liste les avertissements et navigue vers le cours concerné » |
| §7 | Calcul des conflits d'une semaine de 150 cours < 10 ms (L2) | L2, L8 | V: `conflicts.test.ts` (performance), `src/domain/volumetry.perf.test.ts` |

## 8. Gestion des référentiels

| Section | Exigence | Lots | Tests |
|---|---|---|---|
| §8 | Listes + fiches pour courts, moniteurs, groupes, élèves, fermetures, saisons, niveaux ; création, modification, recherche, suppression avec confirmation | L1, L4, L7 | V: `referentiels.test.ts`, `src/domain/search.test.ts` (recherche sans accents, tri) ; E: `referentiels.spec.ts` « trie les listes et propose l'archivage d'un élément utilisé » |
| §8 | Composition d'un groupe : ajout par recherche **ou glisser-déposer**, effectif et alertes | L1, L8 | V: `groups.test.ts` (alertes de composition) ; E: `referentiels.spec.ts` « compose un groupe par recherche d'élèves et signale les dépassements » (recherche, puis glisser-déposer d'un élève sur la composition, ajouté en L8) |
| §8 | Archivage proposé à la suppression d'un élément utilisé | L1 | V: `referentiels.test.ts` « signale l'utilisation par des cours… permet l'archivage », `usage.test.ts` ; E: `referentiels.spec.ts` |
| §8.1 | Saison vierge ou par duplication (sans exceptions, indisponibilités datées ni fermetures) ; saisons passées en lecture seule | L7 | V: `src/domain/seasonDuplication.test.ts`, `src/db/repositories/seasonDuplication.test.ts`, `readOnly.test.ts` (déclencheurs SQLite) ; E: `saisons.spec.ts` « duplique la saison, puis modifie la nouvelle sans effet sur l'ancienne », « une saison archivée n'est modifiable par aucun écran » ; V: `src/db/repositories/volumetry.perf.test.ts` (duplication à la volumétrie cible) |

## 9. Import / export

| Section | Exigence | Lots | Tests |
|---|---|---|---|
| §9.1 | CSV (`;` / `,`, UTF-8 / Windows-1252) et Excel ; assistant fichier → correspondance → aperçu des erreurs → import ; doublons ignorer / mettre à jour | L5 | V: `src/domain/importFile.test.ts` (encodage, séparateur, Excel), `src/domain/studentImport.test.ts`, `src/db/repositories/studentImport.test.ts` (300 adhérents < 5 s) ; R: `import.rs` (fichier choisi lu une seule fois) ; E: `import.spec.ts` ; M: 5.1–5.2 |
| §9.2 | PDF de la semaine (type ou datée, A4 / A3 paysage, couleurs + initiales), PDF par moniteur, feuilles d'appel | L6 | V: `src/features/pdf/model.test.ts`, `src/features/pdf/render.test.ts` ; R: `output.rs` ; E: `sorties.spec.ts` « aperçu et enregistrement du PDF de la semaine (Ctrl/Cmd+P) », « documents PDF et exports de l'écran Import/Export » ; M: 4.1–4.5 |
| §9.2 | Exports CSV / Excel : cours, groupes, élèves, heures moniteurs | L6 | V: `src/domain/exports.test.ts` ; E: `sorties.spec.ts` ; M: 5.3 |

## 10. Récapitulatif des heures

| Section | Exigence | Lots | Tests |
|---|---|---|---|
| §10 | Total par moniteur pour la semaine (légende) et une période (mois en cours, saison) | L2, L3, L6 | V: `hours.test.ts`, `src/domain/hoursReport.test.ts` (périodes), `grid/view.test.ts` (totaux de la légende), `src/features/hours/HoursPage.test.tsx` |
| §10 | Occurrences réelles : fermetures et annulations exclues, remplaçant crédité, cours ponctuels inclus ; détail et export CSV | L2, L6 | V: `hours.test.ts`, `hoursReport.test.ts` ; E: `sorties.spec.ts` « récapitulatif des heures sur une période avec vacances, annulation et remplacement » ; V: `volumetry.test.ts` (heures de la saison complète) |

## 11. Exigences non fonctionnelles

| Section | Exigence | Lots | Vérification |
|---|---|---|---|
| §11.1 | macOS (Intel + Apple Silicon), Windows 10/11, Linux | L0, L8 | C: matrice `ci.yml` et `release.yml` ; M: tableau des environnements |
| §11.1 | Installateurs `.dmg`, `.msi` / `.exe`, `.AppImage`, `.deb` ; sans droits administrateur si possible | L0, L8 | C: `tauri.conf.json` (cibles `dmg`, `msi`, `nsis`, `appimage`, `deb` ; NSIS `currentUser` sans droits administrateur, ajouté en L8) ; M: 1.1–1.2. Non testable automatiquement : installation réelle sur chaque OS |
| §11.1 | Binaires non signés avec notice d'installation | L8 | `docs/INSTALLATION.md` ; M: 1.1 |
| §11.2 | Aucune connexion réseau (télémétrie, polices, mises à jour) | L0 | E: `navigation.spec.ts` ; C: CSP (`default-src 'self'`, `connect-src` limité à l'IPC), capacités sans HTTP, pas de `tauri-plugin-updater` ; M: 1.6 |
| §11.2 | Mise à jour manuelle avec migration automatique du schéma | L0 | V: `db.test.ts` « applique la migration initiale une seule fois » ; `pnpm exec drizzle-kit generate` sans différence (CI locale) ; M: 1.7 |
| §11.3 | Base SQLite locale dans le dossier de données de l'OS | L0 | R: `about.rs` (emplacements) ; E: `navigation.spec.ts` (écran À propos, hors application) ; M: 1.4–1.5 |
| §11.3 | Sauvegarde horodatée à chaque fermeture, 30 conservées | L1 | R: `backup.rs` (nommage, rotation, `VACUUM INTO`) ; V: `src/domain/backup.test.ts`. La fermeture réelle de l'application n'est pas automatisable (pas de tests Tauri sur macOS, §12.1) : M: 6.1–6.2 |
| §11.3 | Exporter / restaurer une sauvegarde (confirmation, copie préalable de l'état courant) | L1, L7 | R: `backup.rs` (export, validation, restauration, refus des fichiers invalides) ; M: 6.3, 6.6 |
| §11.3 | Enregistrement immédiat de chaque modification | L1, L3 | V: `store.test.ts`, `src/db/repositories/planning.test.ts` ; E: `planning.spec.ts` « enregistre chaque modification en base immédiatement » ; M: 6.7 |
| §11.4 | UUID et horodatages (synchronisation future) | L0 | V: `db.test.ts` |
| §11.5 | Volumétrie cible : 10 courts, 20 moniteurs, 60 groupes, 500 élèves, 150 cours | L8 | V: `src/domain/volumetry.perf.test.ts`, `src/db/repositories/volumetry.perf.test.ts` ; E: `charge.perf.spec.ts` (mesures ci-dessous) |
| §11.5 | Affichage d'une semaine et retour du glisser-déposer < 100 ms perçus | L3, L8 | E: `planning.spec.ts` « reste fluide… 150 cours » (aucun cours redessiné pendant le glisser), `charge.perf.spec.ts` ; M: 3.12 |
| §11.5 | Résolution minimale 1366 × 768 | L0 | C: `tauri.conf.json` (`minWidth` / `minHeight`) ; E: tous les scénarios s'exécutent en 1366 × 768 (`playwright.config.ts`) ; M: 2.4 |
| §11.5 | Thèmes clair et sombre suivant le système | L0, L8 | E: `accessibilite.spec.ts` (contrastes en thème clair **et** sombre) ; M: 2.3 |
| §11.5 | Raccourcis : Suppr, Ctrl/Cmd+Z / Maj+Z, Ctrl/Cmd+N, ← / →, Ctrl/Cmd+P | L3, L4, L6, L8 | E: `planning.spec.ts` (Suppr, Ctrl/Cmd+Z, Ctrl/Cmd+N), `semaines.spec.ts` (← / →), `sorties.spec.ts` (Ctrl/Cmd+P) ; M: 3.10. N seul a été retiré en L8 (conformité au §11.5 et WCAG 2.1.4) |
| §11.6 | Données d'élèves uniquement en local | L0 | Voir §11.2 |
| §11.6 | Suppression définitive d'un élève et export de ses données | L7 | V: `src/domain/rgpd.test.ts`, `src/db/repositories/rgpd.test.ts` ; E: `saisons.spec.ts` (RGPD : export, suppression, archives) |
| §11.6 | Chiffrement optionnel des sauvegardes exportées par mot de passe ; recommandation de chiffrement du disque | L7, L8 | R: `crypto.rs`, `backup.rs` (sauvegarde chiffrée, mauvais mot de passe) ; V: `backup.test.ts` (mot de passe et confirmation) ; M: 6.4–6.5. Recommandation FileVault / BitLocker / LUKS : `docs/INSTALLATION.md` |

## 12. Choix technique

| Section | Exigence | Lots | Vérification |
|---|---|---|---|
| §12 | Un développeur assisté par Claude Code, principalement TypeScript | — | Organisation du projet ; sans objet pour les tests |
| §12.1 | Pile : Tauri 2, React + Vite + TypeScript strict, shadcn/ui + Tailwind, dnd-kit, SQLite (`tauri-plugin-sql`), Drizzle (`sqlite-proxy`), règles métier pures, @react-pdf, SheetJS CE + PapaParse, Vitest + Playwright, pnpm + Biome, GitHub Actions + `tauri-action` | L0–L6 | C: `package.json`, `Cargo.toml`, `ci.yml` ; V: `db.test.ts` (Drizzle + sql.js). **Écarts assumés** : l'état et l'annulation reposent sur un magasin maison (`useSyncExternalStore`) plutôt que Zustand ; les formulaires utilisent Zod sans React Hook Form ; les dates passent par `src/domain/dates.ts` (API `Intl`, fuseau Europe/Paris, testé par `dates.test.ts`) plutôt que date-fns ; les fenêtres modales utilisent l'élément natif `<dialog>`. Ces choix réduisent les dépendances sans changer les fonctionnalités |
| §12.2 | Hors ligne garanti (CSP, aucune permission HTTP, pas d'updater, ressources embarquées) | L0 | C: `tauri.conf.json`, `capabilities/default.json` ; E: `navigation.spec.ts` |
| §12.2 | Sauvegardes par `VACUUM INTO` ; restauration après sauvegarde de l'état courant | L1 | R: `backup.rs` |
| §12.2 | Abstraction de la base (Tauri / sql.js) | L0 | V: `db.test.ts` et tous les tests `src/db/**` (sql.js) ; l'implémentation Tauri est vérifiée par M: 1.4 |
| §12.2 | Moteurs web : glisser-déposer, polices et impression validés sur WebKit, WebView2, WebKitGTK | L3, L8 | E: Chromium + WebKit en CI ; WebView2 et WebKitGTK réels : M: sections 2 à 4 (non automatisable : pas de pilote WebDriver Tauri sur macOS) |
| §12.2 | Pas de signature en V1, notice de contournement | L8 | `docs/INSTALLATION.md` ; M: 1.1 |
| §12.3 | Organisation du code (indicative) | L0 | Respectée, avec `src/features/planning/store.ts` (au lieu de `src/store/`), `src/features/hours`, `reglages`, `rgpd`, `about` en plus ; voir `README.md` |

## 13. Décisions complémentaires

| Section | Décision | Lots | Tests |
|---|---|---|---|
| §13 | Niveaux paramétrables | L1 | Voir §3.5 bis |
| §13 | Un seul moniteur par cours | L0, L2 | V: `db.test.ts` (schéma), `commands.test.ts` |
| §13 | Stages = cours ponctuels pendant une fermeture | L4 | E: `semaines.spec.ts` « crée un stage (cours ponctuel) pendant une fermeture… » |
| §13 | Présences sur la feuille d'appel papier uniquement | L6 | V: `pdf/model.test.ts` (feuilles d'appel, colonnes vierges) |

## Exigences transverses du lot L8

| Exigence (lots V1, L8) | Vérification |
|---|---|
| Tests de charge sur la volumétrie cible | V: `src/domain/volumetry.perf.test.ts`, `src/db/repositories/volumetry.perf.test.ts` ; E: `charge.perf.spec.ts` |
| Recette manuelle sur les trois moteurs web | `docs/RECETTE.md` (à dérouler avant publication de la release) |
| Accessibilité : clavier dans la grille, contrastes, focus visibles | E: `accessibilite.spec.ts` (déplacement au clavier avec annonces en français, contrastes et noms accessibles de 12 écrans en thèmes clair et sombre, focus visible sur 30 arrêts de tabulation de 4 écrans) ; V: `geometry.test.ts` (déplacement au clavier), `colors.test.ts` |
| Écran « À propos » | V: `src/App.test.tsx`, `src/app/version.test.ts` ; R: `about.rs` ; E: `navigation.spec.ts` ; M: 1.5 |
| Notice d'installation, guide de démarrage rapide | `docs/INSTALLATION.md`, `docs/DEMARRAGE-RAPIDE.md` |
| Version 1.0 publiée (release GitHub) | C: `.github/workflows/release.yml` (tag `v*` → release en brouillon avec installateurs) ; V: `version.test.ts` (versions alignées) |

## Mesures des tests de charge (poste de développement, macOS Apple Silicon)

Médianes Vitest (`CHARGE_VERBOSE=1 pnpm test:perf`) et moyennes Playwright (annotations « performance », Chromium / WebKit). Les seuils des tests sont des majorants larges pour la CI (multipliés par `PERF_FACTOR`, ou doublés quand `CI` est défini).

| Mesure | Résultat | Seuil du test |
|---|---|---|
| Séances d'une semaine (150 cours + exceptions) | 0,2 ms | 5 ms |
| Séances de toute la saison (≈ 6 400) | 9 ms | 100 ms |
| Conflits d'une semaine, référentiels compris | 1,8 ms | 10 ms |
| Conflits des 43 semaines de la saison | 48 ms | 300 ms |
| Récapitulatif des heures de la saison | 7,5 ms | 150 ms |
| Plan de duplication de saison | 0,4 ms | 50 ms |
| Chargement de l'écran Planning (sql.js) | 8 ms | 300 ms |
| Liste des 500 élèves avec leurs groupes (sql.js) | 3,7 ms | 150 ms |
| Écriture d'une commande (sql.js) | 0,3 ms | 50 ms |
| Duplication de la saison complète (sql.js) | 41 ms | 2 s |
| Affichage de la semaine type, 150 cours (navigateur) | 250–280 ms | 3 s |
| Navigation entre semaines datées | 58–72 ms | 500 ms |
| Retour visuel du glisser-déposer | 17–34 ms | 100 ms |
| Liste des 500 élèves (navigateur) | 370–430 ms | 3 s |
| Recherche parmi 500 élèves | 50–65 ms | 1 s |
| Tri de 500 élèves | 140–260 ms (avant optimisation : 250–350 ms) | 1,5 s |
| Liste des 60 groupes / fiche d'un groupe | 120–140 ms / 70–100 ms | 2 s |

Lenteurs corrigées en L8 : la liste des élèves redessinait ses 500 lignes à chaque tri ou recherche, et créait une fenêtre de confirmation (`<dialog>`) par ligne. Les lignes sont désormais mémoïsées et la fenêtre de suppression n'est créée qu'à l'ouverture. Le bundle principal, chargé au démarrage, passe de 798 ko à 262 ko grâce au chargement des écrans à la demande (`React.lazy`).

## Sections non couvertes

Aucune section de `docs/SPECS.md` n'est sans implémentation. Restent hors de portée des tests automatiques, et couvertes par la recette manuelle (`docs/RECETTE.md`) :

- l'installation des binaires et les alertes Gatekeeper / SmartScreen (§11.1, §12.2) ;
- le rendu et les gestes dans WebView2 et WebKitGTK réels (§12.2) — les tests Playwright utilisent Chromium et WebKit, moteurs de référence de ces webviews ;
- la sauvegarde déclenchée par la fermeture réelle de l'application et les dialogues de fichiers natifs (§11.3, §9) ;
- l'absence de trafic réseau de l'application installée, vérifiée au moniteur réseau (§11.2).
