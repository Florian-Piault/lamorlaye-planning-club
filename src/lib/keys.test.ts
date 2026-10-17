// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { ariaShortcut, detectPlatform, keyLabel, shortcutLabel } from "./keys";

describe("touches selon le système", () => {
  it("reconnaît macOS d'après le navigateur", () => {
    expect(detectPlatform({ platform: "MacIntel" })).toBe("mac");
    expect(
      detectPlatform({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit" }),
    ).toBe("mac");
    expect(detectPlatform({ platform: "Win32", userAgent: "Windows NT 10.0" })).toBe("other");
    expect(detectPlatform({ platform: "Linux x86_64" })).toBe("other");
    expect(detectPlatform(undefined)).toBe("other");
  });

  it("nomme les touches de modification", () => {
    expect(["mod", "alt", "shift", "delete"].map((k) => keyLabel(k, "mac"))).toEqual([
      "⌘",
      "⌥",
      "⇧",
      "⌫",
    ]);
    expect(["mod", "alt", "shift", "delete"].map((k) => keyLabel(k, "other"))).toEqual([
      "Ctrl",
      "Alt",
      "Maj",
      "Suppr",
    ]);
    expect(keyLabel("escape", "mac")).toBe("Échap");
    expect(keyLabel("n", "other")).toBe("N");
    expect(keyLabel("←", "other")).toBe("←");
  });

  it("compose un raccourci", () => {
    expect(shortcutLabel("mod+n", "mac")).toBe("⌘ N");
    expect(shortcutLabel("mod+n", "other")).toBe("Ctrl+N");
    expect(shortcutLabel("mod+shift+z", "mac")).toBe("⌘ ⇧ Z");
    expect(shortcutLabel("mod+shift+z", "other")).toBe("Ctrl+Maj+Z");
  });

  it("donne les noms de touches d'aria-keyshortcuts", () => {
    expect(ariaShortcut("mod+n", "mac")).toBe("Meta+N");
    expect(ariaShortcut("mod+shift+z", "other")).toBe("Control+Shift+Z");
    expect(ariaShortcut("escape", "mac")).toBe("Escape");
    expect(ariaShortcut("←", "other")).toBe("ArrowLeft");
  });
});
