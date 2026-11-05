# Kairos

- Spec fonctionnelle : `docs/SPECS.md` (glossaire des libellés au §2). Chaque chantier vit dans `.plan/<slug>/` : spec UX (`spec.md`), lots et critères de fin (`lots.md`), à créer là aussi.
- Relecture d'un diff : appliquer `docs/CODING_STANDARDS.md`.
- Lot terminé : `pnpm check` au vert.
- Composants communs (toast, zone de messages, bulle d'aide, fenêtre avec garde de saisie, touches) : `src/components/feedback/`, `src/components/ui/`, `src/lib/keys.ts`.
- Vitest : le détail du dernier lancement (échecs compris) reste dans `.vite/vitest-last-run.json`, à lire avant de relancer un test qui a échoué une fois.
- Tests e2e : les aides sont dans `e2e/support/` et les données se posent par `src/test/e2e.ts` (`seedPlanning`, `seedVolume`). Pour plusieurs copies de travail en parallèle, chacune prend son `E2E_PORT`. La suite complète dure ~7 min : itérer sur un fichier (`pnpm exec playwright test e2e/<x>.spec.ts`), reprendre les échecs par `--last-failed`, et valider une réécriture de masse sur un fichier avant de lancer la suite.
- Migrations SQLite (`src/db/migrations/`) : elles tournent dans une transaction, où `PRAGMA foreign_keys` est sans effet. Recréer une table dont d'autres dépendent (`ON DELETE CASCADE`) vide ces tables et emporte ses déclencheurs : modèle à suivre dans `0005_student_phone_optional.sql`.
