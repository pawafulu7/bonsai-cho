import { useCallback, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { UpdateProfileResponse, UserProfile } from "@/types/user";

interface ProfileEditDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Current profile data */
  profile: UserProfile;
  /** CSRF token for mutation */
  csrfToken?: string;
  /** Callback on successful update */
  onSuccess?: (profile: UpdateProfileResponse) => void;
}

interface FormErrors {
  displayName?: string;
  bio?: string;
  location?: string;
  website?: string;
}

/**
 * ProfileEditDialog - Modal dialog for editing user profile
 *
 * Features:
 * - Radix Dialog with focus trap
 * - Form validation with error messages
 * - aria-describedby for error messages
 * - Server-side update with loading state
 * - Return focus to trigger after close
 */
export function ProfileEditDialog({
  open,
  onOpenChange,
  profile,
  csrfToken,
  onSuccess,
}: ProfileEditDialogProps) {
  const [displayName, setDisplayName] = useState(profile.displayName || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [location, setLocation] = useState(profile.location || "");
  const [website, setWebsite] = useState(profile.website || "");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Generate unique IDs for accessibility
  const formId = useId();
  const displayNameId = `${formId}-displayName`;
  const bioId = `${formId}-bio`;
  const locationId = `${formId}-location`;
  const websiteId = `${formId}-website`;
  const displayNameErrorId = `${formId}-displayName-error`;
  const bioErrorId = `${formId}-bio-error`;
  const locationErrorId = `${formId}-location-error`;
  const websiteErrorId = `${formId}-website-error`;

  // Validate form
  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (displayName.length > 50) {
      newErrors.displayName = "表示名は50文字以内で入力してください";
    }

    if (bio.length > 500) {
      newErrors.bio = "自己紹介は500文字以内で入力してください";
    }

    if (location.length > 100) {
      newErrors.location = "場所は100文字以内で入力してください";
    }

    if (website.length > 200) {
      newErrors.website = "ウェブサイトURLは200文字以内で入力してください";
    } else if (
      website &&
      !website.startsWith("https://") &&
      !website.startsWith("http://")
    ) {
      newErrors.website = "URLはhttps://またはhttp://で始めてください";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [displayName, bio, location, website]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/users/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        credentials: "include",
        body: JSON.stringify({
          displayName: displayName.trim() || null,
          bio: bio.trim() || null,
          location: location.trim() || null,
          website: website.trim() || null,
        }),
      });

      if (!response.ok) {
        let errorMessage = "プロフィールの更新に失敗しました";
        try {
          const data = await response.json();
          if (data.error) {
            errorMessage = data.error;
          }
        } catch {
          // JSON parse failed, use default message
        }
        throw new Error(errorMessage);
      }

      const data: UpdateProfileResponse = await response.json();
      onSuccess?.(data);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "プロフィールの更新に失敗しました"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      // Reset to current profile values
      setDisplayName(profile.displayName || "");
      setBio(profile.bio || "");
      setLocation(profile.location || "");
      setWebsite(profile.website || "");
      setErrors({});
      setSubmitError(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-serif">プロフィールを編集</DialogTitle>
          <DialogDescription>
            プロフィール情報を更新できます。変更は保存後に反映されます。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor={displayNameId}>表示名</Label>
            <Input
              id={displayNameId}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="表示名を入力"
              maxLength={50}
              aria-invalid={!!errors.displayName}
              aria-describedby={
                errors.displayName ? displayNameErrorId : undefined
              }
            />
            {errors.displayName && (
              <p
                id={displayNameErrorId}
                className="text-sm text-destructive"
                role="alert"
              >
                {errors.displayName}
              </p>
            )}
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label htmlFor={bioId}>自己紹介</Label>
            <Textarea
              id={bioId}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="自己紹介を入力"
              maxLength={500}
              rows={4}
              aria-invalid={!!errors.bio}
              aria-describedby={errors.bio ? bioErrorId : undefined}
            />
            <p className="text-xs text-muted-foreground text-right">
              {bio.length}/500
            </p>
            {errors.bio && (
              <p
                id={bioErrorId}
                className="text-sm text-destructive"
                role="alert"
              >
                {errors.bio}
              </p>
            )}
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor={locationId}>場所</Label>
            <Input
              id={locationId}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="例: 東京, 日本"
              maxLength={100}
              aria-invalid={!!errors.location}
              aria-describedby={errors.location ? locationErrorId : undefined}
            />
            {errors.location && (
              <p
                id={locationErrorId}
                className="text-sm text-destructive"
                role="alert"
              >
                {errors.location}
              </p>
            )}
          </div>

          {/* Website */}
          <div className="space-y-2">
            <Label htmlFor={websiteId}>ウェブサイト</Label>
            <Input
              id={websiteId}
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              maxLength={200}
              aria-invalid={!!errors.website}
              aria-describedby={errors.website ? websiteErrorId : undefined}
            />
            {errors.website && (
              <p
                id={websiteErrorId}
                className="text-sm text-destructive"
                role="alert"
              >
                {errors.website}
              </p>
            )}
          </div>

          {/* Submit error */}
          {submitError && (
            <p className="text-sm text-destructive" role="alert">
              {submitError}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
