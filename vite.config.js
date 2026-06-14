import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Tailwind v4 is wired in as a Vite plugin (no tailwind.config.js / postcss.config.js).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // react-simple-maps' `browser` field points at a UMD bundle; force the ESM
      // entry so it tree-shakes and its d3 deps land in the shared "charts" chunk.
      "react-simple-maps": "react-simple-maps/dist/index.es.js",
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Split heavy libs out of the app chunk: recharts + its d3 deps are by
        // far the largest dependency, so they get their own cacheable chunk.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("recharts") || id.includes("/d3-") || id.includes("victory-vendor")) return "charts";
          if (id.includes("react")) return "react";
          return "vendor";
        },
      },
    },
  },
  // Unit tests cover the pure logic modules (src/lib) — no DOM needed, so the default
  // node environment is fine. See test/ for the suites.
  test: {
    environment: "node",
    include: ["test/**/*.test.js"],
  },
});
