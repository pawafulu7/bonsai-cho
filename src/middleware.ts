/**
 * Astro Middleware
 *
 * Handles route protection for admin pages.
 * Uses separate admin_users authentication system.
 * Redirects unauthenticated admins to /manage/login.
 */

import { defineMiddleware } from "astro:middleware";
import {
  type Database,
  parseAdminSessionCookie,
  validateAdminSession,
} from "@/lib/auth/admin-session";
import { getDb } from "@/lib/db/client";

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Only protect /manage routes (except /manage/login)
  if (!pathname.startsWith("/manage")) {
    return next();
  }

  // Allow access to login page without authentication
  if (pathname === "/manage/login") {
    return next();
  }

  // Get admin session from cookies
  const cookieHeader = context.request.headers.get("Cookie");
  const sessionToken = parseAdminSessionCookie(cookieHeader);

  // Redirect to admin login if no session
  if (!sessionToken) {
    return context.redirect(
      `/manage/login?returnTo=${encodeURIComponent(pathname)}`
    );
  }

  // Validate admin session using cached DB connection
  const db: Database = await getDb(
    import.meta.env.TURSO_DATABASE_URL,
    import.meta.env.TURSO_AUTH_TOKEN
  );

  const result = await validateAdminSession(db, sessionToken);

  // Redirect to admin login if session is invalid
  if (!result) {
    return context.redirect(
      `/manage/login?returnTo=${encodeURIComponent(pathname)}`
    );
  }

  // Store admin user info in locals for use in pages
  context.locals.adminUser = result.user;
  context.locals.isAdmin = true;

  return next();
});
