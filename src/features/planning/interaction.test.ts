import { describe, expect, it } from "vitest";
import {
  hatchedInstructorId,
  InteractionStore,
  shadedDuration,
  shadedGroupId,
} from "./interaction";

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
        groupId: null,
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
        groupId: null,
        durationMinutes: 60,
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

  it("ombre le groupe du cours déplacé (sur sa durée) ou du cours créé, pas celui d'un redimensionnement (§4.4)", () => {
    const store = new InteractionStore();
    expect(shadedGroupId(store.get())).toBeNull();
    const base = { instructorId: "m1", candidate: null, warnings: [] };
    store.update({
      drag: {
        kind: "move",
        lessonId: "l1",
        groupId: "g1",
        durationMinutes: 60,
        grabOffset: 0,
        duplicate: false,
        ...base,
      },
    });
    expect(shadedGroupId(store.get())).toBe("g1");
    expect(shadedDuration(store.get())).toBe(60);
    store.update({ drag: { kind: "resize", lessonId: "l1", ...base } });
    expect(shadedGroupId(store.get())).toBeNull();
    const select = { kind: "select" as const, weekday: 4, courtId: "c1", anchorY: 0 };
    store.update({ drag: { ...select, groupId: "g2", candidate: null, warnings: [] } });
    expect(shadedGroupId(store.get())).toBe("g2");
    expect(shadedDuration(store.get())).toBeNull();
    store.update({ drag: { ...select, groupId: null, candidate: null, warnings: [] } });
    expect(shadedGroupId(store.get())).toBeNull();
  });
});
