import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LikeButtonProps } from "@/types/social";
import { useLike } from "./useLike";

/**
 * LikeButton - Interactive like button with optimistic updates
 *
 * Features:
 * - Optimistic update with rollback on error
 * - Disabled state while request is pending (prevents double-clicks)
 * - WCAG 2.1 AA compliant (44px touch target, aria-pressed)
 * - Like-pop animation on like action
 */
export function LikeButton({
  bonsaiId,
  initialLiked,
  initialCount,
  csrfToken,
  size = "md",
  showCount = true,
  className,
}: LikeButtonProps) {
  const { liked, count, isPending, toggle } = useLike({
    bonsaiId,
    initialLiked,
    initialCount,
    csrfToken,
  });

  // Size variants (all sizes meet WCAG 2.1 AA 44px minimum touch target)
  const sizeClasses = {
    sm: "px-3 py-1.5 min-h-[44px] min-w-[44px] text-sm",
    md: "px-4 py-2 min-h-[44px] min-w-[44px]",
    lg: "px-5 py-2.5 min-h-[52px] min-w-[52px] text-lg",
  };

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        // Base styles
        "inline-flex items-center gap-2",
        sizeClasses[size],
        "bg-transparent",
        "text-muted-foreground",
        "rounded-full",
        "border border-border",
        // Hover states
        "hover:border-red-400 hover:text-red-500 hover:bg-red-50",
        // Transitions
        "transition-colors duration-150",
        // Focus states (WCAG compliant)
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        // Disabled states
        "disabled:opacity-50 disabled:cursor-not-allowed",
        // Liked state
        liked && "border-red-400 text-red-500 bg-red-50",
        className
      )}
      aria-pressed={liked}
      aria-label={
        liked ? `いいねを取り消す（${count}件）` : `いいねする（${count}件）`
      }
      disabled={isPending}
    >
      <Heart
        className={cn(
          iconSizes[size],
          "transition-transform duration-150",
          liked && "fill-red-500 text-red-500",
          // Apply animation class on like (not on unlike)
          liked && !isPending && "animate-like-pop"
        )}
        aria-hidden="true"
      />
      {showCount && (
        <span className="min-w-[2ch] tabular-nums text-sm font-medium">
          {count}
        </span>
      )}
    </button>
  );
}
