import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dateToISO,
  datetimeLocalToISO,
  formatNumericValue,
  getCurrentDate,
  getCurrentDatetimeLocal,
  isFutureDate,
  isoToDate,
  isoToDatetimeLocal,
  parseNumericInput,
} from "./form-helpers";

describe("form-helpers", () => {
  describe("dateToISO", () => {
    it("should convert valid date string to ISO 8601 as local date", () => {
      const result = dateToISO("2024-06-15");
      expect(result).not.toBeNull();
      // Should be midnight local time converted to UTC
      expect(result).toMatch(/Z$/);
      // The date should be 2024-06-15 in local time (though UTC may differ)
      const date = new Date(result!);
      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(5); // June = 5 (0-indexed)
      expect(date.getDate()).toBe(15);
    });

    it("should return null for empty string", () => {
      expect(dateToISO("")).toBeNull();
    });

    it("should return null for null", () => {
      expect(dateToISO(null)).toBeNull();
    });

    it("should return null for undefined", () => {
      expect(dateToISO(undefined)).toBeNull();
    });

    it("should return null for whitespace only", () => {
      expect(dateToISO("   ")).toBeNull();
    });

    it("should return null for invalid date format", () => {
      expect(dateToISO("invalid-date")).toBeNull();
    });

    it("should return null for invalid date values", () => {
      // Feb 30 doesn't exist
      expect(dateToISO("2024-02-30")).toBeNull();
    });

    it("should return null for partial date format", () => {
      expect(dateToISO("2024-06")).toBeNull();
    });
  });

  describe("datetimeLocalToISO", () => {
    it("should convert valid datetime-local to ISO 8601", () => {
      const result = datetimeLocalToISO("2024-06-15T14:30");
      expect(result).not.toBeNull();
      expect(result).toMatch(/Z$/);
      // Verify the date/time in local timezone
      const date = new Date(result!);
      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(5); // June
      expect(date.getDate()).toBe(15);
      expect(date.getHours()).toBe(14);
      expect(date.getMinutes()).toBe(30);
    });

    it("should return null for empty string", () => {
      expect(datetimeLocalToISO("")).toBeNull();
    });

    it("should return null for null", () => {
      expect(datetimeLocalToISO(null)).toBeNull();
    });

    it("should return null for undefined", () => {
      expect(datetimeLocalToISO(undefined)).toBeNull();
    });

    it("should return null for invalid datetime format", () => {
      expect(datetimeLocalToISO("invalid")).toBeNull();
    });

    it("should return null for date without time", () => {
      expect(datetimeLocalToISO("2024-06-15")).toBeNull();
    });

    it("should return null for datetime with seconds", () => {
      expect(datetimeLocalToISO("2024-06-15T14:30:00")).toBeNull();
    });
  });

  describe("isoToDate", () => {
    it("should extract date part from ISO string in local timezone", () => {
      // Use a time that will be the same date in most timezones
      const result = isoToDate("2024-06-15T12:00:00.000Z");
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should return empty string for null", () => {
      expect(isoToDate(null)).toBe("");
    });

    it("should return empty string for undefined", () => {
      expect(isoToDate(undefined)).toBe("");
    });

    it("should return empty string for empty string", () => {
      expect(isoToDate("")).toBe("");
    });

    it("should return empty string for invalid ISO string", () => {
      expect(isoToDate("invalid")).toBe("");
    });
  });

  describe("isoToDatetimeLocal", () => {
    it("should convert ISO string to datetime-local format", () => {
      const result = isoToDatetimeLocal("2024-06-15T14:30:00.000Z");
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });

    it("should return empty string for null", () => {
      expect(isoToDatetimeLocal(null)).toBe("");
    });

    it("should return empty string for undefined", () => {
      expect(isoToDatetimeLocal(undefined)).toBe("");
    });

    it("should return empty string for empty string", () => {
      expect(isoToDatetimeLocal("")).toBe("");
    });

    it("should return empty string for invalid ISO string", () => {
      expect(isoToDatetimeLocal("invalid")).toBe("");
    });
  });

  describe("parseNumericInput", () => {
    it("should parse valid integer string", () => {
      expect(parseNumericInput("42")).toBe(42);
    });

    it("should parse valid float string", () => {
      expect(parseNumericInput("3.14")).toBe(3.14);
    });

    it("should parse zero", () => {
      expect(parseNumericInput("0")).toBe(0);
    });

    it("should parse negative numbers", () => {
      expect(parseNumericInput("-10")).toBe(-10);
    });

    it("should return null for empty string", () => {
      expect(parseNumericInput("")).toBeNull();
    });

    it("should return null for null", () => {
      expect(parseNumericInput(null)).toBeNull();
    });

    it("should return null for undefined", () => {
      expect(parseNumericInput(undefined)).toBeNull();
    });

    it("should return null for whitespace only", () => {
      expect(parseNumericInput("   ")).toBeNull();
    });

    it("should return null for non-numeric string", () => {
      expect(parseNumericInput("abc")).toBeNull();
    });

    it("should handle string with whitespace", () => {
      expect(parseNumericInput(" 42 ")).toBe(42);
    });
  });

  describe("formatNumericValue", () => {
    it("should format number to string", () => {
      expect(formatNumericValue(42)).toBe("42");
    });

    it("should format float to string", () => {
      expect(formatNumericValue(3.14)).toBe("3.14");
    });

    it("should format zero to string", () => {
      expect(formatNumericValue(0)).toBe("0");
    });

    it("should return empty string for null", () => {
      expect(formatNumericValue(null)).toBe("");
    });

    it("should return empty string for undefined", () => {
      expect(formatNumericValue(undefined)).toBe("");
    });
  });

  describe("isFutureDate", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // Set to 2024-06-15 12:00:00 local time
      vi.setSystemTime(new Date(2024, 5, 15, 12, 0, 0, 0));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe("with YYYY-MM-DD format", () => {
      it("should return true for future date", () => {
        expect(isFutureDate("2024-06-16")).toBe(true);
      });

      it("should return false for today (date-only comparison)", () => {
        // Today should not be considered future
        expect(isFutureDate("2024-06-15")).toBe(false);
      });

      it("should return false for past date", () => {
        expect(isFutureDate("2024-06-14")).toBe(false);
      });
    });

    describe("with ISO 8601 format", () => {
      it("should return true for future datetime", () => {
        // Tomorrow in local time
        const tomorrow = new Date(2024, 5, 16, 12, 0, 0, 0);
        expect(isFutureDate(tomorrow.toISOString())).toBe(true);
      });

      it("should return false for past datetime", () => {
        const yesterday = new Date(2024, 5, 14, 12, 0, 0, 0);
        expect(isFutureDate(yesterday.toISOString())).toBe(false);
      });
    });

    it("should return false for null", () => {
      expect(isFutureDate(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isFutureDate(undefined)).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isFutureDate("")).toBe(false);
    });

    it("should return false for invalid date", () => {
      expect(isFutureDate("invalid")).toBe(false);
    });
  });

  describe("getCurrentDatetimeLocal", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 5, 15, 14, 30, 0, 0));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should return current datetime in local format", () => {
      const result = getCurrentDatetimeLocal();
      expect(result).toBe("2024-06-15T14:30");
    });
  });

  describe("getCurrentDate", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 5, 15, 14, 30, 0, 0));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should return current date in YYYY-MM-DD format", () => {
      const result = getCurrentDate();
      expect(result).toBe("2024-06-15");
    });
  });
});
