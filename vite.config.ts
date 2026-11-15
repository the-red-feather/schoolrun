import { defineConfig } from "vite";

// base "./": every asset path is relative, so the build works on GitHub Pages
// (https://<owner>.github.io/<repo>/), on any other static host, or from a folder.
export default defineConfig({
  base: "./",
  build: { target: "es2022", outDir: "dist", sourcemap: true },
  esbuild: { target: "es2022" },
});
