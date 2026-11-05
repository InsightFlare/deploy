import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { LayerManagerProvider } from "@insightflare/ui/layer-manager";
import { TooltipProvider } from "@insightflare/ui/tooltip";
import { ThemeProvider } from "./theme-provider";
import "./app.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
createRoot(root).render(
  <React.StrictMode>
    <LayerManagerProvider>
      <ThemeProvider>
        <TooltipProvider>
          <App />
        </TooltipProvider>
      </ThemeProvider>
    </LayerManagerProvider>
  </React.StrictMode>
);
