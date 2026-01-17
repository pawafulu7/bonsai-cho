import { z } from "zod";

// Re-export shared schemas from bonsai.schema.ts
export { bonsaiIdParamSchema, paginationQuerySchema } from "./bonsai.schema";

// ============================================
// Common Schemas
// ============================================

/**
 * User ID parameter schema for follow routes
 */
export const userIdParamSchema = z.object({
  userId: z.string().min(1).max(50),
});

// ============================================
// Like Schemas
// ============================================

/**
 * Like response after add/remove
 */
export interface LikeResponse {
  liked: boolean;
  likeCount: number;
}

/**
 * User summary for like/follow lists
 */
export interface UserSummary {
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
}

/**
 * User summary with follow status for follower/following lists
 * Includes isFollowing field to show whether the current user follows each user
 */
export interface UserSummaryWithFollowStatus extends UserSummary {
  isFollowing: boolean;
}

/**
 * Like list response
 */
export interface LikeListResponse {
  data: UserSummary[];
  total: number;
  isLiked: boolean;
  nextCursor: string | null;
  hasMore: boolean;
}

// ============================================
// Comment Schemas
// ============================================

/**
 * Create comment request body
 * Note: HTML escaping is handled on frontend (React auto-escapes)
 * Backend validates length and removes control characters only
 */
export const createCommentSchema = z.object({
  content: z
    .string()
    .max(1000, "Comment must be 1000 characters or less")
    .transform((val) => val.trim())
    // biome-ignore lint/suspicious/noControlCharactersInRegex: Intentionally filtering control characters for security
    .transform((val) => val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ""))
    .refine((val) => val.length >= 1, "Comment cannot be empty"),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

/**
 * Update comment request body (same as create)
 */
export const updateCommentSchema = createCommentSchema;

export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

/**
 * Comment ID parameter schema (includes bonsaiId for IDOR prevention)
 */
export const commentIdParamSchema = z.object({
  bonsaiId: z.string().min(1).max(50),
  commentId: z.string().min(1).max(50),
});

/**
 * Comment item in list response
 */
export interface CommentItem {
  id: string;
  userId: string;
  user: UserSummary;
  content: string;
  createdAt: string;
  updatedAt: string;
  isOwner: boolean;
}

/**
 * Comment list response
 */
export interface CommentListResponse {
  data: CommentItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ============================================
// Follow Schemas
// ============================================

/**
 * Follow response after follow/unfollow
 */
export interface FollowResponse {
  following: boolean;
  followerCount: number;
}

/**
 * Follow list response (followers or following)
 * data contains UserSummaryWithFollowStatus when authenticated, UserSummary when not
 */
export interface FollowListResponse {
  data: (UserSummary | UserSummaryWithFollowStatus)[];
  nextCursor: string | null;
  hasMore: boolean;
  isFollowing?: boolean; // Current user's follow status for target user
}
