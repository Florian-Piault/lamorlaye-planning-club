import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface PageProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

/** Gabarit commun des écrans : en-tête puis contenu. */
export function Page({ title, description, children }: PageProps) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b px-8 py-5">
        <h1 className="font-semibold text-xl tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-muted-foreground text-sm">{description}</p>}
      </header>
      <div className="flex flex-1 flex-col p-8">{children}</div>
    </div>
  );
}

/** Indication de chargement (données ou écran chargé à la demande). */
export function Loading({ className }: { className?: string }) {
  return (
    <p role="status" className={className ?? "text-muted-foreground text-sm"}>
      Chargement…
    </p>
  );
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
}

/** Écran vide, en attendant les fonctionnalités des lots suivants. */
export function EmptyState({ icon: Icon, title, children }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icon className="size-6" aria-hidden />
      </div>
      <p className="font-medium">{title}</p>
      {children && <div className="max-w-md text-muted-foreground text-sm">{children}</div>}
    </div>
  );
}
