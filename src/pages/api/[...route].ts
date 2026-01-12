import type { APIRoute } from "astro";
import app from "@/server/app";
import { parseEnv } from "@/lib/env";

// Validate environment variables at startup
let validatedEnv: { TURSO_DATABASE_URL: string; TURSO_AUTH_TOKEN: string } | null = null;

const getValidatedEnv = () => {
  if (!validatedEnv) {
    const env = {
      TURSO_DATABASE_URL: import.meta.env.TURSO_DATABASE_URL,
      TURSO_AUTH_TOKEN: import.meta.env.TURSO_AUTH_TOKEN,
      PUBLIC_APP_URL: import.meta.env.PUBLIC_APP_URL,
      NODE_ENV: import.meta.env.MODE,
    };

    try {
      const parsed = parseEnv(env);
      validatedEnv = {
        TURSO_DATABASE_URL: parsed.TURSO_DATABASE_URL,
        TURSO_AUTH_TOKEN: parsed.TURSO_AUTH_TOKEN,
      };
    } catch (error) {
      console.error("Environment validation failed:", error);
      throw new Error("Required environment variables are not configured");
    }
  }
  return validatedEnv;
};

// Handle all API routes through Hono
export const ALL: APIRoute = async (context) => {
  // Create a new Request with the correct URL path
  const url = new URL(context.request.url);

  // Get the route parameter and construct the API path
  const route = context.params.route || "";
  const apiPath = `/api/${route}`;

  // Create new URL with the API path
  const newUrl = new URL(apiPath, url.origin);
  newUrl.search = url.search;

  // Create a new request with the modified URL
  const request = new Request(newUrl.toString(), {
    method: context.request.method,
    headers: context.request.headers,
    body:
      context.request.method !== "GET" && context.request.method !== "HEAD"
        ? context.request.body
        : undefined,
    // @ts-expect-error - duplex is needed for streaming but not in types
    duplex: "half",
  });

  // Get validated environment bindings for Hono (for Cloudflare Workers)
  const env = getValidatedEnv();

  return app.fetch(request, env);
};
