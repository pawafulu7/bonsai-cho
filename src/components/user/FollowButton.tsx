import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { FollowButtonProps } from "@/types/user";

/**
 * FollowButton - Follow/Unfollow toggle button
 *
 * Features:
 * - Optimistic updates with rollback on error
 * - Minimum touch target 44px (min-h-11)
 * - aria-pressed for toggle state
 * - Dynamic aria-label
 * - Minimum width to prevent layout shift
 * - animate-like-pop on click
 * - Respects prefers-reduced-motion
 */
export function FollowButton({
  userId,
  userName,
  initialFollowing,
  initialCount = 0,
  csrfToken,
  className,
  onFollowChange,
}: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialCount);
  const [isPending, setIsPending] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const pendingRef = useRef(false);

  const toggle = useCallback(async () => {
    // Prevent double-clicks
    if (pendingRef.current) return;
    pendingRef.current = true;

    // Store previous state for rollback
    const prevFollowing = following;
    const prevCount = count;

    // Optimistic update
    const newFollowing = !following;
    const newCount = following ? Math.max(0, count - 1) : count + 1;
    setFollowing(newFollowing);
    setCount(newCount);
    setIsPending(true);
    setShouldAnimate(true);

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
      // Sync with server response
      setCount(data.followerCount);
      setFollowing(data.following);

      // Notify parent
      onFollowChange?.(data.following, data.followerCount);
    } catch {
      // Rollback on error
      setFollowing(prevFollowing);
      setCount(prevCount);
    } finally {
      setIsPending(false);
      pendingRef.current = false;
      // Reset animation after it completes
      setTimeout(() => setShouldAnimate(false), 200);
    }
  }, [userId, following, count, csrfToken, onFollowChange]);

  const label = following
    ? `${userName}のフォローを解除`
    : `${userName}をフォロー`;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-pressed={following}
      aria-label={label}
      className={cn(
        // Base styles
        "inline-flex items-center justify-center",
        "min-h-11 min-w-[80px] px-4 py-2",
        "text-sm font-medium rounded-md",
        "transition-all duration-200",
        // Focus styles
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        // Disabled state
        "disabled:pointer-events-none disabled:opacity-50",
        // Following state (secondary style)
        following && [
          "bg-secondary text-secondary-foreground",
          "border border-input",
          "hover:bg-secondary/80",
        ],
        // Not following state (primary style)
        !following && [
          "bg-primary text-primary-foreground",
          "hover:bg-primary/90",
        ],
        // Animation
        shouldAnimate && "motion-safe:animate-like-pop",
        className
      )}
    >
      {following ? "フォロー中" : "フォロー"}
    </button>
  );
}
