/**
 * Avis d'écriture en base : chaque écriture passée par le client Drizzle
 * (`client.ts`) le signale, pour les vues qui suivent les données sans être
 * l'écran qui les modifie (guidage de la première utilisation).
 */

const listeners = new Set<() => void>();

/** Écoute les écritures ; renvoie la fonction de désabonnement. */
export function onDataChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Signale une écriture aboutie. */
export function notifyDataChange(): void {
  for (const listener of listeners) listener();
}

/** Début d'une lecture, après espaces et commentaires SQL. */
const READ = /^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*select\b/i;

/**
 * Requête qui peut modifier la base : tout ce qui n'est pas une lecture
 * (`insert … returning`, lu comme une requête, compris).
 */
export function isWrite(sql: string): boolean {
  return !READ.test(sql);
}
