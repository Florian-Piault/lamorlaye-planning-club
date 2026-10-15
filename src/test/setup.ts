import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Sans `globals: true`, Testing Library ne démonte pas les composants entre
// deux tests : du travail React (chargements, écrans à la demande) pouvait
// alors s'exécuter après la destruction de jsdom (« window is not defined »).
afterEach(() => {
  cleanup();
});
