/**
 * Admin authentication utilities
 *
 * Provides functions for admin user validation and authentication.
 * Admin users are stored in the admin_users table with password authentication.
 */

import {
  type Database as AdminDatabase,
  parseAdminSessionCookie,
  validateAdminSession,
} from "./admin-session";
import { parseCsrfCookie, validateCsrfToken } from "./csrf";

// Re-export types from admin-session for convenience
export type { AdminSessionUser } from "./admin-session";

/**
 * Admin authentication result
 */
export interface AdminAuthResult {
  success: true;
  adminUserId: string;
  adminUserName: string;
  adminUserEmail: string;
  isAdmin: true;
}

export interface AdminAuthError {
  success: false;
  error: string;
  code: string;
  status: 401 | 403;
}

export type AdminAuthResponse = AdminAuthResult | AdminAuthError;

/**
 * Validate admin authentication from request context
 *
 * This function checks:
 * 1. Admin session token exists and is valid
 * 2. Admin user is active
 *
 * Use this in API routes that require admin privileges.
 */
export async function validateAdminAuth(
  db: AdminDatabase,
  cookieHeader: string | undefined
): Promise<AdminAuthResponse> {
  const sessionToken = parseAdminSessionCookie(cookieHeader || "");

  if (!sessionToken) {
    return {
      success: false,
      error: "Unauthorized",
      code: "UNAUTHORIZED",
      status: 401,
    };
  }

  const result = await validateAdminSession(db, sessionToken);
  if (!result) {
    return {
      success: false,
      error: "Unauthorized",
      code: "UNAUTHORIZED",
      status: 401,
    };
  }

  // Check admin status
  if (result.user.status !== "active") {
    return {
      success: false,
      error: "Account disabled",
      code: "ACCOUNT_DISABLED",
      status: 403,
    };
  }

  return {
    success: true,
    adminUserId: result.user.id,
    adminUserName: result.user.name,
    adminUserEmail: result.user.email,
    isAdmin: true,
  };
}

/**
 * Validate CSRF token for mutation requests
 *
 * Returns null if valid, error object if invalid
 */
export function validateAdminCsrf(
  cookieHeader: string | undefined,
  csrfHeader: string | null | undefined
): { error: string; code: string } | null {
  const csrfCookie = parseCsrfCookie(cookieHeader || "");

  if (!validateCsrfToken(csrfCookie, csrfHeader ?? null)) {
    return {
      error: "Invalid CSRF token",
      code: "CSRF_VALIDATION_FAILED",
    };
  }

  return null;
}
