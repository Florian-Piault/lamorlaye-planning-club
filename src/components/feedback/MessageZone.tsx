import { CircleAlert, Info, TriangleAlert } from "lucide-react";
import { useId, useState } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { type Message, type MessageKind, messageLayout, moreLabel } from "./messages";

const ICONS = { error: CircleAlert, warning: TriangleAlert, info: Info } as const;

const COLORS: Record<MessageKind, string> = {
  error: "font-medium text-destructive",
  warning: "text-amber-800 dark:text-amber-300",
  info: "text-muted-foreground",
};

interface MessageZoneProps {
  messages: readonly Message[];
  /** Nom accessible de la liste (« Avertissements du créneau », « Alertes »…). */
  label: string;
  className?: string;
}

/**
 * Zone de message réservée (spec UX v1.1) : deux lignes toujours réservées,
 * vides s'il n'y a rien à dire, pour que rien ne bouge sous le curseur quand
 * un avertissement apparaît. L'erreur générale passe en tête, en rouge ; au-delà
 * de deux messages, la dernière ligne devient « + N autres avertissements »,
 * dépliable au clic (seul décalage admis, car demandé). Un message peut porter
 * une action (lien-bouton en fin de ligne).
 *
 * Lecteurs d'écran : l'erreur est annoncée par son `role="alert"` ; les
 * avertissements et informations (doublons, âge, initiales…), repliés compris,
 * le sont par une région `aria-live="polite"` invisible, qui ne reprend pas
 * l'erreur (pas de double annonce).
 */
export function MessageZone({ messages, label, className }: MessageZoneProps) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const collapsed = messageLayout(messages);
  const overflowing = collapsed.hidden > 0;
  const open = expanded && overflowing;
  const { lines, hidden, folded, wrap } = open ? messageLayout(messages, true) : collapsed;
  const announced = messageLayout(messages, true)
    .lines.filter((m) => m.kind !== "error")
    .map((m) => m.text);

  return (
    <div data-slot="message-zone" className={cn("min-h-10 text-xs leading-5", className)}>
      <ul id={listId} aria-label={label} className="flex flex-col">
        {lines.map((message) => {
          const Icon = ICONS[message.kind];
          return (
            <li
              key={`${message.kind}:${message.text}`}
              className={cn("flex items-start gap-1.5", COLORS[message.kind])}
            >
              <Icon className="mt-[3px] size-3.5 shrink-0" aria-hidden />
              {/* Texte complet en bulle quand la ligne est tronquée (déjà lu tel quel). */}
              <Tooltip content={open ? null : message.text} describe={false}>
                <span
                  role={message.kind === "error" ? "alert" : undefined}
                  className={cn("min-w-0", !open && (wrap ? "line-clamp-2" : "truncate"))}
                >
                  {message.text}
                </span>
              </Tooltip>
              {message.action && (
                <button
                  type="button"
                  onClick={message.action.onClick}
                  className="shrink-0 rounded font-medium underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {message.action.label}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {(hidden > 0 || open) && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setExpanded((v) => !v)}
          className="rounded font-medium text-amber-800 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-amber-300"
        >
          {open ? "Masquer les autres messages" : moreLabel(folded)}
        </button>
      )}
      <div aria-live="polite" className="sr-only" data-testid="message-zone-live">
        {announced.map((text) => (
          <p key={text}>{text}</p>
        ))}
      </div>
    </div>
  );
}
