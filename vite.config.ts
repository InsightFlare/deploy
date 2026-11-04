import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: "dist/client", emptyOutDir: true, sourcemap: false },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api/": { target: "http://127.0.0.1:8787", changeOrigin: true },
      "/oauth/": { target: "http://127.0.0.1:8787", changeOrigin: true }
    }
  }
});
