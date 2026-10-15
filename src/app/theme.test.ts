import { afterEach, describe, expect, it, vi } from "vitest";
import { initTheme, readThemePreference, resolveTheme, setThemePreference } from "./theme";

function mockSystemDark(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.theme;
});

describe("thème", () => {
  it("suit le système par défaut", () => {
    mockSystemDark(true);
    expect(readThemePreference()).toBe("system");
    initTheme();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("ignore une valeur stockée inconnue", () => {
    localStorage.setItem("kairos.theme", "rose");
    expect(readThemePreference()).toBe("system");
  });

  it("applique et mémorise un thème forcé", () => {
    mockSystemDark(true);
    setThemePreference("light");
    expect(readThemePreference()).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("résout « système » en clair sans matchMedia", () => {
    expect(resolveTheme("system")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
  });
});
