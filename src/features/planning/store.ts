/**
 * État du planning de la saison ouverte (SPECS.md §5.3, §11.3, §12.1).
 *
 * Chaque modification est une commande inversible du moteur
 * (`domain/commands.ts`) : elle est appliquée immédiatement en mémoire (retour
 * visuel instantané) puis écrite en base dans une transaction, dans l'ordre
 * des actions. Annuler / rétablir passent par la pile `domain/history.ts` et
 * écrivent de même les mutations inverses en base.
 *
 * Si une écriture échoue, l'état est rechargé depuis la base (qui fait foi)
 * et l'historique est vidé, pour ne jamais rejouer une commande incohérente.
 */
import { useSyncExternalStore } from "react";
import type { Db } from "@/db";
import { loadPlanningState, persistCommand, persistRevert } from "@/db/repositories/planning";
import type { Command, PlanningState } from "@/domain/commands";
import {
  emptyHistory,
  execute as executeCommand,
  type History,
  redo as redoCommand,
  undo as undoCommand,
} from "@/domain/history";
import { errorMessage } from "@/hooks/useLoader";

export interface PlanningSnapshot {
  state: PlanningState;
  history: History;
  /** Erreur de la dernière écriture en base, le cas échéant. */
  error: string | null;
}

type Listener = () => void;

/** File d'écriture du dernier magasin utilisé (il survit au démontage de l'écran). */
let lastWrite: Promise<void> = Promise.resolve();

export class PlanningStore {
  private snapshot: PlanningSnapshot;
  private readonly listeners = new Set<Listener>();
  private queue: Promise<void> = Promise.resolve();
  /** Incrémentée à chaque échec : les écritures mises en file avant sont abandonnées. */
  private generation = 0;
  private readonly db: Db;
  private readonly seasonId: string;

  constructor(db: Db, seasonId: string, initial: PlanningState) {
    this.db = db;
    this.seasonId = seasonId;
    this.snapshot = { state: initial, history: emptyHistory, error: null };
  }

  /** Charge le planning, après les écritures encore en cours d'un écran précédent. */
  static async load(db: Db, seasonId: string): Promise<PlanningStore> {
    await lastWrite;
    return new PlanningStore(db, seasonId, await loadPlanningState(db, seasonId));
  }

  getSnapshot = (): PlanningSnapshot => this.snapshot;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(snapshot: PlanningSnapshot) {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }

  /** Écrit en base après les écritures précédentes. */
  private write(run: () => Promise<void>) {
    const generation = this.generation;
    this.queue = this.queue
      .then(() => (generation === this.generation ? run() : undefined))
      .catch((error: unknown) => this.recover(error));
    lastWrite = this.queue;
  }

  /**
   * Après un échec, les écritures déjà en file reposent sur l'état refusé :
   * elles sont abandonnées (changement de génération) et l'état est relu.
   */
  private async recover(error: unknown) {
    const message = `La modification n'a pas pu être enregistrée : ${errorMessage(error)}`;
    try {
      const state = await loadPlanningState(this.db, this.seasonId);
      this.generation++;
      this.set({ state, history: emptyHistory, error: message });
    } catch {
      this.generation++;
      this.set({ ...this.snapshot, error: message });
    }
  }

  /** Exécute une commande : en mémoire tout de suite, puis en base. */
  execute(command: Command): void {
    const step = executeCommand(this.snapshot.history, this.snapshot.state, command);
    this.set({ state: step.state, history: step.history, error: null });
    this.write(() => persistCommand(this.db, command));
  }

  /** Annule la dernière commande ; renvoie la commande annulée. */
  undo(): Command | null {
    const step = undoCommand(this.snapshot.history, this.snapshot.state);
    const { command } = step;
    if (!command) return null;
    this.set({ state: step.state, history: step.history, error: null });
    this.write(() => persistRevert(this.db, command));
    return command;
  }

  /** Rétablit la dernière commande annulée ; renvoie la commande rétablie. */
  redo(): Command | null {
    const step = redoCommand(this.snapshot.history, this.snapshot.state);
    const { command } = step;
    if (!command) return null;
    this.set({ state: step.state, history: step.history, error: null });
    this.write(() => persistCommand(this.db, command));
    return command;
  }

  dismissError(): void {
    if (this.snapshot.error) this.set({ ...this.snapshot, error: null });
  }

  /** Attend la fin des écritures en cours (tests, fermeture). */
  flush(): Promise<void> {
    return this.queue;
  }
}

export function usePlanningSnapshot(store: PlanningStore): PlanningSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
