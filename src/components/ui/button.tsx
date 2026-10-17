import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { type MouseEvent, useId } from "react";

import { cn } from "@/lib/utils";
import { Tooltip } from "./tooltip";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/75 disabled:pointer-events-none disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:focus-visible:opacity-100 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive: "bg-destructive text-white shadow-xs hover:bg-destructive/90",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /**
     * Raison affichée quand le bouton est grisé (`disabled`) : en petit texte à
     * côté du bouton, dans une place réservée, et en bulle au survol et au
     * clavier. Le bouton reste alors focalisable (`aria-disabled`) pour que la
     * raison soit lisible au clavier.
     */
    disabledReason?: string;
    /** Côté du texte de la raison ; `"none"` : en bulle seulement (bouton icône). */
    reasonSide?: "start" | "end" | "none";
    /** Bulle d'aide commune (au survol et au clavier), à la place d'un `title` natif. */
    tooltip?: string;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  disabledReason,
  reasonSide = "end",
  tooltip,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  const reasonId = useId();
  const classes = cn(buttonVariants({ variant, size, className }));

  if (disabledReason === undefined) {
    const plain = (
      <Comp data-slot="button" data-variant={variant ?? "default"} className={classes} {...props} />
    );
    return tooltip ? (
      <Tooltip content={tooltip} describe={!repeatsName(props["aria-label"], tooltip)}>
        {plain}
      </Tooltip>
    ) : (
      plain
    );
  }

  const { disabled, onClick, ...rest } = props;
  const blocked = Boolean(disabled);
  const button = (
    <Comp
      data-slot="button"
      data-variant={variant ?? "default"}
      className={classes}
      {...rest}
      // Clés absentes quand le bouton est actif : la bulle peut alors le décrire.
      {...(blocked ? { "aria-disabled": true, "aria-describedby": reasonId } : {})}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        // Grisé mais focalisable : le clic (ou Entrée dans un formulaire) est sans effet.
        if (blocked) event.preventDefault();
        else onClick?.(event);
      }}
    />
  );
  const reason = (
    <span
      id={reasonId}
      aria-hidden={!blocked || undefined}
      className={cn(
        "text-muted-foreground text-xs",
        reasonSide === "none" ? "sr-only" : !blocked && "invisible",
      )}
    >
      {disabledReason}
    </span>
  );
  return (
    <span data-slot="button-with-reason" className="inline-flex items-center gap-2">
      {reasonSide === "start" && reason}
      <Tooltip
        content={blocked ? disabledReason : tooltip}
        describe={!blocked && !(tooltip && repeatsName(props["aria-label"], tooltip))}
      >
        {button}
      </Tooltip>
      {reasonSide !== "start" && reason}
    </span>
  );
}

/**
 * La bulle ne fait que répéter le nom accessible (« Modifier » pour « Modifier
 * Court 1 »), éventuellement suivi d'un raccourci (« Fermer (Échap) » pour
 * « Fermer », annoncé par `aria-keyshortcuts`) : inutile de l'annoncer une
 * seconde fois comme description.
 */
function repeatsName(name: string | undefined, tooltip: string): boolean {
  if (!name) return false;
  const label = name.toLowerCase();
  const bubble = tooltip.toLowerCase();
  return label.includes(bubble) || bubble.replace(/\s*\([^)]*\)$/, "") === label;
}

export { Button, buttonVariants };
