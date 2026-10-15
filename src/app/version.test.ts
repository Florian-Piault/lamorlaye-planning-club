import { describe, expect, it } from "vitest";
import packageJson from "../../package.json" with { type: "json" };
import cargoToml from "../../src-tauri/Cargo.toml?raw";
import tauriConfig from "../../src-tauri/tauri.conf.json" with { type: "json" };

describe("version de l'application", () => {
  it("est la même dans package.json, tauri.conf.json et Cargo.toml", () => {
    const cargoVersion = /^version = "([^"]+)"/m.exec(cargoToml)?.[1];
    expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(tauriConfig.version).toBe(packageJson.version);
    expect(cargoVersion).toBe(packageJson.version);
  });

  it("est celle affichée par l'écran « À propos » hors de Tauri", () => {
    expect(__APP_VERSION__).toBe(packageJson.version);
  });
});
