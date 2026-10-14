import type * as React from "react";

import { cn } from "@/lib/utils";

const fieldClasses =
  "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(fieldClasses, className)} {...props} />;
}

/** Liste déroulante native (rendu fiable sur les trois moteurs web). */
function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select data-slot="select" className={cn(fieldClasses, "pr-8", className)} {...props} />;
}

function Checkbox({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn("size-4 shrink-0 rounded border-input accent-primary", className)}
      {...props}
    />
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
