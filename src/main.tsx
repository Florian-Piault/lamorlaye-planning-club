import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Police embarquée dans l'application (aucune ressource distante, §12.2).
import "@fontsource-variable/inter";
import "./index.css";
import { App } from "./App";
import { initTheme } from "./app/theme";

initTheme();

const root = document.getElementById("root");
if (!root) throw new Error("Élément #root introuvable.");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
