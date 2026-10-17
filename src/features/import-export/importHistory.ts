/**
 * Historique des imports d'élèves de la session (docs/SPECS.md §9.1, §12.1).
 *
 * Chaque import est une seule commande inversible (`domain/studentImport.ts`),
 * écrite en base dans une transaction. La pile du planning
 * (`features/planning/store.ts`) ne porte que sur les cours, exceptions et
 * fermetures : l'import a donc sa propre pile, avec « Annuler l'import » et
 * « Rétablir l'import » dans l'écran Import/Export. Elle survit à la
 * navigation entre les écrans, pas à la fermeture de l'application.
 *
 * Contrairement au planning, l'écriture est attendue avant la mise à jour de
 * l'historique : un import refusé par la base n'y apparaît jamais. Comme les
 * élèves importés restent modifiables dans les référentiels, l'annulation
 * demande une confirmation si certains l'ont été depuis l'import.
 */
import { useSyncExternalStore } from "react";
import type { Db } from "@/db";
import { loadImportFootprint, persistImport, revertImport } from "@/db/repositories/studentImport";
import {
  type ImportCommand,
  type ImportSummary,
  modifiedSinceImport,
} from "@/domain/studentImport";
import { errorMessage } from "@/hooks/useLoader";

export interface ImportEntry {
  command: ImportCommand;
  summary: ImportSummary;
  fileName: string;
}

export interface ImportHistorySnapshot {
  /** Imports réalisés, le plus récent en dernier. */
  past: readonly ImportEntry[];
  /** Imports annulés, le prochain à rétablir en dernier. */
  future: readonly ImportEntry[];
  busy: boolean;
  error: string | null;
  /**
   * Annulation en attente de confirmation : des élèves de l'import ont été
   * modifiés depuis, l'annulation effacerait ces modifications.
   */
  confirmUndo: string | null;
}

type Listener = () => void;

const initial: ImportHistorySnapshot = {
  past: [],
  future: [],
  busy: false,
  error: null,
  confirmUndo: null,
};

/** Message de confirmation de l'annulation d'un import dont des élèves ont été modifiés. */
function confirmUndoMessage(modified: number): string {
  return modified > 1
    ? `${modified} élèves de cet import ont été modifiés depuis (fiche ou groupes) : l'annulation effacera ces modifications.`
    : "Un élève de cet import a été modifié depuis (fiche ou groupes) : l'annulation effacera ces modifications.";
}

export class ImportHistory {
  private snapshot: ImportHistorySnapshot = initial;
  private readonly listeners = new Set<Listener>();

  getSnapshot = (): ImportHistorySnapshot => this.snapshot;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<ImportHistorySnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }

  /** Exécute une action ; `true` si elle a modifié la base. */
  private async run(action: () => Promise<Partial<ImportHistorySnapshot>>): Promise<boolean> {
    if (this.snapshot.busy) return false;
    this.set({ busy: true, error: null, confirmUndo: null });
    try {
      const patch = await action();
      this.set({ ...patch, busy: false });
      return !patch.confirmUndo;
    } catch (error) {
      this.set({ busy: false, error: errorMessage(error) });
      return false;
    }
  }

  /** Réalise un import ; renvoie `false` si la base l'a refusé (voir `error`). */
  execute(db: Db, entry: ImportEntry): Promise<boolean> {
    return this.run(async () => {
      await persistImport(db, entry.command);
      return { past: [...this.snapshot.past, entry], future: [] };
    });
  }

  /**
   * Annule le dernier import. Si des élèves de l'import ont été modifiés
   * depuis, l'annulation n'a lieu qu'avec `force` : sinon elle est mise en
   * attente de confirmation (`confirmUndo`) et `false` est renvoyé.
   */
  undo(db: Db, { force = false } = {}): Promise<boolean> {
    const entry = this.snapshot.past.at(-1);
    if (!entry) return Promise.resolve(false);
    return this.run(async () => {
      if (!force) {
        const footprint = await loadImportFootprint(db, entry.command);
        const modified = modifiedSinceImport(entry.command, footprint).length;
        if (modified > 0) return { confirmUndo: confirmUndoMessage(modified) };
      }
      await revertImport(db, entry.command);
      return {
        past: this.snapshot.past.slice(0, -1),
        future: [...this.snapshot.future, entry],
      };
    });
  }

  /** Rétablit le dernier import annulé. */
  redo(db: Db): Promise<boolean> {
    const entry = this.snapshot.future.at(-1);
    if (!entry) return Promise.resolve(false);
    return this.run(async () => {
      await persistImport(db, entry.command);
      return {
        past: [...this.snapshot.past, entry],
        future: this.snapshot.future.slice(0, -1),
      };
    });
  }

  dismissError(): void {
    if (this.snapshot.error) this.set({ error: null });
  }

  /** Renonce à l'annulation en attente de confirmation. */
  cancelUndo(): void {
    if (this.snapshot.confirmUndo) this.set({ confirmUndo: null });
  }

  /**
   * Vide l'historique : après un effacement RGPD (rétablir un import
   * recréerait l'élève effacé), et dans les tests.
   */
  reset(): void {
    this.snapshot = initial;
    for (const listener of this.listeners) listener();
  }
}

/** Historique partagé de la session. */
export const importHistory = new ImportHistory();

export function useImportHistory(history: ImportHistory = importHistory): ImportHistorySnapshot {
  return useSyncExternalStore(history.subscribe, history.getSnapshot);
}
