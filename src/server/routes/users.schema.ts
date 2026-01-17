/**
 * User Profile API Schema Definitions
 *
 * Zod validation schemas for user profile endpoints.
 */

import { z } from "zod";

// ============================================================================
// Path Parameters
// ============================================================================

export const userIdParamSchema = z.object({
  userId: z.string().min(1).max(50),
});

// ============================================================================
// Update Profile Request
// ============================================================================

/**
 * PATCH /api/users/me request body schema
 *
 * Validation rules (per CodexMCP review):
 * - displayName: max 50 chars, trim whitespace
 * - bio: max 500 chars, remove control characters
 * - location: max 100 chars, trim whitespace
 * - website: max 200 chars, must start with https:// or http://
 * - Clear values: set to null (not empty string)
 */
export const updateProfileSchema = z.object({
  displayName: z
    .string()
    .max(50, "Display name must be 50 characters or less")
    .transform((val) => val.trim())
    .transform((val) => (val === "" ? null : val))
    .nullable()
    .optional(),
  bio: z
    .string()
    .max(500, "Bio must be 500 characters or less")
    // Remove control characters (except newlines and tabs)
    // biome-ignore lint/suspicious/noControlCharactersInRegex: Intentionally matching control characters to remove them
    .transform((val) => val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ""))
    .transform((val) => (val === "" ? null : val))
    .nullable()
    .optional(),
  location: z
    .string()
    .max(100, "Location must be 100 characters or less")
    .transform((val) => val.trim())
    .transform((val) => (val === "" ? null : val))
    .nullable()
    .optional(),
  website: z
    .string()
    .max(200, "Website URL must be 200 characters or less")
    .transform((val) => val.trim())
    .refine(
      (val) => {
        if (val === "" || val === null) return true;
        // Strict URL validation using URL constructor
        try {
          const url = new URL(val);
          // Only allow http and https protocols (prevent javascript:, data:, etc.)
          return url.protocol === "https:" || url.protocol === "http:";
        } catch {
          return false;
        }
      },
      {
        message:
          "Website must be a valid URL starting with https:// or http://",
      }
    )
    .transform((val) => (val === "" ? null : val))
    .nullable()
    .optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ============================================================================
// Response Types
// ============================================================================

/**
 * User profile response for GET /api/users/:userId
 */
export interface UserProfileResponse {
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  followerCount: number;
  followingCount: number;
  bonsaiCount: number; // Public bonsai only for non-owner, all for owner
  isFollowing: boolean | null; // null if not authenticated
  isSelf: boolean;
  createdAt: string;
}

/**
 * Update profile response for PATCH /api/users/me
 */
export interface UpdateProfileResponse {
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  updatedAt: string;
}
