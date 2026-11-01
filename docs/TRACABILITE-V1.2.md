# Traçabilité disponibilités des élèves → lots → tests

> Référence : [spec des disponibilités des élèves](../.plan/disponibilites-eleves/spec.md) (45 user stories), [`.plan/disponibilites-eleves/lots.md`](../.plan/disponibilites-eleves/lots.md) (lots L17 à L22). État aux lots L17 et L20. Les versions précédentes restent dans [`TRACABILITE.md`](TRACABILITE.md) (v1.0) et [`TRACABILITE-V1.1.md`](TRACABILITE-V1.1.md) (v1.1).
>
> Chaque user story est rattachée au lot qui l'implémente et aux tests qui le vérifient. Une story dont le lot n'est pas encore livré porte « à venir ».

**Légende** (comme pour la v1.1)

- `E:` Playwright (`e2e/*.spec.ts`), sous Chromium et WebKit — `pnpm test:e2e`. Nom du test entre guillemets, `›` sépare le `describe` du test.
- `V:` Vitest (`src/**/*.test.ts`) — `pnpm test`.
- `M:` recette manuelle (`docs/RECETTE.md`).

## User stories

### Saisie dans la fiche (L18)

| # | Story (résumé) | Tests |
|---|---|---|
| 1 à 9 | Section, frise, plages multiples, fusion, effacement, « disponible partout », garde de saisie, annuler / rétablir, lecture seule | à venir (L18). Socle posé par L17 : fusion par jour à l'écriture (`replaceStudentAvailabilities`, même `normalizeSlots` que les moniteurs) ; lecture seule d'une saison terminée, V: `src/db/readOnly.test.ts` « saison archivée en lecture seule : repositories › refuse les écritures sur les groupes, leur composition, les élèves et leurs disponibilités », `src/db/migrations.test.ts` « migration 0006 : disponibilités des élèves › emporte les plages avec l'élève et protège celles d'une saison archivée » |

### Liste et saisie en série (L19)

| # | Story (résumé) | Tests |
|---|---|---|
| 10 à 20 | Indicateur « renseignées », filtre, saisie en série | à venir (L19). L17 expose l'indicateur `hasAvailabilities` de la liste des élèves, sans écran. |

### Composition des groupes (L20)

| # | Story (résumé) | Tests |
|---|---|---|
| 21 | Les compatibles en tête des élèves à ajouter | E: `composition-disponibilites.spec.ts` « composition d'un groupe selon les disponibilités › les candidats compatibles passent en tête ; l'incompatible porte le badge et sa bulle cite le cours » (Bruno, libre le mercredi après-midi, et Chloé, sans plage, avant Alice, première par ordre alphabétique mais libre seulement le samedi) ; V: `src/features/referentiels/groupes/composition.test.ts` « élèves proposés par la recherche › trie avant de couper : un compatible 9e par ordre alphabétique reste proposé », « … › garde l'ordre reçu dans chaque catégorie » ; « cours du groupe au planning habituel › ne retient que la version en vigueur à la date du jour » (cours à deux versions, « Appliquer à partir de »), « … › ramène la date dans la saison, comme la grille » |
| 22 | Badge « hors disponibilités » sur l'incompatible | E: même test que la story 21 (un seul badge, sur l'option d'Alice) |
| 23 | Ajout possible d'un élève incompatible | E: `composition-disponibilites.spec.ts` « composition d'un groupe selon les disponibilités › l'élève incompatible peut être ajouté ; il est signalé sans que les boutons bougent » (par clic) ; `composition-disponibilites.spec.ts` « composition d'un groupe selon les disponibilités › l'élève incompatible s'ajoute aussi par Entrée » (champ vidé, focus gardé) |
| 24 | Membres incompatibles signalés dans « Élèves du groupe » | E: les deux tests de la story 23 (« 1 élève hors disponibilités : Alice Test » dans la liste « Alertes » ; zone réservée : le lien « Importer ou coller une liste » et le bouton « Retirer » du membre déjà inscrit gardent leur position) ; V: `src/features/referentiels/groupes/composition.test.ts` « alerte des membres hors disponibilités › accorde le nombre », « … › trie par nom puis prénom, accents compris » (Émery avant Faure), « … › ne dit rien sans membre incompatible » |
| 25 | Le badge dit quel cours coince (jour et heure) | E: test de la story 21 (bulle « Hors disponibilités : mercredi 14:00–15:00 » au survol, reprise dans le nom accessible de l'option ; au clavier, ↑/↓ jusqu'à Alice : option active, ligne visible « Cours en cause : mercredi 14:00–15:00 ») ; V: `src/features/referentiels/groupes/composition.test.ts` « cours du groupe au planning habituel › joint dans la bulle tous les cours qui coincent » |
| 26 | Élève sans plage compatible | E: test de la story 21 (Chloé, sans plage, en tête et sans badge) ; V: `src/domain/availability.test.ts` « compatibilité d'un élève avec les cours d'un groupe › rend compatible un élève sans plage, quels que soient les cours » |
| 27 | Groupe sans cours : tout le monde compatible | E: `composition-disponibilites.spec.ts` « composition d'un groupe selon les disponibilités › sur un groupe sans cours, aucun candidat ne porte le badge » (Alice, libre seulement le samedi, proposée sans badge à son rang alphabétique) ; V: `availability.test.ts` « … › rend compatible tout élève d'un groupe sans cours » |

### Grille du planning (L17)

