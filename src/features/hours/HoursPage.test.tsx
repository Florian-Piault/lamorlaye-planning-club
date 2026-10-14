import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "@/App";
import type { AppDatabase } from "@/db";
import { closures, courts, groups, instructors, lessonExceptions, lessons } from "@/db/schema";
import { instructorHours, minutesOf } from "@/domain/hours";
import { hoursLabel } from "@/domain/hoursReport";
import { openTestDatabase } from "@/test/database";
import { seedSeason } from "@/test/fixtures";
import { OUTPUT_COURTS, OUTPUT_GROUPS, OUTPUT_INSTRUCTORS, OUTPUT_STATE } from "@/test/outputs";

/**
 * Écran « Récapitulatif des heures » sur une base sql.js : le total affiché
 * doit être celui du moteur (`domain/hours.ts`) sur une période comprenant
 * des vacances, une annulation et un remplacement.
 */
async function seededDatabase(): Promise<AppDatabase> {
  const database = await openTestDatabase();
  const { db } = database;
  const season = await seedSeason(db);
  const seasonId = season.id;
  await db.insert(courts).values(OUTPUT_COURTS.map((c) => ({ ...c, seasonId })));
  await db.insert(instructors).values(OUTPUT_INSTRUCTORS.map((i) => ({ ...i, seasonId })));
  await db.insert(groups).values(
    OUTPUT_GROUPS.map(({ id, name, minAge, maxAge, maxSize, active }) => ({
      id,
      seasonId,
      name,
      minAge,
      maxAge,
      maxSize,
      active,
    })),
  );
  await db.insert(lessons).values(OUTPUT_STATE.lessons.map((l) => ({ ...l, seasonId })));
  await db
    .insert(lessonExceptions)
    .values(OUTPUT_STATE.exceptions.map((e) => ({ ...e, seasonId })));
  await db.insert(closures).values(OUTPUT_STATE.closures.map((c) => ({ ...c, seasonId })));
  return database;
}

afterEach(() => {
  window.location.hash = "";
});

describe("écran Récapitulatif des heures", () => {
  it("affiche les heures du moteur sur une période avec vacances, annulation et remplacement", async () => {
    const database = await seededDatabase();
    window.location.hash = "#/heures";
    render(<App openDatabase={async () => database} />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Récapitulatif des heures" }),
    ).toBeInTheDocument();
    fireEvent.change(await screen.findByLabelText("Du"), { target: { value: "2026-10-15" } });
    fireEvent.change(screen.getByLabelText("Au"), { target: { value: "2026-11-15" } });

    const table = await screen.findByRole("table", { name: "Heures par moniteur" });
    await waitFor(() => expect(within(table).getByTestId("hours-total")).toHaveTextContent("4"));

    const engine = instructorHours(
      { ...OUTPUT_STATE, season: { startDate: "2026-09-01", endDate: "2027-06-30" } },
      "2026-10-15",
      "2026-11-15",
    );
    const rows = within(table).getAllByTestId("hours-row");
    expect(rows.map((r) => r.textContent)).toEqual([
      `KBKarim Benali1${hoursLabel(minutesOf(engine, "m2"))}`,
      `MLMarc Leroy1${hoursLabel(minutesOf(engine, "m3"))}`,
      `JMJulie Martin2${hoursLabel(minutesOf(engine, "m1"))}`,
    ]);
    const total = engine.reduce((sum, h) => sum + h.minutes, 0);
    expect(total).toBe(390);
    expect(within(table).getByTestId("hours-total")).toHaveTextContent(
      `Total4${hoursLabel(total)}`,
    );

    // Détail d'un moniteur : le remplacement est crédité au remplaçant.
    await userEvent.click(within(table).getByRole("button", { name: /Marc Leroy/ }));
    const detail = await screen.findByRole("table", { name: "Séances de Marc Leroy" });
    expect(detail).toHaveTextContent("Samedi 07/11/2026");
    expect(detail).toHaveTextContent("Remplace KB");

    // Raccourci « Saison ».
    await userEvent.click(screen.getByRole("button", { name: "Saison" }));
    expect(screen.getByLabelText("Du")).toHaveValue("2026-09-01");
    expect(screen.getByLabelText("Au")).toHaveValue("2027-06-30");

    // Période invalide.
    fireEvent.change(screen.getByLabelText("Au"), { target: { value: "2026-08-01" } });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La date de fin précède la date de début.",
    );
  });
});
