// @ts-check

import fs from "node:fs";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig } from "astro/config";

// Check if mkcert certificates exist for trusted HTTPS
const hasMkcertCerts =
  fs.existsSync("certs/localhost.pem") &&
  fs.existsSync("certs/localhost-key.pem");

// HTTPS configuration for local development
// Use mkcert certificates if available, otherwise use basic-ssl plugin
const httpsConfig = hasMkcertCerts
  ? {
      key: fs.readFileSync("certs/localhost-key.pem"),
      cert: fs.readFileSync("certs/localhost.pem"),
    }
  : true; // 'true' enables basic-ssl plugin's self-signed cert

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
    plugins: [
      tailwindcss(),
      // Use basic-ssl plugin only when mkcert certs are not available
      ...(process.env.NODE_ENV !== "production" && !hasMkcertCerts
        ? [basicSsl()]
        : []),
    ],
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
      // Enable HTTPS for local development
      https: process.env.NODE_ENV !== "production" ? httpsConfig : undefined,
    },
  },
});
