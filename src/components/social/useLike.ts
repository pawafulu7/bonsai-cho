import { useCallback, useRef, useState } from "react";
import type { UseLikeOptions, UseLikeReturn } from "@/types/social";

/**
 * useLike - Custom hook for like functionality
 *
 * Provides optimistic update with rollback on error.
 * Uses isPending state to prevent double-clicks.
 */
export function useLike({
  bonsaiId,
  initialLiked,
  initialCount,
  csrfToken,
}: UseLikeOptions): UseLikeReturn {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [isPending, setIsPending] = useState(false);
  // useRef for synchronous guard (useState is async and can miss rapid clicks)
  const pendingRef = useRef(false);

  const toggle = useCallback(async () => {
    // Prevent double-clicks with synchronous ref check
    if (pendingRef.current) return;
    pendingRef.current = true;

    // Store previous state for rollback
    const prevLiked = liked;
    const prevCount = count;

    // Optimistic update
    setLiked(!liked);
    setCount(liked ? count - 1 : count + 1);
    setIsPending(true);

    try {
      const response = await fetch(`/api/bonsai/${bonsaiId}/likes`, {
        method: liked ? "DELETE" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to toggle like");
      }

      const data = await response.json();
      // Sync with server response to ensure consistency
      setCount(data.likeCount);
      setLiked(data.liked);
    } catch {
      // Rollback on error
      setLiked(prevLiked);
      setCount(prevCount);
    } finally {
      setIsPending(false);
      pendingRef.current = false;
    }
  }, [bonsaiId, liked, count, csrfToken]);

  return { liked, count, isPending, toggle };
}
