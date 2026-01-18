// @ts-check

import fs from "node:fs";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// HTTPS configuration for local development
// Generated with: mkcert localhost 127.0.0.1 ::1
const httpsConfig =
  process.env.NODE_ENV !== "production" &&
  fs.existsSync("certs/localhost.pem") &&
  fs.existsSync("certs/localhost-key.pem")
    ? {
        key: fs.readFileSync("certs/localhost-key.pem"),
        cert: fs.readFileSync("certs/localhost.pem"),
      }
    : undefined;

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      // Cloudflare Workers compatibility
      alias:
        process.env.NODE_ENV === "production"
          ? {
              "react-dom/server": "react-dom/server.edge",
            }
          : {},
    },
    server: {
      https: httpsConfig,
    },
  },
});
