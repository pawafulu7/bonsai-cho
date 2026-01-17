import { useCallback, useEffect, useRef, useState } from "react";
import type {
  FollowListUser,
  UseFollowListOptions,
  UseFollowListReturn,
  UserCardProps,
} from "@/types/user";

/**
 * useFollowList - Custom hook for fetching followers/following list
 *
 * Features:
 * - Cursor-based pagination
 * - Loading and error states
 * - Load more capability
 * - Auto-initialization via useEffect (not during render)
 * - csrfToken support for follow buttons
 */
export function useFollowList({
  userId,
  type,
  limit = 20,
  csrfToken,
}: UseFollowListOptions): UseFollowListReturn {
  const [users, setUsers] = useState<UserCardProps[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  // Use ref to avoid stale closure issues with cursor in useCallback dependencies
  const cursorRef = useRef<string | null>(null);

  const fetchUsers = useCallback(
    async (loadMore = false) => {
      if (loadMore) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams({ limit: String(limit) });
        if (loadMore && cursorRef.current) {
          params.set("cursor", cursorRef.current);
        }

        const response = await fetch(
          `/api/users/${encodeURIComponent(userId)}/${type}?${params.toString()}`,
          { credentials: "include" }
        );

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("User not found");
          }
          throw new Error(`Failed to fetch ${type}`);
        }

        const data = await response.json();

        // Map API response to UserCardProps
        const newUsers: UserCardProps[] = data.data.map(
          (user: FollowListUser) => ({
            id: user.id,
            name: user.name,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            isFollowing: user.isFollowing,
            showFollowButton: !!csrfToken, // Only show follow button if csrfToken is available
            csrfToken,
          })
        );

        if (loadMore) {
          setUsers((prev) => [...prev, ...newUsers]);
        } else {
          setUsers(newUsers);
        }

        setHasMore(data.hasMore);
        cursorRef.current = data.nextCursor;
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [userId, type, limit, csrfToken]
  );

  // Auto-initialize via useEffect (proper React pattern)
  // Re-fetch when userId or type changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: Intentionally depend on userId/type to refetch on change
  useEffect(() => {
    fetchUsers(false);
  }, [userId, type]);

  // Load more
  const loadMore = useCallback(async () => {
    if (!isLoadingMore && hasMore && !isLoading) {
      await fetchUsers(true);
    }
  }, [isLoadingMore, hasMore, isLoading, fetchUsers]);

  return {
    users,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
  };
}
