/**
 * Astro Middleware
 *
 * Handles route protection for admin pages.
 * Redirects unauthenticated users to login and non-admins to home.
 */

import { defineMiddleware } from "astro:middleware";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { isAdminUser } from "@/lib/auth/admin";
import { parseSessionCookie, validateSession } from "@/lib/auth/session";
import * as schema from "@/lib/db/schema";

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Only protect /manage routes
  if (!pathname.startsWith("/manage")) {
    return next();
  }

  // Get session from cookies
  const cookieHeader = context.request.headers.get("Cookie");
  const sessionToken = parseSessionCookie(cookieHeader);

  // Redirect to login if no session
  if (!sessionToken) {
    return context.redirect(`/login?redirect=${encodeURIComponent(pathname)}`);
  }

  // Validate session
  const env = {
    TURSO_DATABASE_URL: import.meta.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: import.meta.env.TURSO_AUTH_TOKEN,
  };

  const client = createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
  const db = drizzle(client, { schema });

  const result = await validateSession(db as never, sessionToken);

  // Redirect to login if session is invalid
  if (!result) {
    return context.redirect(`/login?redirect=${encodeURIComponent(pathname)}`);
  }

  // Check admin privileges
  const adminUserIdsEnv = import.meta.env.ADMIN_USER_IDS;
  const isAdmin = isAdminUser(result.user.id, adminUserIdsEnv);

  // Redirect non-admins to home
  if (!isAdmin) {
    return context.redirect("/");
  }

  // Store user info in locals for use in pages
  context.locals.user = result.user;
  context.locals.isAdmin = true;

  return next();
});
