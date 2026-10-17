import { describe, expect, it } from "vitest";
import {
  CLUB_STEPS,
  crossedStep,
  type Guidance,
  guidanceOf,
  nextStepLabel,
  type SeasonCounts,
  sameGuidance,
  stepDoneMessage,
} from "./guidance";

const none: SeasonCounts = { courts: 0, instructors: 0, groups: 0, students: 0, lessons: 0 };

const done = (g: Guidance) => g.steps.filter((s) => s.done).map((s) => s.key);

describe("état des étapes du guidage", () => {
  it("base vide : aucune étape faite, la saison d'abord", () => {
    const g = guidanceOf(null, null);
    expect(done(g)).toEqual([]);
    expect(g.next).toBe("saison");
    expect(g.complete).toBe(false);
    expect(g.planningReady).toBe(false);
    expect(g.steps.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("suit la saisie, de la saison au premier cours", () => {
    const seasonId = "s1";
    const path: [Partial<SeasonCounts>, string | null, boolean][] = [
      [{}, "courts", false],
      [{ courts: 2 }, "moniteurs", false],
      [{ courts: 2, instructors: 1 }, "groupes", false],
      [{ courts: 2, instructors: 1, groups: 3 }, "eleves", true],
      [{ courts: 2, instructors: 1, groups: 3, students: 12 }, "planning", true],
      [{ courts: 2, instructors: 1, groups: 3, students: 12, lessons: 1 }, null, true],
    ];
    for (const [counts, next, ready] of path) {
      const g = guidanceOf(seasonId, { ...none, ...counts });
      expect(g.next).toBe(next);
      expect(g.planningReady).toBe(ready);
      expect(g.complete).toBe(next === null);
    }
  });

  it("une saison créée compte même avant que ses comptes soient lus", () => {
    expect(done(guidanceOf("s1", null))).toEqual(["saison"]);
  });

  it("l'étape suivante est la première non faite, même dans le désordre", () => {
    const g = guidanceOf("s1", { ...none, groups: 1, students: 4 });
    expect(done(g)).toEqual(["saison", "groupes", "eleves"]);
    expect(g.next).toBe("courts");
    expect(g.planningReady).toBe(false);
  });

  it("les élèves ne sont pas nécessaires pour placer un cours", () => {
    const g = guidanceOf("s1", { ...none, courts: 1, instructors: 1, groups: 1, lessons: 1 });
    expect(g.planningReady).toBe(true);
    expect(g.next).toBe("eleves");
    expect(g.complete).toBe(false);
  });

  it("les étapes du club s'arrêtent avant le planning", () => {
    expect(CLUB_STEPS).toEqual(["saison", "courts", "moniteurs", "groupes", "eleves"]);
  });

  it("compare deux états", () => {
    const a = guidanceOf("s1", { ...none, courts: 1 });
    expect(sameGuidance(a, guidanceOf("s1", { ...none, courts: 5 }))).toBe(true);
    expect(sameGuidance(a, guidanceOf("s1", { ...none, courts: 1, groups: 1 }))).toBe(false);
    expect(sameGuidance(a, guidanceOf("s2", { ...none, courts: 1 }))).toBe(false);
    expect(sameGuidance(null, a)).toBe(false);
  });
});

describe("étape franchie (toast de première fois)", () => {
  const at = (counts: Partial<SeasonCounts>, seasonId: string | null = "s1") =>
    guidanceOf(seasonId, { ...none, ...counts });

  it("annonce chaque étape franchie, de la base vide aux élèves", () => {
    const states = [
      guidanceOf(null, null),
      at({}),
      at({ courts: 1 }),
      at({ courts: 1, instructors: 1 }),
      at({ courts: 1, instructors: 1, groups: 1 }),
      at({ courts: 1, instructors: 1, groups: 1, students: 1 }),
    ];
    const crossed = states.slice(1).map((after, i) => crossedStep(states[i] ?? null, after));
    expect(crossed).toEqual(["saison", "courts", "moniteurs", "groupes", "eleves"]);
  });

  it("n'annonce pas le premier cours : le guidage disparaît", () => {
    const before = at({ courts: 1, instructors: 1, groups: 1, students: 1 });
    const after = at({ courts: 1, instructors: 1, groups: 1, students: 1, lessons: 1 });
    expect(crossedStep(before, after)).toBeNull();
    expect(after.complete).toBe(true);
  });

  it("n'annonce rien sans état précédent (ouverture de l'application)", () => {
    expect(crossedStep(null, at({ courts: 1 }))).toBeNull();
  });

  it("n'annonce rien quand plusieurs étapes sont faites d'un coup", () => {
    expect(crossedStep(at({}), at({ courts: 2, instructors: 3 }))).toBeNull();
    // Saison dupliquée : saison, courts, moniteurs… d'un coup.
    expect(crossedStep(guidanceOf(null, null), at({ courts: 2, groups: 1 }))).toBeNull();
  });

  it("n'annonce rien quand rien ne change ou qu'une étape est défaite", () => {
    expect(crossedStep(at({ courts: 1 }), at({ courts: 2 }))).toBeNull();
    expect(crossedStep(at({ courts: 1 }), at({}))).toBeNull();
  });

  it("n'annonce rien en changeant de saison consultée", () => {
    expect(crossedStep(at({ courts: 1 }, "s1"), at({}, "s2"))).toBeNull();
    expect(crossedStep(at({}, "s1"), at({ courts: 1 }, "s2"))).toBeNull();
  });

  it("n'annonce rien une fois le guidage complet", () => {
    const before = at({ courts: 1, instructors: 1, groups: 1, lessons: 1 });
    const after = at({ courts: 1, instructors: 1, groups: 1, lessons: 1, students: 1 });
    expect(crossedStep(before, after)).toBeNull();
  });

  it("libellés du toast", () => {
    expect(stepDoneMessage("courts")).toBe("Premier court ajouté");
    expect(nextStepLabel("moniteurs")).toBe("Étape suivante : Moniteurs");
  });
});
