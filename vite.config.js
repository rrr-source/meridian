import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Tailwind v4 is wired in as a Vite plugin (no tailwind.config.js / postcss.config.js).
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
