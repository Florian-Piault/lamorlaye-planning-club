# Vocabulaire et bulles d'aide

Type: grilling
Status: resolved
Blocked by: 04

## Question

Quels termes remplace-t-on, lesquels garde-t-on en les expliquant, et quelle politique pour les bulles d'aide et les écrans techniques ?

À partir de l'inventaire : glossaire des remplacements (en priorité « semaine type » / « semaine datée » et « exceptions », avec une phrase simple qui lève la peur de modifier une semaine au lieu de l'année), règle pour les icônes (bulle d'aide systématique ? libellé visible ?), et sort des informations techniques de Réglages et d'Import/Export (masquées, repliées dans une zone « avancé », reformulées). Le glossaire de `docs/SPECS.md` §2 est à garder cohérent.

## Answer

Grilling du 16/10/2026, à partir de l'[Inventaire des libellés techniques et des icônes sans aide](04-inventaire-jargon.md) (fichiers et lignes y sont relevés).

### Termes clés

| Aujourd'hui | À l'écran en v1.1 |
|---|---|
| Semaine type | **Planning habituel** |
| Semaine datée | **Une semaine précise**, nommée par sa date (« Semaine du 6 octobre ») |
| Cours ponctuel | **Cours ponctuel** conservé, sous-titre « cette semaine seulement » dans le panneau |
| Exception, occurrence | **Plus affichés** : « Modifié cette semaine », « Annulé cette semaine », « Revenir au cours habituel » ; « (exceptions) » retiré du bandeau |
| N version(s) de cours hors vigueur | Pastille « 2 cours changent plus tard dans la saison » (ou « ont changé »), détail en bulle |
| Référentiels | **Le club** (menu, page, fil d'Ariane) |
| Active / Archivée / Consultée | **En cours / Terminée / Affichée** |
| Lecture seule, consultation seule | « Consultation seulement (saison terminée) » |
| Plage (disponibilités moniteur) | **Horaire de disponibilité** : « Ajouter un horaire », section « Disponible chaque semaine » (« créneau » reste réservé aux cours) |

**Phrase de portée** dans la barre de mode (ligne fixe du [Principe anti-décalage et règles des modales](06-stabilite-et-modales.md)), toujours visible : « Vos changements valent pour toutes les semaines de la saison » (planning habituel) ou « Vos changements ne concernent que cette semaine » (semaine précise).

### Autres libellés

Les pistes de l'inventaire sont adoptées par défaut (« Élèves du groupe », « Nombre d'élèves », « Groupe trop plein », « Heures affichées », « Le planning s'affiche à partir de / jusqu'à », « Du premier au dernier jour inclus », « Associer les colonnes de votre fichier », « Zones rayées : X n'est pas disponible », « Revenir au cours habituel », etc.). Raccourcis affichés selon le système (Ctrl ou ⌘). Renvois : en-têtes « C1, C2… » et « ☀ » à [Lisibilité de la grille](12-lisibilite-grille.md) ; textes de l'aide-mémoire (Ctrl/⌘ Z, Échap) à [Mode d'emploi du planning](10-mode-emploi-planning.md).

### Bulles d'aide et icônes

- Composant **Tooltip commun** (survol ~300 ms et focus clavier) sur **tout** bouton icône ; il remplace les `title` natifs.
- **Libellé visible** en plus pour les actions rares ou ambiguës : bouclier « Données personnelles », silhouette « − » « Retirer ».
- Icônes universelles (crayon, corbeille, ×, flèches, poignée) : icône seule + bulle.

### Informations techniques

- Réglages et Import/Export disent l'essentiel en mots simples : « Données enregistrées sur cet ordinateur », « Protégez l'ordinateur par un mot de passe », « Protégée par mot de passe », « Fichier Excel ou export de votre logiciel d'adhérents ».
- Les détails exacts (SQLite, emplacement, migrations, AES-256, FileVault/BitLocker/LUKS, encodages, séparateur) restent dans une section repliée **« Détails techniques »** sur l'écran concerné.
- Export : bouton principal « Exporter vers Excel » ; le CSV passe dans « Détails techniques ».

### Glossaire

`docs/SPECS.md` §2 garde les termes métier (utilisés par le code et les lots V1) et gagne une colonne **« Libellé affiché »**, plus les termes manquants (semaine datée, cours ponctuel, plage, composition, référentiels, amplitude). Pas de lexique dans l'application.
