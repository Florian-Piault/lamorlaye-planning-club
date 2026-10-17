/**
 * Seuil (ms) d'une mesure de temps des tests de charge (`*.perf.test.ts`,
 * `e2e/*.perf.spec.ts`, lancés par `pnpm test:perf`). Les seuils sont fixés
 * pour un poste de développement au repos ; `PERF_FACTOR` les multiplie sur
 * une machine chargée ou partagée (2 par défaut quand `CI` est défini).
 */
export function perfLimit(ms: number): number {
  const factor = Number(process.env.PERF_FACTOR) || (process.env.CI ? 2 : 1);
  return ms * factor;
}
