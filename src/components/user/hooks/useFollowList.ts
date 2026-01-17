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
  // Use ref to track request ID and prevent stale request responses from overwriting current state
  const requestIdRef = useRef(0);

  const fetchUsers = useCallback(
    async (loadMore = false) => {
      // Increment request ID to track this specific request
      const requestId = ++requestIdRef.current;

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

        // Ignore stale responses from outdated requests
        if (requestId !== requestIdRef.current) return;

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
        // Only update error state if this is still the current request
        if (requestId === requestIdRef.current) {
          setError(err instanceof Error ? err : new Error("Unknown error"));
        }
      } finally {
        // Only update loading state if this is still the current request
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [userId, type, limit, csrfToken]
  );

  // Auto-initialize via useEffect (proper React pattern)
  // Re-fetch when fetchUsers changes (which depends on userId, type, limit, csrfToken)
  useEffect(() => {
    // Reset cursor and request ID when dependencies change to prevent stale pagination
    cursorRef.current = null;
    fetchUsers(false);
  }, [fetchUsers]);

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
