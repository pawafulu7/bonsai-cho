import { describe, expect, it } from "vitest";
import { buttonVariants } from "./button";

describe("buttonVariants", () => {
  describe("cursor-pointer", () => {
    it("should include cursor-pointer in default variant", () => {
      const result = buttonVariants({ variant: "default" });
      expect(result).toContain("cursor-pointer");
    });

    it("should include cursor-pointer in all variants", () => {
      const variants = [
        "default",
        "destructive",
        "outline",
        "secondary",
        "ghost",
        "link",
      ] as const;

      for (const variant of variants) {
        const result = buttonVariants({ variant });
        expect(result).toContain("cursor-pointer");
      }
    });

    it("should include cursor-pointer in all sizes", () => {
      const sizes = ["default", "sm", "lg", "icon"] as const;

      for (const size of sizes) {
        const result = buttonVariants({ size });
        expect(result).toContain("cursor-pointer");
      }
    });
  });

  describe("base classes", () => {
    it("should include transition-colors for smooth hover feedback", () => {
      const result = buttonVariants();
      expect(result).toContain("transition-colors");
    });

    it("should include focus-visible ring for accessibility", () => {
      const result = buttonVariants();
      expect(result).toContain("focus-visible:ring-1");
    });

    it("should include disabled state styles", () => {
      const result = buttonVariants();
      expect(result).toContain("disabled:pointer-events-none");
      expect(result).toContain("disabled:opacity-50");
    });
  });
});
