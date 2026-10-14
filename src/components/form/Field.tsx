import { type ReactNode, useId } from "react";
import { Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  /** Rendu du contrôle, avec son identifiant et ses attributs d'accessibilité. */
  children: (props: {
    id: string;
    "aria-invalid": boolean | undefined;
    "aria-describedby": string | undefined;
  }) => ReactNode;
}

/** Champ de formulaire : libellé, contrôle, aide et message d'erreur. */
export function Field({ label, error, hint, required, className, children }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-1">
        <Label htmlFor={id}>{label}</Label>
        {required && (
          <span className="text-destructive text-sm leading-none" aria-hidden>
            *
          </span>
        )}
      </div>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error || hint ? messageId : undefined,
      })}
      {error ? (
        <p id={messageId} className="text-destructive text-xs">
          {error}
        </p>
      ) : (
        hint && (
          <p id={messageId} className="text-muted-foreground text-xs">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** Message d'erreur général d'un formulaire ou d'une action. */
export function ErrorAlert({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive text-sm"
    >
      {children}
    </div>
  );
}
