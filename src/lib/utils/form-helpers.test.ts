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
    it("should convert valid date string to ISO 8601", () => {
      const result = dateToISO("2024-06-15");
      expect(result).toMatch(/^2024-06-15T/);
      expect(result).toMatch(/Z$/);
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

    it("should return null for invalid date", () => {
      expect(dateToISO("invalid-date")).toBeNull();
    });
  });

  describe("datetimeLocalToISO", () => {
    it("should convert valid datetime-local to ISO 8601", () => {
      const result = datetimeLocalToISO("2024-06-15T14:30");
      expect(result).toMatch(/^2024-06-15T/);
      expect(result).toMatch(/Z$/);
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

    it("should return null for invalid datetime", () => {
      expect(datetimeLocalToISO("invalid")).toBeNull();
    });
  });

  describe("isoToDate", () => {
    it("should extract date part from ISO string", () => {
      expect(isoToDate("2024-06-15T14:30:00.000Z")).toBe("2024-06-15");
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
      // Note: This test depends on local timezone
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
      vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should return true for future date", () => {
      expect(isFutureDate("2024-06-16T00:00:00.000Z")).toBe(true);
    });

    it("should return false for past date", () => {
      expect(isFutureDate("2024-06-14T00:00:00.000Z")).toBe(false);
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
      vi.setSystemTime(new Date("2024-06-15T14:30:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should return current datetime in local format", () => {
      const result = getCurrentDatetimeLocal();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });
  });

  describe("getCurrentDate", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-06-15T14:30:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should return current date in YYYY-MM-DD format", () => {
      const result = getCurrentDate();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