| # | Story (résumé) | Tests |
|---|---|---|
| 28 | Un cours signale les élèves du groupe indisponibles sur son créneau | E: `eleves-hors-disponibilites.spec.ts` « élèves hors disponibilités › le cours signale en un seul avertissement les élèves disponibles le samedi seulement » ; V: `src/domain/conflicts.test.ts` « 7. élèves hors disponibilités › signale un cours qui déborde d'une plage, même partiellement, et pas un cours couvert » |
| 29 | Un seul avertissement par cours, « N élèves hors disponibilités » | E: même test (une seule entrée dans « Avertissements (1) », un seul message dans la fiche) ; V: `conflicts.test.ts` « 7. … › donne un seul conflit par créneau, qui liste tous les élèves indisponibles » (trois élèves, un conflit) |
| 30 | Noms des élèves dans la fiche au survol et dans le panneau | E: même test (« 2 élèves hors disponibilités : Léa Test, Tom Test » dans la fiche, le panneau et la description accessible du cours ; Zoé, sans plage, absente) ; V: `conflicts.test.ts` « 7. … › donne un seul conflit… » (noms triés par nom puis prénom) |
| 31 | Dans le panneau « Avertissements », avec la navigation vers le cours | E: même test (clic sur l'entrée → cours sélectionné) |
| 32 | Disponible seulement si le cours tient entièrement dans une plage | V: `conflicts.test.ts` « 7. … › signale un cours qui déborde d'une plage, même partiellement, et pas un cours couvert » (débordement d'un quart d'heure, autre jour, cours couvert) ; règle partagée `isAvailableDuring`, déjà prouvée pour les moniteurs |
| 33 | Jamais bloquant | Par construction : le contrôle ne produit qu'un avertissement, comme les six autres (§7) ; E: le test de la story 28 pose le cours par `seedPlanning` et il reste enregistré et sélectionnable. Pas de test d'enregistrement par l'écran sur un cours en conflit d'élève (voir « Couvertures partielles ») |
| 34 | Semaine précise, séances modifiées et cours ponctuels contrôlés d'après leur jour de semaine | E: `eleves-hors-disponibilites.spec.ts` « élèves hors disponibilités › en semaine précise, la séance modifiée et le cours ponctuel sont contrôlés, la séance annulée non » (date figée au 04/11/2026 ; séance du lundi déplacée au mardi et rattrapage du samedi signalés avec leurs noms dans la description, la fiche au survol, le panneau « Avertissements (2) » et le panneau « Modifier pour cette semaine ») ; V: `conflicts.test.ts` « 7. … › contrôle les séances d'une semaine précise : annulée ignorée, modifiée et ponctuelle contrôlées » |
| 35 | Séance annulée sans avertissement | E: `eleves-hors-disponibilites.spec.ts` même test (séance du mercredi annulée : Lina, hors disponibilités, n'apparaît nulle part) ; V: `conflicts.test.ts`, même test que la story 34 |
| — | Sans aucune plage, aucun nouvel avertissement (risque « bruit à la mise en service ») | E: `eleves-hors-disponibilites.spec.ts` « élèves hors disponibilités › sans aucune plage saisie, le club de démonstration n'a aucun avertissement d'élève » ; V: `conflicts.test.ts` « 7. … › ne signale jamais un élève sans plage » |

### Aide pendant le glisser (L21)

| # | Story (résumé) | Tests |
|---|---|---|
| 36 à 41 | Ombrage gradué, à la création comme au déplacement, distinct des hachures, fluide | à venir (L21). L17 pose `unavailableStudents` (`src/domain/availability.ts`), celle du 7e contrôle. |

### Cycle de vie (L17)

| # | Story (résumé) | Tests |
|---|---|---|
| 42 | Plages recopiées à la duplication d'une saison | V: `src/db/repositories/seasonDuplication.test.ts` « nouvelle saison par duplication › recopie les plages de disponibilité de chaque élève sur sa copie », « … › la nouvelle saison est modifiable sans aucun effet sur l'origine » (plages de la copie effacées, celles de l'origine intactes) ; `src/domain/seasonDuplication.test.ts` « planSeasonDuplication › réécrit les références et ignore celles hors de la saison d'origine » |
| 43 | L'export RGPD contient les disponibilités | V: `src/db/repositories/rgpd.test.ts` « RGPD : export des données › exporte toutes les fiches d'un élève en JSON lisible » (saison en cours et saison archivée) ; `src/domain/rgpd.test.ts` « export des données › présente la personne et ses fiches par saison… » |
| 44 | La suppression définitive efface les disponibilités | V: `rgpd.test.ts` (dépôt) « RGPD : suppression définitive › efface l'élève de toutes les saisons, y compris de ses groupes » (4 plages, puis aucune) ; `migrations.test.ts` « migration 0006 : … › emporte les plages avec l'élève et protège celles d'une saison archivée » (cascade, effacement RGPD permis en saison archivée) |
| 45 | Sauvegardes et restaurations incluent les disponibilités | Par construction : la sauvegarde copie le fichier SQLite entier, où vit la table `student_availabilities` (V: `src/db/db.test.ts`, liste des tables). Recette en L22. |

## Données et migration (L17)

- Migration `0006_student_availabilities` : V: `migrations.test.ts` « migration 0006 : disponibilités des élèves › ajoute la table sans toucher aux élèves ni aux groupes » (aucune ligne perdue, clé étrangère `ON DELETE CASCADE`), « … › refuse un jour hors de 1 à 7 et une plage dont le début n'est pas avant la fin » (contrôles `student_availabilities_weekday_check` et `student_availabilities_times_check`) ; les suites « migration 0005 : … » et « sauvegarde avant mise à jour » attendent désormais 0005 puis 0006 depuis une base v1.0.

## Couvertures partielles

- **Story 33** : l'absence de blocage n'est pas éprouvée par un enregistrement à l'écran d'un cours en conflit d'élève ; le contrôle ne sait produire qu'un avertissement.
- **Story 45** : pas de test de sauvegarde et restauration propre aux plages ; recette prévue en L22.
