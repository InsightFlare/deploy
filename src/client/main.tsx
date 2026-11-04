import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { LayerManagerProvider } from "@insightflare/ui/layer-manager";
import "@insightflare/ui/styles.css";
import "./app.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
createRoot(root).render(
  <React.StrictMode>
    <LayerManagerProvider>
      <App />
    </LayerManagerProvider>
  </React.StrictMode>
);
