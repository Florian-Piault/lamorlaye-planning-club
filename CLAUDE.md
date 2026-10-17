# Kairos

- Spec fonctionnelle : `SPECS.md` (glossaire des libellés au §2). Lots et critères de fin : `LOTS-V*.md`, spec UX détaillée dans `.plan/<chantier>/`.
- Relecture d'un diff : appliquer `CODING_STANDARDS.md`.
- Lot terminé : `pnpm check` au vert.
- Composants communs (toast, zone de messages, bulle d'aide, fenêtre avec garde de saisie, touches) : `src/components/feedback/`, `src/components/ui/`, `src/lib/keys.ts`.
- Tests e2e : les aides sont dans `e2e/support/` et les données se posent par `src/test/e2e.ts` (`seedPlanning`, `seedVolume`). Pour plusieurs copies de travail en parallèle, chacune prend son `E2E_PORT`.
- Migrations SQLite (`src/db/migrations/`) : elles tournent dans une transaction, où `PRAGMA foreign_keys` est sans effet. Recréer une table dont d'autres dépendent (`ON DELETE CASCADE`) vide ces tables et emporte ses déclencheurs : modèle à suivre dans `0005_student_phone_optional.sql`.
