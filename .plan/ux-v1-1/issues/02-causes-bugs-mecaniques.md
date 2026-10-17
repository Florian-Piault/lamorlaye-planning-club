# Causes des bugs mécaniques

Type: research
Status: resolved

## Question

Quelle est la cause racine de chacun de ces bugs, et sa correction est-elle évidente ou demande-t-elle un arbitrage ?

- B4 : raccourci « N » inopérant sur le planning (seul Ctrl/⌘ N marche).
- B6 : +15 min au glisser des disponibilités (14 h → 18 h donne 14:00–18:15).
- Clic simple dans la frise des disponibilités qui crée une plage de 15 min.
- B8 : hachures du mauvais moniteur après changement de moniteur dans « Nouveau cours ».
- Moniteur déjà occupé affiché « ● disponible » dans « Nouveau cours ».
- B9 : Ascension et 8 mai rangés « pendant les vacances » dans l'assistant des fermetures.
- B10 : erreurs de formulaire non revalidées à la saisie.
- B11 : pas de confirmation de création de saison (ni toast, état transitoire trompeur).
- B12 : cases à cocher nommées « on » au lecteur d'écran.

Une réponse complète donne, par bug : fichier:ligne, cause, correction proposée, et le drapeau « arbitrage nécessaire » avec la question à poser quand la correction touche une règle métier (voir `docs/SPECS.md`).

## Answer

Lecture du code, 16/10/2026, sans exécution des tests ; deux comportements confirmés par des tests e2e existants (B6, B12).

| Bug | Fichier:ligne | Cause | Correction | Arbitrage |
|---|---|---|---|---|
| B4 « N » | `src/features/planning/components/WarningsPanel.tsx:25` | « N » seul retiré exprès en L8 (WCAG 2.1.4, `PlanningPage.tsx:882-886`, SPECS §11.5, `DEMARRAGE-RAPIDE.md:90`) ; seul le mode d'emploi à l'écran l'annonce encore | Afficher Ctrl/⌘ + N | non |
| B6 +15 min | `src/features/referentiels/moniteurs/AvailabilityEditor.tsx:87-88,162-166` | Fin = `max(anchor, current) + STEP` : la case survolée en dernier est incluse ; le repère « 18h » est au début de la case 18:00 | Fin à la limite de case la plus proche du pointeur ; ajuster `e2e/referentiels.spec.ts:95-105` | non |
| Clic simple = 15 min | `AvailabilityEditor.tsx:152-160,87-90` | Pas de seuil de glisser : appui-relâche bascule la case (crée ou efface 15 min), sans annulation | Selon arbitrage | **oui** |
| B8 hachures | `src/features/planning/interaction.ts:105-111` | `hatchedInstructorId` = glisser > survol > épinglé ; le moniteur du panneau n'y est pas, et le survol reste sur le cours de Jean (`LessonBlock.tsx:114-121`) | `panelInstructorId` dans l'état d'interaction, prioritaire juste après le glisser | non (panneau > survol) |
| Occupé « ● disponible » | `src/domain/instructorAvailability.ts:71,99-108`, `src/features/planning/grid/view.ts:253-266`, `LessonPanel.tsx:133-154` | « Disponible » ne regarde que plages et indisponibilités, pas les cours affectés (conflit seulement en avertissement, `domain/conflicts.ts:198`) | Passer les cours à `instructorChoices` en excluant le cours édité | **oui** |
| B9 Ascension / 8 mai | `src/domain/schoolCalendar.ts:172-174,184`, `src/data/school-calendar.json` | La donnée range le « Pont de l'Ascension » (06–09/05/2027) parmi les vacances ; les deux fériés y tombent et sont décochés ; badge sans nom de période (`ClosuresTab.tsx:328-332`) | Exclure le pont de `duringHolidays` et/ou nommer la période | **oui** |
| B10 erreurs | `src/features/referentiels/saison/SeasonForm.tsx:58-61` + `UnavailabilitySection.tsx:142`, `InstructorForm.tsx:84`, `GroupForm.tsx:69`, `StudentForm.tsx:90`, `CourtsTab.tsx:165`, `LevelsTab.tsx:153`, `ClosuresTab.tsx:196-203` | Erreurs posées à la soumission, jamais effacées ; `CourtsTab`/`LevelsTab` ne vident pas même après succès | Effacer l'erreur du champ dans le setter (aide commune aux 7 formulaires) | non |
| B11 saison | `SeasonTab.tsx:45-49,145-150`, `SeasonForm.tsx:80,172-174` | 1ʳᵉ saison : aucun message, `reload()` non attendu, « Modifications enregistrées. » affiché sur le formulaire de création ; toast seulement dans le Planning (`PlanningPage.tsx:1171`) | Pas de `saved` en création, attendre le rechargement, « Saison « X » créée » | **oui** (toast commun ?) |
| B12 « on » | `src/components/ui/input.tsx:17-40` ; `SeasonForm.tsx:152-157`, `InstructorForm.tsx:175-180`, `GroupForm.tsx:136-139`, `CourtsTab.tsx:199-205`, `StudentForm.tsx:172-180` | Libellé par `<label>` englobant sans `id`/`htmlFor` ; marche sous Chromium (`e2e/referentiels.spec.ts:14,53`), « on » = `value` par défaut lu par l'outil du test | Lien explicite `useId` + `htmlFor` ou `aria-labelledby` ; vérifier VoiceOver sous WebKit | non |

Arbitrages ouverts :

- **Clic simple dans la frise** : (a) rien, il faut glisser ; (b) basculer 15 min comme aujourd'hui ; (c) basculer une heure ; (d) pré-remplir le formulaire « Jour / De / À » sans enregistrer. Et faut-il une annulation dans l'éditeur ?
- **Moniteur occupé** : « disponible » exclut-il un moniteur qui a déjà un cours sur tout ou partie du créneau (SPECS §5.1 vs §7) ? 3ᵉ groupe « Occupés sur ce créneau » avec le cours, ou rangé parmi les indisponibles ? Hachures pour les cours affectés ?
- **Pont de l'Ascension** : compte-t-il comme des vacances (classement et décochage) ? Un férié dans un pont reste-t-il coché comme fermeture à part ?
- **Confirmation de création** : toast commun aux Référentiels, ou message en ligne `role="status"` bien placé ? (porté par [Guidage de la première utilisation](08-guidage-premiere-utilisation.md))
