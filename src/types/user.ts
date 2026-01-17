/**
 * User Profile Types
 *
 * TypeScript types for user profile components and hooks.
 */

// ============================================================================
// API Response Types
// ============================================================================

/**
 * User profile data from GET /api/users/:userId
 */
export interface UserProfile {
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  followerCount: number;
  followingCount: number;
  bonsaiCount: number;
  isFollowing: boolean | null;
  isSelf: boolean;
  createdAt: string;
}

/**
 * Update profile request body
 */
export interface UpdateProfileRequest {
  displayName?: string | null;
  bio?: string | null;
  location?: string | null;
  website?: string | null;
}

/**
 * Update profile response from PATCH /api/users/me
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

// ============================================================================
// Component Props
// ============================================================================

/**
 * FollowButton component props
 */
export interface FollowButtonProps {
  /** Target user ID */
  userId: string;
  /** Target user's name for aria-label */
  userName: string;
  /** Initial follow state */
  initialFollowing: boolean;
  /** Initial follower count */
  initialCount?: number;
  /** CSRF token for mutation */
  csrfToken?: string;
  /** Additional class names */
  className?: string;
  /** Callback when follow state changes */
  onFollowChange?: (following: boolean, count: number) => void;
}

/**
 * ProfileHeader component props
 */
export interface ProfileHeaderProps {
  /** User profile data */
  profile: UserProfile;
  /** CSRF token for mutations */
  csrfToken?: string;
  /** Whether the current user is authenticated */
  isAuthenticated: boolean;
  /** Callback when profile is updated */
  onProfileUpdate?: (profile: UpdateProfileResponse) => void;
}

/**
 * UserCard component props
 */
export interface UserCardProps {
  /** User ID */
  id: string;
  /** Username (unique identifier) */
  name: string;
  /** Display name (nullable) */
  displayName: string | null;
  /** Avatar URL (nullable) */
  avatarUrl: string | null;
  /** Whether current user follows this user */
  isFollowing?: boolean;
  /** CSRF token for follow button */
  csrfToken?: string;
  /** Whether to show follow button */
  showFollowButton?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * FollowerGrid component props
 */
export interface FollowerGridProps {
  /** Target user ID */
  userId: string;
  /** Type of list: 'followers' or 'following' */
  type: "followers" | "following";
  /** Initial data from SSR */
  initialData?: UserCardProps[];
  /** Initial cursor for pagination */
  initialCursor?: string | null;
  /** Initial hasMore flag */
  initialHasMore?: boolean;
  /** CSRF token for follow buttons */
  csrfToken?: string;
}

// ============================================================================
// Hook Options and Returns
// ============================================================================

/**
 * useProfile hook options
 */
export interface UseProfileOptions {
  /** User ID to fetch profile for */
  userId: string;
  /** Initial profile data from SSR */
  initialData?: UserProfile;
}

/**
 * useProfile hook return type
 */
export interface UseProfileReturn {
  /** User profile data */
  profile: UserProfile | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Refetch profile */
  refetch: () => Promise<void>;
}

/**
 * useFollowList hook options
 */
export interface UseFollowListOptions {
  /** Target user ID */
  userId: string;
  /** Type of list */
  type: "followers" | "following";
  /** Page size */
  limit?: number;
}

/**
 * useFollowList hook return type
 */
export interface UseFollowListReturn {
  /** List of users */
  users: UserCardProps[];
  /** Loading state */
  isLoading: boolean;
  /** Loading more state */
  isLoadingMore: boolean;
  /** Error state */
  error: Error | null;
  /** Whether there are more items */
  hasMore: boolean;
  /** Load more items */
  loadMore: () => Promise<void>;
}
