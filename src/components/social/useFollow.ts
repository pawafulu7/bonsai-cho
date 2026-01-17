import { useCallback, useState } from "react";
import type { UseFollowOptions, UseFollowReturn } from "@/types/social";

/**
 * useFollow - Custom hook for follow functionality
 *
 * Provides optimistic update with rollback on error.
 * Uses isPending state to prevent double-clicks.
 */
export function useFollow({
  userId,
  initialFollowing,
  initialCount = 0,
  csrfToken,
}: UseFollowOptions): UseFollowReturn {
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialCount);
  const [isPending, setIsPending] = useState(false);

  const toggle = useCallback(async () => {
    // Prevent double-clicks while request is in flight
    if (isPending) return;

    // Store previous state for rollback
    const prevFollowing = following;
    const prevCount = count;

    // Optimistic update
    setFollowing(!following);
    setCount(following ? count - 1 : count + 1);
    setIsPending(true);

    try {
      const response = await fetch(`/api/users/${userId}/follow`, {
        method: following ? "DELETE" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to toggle follow");
      }

      const data = await response.json();
      // Sync with server response to ensure consistency
      setCount(data.followerCount);
      setFollowing(data.following);
    } catch {
      // Rollback on error
      setFollowing(prevFollowing);
      setCount(prevCount);
    } finally {
      setIsPending(false);
    }
  }, [userId, following, count, csrfToken, isPending]);

  return { following, count, isPending, toggle };
}
