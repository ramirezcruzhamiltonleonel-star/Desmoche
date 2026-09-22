import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/index.css";

const container = document.getElementById("root");
if (!container) throw new Error("No se encontró el elemento #root");

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Registering a service worker (even one that does nothing but pass every
// request straight to the network) is what makes Chrome/Android treat this
// as an installable PWA — "Agregar a inicio" — without it, the browser has
// no basis to offer that at all. No offline caching is implied by this.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installability just won't be offered this session — not fatal.
    });
  });
}
