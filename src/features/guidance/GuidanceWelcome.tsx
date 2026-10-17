import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { CLUB_STEPS, type Guidance, stepAction, stepLabel } from "@/domain/guidance";
import { cn } from "@/lib/utils";
import { type GuidanceState, STEP_PATHS } from "./GuidanceProvider";

/**
 * Accueil « Avant de construire le planning » (spec UX v1.1), à la place des
 * états vides « Aucune saison » et « Aucun court » : le lien entre cours,
 * court, moniteur et groupe, les étapes du club dans l'ordre avec leur coche,
 * et un seul bouton, vers l'étape suivante.
 */
export function GuidanceWelcome({ guidance }: { guidance: Guidance }) {
  const steps = guidance.steps.filter((s) => CLUB_STEPS.includes(s.key));
  return (
    <section
      aria-labelledby="guidance-welcome"
      data-testid="guidance-welcome"
      className="mx-auto mt-6 w-full max-w-lg rounded-xl border p-6"
    >
      <h2 id="guidance-welcome" className="font-semibold text-lg">
        Avant de construire le planning
      </h2>
      <p className="mt-1 text-muted-foreground text-sm">
        Le planning place des cours sur les courts du club, chacun avec un moniteur et un groupe
        d'élèves. Saisissez-les dans cet ordre :
      </p>
      <ol aria-label="Étapes" className="mt-4 flex flex-col gap-2">
        {steps.map((step) => (
          <li key={step.key} className="flex h-8 items-center gap-3 text-sm">
            <StepBadge number={step.number} done={step.done} large />
            <span className={cn(step.done && "text-muted-foreground line-through")}>
              {stepLabel(step.key)}
              {step.done && <span className="sr-only"> (fait)</span>}
            </span>
            {step.key === guidance.next && (
              <Button asChild size="sm" className="ml-auto">
                <Link to={STEP_PATHS[step.key]}>{stepAction(step.key)}</Link>
              </Button>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-4 text-muted-foreground text-xs">
        Niveaux et fermetures sont facultatifs et peuvent attendre.
      </p>
    </section>
  );
}

/**
 * Pastille d'étape d'un onglet du club : numéro d'ordre, coche une fois
 * l'étape faite, en couleur pour l'étape suivante ; `null` hors guidage
 * (complet, saison terminée) ou pour un onglet facultatif (Niveaux,
 * Fermetures). Le nom de l'onglet ne change pas : l'état est sa description.
 */
export function stepMarkOf(
  state: GuidanceState,
  step: string,
): { badge: ReactNode; description: string } | null {
  if (state.status !== "on") return null;
  const { guidance } = state;
  const current = guidance.steps.find((s) => s.key === step);
  if (!current || !CLUB_STEPS.includes(current.key)) return null;
  const next = guidance.next === current.key;
  return {
    badge: <StepBadge number={current.number} done={current.done} next={next} />,
    description: current.done
      ? `Étape ${current.number}, faite`
      : next
        ? `Étape ${current.number}, la suivante`
        : `Étape ${current.number}`,
  };
}

function StepBadge({
  number,
  done,
  next = false,
  large = false,
}: {
  number: number;
  done: boolean;
  next?: boolean;
  large?: boolean;
}) {
  return (
    <span
      aria-hidden
      data-testid="step-mark"
      data-state={done ? "done" : next ? "next" : "todo"}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full tabular-nums",
        large ? "size-6 text-xs" : "ml-1.5 size-4 text-[10px]",
        done
          ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400"
          : next
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground",
      )}
    >
      {done ? <Check className={large ? "size-3.5" : "size-2.5"} /> : number}
    </span>
  );
}
