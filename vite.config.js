import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Tailwind v4 is wired in as a Vite plugin (no tailwind.config.js / postcss.config.js).
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
});
