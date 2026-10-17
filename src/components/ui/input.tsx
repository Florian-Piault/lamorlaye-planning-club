import type * as React from "react";
import { type ReactNode, useId } from "react";

import { cn } from "@/lib/utils";

/*
 * Anneau au focus (`focus:` et non `focus-visible:`) : un champ de saisie a
 * toujours un focus visible, et WebKit ne reconnaît pas `:focus-visible` sur
 * les segments d'un champ date ou heure (aucun indicateur sous macOS et Linux).
 */
const fieldClasses =
  "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/75 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:focus:ring-destructive/75 dark:bg-input/30";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(fieldClasses, className)} {...props} />;
}

/** Liste déroulante native (rendu fiable sur les trois moteurs web). */
function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select data-slot="select" className={cn(fieldClasses, "pr-8", className)} {...props} />;
}

type CheckboxProps = Omit<React.ComponentProps<"input">, "type"> & {
  /**
   * Libellé de la case, relié explicitement par un identifiant généré
   * (`id` / `htmlFor`) : la case est annoncée par son libellé, et non « on »,
   * sur tous les moteurs (B12). Sans libellé, prévoir un `aria-label`.
   */
  label?: ReactNode;
  /** Classes du libellé (disposition, graisse). */
  labelClassName?: string;
};

function Checkbox({ className, label, labelClassName, id, ...props }: CheckboxProps) {
  const generatedId = useId();
  const checkboxId = id ?? generatedId;
  const input = (
    <input
      type="checkbox"
      data-slot="checkbox"
      id={checkboxId}
      className={cn("size-4 shrink-0 rounded border-input accent-primary", className)}
      {...props}
    />
  );
  if (label === undefined) return input;
  return (
    <span className={cn("flex items-center gap-2 text-sm leading-none", labelClassName)}>
      {input}
      <label htmlFor={checkboxId} className="flex min-w-0 select-none items-center gap-2">
        {label}
      </label>
    </span>
  );
}

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: le contrôle est associé par `htmlFor` à l'usage.
    <label
      data-slot="label"
      className={cn(
        "flex select-none items-center gap-2 font-medium text-sm leading-none",
        className,
      )}
      {...props}
    />
  );
}

export { Checkbox, Input, Label, Select };
