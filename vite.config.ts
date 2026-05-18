import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const app = process.env.VITE_APP ?? "toybox";
const htmlEntry = app === "lusie" ? "lusie.html" : "index.html";
const apiProxyTarget = process.env.API_BASE_URL ?? "http://localhost:5174";

export default defineConfig(() => ({
  plugins: [
    react(),
    {
      name: "route-root-to-selected-app",
      configureServer(server) {
        if (app !== "lusie") return;
        server.middlewares.use((request, _response, next) => {
          const url = request.url ?? "/";
          const pathname = url.split("?", 1)[0];
          const isAssetOrApi =
            pathname.includes(".") ||
            pathname.startsWith("/@") ||
            pathname.startsWith("/api") ||
            pathname.startsWith("/runs");
          if (!isAssetOrApi) {
            request.url = "/lusie.html";
          }
          next();
        });
      }
    }
  ],
  appType: "spa",
  server: {
    port: app === "lusie" ? 5175 : 5173,
    proxy: {
      "/api": apiProxyTarget,
      "/runs": apiProxyTarget
    }
  },
  build: {
    rollupOptions: {
      input: path.resolve(rootDir, htmlEntry)
    }
  }
}));
