import { BookOpen, ChevronDown, Lightbulb } from "lucide-react";
import { memo, type ReactNode, useId } from "react";
import { keyLabel, shortcutLabel } from "@/lib/keys";
import { cn } from "@/lib/utils";

/** Situation qui choisit l'astuce. */
export type HelpContext = "no-lesson" | "selected" | "other";

interface PlanningHelpProps {
  context: HelpContext;
  /** Mode affiché : la phrase de portée de l'astuce en dépend. */
  mode: "type" | "dated";
  readOnly: boolean;
  /** Texte complet déplié (replié à chaque ouverture du planning). */
  open: boolean;
  onToggle: () => void;
}

/**
 * Mode d'emploi du planning (spec UX v1.1, SPECS.md §4.5) : une astuce d'une
 * phrase en tête du panneau latéral, selon la situation (aucun cours placé,
 * cours sélectionné, sinon), et le texte complet sur demande, « Les bases »
 * puis « Pour aller plus vite ». Touches selon le système ; pour créer un
 * cours, seul Ctrl/⌘ N est annoncé (B4).
 */
export const PlanningHelp = memo(function PlanningHelp({
  context,
  mode,
  readOnly,
  open,
  onToggle,
}: PlanningHelpProps) {
  const fullId = useId();
  return (
    <section aria-label="Mode d'emploi" className="flex flex-col gap-2">
      <div
        data-testid="planning-tip"
        data-context={readOnly ? "read-only" : context}
        // Hauteur réservée (texte le plus long) : les Avertissements ne bougent
        // pas quand l'astuce change (principe « rien ne bouge » de la v1.1).
        className="flex min-h-[6.25rem] gap-2 rounded-md bg-primary/10 p-2.5 text-xs"
      >
        <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-muted-foreground">
          <Tip context={context} mode={mode} readOnly={readOnly} />
        </p>
      </div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={fullId}
        onClick={onToggle}
        className="flex items-center gap-1.5 self-start rounded-md border px-2 py-1 font-medium text-primary text-xs hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <BookOpen aria-hidden className="size-3.5" />
        {open ? "Masquer le mode d'emploi" : "Tout le mode d'emploi"}
        <ChevronDown aria-hidden className={cn("size-3.5 transition", open && "rotate-180")} />
      </button>
      <div
        id={fullId}
        hidden={!open}
        data-testid="planning-manual"
        className="flex flex-col gap-2 rounded-md border p-2.5"
      >
        <h3 className="font-medium text-xs">Les bases</h3>
        <Basics />
        <h3 className="mt-1 font-medium text-xs">Pour aller plus vite</h3>
        <Faster />
      </div>
    </section>
  );
});

function Tip({ context, mode, readOnly }: Omit<PlanningHelpProps, "open" | "onToggle">) {
  if (readOnly) {
    return <>Saison terminée : cliquez un cours pour voir son détail, sans le modifier.</>;
  }
  if (context === "no-lesson") {
    return (
      <>
        Commencez par <B>+ Nouveau cours</B> en haut : jour, heure, court, groupe et moniteur, puis{" "}
        <B>Créer le cours</B>.
      </>
    );
  }
  if (context === "selected") {
    return (
      <>
        Glissez ce cours pour le déplacer, tirez son bas pour changer sa durée.{" "}
        <Kbd>{keyLabel("delete")}</Kbd> le supprime, <Kbd>{shortcutLabel("mod+z")}</Kbd> annule.
      </>
    );
  }
  return mode === "type" ? (
    <>
      Cliquez un cours pour le modifier. En <B>Planning habituel</B>, vos changements valent pour
      toutes les semaines ; pour une seule fois, passez à <B>Une semaine précise</B>.
    </>
  ) : (
    <>
      Cliquez un cours pour le modifier. En <B>Une semaine précise</B>, vos changements ne
      concernent que cette semaine ; le planning habituel reste inchangé.
    </>
  );
}

function Basics() {
  return (
    <ol className="flex list-decimal flex-col gap-1.5 pl-4 text-muted-foreground text-xs">
      <li>
        Cliquez <B>+ Nouveau cours</B> en haut : choisissez le jour, l'heure, le court, le groupe et
        le moniteur, puis <B>Créer le cours</B>.
      </li>
      <li>
        Cliquez un cours du planning pour le <B>modifier</B> ou le <B>supprimer</B>.
      </li>
      <li>
        En <B>Planning habituel</B>, vos changements valent pour toutes les semaines de la saison.
        Pour annuler ou changer un cours une seule fois (vacances, tournoi), passez à{" "}
        <B>Une semaine précise</B> et cliquez la séance.
      </li>
      <li>
        Une erreur ? Le bouton <B>Annuler</B> en haut revient en arrière.
      </li>
    </ol>
  );
}

function Faster() {
  const rows: [ReactNode, string][] = [
    ["Glisser dans la colonne d'un court", "crée un cours à cet endroit"],
    ["Glisser un cours", "le déplace (jour, heure, court, par 15 min)"],
    ["Tirer le bas d'un cours", "change sa durée"],
    [
      <>
        <Kbd>{keyLabel("alt")}</Kbd> + glisser
      </>,
      "duplique le cours",
    ],
    ["Glisser la pastille d'un moniteur sur un cours", "change de moniteur"],
    [
      "Survoler un cours ou cliquer une pastille",
      "montre en rayures quand le moniteur n'est pas disponible",
    ],
    [<Kbd key="n">{shortcutLabel("mod+n")}</Kbd>, "nouveau cours"],
    [<Kbd key="del">{keyLabel("delete")}</Kbd>, "supprime le cours sélectionné"],
    [
      <>
        <Kbd>{shortcutLabel("mod+z")}</Kbd> / <Kbd>{shortcutLabel("mod+shift+z")}</Kbd>
      </>,
      "annule / rétablit",
    ],
    [<Kbd key="esc">{keyLabel("escape")}</Kbd>, "annule le déplacement en cours"],
    [
      <>
        <Kbd>←</Kbd> <Kbd>→</Kbd>
      </>,
      "semaine précédente / suivante (une semaine précise)",
    ],
  ];
  return (
    <ul className="flex list-disc flex-col gap-1 pl-4 text-muted-foreground text-xs">
      {rows.map(([gesture, effect]) => (
        <li key={effect}>
          <span className="font-medium text-foreground">{gesture}</span> : {effect}
        </li>
      ))}
    </ul>
  );
}

function B({ children }: { children: ReactNode }) {
  return <b className="text-foreground">{children}</b>;
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded border border-b-2 px-1 font-mono text-[10px] text-foreground">
      {children}
    </kbd>
  );
}
