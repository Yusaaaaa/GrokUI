import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import { applyTheme } from "./lib/theme";
import { useSettingsStore } from "./stores/settings-store";
import "./styles/globals.css";

applyTheme(useSettingsStore.getState().theme);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
