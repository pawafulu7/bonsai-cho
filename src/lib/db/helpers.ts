/**
 * Database Helper Functions
 *
 * Common utilities for database operations.
 */

import { type Column, isNull } from "drizzle-orm";

/**
 * Filter for non-deleted records (soft delete pattern)
 *
 * Usage:
 * ```typescript
 * const records = await db
 *   .select()
 *   .from(schema.bonsai)
 *   .where(notDeleted(schema.bonsai));
 * ```
 *
 * @param table - Table with deletedAt column
 * @returns SQL condition for deletedAt IS NULL
 */
export function notDeleted<T extends { deletedAt: Column }>(table: T) {
  return isNull(table.deletedAt);
}

/**
 * Cursor pagination types and utilities
 */
export interface Cursor {
  createdAt: string;
  id: string;
}

/**
 * Encode cursor for pagination
 *
 * Uses encodeURIComponent + btoa pattern for UTF-8 support in Cloudflare Workers.
 * This handles non-ASCII characters (e.g., Japanese) safely.
 *
 * @param cursor - Cursor object with createdAt and id
 * @returns Base64url encoded cursor string
 */
export function encodeCursor(cursor: Cursor): string {
  const payload = JSON.stringify(cursor);
  // Handle UTF-8 characters: encodeURIComponent converts to percent-encoded UTF-8,
  // then unescape converts to Latin-1 byte string that btoa can process
  const base64 = btoa(unescape(encodeURIComponent(payload)));
  // Convert to base64url format
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Decode cursor from pagination
 *
 * Reverses the UTF-8 safe encoding from encodeCursor.
 *
 * @param encoded - Base64url encoded cursor string
 * @returns Cursor object or null if invalid
 */
export function decodeCursor(encoded: string): Cursor | null {
  try {
    // Convert from base64url to base64
    let base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    // Add padding if needed
    while (base64.length % 4) {
      base64 += "=";
    }
    // Reverse UTF-8 encoding: atob gives Latin-1 string, escape + decodeURIComponent restores UTF-8
    const payload = decodeURIComponent(escape(atob(base64)));
    const parsed = JSON.parse(payload);

    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") {
      return null;
    }

    // Validate createdAt is a valid ISO date
    const date = new Date(parsed.createdAt);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return parsed as Cursor;
  } catch {
    return null;
  }
}
