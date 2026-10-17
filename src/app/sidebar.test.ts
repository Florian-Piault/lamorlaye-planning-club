import { afterEach, describe, expect, it, vi } from "vitest";
import { readSidebarCollapsed, resetSidebarSession, setSidebarCollapsed } from "./sidebar";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  resetSidebarSession();
});

describe("menu réduit aux icônes", () => {
  it("est déplié par défaut, puis retrouve le choix enregistré sur le poste", () => {
    expect(readSidebarCollapsed()).toBe(false);
    setSidebarCollapsed(true);
    expect(localStorage.getItem("kairos.menu-reduit")).toBe("1");
    // Nouveau lancement : la valeur stockée fait foi.
    resetSidebarSession();
    expect(readSidebarCollapsed()).toBe(true);
  });

  it("garde le choix de la session si le stockage refuse l'écriture", () => {
    localStorage.setItem("kairos.menu-reduit", "1");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("stockage plein");
    });
    setSidebarCollapsed(false);
    expect(readSidebarCollapsed()).toBe(false);
  });

  it("reste déplié si le stockage est illisible", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("accès refusé");
    });
    expect(readSidebarCollapsed()).toBe(false);
  });
});
