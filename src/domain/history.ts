/**
 * Pile d'annulation / rétablissement illimitée de la session (docs/SPECS.md §5.3).
 *
 * Structure immuable : chaque opération renvoie un nouvel historique et le
 * nouvel état du planning. Exécuter une commande vide la pile de rétablissement.
 */
import { applyCommand, type Command, type PlanningState, revertCommand } from "./commands";

export interface History {
  /** Commandes appliquées, la plus récente en dernier. */
  past: readonly Command[];
  /** Commandes annulées, la prochaine à rétablir en dernier. */
  future: readonly Command[];
}

export const emptyHistory: History = { past: [], future: [] };

export interface HistoryStep {
  history: History;
  state: PlanningState;
  /** Commande concernée (`null` si rien à annuler ou à rétablir). */
  command: Command | null;
}

export function execute(history: History, state: PlanningState, command: Command): HistoryStep {
  return {
    history: { past: [...history.past, command], future: [] },
    state: applyCommand(state, command),
    command,
  };
}

export function undo(history: History, state: PlanningState): HistoryStep {
  const command = history.past.at(-1);
  if (!command) return { history, state, command: null };
  return {
    history: { past: history.past.slice(0, -1), future: [...history.future, command] },
    state: revertCommand(state, command),
    command,
  };
}

export function redo(history: History, state: PlanningState): HistoryStep {
  const command = history.future.at(-1);
  if (!command) return { history, state, command: null };
  return {
    history: { past: [...history.past, command], future: history.future.slice(0, -1) },
    state: applyCommand(state, command),
    command,
  };
}

export function canUndo(history: History): boolean {
  return history.past.length > 0;
}

export function canRedo(history: History): boolean {
  return history.future.length > 0;
}

/** « Annuler déplacement du cours », ou `null`. */
export function undoLabel(history: History): string | null {
  const command = history.past.at(-1);
  return command ? `Annuler ${lowerFirst(command.label)}` : null;
}

/** « Rétablir déplacement du cours », ou `null`. */
export function redoLabel(history: History): string | null {
  const command = history.future.at(-1);
  return command ? `Rétablir ${lowerFirst(command.label)}` : null;
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}
