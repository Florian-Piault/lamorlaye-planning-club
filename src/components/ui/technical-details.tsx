import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Section repliée « Détails techniques » (spec UX v1.1, Vocabulaire) : l'écran
 * dit l'essentiel en mots simples, les détails exacts (format de fichier,
 * emplacement, chiffrement…) restent à portée sans effrayer. Repliée à chaque
 * ouverture de l'écran.
 */
export function TechnicalDetails({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <details
      data-testid="technical-details"
      className={cn("group text-muted-foreground text-xs", className)}
    >
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" aria-hidden />
        Détails techniques
      </summary>
      <div className="mt-2 flex flex-col gap-2 pl-4.5">{children}</div>
    </details>
  );
}
