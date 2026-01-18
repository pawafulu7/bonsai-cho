/**
 * Form Helper Utilities
 *
 * Provides normalization functions for form inputs to match API expectations.
 * Handles date/time conversion and numeric input parsing.
 */

/**
 * Parse YYYY-MM-DD string as local date
 * Returns null for invalid format
 */
function parseDateString(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, yearStr, monthStr, dayStr] = match;
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10) - 1; // 0-indexed
  const day = Number.parseInt(dayStr, 10);
  const date = new Date(year, month, day);
  // Validate the date is valid (e.g., not Feb 30)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/**
 * Convert date input value (YYYY-MM-DD) to ISO 8601 format
 * Treats input as local date at midnight local time
 * Returns null for empty/invalid values
 */
export function dateToISO(dateStr: string | null | undefined): string | null {
  if (!dateStr || dateStr.trim() === "") return null;
  try {
    const date = parseDateString(dateStr.trim());
    if (!date) return null;
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
    // datetime-local format: YYYY-MM-DDTHH:mm
    const match = datetimeStr
      .trim()
      .match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
    if (!match) return null;
    const [, yearStr, monthStr, dayStr, hourStr, minStr] = match;
    const year = Number.parseInt(yearStr, 10);
    const month = Number.parseInt(monthStr, 10) - 1;
    const day = Number.parseInt(dayStr, 10);
    const hour = Number.parseInt(hourStr, 10);
    const minute = Number.parseInt(minStr, 10);
    const date = new Date(year, month, day, hour, minute);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

/**
 * Convert ISO 8601 string to date input format (YYYY-MM-DD)
 * Returns the date portion in local timezone
 * Returns empty string for null/invalid values
 */
export function isoToDate(isoStr: string | null | undefined): string {
  if (!isoStr) return "";
  try {
    const date = new Date(isoStr);
    if (Number.isNaN(date.getTime())) return "";
    // Use local date components to avoid timezone shift
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
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
 * Check if a date string (YYYY-MM-DD or ISO 8601) is in the future
 * For YYYY-MM-DD format, compares dates only (ignores time)
 * Returns true if date is after current date/time
 */
export function isFutureDate(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  try {
    const trimmed = dateStr.trim();
    // Check if it's a date-only format (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const inputDate = parseDateString(trimmed);
      if (!inputDate) return false;
      // Compare date only (set current date to start of day)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return inputDate > today;
    }
    // For ISO 8601 or other formats, compare as datetime
    const date = new Date(trimmed);
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
