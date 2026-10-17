import { describe, expect, it } from "vitest";
import { hatchedInstructorId, InteractionStore } from "./interaction";

describe("état des interactions", () => {
  it("ne prévient les abonnés que si une valeur change", () => {
    const store = new InteractionStore();
    let calls = 0;
    const unsubscribe = store.subscribe(() => calls++);
    store.update({ hoverInstructorId: "m1" });
    store.update({ hoverInstructorId: "m1" });
    expect(calls).toBe(1);
    unsubscribe();
    store.update({ hoverInstructorId: null });
    expect(calls).toBe(1);
    expect(store.get().hoverInstructorId).toBeNull();
  });

  it("hachure le moniteur glissé, sinon survolé, sinon épinglé (§4.4)", () => {
    const store = new InteractionStore();
    expect(hatchedInstructorId(store.get())).toBeNull();
    store.update({ pinnedInstructorId: "épinglé" });
    expect(hatchedInstructorId(store.get())).toBe("épinglé");
    store.update({ hoverInstructorId: "survolé" });
    expect(hatchedInstructorId(store.get())).toBe("survolé");
    store.update({
      drag: {
        kind: "instructor",
        instructorId: "glissé",
        targetLessonId: null,
        candidate: null,
        warnings: [],
      },
    });
    expect(hatchedInstructorId(store.get())).toBe("glissé");
    store.update({
      drag: {
        kind: "select",
        weekday: 1,
        courtId: "c1",
        anchorY: 0,
        candidate: null,
        warnings: [],
      },
    });
    expect(hatchedInstructorId(store.get())).toBe("survolé");
  });

  it("hachure le moniteur du panneau avant le survol, après le glisser (B8)", () => {
    const store = new InteractionStore();
    store.update({ pinnedInstructorId: "épinglé", hoverInstructorId: "survolé" });
    store.update({ panelInstructorId: "panneau" });
    expect(hatchedInstructorId(store.get())).toBe("panneau");
    store.update({
      drag: {
        kind: "move",
        lessonId: "l1",
        instructorId: "glissé",
        grabOffset: 0,
        duplicate: false,
        candidate: null,
        warnings: [],
      },
    });
    expect(hatchedInstructorId(store.get())).toBe("glissé");
    store.update({ drag: null, panelInstructorId: null });
    expect(hatchedInstructorId(store.get())).toBe("survolé");
  });
});
