import { describe, expect, it } from "vitest";
import { lesson, testContext } from "@/test/planning";
import { cancelOccurrence, moveLesson, type PlanningState, resizeLesson } from "./commands";
import {
  canRedo,
  canUndo,
  emptyHistory,
  execute,
  redo,
  redoLabel,
  undo,
  undoLabel,
} from "./history";

const initial: PlanningState = { lessons: [lesson()], exceptions: [], closures: [] };

describe("pile d'annulation", () => {
  it("annule et rétablit sans limite", () => {
    const ctx = testContext();
    let step = execute(emptyHistory, initial, resizeLesson(initial, "cours", 90, ctx));
    step = execute(
      step.history,
      step.state,
      moveLesson(step.state, "cours", { weekday: 4, startTime: "10:00", courtId: "c2" }, ctx),
    );
    step = execute(
      step.history,
      step.state,
      cancelOccurrence(
        step.state,
        { lessonId: "cours", occurrenceDate: "2026-11-05" },
        { reason: "rain" },
        ctx,
      ),
    );
    const final = step.state;
    expect(undoLabel(step.history)).toBe("Annuler annulation de la séance du 05/11/2026");
    expect(canRedo(step.history)).toBe(false);

    step = undo(step.history, step.state);
    step = undo(step.history, step.state);
    expect(redoLabel(step.history)).toBe("Rétablir déplacement du cours");
    step = undo(step.history, step.state);
    expect(step.state).toEqual(initial);
    expect(canUndo(step.history)).toBe(false);
    expect(undoLabel(step.history)).toBeNull();

    // Rien à annuler : état inchangé.
    const noop = undo(step.history, step.state);
    expect(noop.command).toBeNull();
    expect(noop.state).toBe(step.state);

    step = redo(step.history, step.state);
    step = redo(step.history, step.state);
    step = redo(step.history, step.state);
    expect(step.state).toEqual(final);
    expect(redo(step.history, step.state).command).toBeNull();
    expect(redoLabel(step.history)).toBeNull();
  });

  it("vide la pile de rétablissement après une nouvelle commande", () => {
    const ctx = testContext();
    let step = execute(emptyHistory, initial, resizeLesson(initial, "cours", 90, ctx));
    step = undo(step.history, step.state);
    expect(canRedo(step.history)).toBe(true);
    step = execute(step.history, step.state, resizeLesson(step.state, "cours", 45, ctx));
    expect(canRedo(step.history)).toBe(false);
    expect(step.history.past).toHaveLength(1);
    expect(step.state.lessons[0]?.durationMinutes).toBe(45);
  });
});
