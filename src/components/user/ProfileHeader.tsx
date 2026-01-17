import { LinkIcon, MapPin, Pencil } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProfileHeaderProps, UpdateProfileResponse } from "@/types/user";
import { FollowButton } from "./FollowButton";
import { ProfileEditDialog } from "./ProfileEditDialog";

/**
 * ProfileHeader - User profile header component
 *
 * Features:
 * - Avatar (96px / w-24 h-24)
 * - Display name and username
 * - Bio, location, website
 * - Stats: bonsaiCount, followerCount, followingCount
 * - Follow button (for others) or Edit button (for self)
 * - Responsive: vertical on mobile, horizontal on sm+
 * - tabular-nums for stat numbers
 */
export function ProfileHeader({
  profile,
  csrfToken,
  isAuthenticated,
  onProfileUpdate,
}: ProfileHeaderProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [currentProfile, setCurrentProfile] = useState(profile);

  // Get initials for avatar fallback
  const displayName = currentProfile.displayName || currentProfile.name;
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Handle profile update from dialog
  const handleProfileUpdate = (updated: UpdateProfileResponse) => {
    setCurrentProfile((prev) => ({
      ...prev,
      displayName: updated.displayName,
      bio: updated.bio,
      location: updated.location,
      website: updated.website,
    }));
    onProfileUpdate?.(updated);
    setIsEditOpen(false);
  };

  // Format website URL for display
  const formatWebsiteDisplay = (url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.hostname + (parsed.pathname !== "/" ? parsed.pathname : "");
    } catch {
      return url;
    }
  };

  return (
    <header className="space-y-6">
      {/* Main profile section */}
      <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
        {/* Avatar */}
        <Avatar className="w-24 h-24 border-2 border-primary/20">
          <AvatarImage
            src={currentProfile.avatarUrl || undefined}
            alt={`${displayName}のアバター`}
          />
          <AvatarFallback className="text-2xl font-serif text-primary bg-primary/10">
            {initials}
          </AvatarFallback>
        </Avatar>

        {/* Profile info */}
        <div className="flex-1 text-center sm:text-left space-y-4">
          {/* Name and action button row */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div>
              <h1 className="font-serif text-2xl font-bold text-foreground">
                {displayName}
              </h1>
              <p className="text-muted-foreground">@{currentProfile.name}</p>
            </div>

            {/* Action button */}
            <div className="sm:ml-auto">
              {currentProfile.isSelf ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditOpen(true)}
                  className="min-h-11 gap-2"
                >
                  <Pencil className="w-4 h-4" aria-hidden="true" />
                  プロフィールを編集
                </Button>
              ) : isAuthenticated && currentProfile.isFollowing !== null ? (
                <FollowButton
                  userId={currentProfile.id}
                  userName={displayName}
                  initialFollowing={currentProfile.isFollowing}
                  initialCount={currentProfile.followerCount}
                  csrfToken={csrfToken}
                />
              ) : null}
            </div>
          </div>

          {/* Bio */}
          {currentProfile.bio && (
            <p className="text-foreground whitespace-pre-wrap">
              {currentProfile.bio}
            </p>
          )}

          {/* Location and Website */}
          {(currentProfile.location || currentProfile.website) && (
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {currentProfile.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" aria-hidden="true" />
                  {currentProfile.location}
                </span>
              )}
              {currentProfile.website && (
                <a
                  href={currentProfile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <LinkIcon className="w-4 h-4" aria-hidden="true" />
                  {formatWebsiteDisplay(currentProfile.website)}
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <nav
        aria-label="プロフィール統計"
        className={cn(
          "flex justify-center sm:justify-start gap-6",
          "pt-4 border-t border-border"
        )}
      >
        <a
          href={`/users/${currentProfile.id}`}
          className="text-center hover:text-primary transition-colors"
        >
          <span className="block text-xl font-bold tabular-nums">
            {currentProfile.bonsaiCount}
          </span>
          <span className="text-sm text-muted-foreground">盆栽</span>
        </a>
        <a
          href={`/users/${currentProfile.id}/followers`}
          className="text-center hover:text-primary transition-colors"
        >
          <span className="block text-xl font-bold tabular-nums">
            {currentProfile.followerCount}
          </span>
          <span className="text-sm text-muted-foreground">フォロワー</span>
        </a>
        <a
          href={`/users/${currentProfile.id}/following`}
          className="text-center hover:text-primary transition-colors"
        >
          <span className="block text-xl font-bold tabular-nums">
            {currentProfile.followingCount}
          </span>
          <span className="text-sm text-muted-foreground">フォロー中</span>
        </a>
      </nav>

      {/* Edit Dialog */}
      {currentProfile.isSelf && (
        <ProfileEditDialog
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          profile={currentProfile}
          csrfToken={csrfToken}
          onSuccess={handleProfileUpdate}
        />
      )}
    </header>
  );
}
