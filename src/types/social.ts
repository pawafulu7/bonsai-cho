/**
 * Social Feature Types
 *
 * Type definitions for social feature UI components (likes, comments, follows).
 * Extends API response types with frontend-specific properties.
 */

export type {
  BonsaiDetailResponse,
  CareLogItem,
} from "@/server/routes/bonsai.schema";
// Re-export API types for convenience
export type {
  CommentItem,
  CommentListResponse,
  FollowListResponse,
  FollowResponse,
  LikeListResponse,
  LikeResponse,
  UserSummary,
} from "@/server/routes/social.schema";

// ============================================================================
// Bonsai List Types (Extended for social features)
// ============================================================================

/**
 * Bonsai list item with social counts for card display
 */
export interface BonsaiListItemWithSocial {
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
  likeCount: number;
  commentCount: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Bonsai list response with social counts
 */
export interface BonsaiListResponseWithSocial {
  data: BonsaiListItemWithSocial[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Bonsai detail with isLiked status (for logged-in users)
 * Extends BonsaiDetailResponse with additional isLiked property
 */
export type BonsaiDetailWithLikeStatus =
  import("@/server/routes/bonsai.schema").BonsaiDetailResponse & {
    isLiked: boolean;
  };

// ============================================================================
// Component Props Types
// ============================================================================

/**
 * Props for LikeButton component
 */
export interface LikeButtonProps {
  bonsaiId: string;
  initialLiked: boolean;
  initialCount: number;
  csrfToken: string;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
  className?: string;
}

/**
 * Props for CommentSection component
 */
export interface CommentSectionProps {
  bonsaiId: string;
  initialComments: import("@/server/routes/social.schema").CommentItem[];
  initialHasMore: boolean;
  initialNextCursor: string | null;
  currentUserId: string | null;
  bonsaiOwnerId: string;
  csrfToken: string;
  className?: string;
}

/**
 * Props for CommentItem component
 */
export interface CommentItemProps {
  comment: import("@/server/routes/social.schema").CommentItem;
  canDelete: boolean;
  onDelete: () => void;
  isPending?: boolean;
}

/**
 * Props for CommentForm component
 */
export interface CommentFormProps {
  bonsaiId: string;
  csrfToken: string;
  onSubmit: (content: string) => Promise<void>;
  isPending?: boolean;
  className?: string;
}

/**
 * Props for FollowButton component
 */
export interface FollowButtonProps {
  userId: string;
  initialFollowing: boolean;
  initialCount?: number;
  csrfToken: string;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
  className?: string;
}

// ============================================================================
// Hook Return Types
// ============================================================================

/**
 * Return type for useLike hook
 */
export interface UseLikeReturn {
  liked: boolean;
  count: number;
  isPending: boolean;
  toggle: () => Promise<void>;
}

/**
 * Options for useLike hook
 */
export interface UseLikeOptions {
  bonsaiId: string;
  initialLiked: boolean;
  initialCount: number;
  csrfToken: string;
}

/**
 * Return type for useComments hook
 */
export interface UseCommentsReturn {
  comments: import("@/server/routes/social.schema").CommentItem[];
  hasMore: boolean;
  isPending: boolean;
  isSubmitting: boolean;
  addComment: (content: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  loadMore: () => Promise<void>;
}

/**
 * Options for useComments hook
 */
export interface UseCommentsOptions {
  bonsaiId: string;
  initialComments: import("@/server/routes/social.schema").CommentItem[];
  initialHasMore: boolean;
  initialNextCursor: string | null;
  csrfToken: string;
}

/**
 * Return type for useFollow hook
 */
export interface UseFollowReturn {
  following: boolean;
  count: number;
  isPending: boolean;
  toggle: () => Promise<void>;
}

/**
 * Options for useFollow hook
 */
export interface UseFollowOptions {
  userId: string;
  initialFollowing: boolean;
  initialCount?: number;
  csrfToken: string;
}

// ============================================================================
// Card Grid Types
// ============================================================================

/**
 * Props for BonsaiCard component
 */
export interface BonsaiCardProps {
  id: string;
  name: string;
  description: string | null;
  thumbnailUrl: string | null;
  speciesNameJa: string | null;
  styleNameJa: string | null;
  likeCount: number;
  commentCount: number;
  className?: string;
}

/**
 * Empty State CTA configuration
 */
export interface EmptyCtaConfig {
  label: string;
  href: string;
}

/**
 * Props for BonsaiCardGrid component
 */
export interface BonsaiCardGridProps {
  initialData: BonsaiListItemWithSocial[];
  initialCursor: string | null;
  initialHasMore: boolean;
  /** Empty State CTA configuration (presentational pattern) */
  emptyCta?: EmptyCtaConfig;
}

/**
 * Return type for useBonsaiList hook
 */
export interface UseBonsaiListReturn {
  items: BonsaiListItemWithSocial[];
  hasMore: boolean;
  isLoading: boolean;
  loadMore: () => Promise<void>;
}
