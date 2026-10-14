import { Badge } from "@/components/ui/badge";

/** Statut d'un élément des référentiels : actif ou archivé. */
export function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge variant="secondary">Actif</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      Archivé
    </Badge>
  );
}
