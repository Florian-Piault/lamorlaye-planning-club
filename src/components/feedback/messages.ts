/**
 * Règles de la zone de message réservée (spec UX v1.1, « Composants communs ») :
 * deux lignes toujours réservées, l'erreur générale en tête ; au-delà de deux
 * messages, la dernière ligne devient « + N autres avertissements ».
 */

export type MessageKind = "error" | "warning" | "info";

export interface Message {
  kind: MessageKind;
  text: string;
}

/** Nombre de lignes réservées en permanence. */
export const RESERVED_LINES = 2;

export interface MessageLayout {
  /** Messages affichés, erreurs en tête. */
  lines: Message[];
  /** Nombre de messages repliés derrière la ligne « + N autres ». */
  hidden: number;
  /** Messages repliés (pour nommer la ligne « + N autres »). */
  folded: Message[];
  /** Un message seul peut occuper les deux lignes. */
  wrap: boolean;
}

/**
 * Messages à afficher : erreurs d'abord (ordre d'arrivée conservé), doublons
 * retirés. Replié, au plus deux lignes ; déplié (au clic de l'utilisatrice),
 * tous les messages.
 */
export function messageLayout(messages: readonly Message[], expanded = false): MessageLayout {
  const seen = new Set<string>();
  const unique = messages.filter((m) => {
    const key = `${m.kind}:${m.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const ordered = [
    ...unique.filter((m) => m.kind === "error"),
    ...unique.filter((m) => m.kind !== "error"),
  ];
  if (expanded || ordered.length <= RESERVED_LINES) {
    return { lines: ordered, hidden: 0, folded: [], wrap: ordered.length === 1 };
  }
  const shown = RESERVED_LINES - 1;
  const folded = ordered.slice(shown);
  return { lines: ordered.slice(0, shown), hidden: folded.length, folded, wrap: false };
}

/**
 * Ligne de repli : « + 1 autre avertissement », « + 3 autres avertissements »,
 * ou « + 2 autres messages » si des informations ou erreurs sont repliées.
 */
export function moreLabel(folded: readonly Message[]): string {
  const count = folded.length;
  const noun = folded.every((m) => m.kind === "warning") ? "avertissement" : "message";
  return count > 1 ? `+ ${count} autres ${noun}s` : `+ ${count} autre ${noun}`;
}

/** Messages d'avertissement à partir de textes. */
export function warnings(texts: readonly string[]): Message[] {
  return texts.map((text) => ({ kind: "warning", text }));
}

/** Erreur générale (ou aucune). */
export function errorMessages(text: string | null | undefined): Message[] {
  return text ? [{ kind: "error", text }] : [];
}
