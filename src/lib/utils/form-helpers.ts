/**
 * Form Helper Utilities
 *
 * Provides normalization functions for form inputs to match API expectations.
 * Handles date/time conversion and numeric input parsing.
 */

/**
 * Convert date input value (YYYY-MM-DD) to ISO 8601 format
 * Returns null for empty/invalid values
 */
export function dateToISO(dateStr: string | null | undefined): string | null {
  if (!dateStr || dateStr.trim() === "") return null;
  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

/**
 * Convert datetime-local input value (YYYY-MM-DDTHH:mm) to ISO 8601 format
 * Returns null for empty/invalid values
 */
export function datetimeLocalToISO(
  datetimeStr: string | null | undefined
): string | null {
  if (!datetimeStr || datetimeStr.trim() === "") return null;
  try {
    const date = new Date(datetimeStr);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

/**
 * Convert ISO 8601 string to date input format (YYYY-MM-DD)
 * Returns empty string for null/invalid values
 */
export function isoToDate(isoStr: string | null | undefined): string {
  if (!isoStr) return "";
  try {
    const date = new Date(isoStr);
    if (Number.isNaN(date.getTime())) return "";
    return isoStr.split("T")[0];
  } catch {
    return "";
  }
}

/**
 * Convert ISO 8601 string to datetime-local input format (YYYY-MM-DDTHH:mm)
 * Returns empty string for null/invalid values
 */
export function isoToDatetimeLocal(isoStr: string | null | undefined): string {
  if (!isoStr) return "";
  try {
    const date = new Date(isoStr);
    if (Number.isNaN(date.getTime())) return "";
    // Get local date components
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return "";
  }
}

/**
 * Parse numeric input string to number or null
 * Returns null for empty, undefined, or invalid values
 * This prevents sending NaN or 0 for empty optional numeric fields
 */
export function parseNumericInput(
  value: string | null | undefined
): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (trimmed === "") return null;
  const num = Number(trimmed);
  return Number.isNaN(num) ? null : num;
}

/**
 * Format number for display in input field
 * Returns empty string for null/undefined
 */
export function formatNumericValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

/**
 * Check if a date string is in the future
 * Returns true if date is after current time
 */
export function isFutureDate(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return false;
    return date > new Date();
  } catch {
    return false;
  }
}

/**
 * Get current datetime in datetime-local input format
 * Useful for setting default values
 */
export function getCurrentDatetimeLocal(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Get current date in date input format
 * Useful for setting max attribute on date inputs
 */
export function getCurrentDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
