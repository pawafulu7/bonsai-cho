/**
 * CSRF protection utilities
 *
 * Uses Double Submit Cookie pattern for stateless CSRF protection.
 * Compatible with Cloudflare Workers.
 */

import { base64urlEncode, generateRandomBytes, secureCompare } from "./crypto";

// CSRF cookie configuration
export const CSRF_COOKIE_NAME = "__Host-csrf";
export const CSRF_HEADER_NAME = "X-CSRF-Token";
export const CSRF_FORM_FIELD = "_csrf";

export const CSRF_COOKIE_OPTIONS = {
  httpOnly: false, // Must be readable by JavaScript for header submission
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 14, // 14 days - same as session
};

/**
 * Generate a new CSRF token
 * Returns a 32-byte (256-bit) base64url-encoded string
 */
export function generateCsrfToken(): string {
  return base64urlEncode(generateRandomBytes(32));
}

/**
 * Validate CSRF token from request against cookie
 *
 * Checks both header and form body for the token.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function validateCsrfToken(
  cookieToken: string | null,
  requestToken: string | null
): boolean {
  if (!cookieToken || !requestToken) {
    return false;
  }

  return secureCompare(cookieToken, requestToken);
}

/**
 * Extract CSRF token from request
 *
 * Checks in order:
 * 1. X-CSRF-Token header
 * 2. _csrf form field (for form submissions)
 */
export function extractCsrfToken(
  request: Request,
  formData?: FormData
): string | null {
  // Check header first
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  if (headerToken) {
    return headerToken;
  }

  // Check form data
  if (formData) {
    const formToken = formData.get(CSRF_FORM_FIELD);
    if (typeof formToken === "string") {
      return formToken;
    }
  }

  return null;
}

/**
 * Parse CSRF token from cookie header
 */
export function parseCsrfCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.split("=");
    if (name === CSRF_COOKIE_NAME) {
      return valueParts.join("=") || null;
    }
  }

  return null;
}

/**
 * Create a Set-Cookie header value for the CSRF token
 */
export function createCsrfCookie(token: string): string {
  const { httpOnly, secure, sameSite, path, maxAge } = CSRF_COOKIE_OPTIONS;
  const parts = [
    `${CSRF_COOKIE_NAME}=${token}`,
    `Path=${path}`,
    `Max-Age=${maxAge}`,
    `SameSite=${sameSite}`,
  ];

  if (httpOnly) parts.push("HttpOnly");
  if (secure) parts.push("Secure");

  return parts.join("; ");
}

/**
 * Create a Set-Cookie header value to clear the CSRF cookie
 */
export function clearCsrfCookie(): string {
  return `${CSRF_COOKIE_NAME}=; Path=/; Max-Age=0; Secure; SameSite=Lax`;
}

/**
 * Validate CSRF for a request
 *
 * Returns true if CSRF validation passes, false otherwise.
 * This is a convenience function that combines cookie parsing and validation.
 */
export async function validateRequestCsrf(request: Request): Promise<boolean> {
  const cookieHeader = request.headers.get("Cookie");
  const cookieToken = parseCsrfCookie(cookieHeader);

  // For form submissions, try to parse form data
  let formData: FormData | undefined;
  const contentType = request.headers.get("Content-Type") || "";

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    try {
      formData = await request.clone().formData();
    } catch {
      // Ignore form parsing errors
    }
  }

  const requestToken = extractCsrfToken(request, formData);

  return validateCsrfToken(cookieToken, requestToken);
}
