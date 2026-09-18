import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Vite/Rollup (ESM) has trouble statically resolving named exports
      // through @desmoche/shared's CommonJS dist build (built for the
      // server's Node/CJS runtime) once real runtime functions — not just
      // types — are imported. Pointing straight at the TS source sidesteps
      // that: Vite already transpiles TS itself, no separate build needed.
      "@desmoche/shared": fileURLToPath(new URL("../shared/src/index.ts", import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
});
