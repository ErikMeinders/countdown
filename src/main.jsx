import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.jsx";
import { ThemeProvider } from "./theme-context.jsx";
import "./styles/animations.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
);

// The service worker is what makes the app installable and playable offline.
// Registered relative to the document, so it picks up the /countdown/ scope on
// Pages without the path being hard-coded anywhere.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Offline play is a bonus; a failed registration must not break the game.
    });
  });
}
