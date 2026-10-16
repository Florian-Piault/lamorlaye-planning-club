import { cn } from "@/lib/utils";

/**
 * Classe d'un bouton de choix segmenté (« Planning habituel / Une semaine
 * précise », « Semaine / Jour ») : `activeClass` colore le choix en cours.
 */
export function segmentClass(active: boolean, activeClass: string, className?: string): string {
  return cn(
    "whitespace-nowrap rounded px-2 font-medium text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active ? activeClass : "text-muted-foreground hover:text-foreground",
    className,
  );
}
