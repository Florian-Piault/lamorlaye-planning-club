import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { openTestDatabase } from "./test/database";

describe("coque de l'application", () => {
  it("affiche la navigation et ouvre l'écran Réglages", async () => {
    render(<App openDatabase={openTestDatabase} />);

    const nav = await screen.findByRole("navigation", { name: "Navigation principale" });
    for (const label of ["Planning", "Référentiels", "Import/Export", "Réglages"]) {
      expect(nav).toHaveTextContent(label);
    }
    // L'écran d'accueil est le planning (redirection depuis la racine).
    expect(await screen.findByRole("heading", { level: 1, name: "Planning" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("link", { name: "Réglages" }));
    expect(screen.getByRole("heading", { level: 1, name: "Réglages" })).toBeInTheDocument();
    expect(screen.getByTestId("storage-kind")).toHaveTextContent("Base en mémoire");
  });
});
