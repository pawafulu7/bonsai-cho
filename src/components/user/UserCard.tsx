import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { UserCardProps } from "@/types/user";
import { FollowButton } from "./FollowButton";

/**
 * UserCard - Card component for user lists (followers/following)
 *
 * Features:
 * - BonsaiCard visual pattern (asymmetric radius, left border)
 * - Card is navigable via anchor (no nested interactive elements)
 * - FollowButton positioned separately to avoid a11y issues
 * - Hover animation
 */
export function UserCard({
  id,
  name,
  displayName,
  avatarUrl,
  isFollowing,
  csrfToken,
  showFollowButton = true,
  className,
}: UserCardProps) {
  // Get display name with fallback
  const userDisplayName = displayName || name;

  // Get initials for avatar fallback
  const initials = userDisplayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <article
      className={cn(
        // Base styles (BonsaiCard pattern)
        "bg-card rounded-tl-xl rounded-br-xl",
        "p-4 shadow-card overflow-hidden",
        "border-l-4 border-primary",
        // Hover effects
        "hover:shadow-xl hover:translate-y-[-2px]",
        "transition-all duration-200",
        // Focus styles for keyboard navigation
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        // Relative positioning for absolute button
        "relative",
        className
      )}
    >
      {/* Main content area - clickable link */}
      <a
        href={`/users/${id}`}
        className={cn(
          "flex items-center gap-4 focus:outline-none",
          // Add padding-right to make room for follow button
          showFollowButton && isFollowing !== undefined && "pr-24"
        )}
        aria-label={`${userDisplayName}のプロフィールを見る`}
      >
        {/* Avatar */}
        <Avatar className="w-12 h-12 border border-primary/20 shrink-0">
          <AvatarImage src={avatarUrl || undefined} alt={userDisplayName} />
          <AvatarFallback className="font-serif text-primary bg-primary/10">
            {initials}
          </AvatarFallback>
        </Avatar>

        {/* User info */}
        <div className="flex-1 min-w-0">
          <p className="font-serif font-bold text-foreground truncate">
            {userDisplayName}
          </p>
          <p className="text-sm text-muted-foreground truncate">@{name}</p>
        </div>
      </a>

      {/* Follow button - positioned absolutely to avoid nesting inside anchor */}
      {showFollowButton && isFollowing !== undefined && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <FollowButton
            userId={id}
            userName={userDisplayName}
            initialFollowing={isFollowing}
            csrfToken={csrfToken}
          />
        </div>
      )}
    </article>
  );
}
