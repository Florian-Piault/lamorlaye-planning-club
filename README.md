# Kairos

Application de bureau pour construire et tenir à jour le **planning des cours collectifs** d'un club de tennis : groupes d'élèves, répartition entre les moniteurs selon leurs disponibilités, affectation aux courts, semaines réelles avec leurs exceptions, et diffusion en PDF.

- **macOS, Windows et Linux**, un seul poste, un seul utilisateur, en français.
- **100 % hors ligne** : aucune connexion réseau, aucun compte, aucune télémétrie ; les données restent dans une base SQLite locale, sauvegardée automatiquement.
- Grille **jours × courts** avec glisser-déposer (souris et clavier), avertissements de conflits non bloquants, semaine type et semaines datées, stages pendant les vacances.
- Import d'élèves (CSV, Excel), PDF (semaine, planning par moniteur, feuilles d'appel), exports CSV / Excel, récapitulatif des heures des moniteurs.

Spécifications : [`docs/SPECS.md`](docs/SPECS.md) · découpage en lots : [`.plan/v1/lots.md`](.plan/v1/lots.md), [`.plan/ux-v1-1/lots.md`](.plan/ux-v1-1/lots.md) · nouveautés : [`docs/CHANGELOG.md`](docs/CHANGELOG.md).

## Installation

Les installateurs de chaque version (`.dmg`, `.exe` / `.msi`, `.AppImage` / `.deb`) sont publiés dans les **Releases** du dépôt. Ils ne sont pas signés en version 1 : suivez la [notice d'installation](docs/INSTALLATION.md) pour autoriser l'application au premier lancement et connaître l'emplacement des données.

Pour la prise en main : [guide de démarrage rapide](docs/DEMARRAGE-RAPIDE.md).

## Développement

### Prérequis

- [Node.js](https://nodejs.org/) 24 et [pnpm](https://pnpm.io/) (version fixée par `packageManager` dans `package.json`, via Corepack : `corepack enable`) ;
- [Rust](https://www.rust-lang.org/tools/install) stable ;
- les [prérequis Tauri 2](https://v2.tauri.app/start/prerequisites/) du système (Xcode Command Line Tools sur macOS ; WebView2 et les outils de build C++ sur Windows ; `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf` sur Linux).

### Commandes

```sh
pnpm install                 # dépendances (SheetJS est installé depuis cdn.sheetjs.com, version figée)
pnpm tauri dev               # application de bureau en développement (base SQLite réelle)
pnpm dev                     # interface seule dans le navigateur, base sql.js en mémoire
pnpm tauri build             # installateurs pour le système courant
```

### Vérifications (identiques à la CI)

```sh
pnpm check                   # les quatre suivantes, à lancer avant chaque commit de lot
pnpm run lint                # Biome : vérification, formatage et règles de biome-plugins/
pnpm typecheck               # TypeScript strict
pnpm test                    # Vitest : domaine, base sql.js, composants
pnpm test:e2e                # Playwright (Chromium et WebKit), dont accessibilité
pnpm test:perf               # tests de charge (*.perf.test.ts, e2e/*.perf.spec.ts)
pnpm run test:coverage       # couverture ≥ 90 % (domaine, grille, mise en forme des PDF)
pnpm exec drizzle-kit generate   # ne doit rien produire : schéma et migrations à jour
cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
```

`pnpm install` active le hook `.githooks/pre-commit` (lint, typecheck, Vitest).

Les tests de charge affichent leurs mesures avec `CHARGE_VERBOSE=1 pnpm test:perf` (Vitest) ou dans le rapport Playwright (annotations « performance »). Sur une machine chargée, `PERF_FACTOR=3 pnpm test:perf` multiplie les seuils (×2 quand `CI` est défini).

`E2E_PORT=1437 pnpm test:e2e` lance la suite sur un autre port, pour plusieurs copies de travail en parallèle. Le serveur lancé par Playwright ne recharge pas la page quand un fichier change.

### Organisation du code

```
src/
  domain/        règles métier pures (occurrences, conflits, heures, commandes inversibles…) + tests
  db/            schéma Drizzle, migrations, accès SQLite (Tauri ou sql.js), repositories
  features/      écrans : planning (grille, glisser-déposer), referentiels, import-export,
                 pdf, hours, reglages, rgpd, about
  components/    composants d'interface partagés (shadcn/ui, mise en page)
  test/          outils de test (bases sql.js, jeux de données, volumétrie cible)
src-tauri/       application Tauri : configuration, capacités, commandes Rust
                 (sauvegardes, chiffrement, fichiers d'import et d'export, « À propos »)
e2e/             scénarios Playwright
docs/            installation, démarrage rapide, recette manuelle, traçabilité
```

Les choix techniques sont décrits au §12 de `docs/SPECS.md`. La correspondance entre chaque section des spécifications, les lots et les tests est tenue dans [`docs/TRACABILITE.md`](docs/TRACABILITE.md).

### Modifier le schéma de la base

1. Modifier `src/db/schema.ts`.
2. `pnpm db:generate` produit la migration dans `src/db/migrations/` ; elle est appliquée automatiquement au démarrage de l'application.

### Publier une version

1. Mettre à jour la version dans `package.json`, `src-tauri/Cargo.toml` et `src-tauri/tauri.conf.json` (un test Vitest vérifie qu'elles sont identiques), ainsi que `docs/CHANGELOG.md`, et le calendrier scolaire embarqué (`src/data/school-calendar.json`) si nécessaire.
2. Dérouler la [recette manuelle](docs/RECETTE.md) sur les installateurs produits par la CI.
3. Pousser un tag `vX.Y.Z` : le workflow `release.yml` vérifie la version, construit les installateurs des trois OS et les joint à une **release GitHub en brouillon**, à relire puis publier à la main.
