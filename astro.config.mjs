// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: cloudflare({
    mode: "directory",
    platformProxy: {
      enabled: true,
    },
  }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      // Cloudflare Workers compatibility
      alias: process.env.NODE_ENV === "production"
        ? {
            "react-dom/server": "react-dom/server.edge",
          }
        : {},
    },
  },
});
