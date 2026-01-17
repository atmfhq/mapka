import React from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Ensure the installed PWA updates cleanly (prevents mixed/stale bundles)
const didReloadKey = "pwa_did_reload_on_update";
registerSW({
  immediate: true,
  onNeedRefresh() {
    // Avoid reload loops
    if (sessionStorage.getItem(didReloadKey) === "1") return;
    sessionStorage.setItem(didReloadKey, "1");
    window.location.reload();
  },
  onOfflineReady() {
    // no-op
  },
});
