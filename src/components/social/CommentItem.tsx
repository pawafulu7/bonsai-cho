import { Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { CommentItemProps } from "@/types/social";

/**
 * CommentItem - Individual comment display
 *
 * Features:
 * - User avatar with fallback
 * - Relative time display
 * - Delete button for comment owners
 */
export function CommentItem({
  comment,
  canDelete,
  onDelete,
  isPending = false,
}: CommentItemProps) {
  // Format relative time
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay > 30) {
      return date.toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
    if (diffDay > 0) return `${diffDay}日前`;
    if (diffHour > 0) return `${diffHour}時間前`;
    if (diffMin > 0) return `${diffMin}分前`;
    return "たった今";
  };

  // Get user initials for avatar fallback
  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <article
      className={cn(
        "flex gap-3 p-3 rounded-lg bg-card border border-border/50",
        "transition-opacity duration-200",
        isPending && "opacity-50"
      )}
    >
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarImage src={comment.user.avatarUrl || undefined} alt="" />
        <AvatarFallback className="bg-primary/10 text-primary text-sm">
          {getInitials(comment.user.displayName || comment.user.name)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <header className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-sm text-foreground truncate">
              {comment.user.displayName || comment.user.name}
            </span>
            <time
              dateTime={comment.createdAt}
              className="text-xs text-muted-foreground shrink-0"
            >
              {formatRelativeTime(comment.createdAt)}
            </time>
          </div>

          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={isPending}
              className={cn(
                "p-1.5 rounded-md",
                "text-muted-foreground hover:text-destructive",
                "hover:bg-destructive/10",
                "transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              aria-label="コメントを削除"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </header>

        <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
          {comment.content}
        </p>
      </div>
    </article>
  );
}
