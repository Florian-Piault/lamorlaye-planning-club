# Inventaire des libellés techniques et des icônes sans aide

Type: research
Status: resolved

## Question

Quels libellés, messages et icônes de l'interface utilisent un vocabulaire technique ou ne sont pas expliqués ?

Points de départ du rapport : « Semaine type / Semaine datée », « exceptions », « Cours ponctuels », « Heure de début de la grille », « Amplitude horaire », « Active / Consultée », « Référentiels », « Composition », « plage », en-têtes « C1, C2, ☀ », Import/Export (CSV, UTF-8, séparateur, Windows-1252, dates d'effet, « Bornes incluses »), Réglages (« Migrations appliquées », `:memory:`, FileVault/BitLocker/LUKS), icônes bouclier, silhouette « − », poignée ⋮⋮ sans bulle d'aide. Balayer aussi le reste de l'interface pour des cas du même genre.

Une réponse complète donne une table : libellé ou icône, écran, fichier:ligne, et une proposition de remplacement en langage courant (ou « à masquer / déplacer dans une zone avancée »). Sert à trancher [Vocabulaire et bulles d'aide](09-vocabulaire-et-bulles.md).

## Answer

Recherche dans le code (lecture seule), 16/10/2026. Chemins relatifs à `src/features/` sauf ceux préfixés `components/` (`src/components/`). Les remplacements proposés sont des pistes, la décision revient à [Vocabulaire et bulles d'aide](09-vocabulaire-et-bulles.md).

### Points transverses

- **Aucun composant Tooltip partagé** (`src/components/ui/` : badge, button, card, dialog, input, table). Les aides passent par l'attribut `title` natif : ~1 s de survol, jamais au clavier. La bulle de `planning/components/DragFeedback.tsx:66` n'est pas réutilisable.
- `Field` accepte déjà une prop `hint` sous le champ (`components/form/Field.tsx:8,43`), inutilisée par `SeasonForm`.
- Glossaire `SPECS.md` §2 (l.26-39) : Saison, Court, Moniteur, Groupe, Élève, Cours, Semaine type, Occurrence, Exception, Période de fermeture. Manquent semaine datée, cours ponctuel, plage, composition, référentiels, amplitude. Non affiché dans l'application.

### Libellés

| Libellé | Écran | Fichier:ligne | Aide ? | Piste |
|---|---|---|---|---|
| « Semaine type » (bouton de mode) | Planning | planning/components/WeekNavigator.tsx:57 | non | « Planning habituel (toutes les semaines) » |
| « Mode Semaine type … toute la saison » | Planning, bandeau | planning/PlanningPage.tsx:1227,1232 | dans le texte | « Planning habituel : vos changements valent pour toute la saison » |
| « Semaine type et semaines datées de la saison. » | Planning, sous-titre | planning/PlanningPage.tsx:106 | non | « Le planning habituel, et chaque semaine du calendrier » |
| « Semaine datée » | Planning, aide-mémoire | planning/components/WarningsPanel.tsx:51 | non | « Une semaine précise » |
| « Semaine type » / « Semaine datée » (liste) | Import/Export, PDF | import-export/Outputs.tsx:125-126 | non | idem |
| « (exceptions) » | Planning, bandeau | planning/PlanningPage.tsx:1238 | non | supprimer le mot |
| « Les exceptions … ne sont pas copiées » | Saisons, dupliquer | referentiels/saison/SeasonTab.tsx:261 | non | « les changements faits sur une semaine précise » |
| « Rétablir l'occurrence d'origine » | Planning | planning/components/OccurrenceActions.tsx:82 | non | « Revenir au cours habituel » |
| « Cours ponctuel » (et variantes) | Planning | PlanningPage.tsx:398,414,475,552,951-952,1005,1061 | oui à 956 | « Cours exceptionnel (cette semaine seulement) » |
| « cours ponctuels » | Fermetures, Heures | fermetures/ClosuresTab.tsx:67 ; hours/HoursPage.tsx:38 | non | « cours exceptionnels » |
| « N version(s) de cours hors vigueur … » | Planning, bandeau | PlanningPage.tsx:1246 | non | reformuler ou masquer |
| « Hachuré : indisponibilités de X » | Planning, bandeau | PlanningPage.tsx:1253 | partielle | « Zones rayées : X n'est pas disponible » |
| « Heure de début / de fin de la grille » | Saison | referentiels/saison/SeasonForm.tsx:117,132 | non | « Le planning s'affiche à partir de / jusqu'à » |
| « Amplitude horaire » | Saison | saison/SeasonTab.tsx:64,200 | non | « Heures affichées » |
| « Active » / « Archivée » | Saisons | saison/SeasonTab.tsx:117-119 | non | « En cours » / « Terminée (consultation seule) » |
| « Consultée » | Saisons | saison/SeasonTab.tsx:122 | non | « Affichée en ce moment » |
| « … en vigueur en fin de saison » | Saisons, dupliquer | saison/SeasonTab.tsx:259-260 | non | « tels qu'ils sont en fin de saison » |
| « Référentiels » | Menu, page | referentiels/ReferentielsPage.tsx:24,31 ; AppShell | non | « Le club » / « Fiches du club » |
| « Composition » | Fiche groupe | referentiels/groupes/GroupPage.tsx:227 | non | « Élèves du groupe » |
| « Glisser sur la composition du groupe » | Fiche groupe | GroupPage.tsx:80 | `title` | « Faire glisser dans la liste des élèves du groupe » |
| « Effectif » / « Effectif dépassé » | Groupes, PDF | groupes/GroupsTab.tsx:105,141 ; pdf/documents.tsx:448 | non | « Nombre d'élèves » / « Groupe trop plein » |
| « Statut » | Groupes, Import | GroupsTab.tsx:108 ; StudentImport.tsx:546 | non | acceptable |
| « plage » | Fiche moniteur | moniteurs/AvailabilityEditor.tsx:109,216,283,318 | consigne | « créneau » |
| « Plages récurrentes, valables toute la saison » | Fiche moniteur | moniteurs/InstructorPage.tsx:130 | non | « Disponible chaque semaine, toute la saison » |
| En-têtes « C1, C2… » | Grille | planning/components/PlanningGrid.tsx:215 | `title` | vrai nom du court, abrégé si besoin |
| « ☀ » | Grille | PlanningGrid.tsx:216 | `title` | « extérieur » ou légende |
| « Ctrl/⌘ Z », « Échap interrompt un glisser » | Aide-mémoire | WarningsPanel.tsx:55-56 | non | touche selon l'OS ; « Échap annule le déplacement » |
| « (Ctrl/⌘ N) », « (Ctrl/⌘ P) » | Barre d'outils planning | PlanningPage.tsx:1061-1062,1094 | `title` | garder, touche selon l'OS |
| « Exports CSV / Excel » ; « séparateur ; UTF-8 » | Import/Export | import-export/Outputs.tsx:268,270 | non | « Exporter en tableau (Excel) » ; détails en zone avancée |
| Bouton « CSV » | Import/Export | Outputs.tsx:290 | aria-label | « Fichier texte (tableur) » ou zone avancée |
| « … avec leurs dates d'effet » | Import/Export | Outputs.tsx:229 | non | « avec leurs dates de début et de fin » |
| « Formats acceptés : CSV (…UTF-8 ou Windows-1252…) » | Import élèves | import-export/StudentImport.tsx:239-240 | non | « Fichier Excel ou export du logiciel d'adhérents » + zone avancée |
| Description de la page Import/Export | Import/Export | import-export/ImportExportPage.tsx:10 | non | « Importer des élèves, imprimer, exporter vers Excel » |
| « Correspondance des colonnes / incomplète » | Import élèves | StudentImport.tsx:49,337,341,416 | non | « Associer les colonnes de votre fichier » / « Il manque des colonnes obligatoires » |
| « Bornes incluses. » | Heures | hours/HoursPage.tsx:123 | non | « Du premier au dernier jour inclus » |
| « … (CSV) » | Heures | HoursPage.tsx:216,220 | non | retirer ou « (tableur) » |
| « Fichier SQLite local » / « Base en mémoire » | Réglages | reglages/ReglagesPage.tsx:11,26 | non | « Données enregistrées sur cet ordinateur » ou masquer |
| « Emplacement » (`:memory:` ou chemin) | Réglages | ReglagesPage.tsx:27-28 (db/drivers/sqljs.ts:36) | non | zone avancée |
| « Migrations appliquées au démarrage » | Réglages | ReglagesPage.tsx:29-30 | non | zone avancée |
| « FileVault, BitLocker, LUKS » | Réglages, RGPD | rgpd/PrivacyCard.tsx:45 | non | « Protégez l'ordinateur par un mot de passe » |
| « Chiffrement AES-256 ; … » / « chiffrée par un mot de passe » | Réglages, sauvegarde | reglages/BackupCard.tsx:282,47 | non | « Protégée par mot de passe … » |
| « Données personnelles (RGPD) » | Élèves | eleves/StudentsTab.tsx:285 | `title` | « Données personnelles de l'élève » |
| « Lecture seule » / « consultation seule » | Planning, archives | PlanningPage.tsx:1052,1228 ; SeasonTab.tsx:190 | non | « Consultation seulement (saison terminée) » |

### Boutons icône

| Icône | Écran | Fichier:ligne | Aide ? | Piste |
|---|---|---|---|---|
| Bouclier `ShieldCheck` | Élèves | eleves/StudentsTab.tsx:283-288 | aria-label + `title` | icône + texte, ou vraie bulle |
| Silhouette « − » `UserMinus` | Fiche groupe | groupes/GroupPage.tsx:384-389 | aria-label + `title` | icône + « Retirer » |
| Poignée ⋮⋮ `GripVertical` | Courts, Niveaux | referentiels/components/SortableList.tsx:125-133 | aria-label seul | bulle, ou boutons ↑↓ |
| Poignée ⋮⋮ | Fiche groupe | GroupPage.tsx:79-83 | aria-label + `title` | voir « Composition » |
| Crayon | Fermetures | fermetures/ClosuresTab.tsx:104-110 | aria-label seul | bulle « Modifier » |
| Crayon, corbeille | Indisponibilités moniteur | moniteurs/UnavailabilitySection.tsx:72-92 | aria-label seul | bulles |
| « × » d'un créneau | Disponibilités | moniteurs/AvailabilityEditor.tsx:232-248 | aria-label seul | « Retirer ce créneau » |
| « × » d'un message d'erreur | Planning | PlanningPage.tsx:1130-1134 | aria-label seul | « Fermer » |
| « × » du panneau | Panneau de cours | planning/components/LessonPanel.tsx:197-201 | aria-label seul | « Fermer » |
| Crayons, Restaurer, « + » groupe, flèches de semaine, Annuler/Rétablir | divers | StudentsTab.tsx:273 ; LevelsTab.tsx:90 ; CourtsTab.tsx:99 ; BackupCard.tsx:174 ; LessonPanel.tsx:237 ; WeekNavigator.tsx:71,82 ; PlanningPage.tsx:1073,1083 | aria-label + `title` | futur Tooltip |
| Corbeille | Référentiels | referentiels/components/DeleteAction.tsx:91-92 | aria-label + `title` | idem |
| Sélecteur de saison | En-tête | components/layout/AppShell.tsx:110-126 | texte visible « active/archivée » | « en cours » |
| Pastilles moniteurs | Légende planning | planning/components/Legend.tsx:82 | `title` multiligne | via Tooltip |

Seuls cas sans aucun `title` : poignée Courts/Niveaux, crayon Fermetures, crayon et corbeille des indisponibilités, les trois « × ».
