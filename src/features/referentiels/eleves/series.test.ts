import { describe, expect, it } from "vitest";
import {
  advanceSeries,
  currentItem,
  isFinished,
  progressLabel,
  seriesSummary,
  startSeries,
} from "./series";

function started<T>(items: T[]) {
  const series = startSeries(items);
  if (!series) throw new Error("série vide");
  return series;
}

describe("saisie des disponibilités en série", () => {
  it("ne démarre pas sans élève", () => {
    expect(startSeries([])).toBeNull();
  });

  it("démarre sur le premier élève et affiche « 1 / N »", () => {
    const series = started(["Léa", "Tom", "Zoé"]);
    expect(currentItem(series)).toBe("Léa");
    expect(progressLabel(series)).toBe("1 / 3");
    expect(isFinished(series)).toBe(false);
  });

  it("parcourt les élèves dans l'ordre reçu, qu'ils soient enregistrés ou passés", () => {
    let series = started(["Léa", "Tom", "Zoé"]);
    series = advanceSeries(series, "saved");
    expect(currentItem(series)).toBe("Tom");
    expect(progressLabel(series)).toBe("2 / 3");
    series = advanceSeries(series, "skipped");
    expect(currentItem(series)).toBe("Zoé");
    expect(progressLabel(series)).toBe("3 / 3");
    series = advanceSeries(series, "saved");
    expect(isFinished(series)).toBe(true);
    expect(currentItem(series)).toBeUndefined();
    expect(series).toMatchObject({ saved: 2, skipped: 1 });
  });

  it("ne va pas au-delà du dernier élève", () => {
    const done = advanceSeries(started(["Léa"]), "skipped");
    expect(advanceSeries(done, "saved")).toEqual(done);
  });

  it("dresse le bilan de fin, accordé au nombre", () => {
    let series = started(["Léa", "Tom", "Zoé"]);
    series = advanceSeries(advanceSeries(advanceSeries(series, "saved"), "saved"), "skipped");
    expect(seriesSummary(series)).toBe("Saisie en série terminée : 2 élèves enregistrés, 1 passé.");
    const one = advanceSeries(started(["Léa"]), "saved");
    expect(seriesSummary(one)).toBe("Saisie en série terminée : 1 élève enregistré.");
    const none = advanceSeries(advanceSeries(started(["Léa", "Tom"]), "skipped"), "skipped");
    expect(seriesSummary(none)).toBe(
      "Saisie en série terminée : aucun élève enregistré, 2 passés.",
    );
  });

  it("dit la série arrêtée en cours de route, et rien avant le premier geste", () => {
    const series = started(["Léa", "Tom", "Zoé"]);
    expect(seriesSummary(series)).toBeNull();
    expect(seriesSummary(advanceSeries(series, "saved"))).toBe(
      "Saisie en série arrêtée : 1 élève enregistré.",
    );
  });
});
