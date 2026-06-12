import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      // Keep in sync with tsconfig.json "paths"
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    // Mobile target: WebGL2-capable browsers all support ES2022 baseline features we use.
    target: "es2022",
    // Perf budget guard: warn early if a chunk creeps past ~250 KB (pre-gzip).
    chunkSizeWarningLimit: 800,
  },
  server: {
    // Expose on LAN for real-device (Android/Chrome) testing.
    host: true,
  },
});
