import { memo } from "react";

export interface WarningItem {
  lessonId: string;
  title: string;
  messages: string[];
}

interface WarningsPanelProps {
  items: readonly WarningItem[];
  onShow: (lessonId: string) => void;
}

/** Panneau « Avertissements » (§7), sous le mode d'emploi du planning. */
export const WarningsPanel = memo(function WarningsPanel({ items, onShow }: WarningsPanelProps) {
  return (
    <div className="flex flex-col gap-5">
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
