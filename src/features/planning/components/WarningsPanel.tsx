import { memo } from "react";
import { keyLabel, shortcutLabel } from "@/lib/keys";

export interface WarningItem {
  lessonId: string;
  title: string;
  messages: string[];
}

interface WarningsPanelProps {
  items: readonly WarningItem[];
  onShow: (lessonId: string) => void;
}

/** Mode d'emploi de la grille et panneau « Avertissements » (§7). */
export const WarningsPanel = memo(function WarningsPanel({ items, onShow }: WarningsPanelProps) {
  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="planning-help" className="flex flex-col gap-2">
        <h2 id="planning-help" className="font-semibold text-sm">
          Mode d'emploi
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-4 text-muted-foreground text-xs">
          <li>
            <b className="text-foreground">Créer</b> : cliquer-glisser dans la colonne d'un court,
            ou <Kbd>{shortcutLabel("mod+n")}</Kbd>
          </li>
          <li>
            <b className="text-foreground">Déplacer</b> : glisser un cours (jour, heure, court ; pas
            de 15 min)
          </li>
          <li>
            <b className="text-foreground">Durée</b> : tirer le bord bas d'un cours
          </li>
          <li>
            <b className="text-foreground">Dupliquer</b> : glisser en maintenant{" "}
            <Kbd>{keyLabel("alt")}</Kbd>
          </li>
          <li>
            <b className="text-foreground">Changer de moniteur</b> : glisser sa pastille sur un
            cours
          </li>
          <li>
            <b className="text-foreground">Disponibilités</b> : survoler un cours ou cliquer une
            pastille
          </li>
          <li>
            <b className="text-foreground">Modifier</b> : cliquer un cours ·{" "}
            <Kbd>{keyLabel("delete")}</Kbd> le supprime
          </li>
          <li>
            <b className="text-foreground">Une semaine précise</b> : <Kbd>←</Kbd> / <Kbd>→</Kbd>{" "}
            semaine précédente / suivante ; cliquer une séance pour l'annuler, la remplacer ou
            revenir au cours habituel
          </li>
          <li>
            <b className="text-foreground">Annuler / rétablir</b> :{" "}
            <Kbd>{shortcutLabel("mod+z")}</Kbd> · <Kbd>{shortcutLabel("mod+shift+z")}</Kbd> ·{" "}
            <Kbd>{keyLabel("escape")}</Kbd> annule le déplacement
          </li>
        </ul>
      </section>
      <section aria-labelledby="planning-warnings" className="flex flex-col gap-2">
        <h2 id="planning-warnings" className="font-semibold text-sm">
          Avertissements ({items.length})
        </h2>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-xs">Aucun conflit cette semaine.</p>
        ) : (
          <ul aria-label="Avertissements" className="flex flex-col gap-1.5">
            {items.map((item) => (
              <li key={item.lessonId}>
                <button
                  type="button"
                  onClick={() => onShow(item.lessonId)}
                  className="w-full rounded-md bg-destructive/10 px-2 py-1.5 text-left text-xs hover:outline hover:outline-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="font-semibold">{item.title}</div>
                  {item.messages.map((message) => (
                    <div key={message} className="text-destructive">
                      ⚠ {message}
                    </div>
                  ))}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
});

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded border border-b-2 px-1 font-mono text-[10px] text-foreground">
      {children}
    </kbd>
  );
}
