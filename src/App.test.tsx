// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import packageJson from "../package.json" with { type: "json" };
import { App } from "./App";
import { openTestDatabase } from "./test/database";

describe("coque de l'application", () => {
  it("affiche la navigation et ouvre l'écran Réglages", async () => {
    render(<App openDatabase={openTestDatabase} />);

    const nav = await screen.findByRole("navigation", { name: "Navigation principale" });
    for (const label of ["Planning", "Le club", "Import/Export", "Réglages", "À propos"]) {
      expect(nav).toHaveTextContent(label);
    }
    // L'écran d'accueil est le planning (redirection depuis la racine).
    expect(await screen.findByRole("heading", { level: 1, name: "Planning" })).toBeInTheDocument();

    // Les écrans sont chargés à la demande (découpage par route).
    await userEvent.click(screen.getByRole("link", { name: "Réglages" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Réglages" })).toBeInTheDocument();
    expect(screen.getByTestId("storage-kind")).toHaveTextContent("Données gardées en mémoire");
  });

  it("affiche la version et l'emplacement des données dans « À propos »", async () => {
    render(<App openDatabase={openTestDatabase} />);
    await userEvent.click(await screen.findByRole("link", { name: "À propos" }));
    expect(await screen.findByRole("heading", { level: 1, name: "À propos" })).toBeInTheDocument();
    // Les informations sont chargées de façon asynchrone (« … » en attendant).
    await waitFor(() =>
      expect(screen.getByTestId("app-version")).toHaveTextContent(packageJson.version),
    );
    expect(screen.getByTestId("database-location")).toHaveTextContent(/mémoire/);
    expect(screen.getByTestId("backups-location")).toHaveTextContent(
      "Disponibles dans l'application de bureau uniquement",
    );
    expect(screen.getByRole("table", { name: "Composants libres" })).toHaveTextContent("Tauri");
  });
});
