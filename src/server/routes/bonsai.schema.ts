/**
 * Bonsai API Validation Schemas
 *
 * Zod schemas for request/response validation.
 */

import { z } from "zod";

// ============================================================================
// Common Schemas
// ============================================================================

/**
 * Pagination query parameters
 */
export const paginationQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return 20;
      const num = Number.parseInt(val, 10);
      return Number.isNaN(num) ? 20 : num;
    })
    .pipe(z.number().int().min(1).max(100)),
});

/**
 * Bonsai ID parameter
 */
export const bonsaiIdParamSchema = z.object({
  bonsaiId: z.string().min(1).max(50),
});

/**
 * Care log ID parameter
 */
export const careLogIdParamSchema = z.object({
  bonsaiId: z.string().min(1).max(50),
  logId: z.string().min(1).max(50),
});

// ============================================================================
// Bonsai Schemas
// ============================================================================

/**
 * Create bonsai request body
 */
export const createBonsaiSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less"),

  description: z
    .string()
    .max(2000, "Description must be 2000 characters or less")
    .optional()
    .nullable()
    .transform((val) => val?.trim() || null),

  speciesId: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/, "Invalid species ID format")
    .optional()
    .nullable(),

  styleId: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/, "Invalid style ID format")
    .optional()
    .nullable(),

  acquiredAt: z
    .string()
    .datetime({ message: "Invalid datetime format. Use ISO 8601 format." })
    .optional()
    .nullable()
    .refine(
      (val) => {
        if (!val) return true;
        return new Date(val) <= new Date();
      },
      { message: "Acquired date cannot be in the future" }
    ),

  estimatedAge: z
    .number()
    .int()
    .min(0, "Estimated age must be non-negative")
    .max(1000, "Estimated age must be realistic")
    .optional()
    .nullable(),

  height: z
    .number()
    .positive("Height must be positive")
    .max(500, "Height must be realistic (cm)")
    .optional()
    .nullable(),

  width: z
    .number()
    .positive("Width must be positive")
    .max(500, "Width must be realistic (cm)")
    .optional()
    .nullable(),

  potDetails: z
    .string()
    .max(500, "Pot details must be 500 characters or less")
    .optional()
    .nullable()
    .transform((val) => val?.trim() || null),

  isPublic: z.boolean().default(true),
});

/**
 * Update bonsai request body (partial)
 *
 * Note: partial() preserves default values from createBonsaiSchema.
 * Empty object {} will be parsed as { isPublic: true } due to isPublic's default(true).
 * This is intentional - API handler performs additional validation as needed.
 */
export const updateBonsaiSchema = createBonsaiSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

// ============================================================================
// Care Log Schemas
// ============================================================================

/**
 * Care type enum values
 */
export const careTypeEnum = z.enum([
  "watering",
  "fertilizing",
  "pruning",
  "repotting",
  "wiring",
  "other",
]);

export type CareType = z.infer<typeof careTypeEnum>;

/**
 * Create care log request body
 */
export const createCareLogSchema = z.object({
  careType: careTypeEnum,

  description: z
    .string()
    .max(1000, "Description must be 1000 characters or less")
    .optional()
    .nullable()
    .transform((val) => val?.trim() || null),

  performedAt: z
    .string()
    .datetime({ message: "Invalid datetime format. Use ISO 8601 format." })
    .refine((val) => new Date(val) <= new Date(), {
      message: "Performed date cannot be in the future",
    }),

  imageUrl: z.string().max(500).optional().nullable(),
});

/**
 * Update care log request body (partial)
 */
export const updateCareLogSchema = createCareLogSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

/**
 * Care log filter query parameters
 */
export const careLogFilterSchema = z.object({
  careType: careTypeEnum.optional(),
  from: z
    .string()
    .datetime({ message: "Invalid datetime format for 'from'" })
    .optional(),
  to: z
    .string()
    .datetime({ message: "Invalid datetime format for 'to'" })
    .optional(),
});

// ============================================================================
// Response Types
// ============================================================================

/**
 * Bonsai list item (summary for list view)
 */
export interface BonsaiListItem {
  id: string;
  name: string;
  description: string | null;
  speciesId: string | null;
  speciesNameJa: string | null;
  styleId: string | null;
  styleNameJa: string | null;
  primaryImageUrl: string | null;
  thumbnailUrl: string | null;
  imageCount: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Bonsai list response with pagination
 */
export interface BonsaiListResponse {
  data: BonsaiListItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Bonsai detail response
 */
export interface BonsaiDetailResponse {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  speciesId: string | null;
  species: {
    id: string;
    nameJa: string;
    nameEn: string | null;
    nameScientific: string | null;
  } | null;
  styleId: string | null;
  style: {
    id: string;
    nameJa: string;
    nameEn: string | null;
  } | null;
  acquiredAt: string | null;
  estimatedAge: number | null;
  height: number | null;
  width: number | null;
  potDetails: string | null;
  isPublic: boolean;
  likeCount: number;
  commentCount: number;
  images: Array<{
    id: string;
    imageUrl: string;
    thumbnailUrl: string | null;
    caption: string | null;
    isPrimary: boolean;
    sortOrder: number;
  }>;
  tags: Array<{
    id: string;
    name: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Care log item
 */
export interface CareLogItem {
  id: string;
  bonsaiId: string;
  careType: CareType;
  description: string | null;
  performedAt: string;
  imageUrl: string | null;
  createdAt: string;
}

/**
 * Care log list response
 */
export interface CareLogListResponse {
  data: CareLogItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ============================================================================
// Input Types (inferred from schemas)
// ============================================================================

export type CreateBonsaiInput = z.infer<typeof createBonsaiSchema>;
export type UpdateBonsaiInput = z.infer<typeof updateBonsaiSchema>;
export type CreateCareLogInput = z.infer<typeof createCareLogSchema>;
export type UpdateCareLogInput = z.infer<typeof updateCareLogSchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
