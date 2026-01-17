import { Heart, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BonsaiCardProps } from "@/types/social";

/**
 * BonsaiCard - Card component for bonsai list display
 *
 * Features:
 * - Asymmetric border-radius for organic feel (rounded-tl-xl rounded-br-xl)
 * - Left accent border (border-l-4 border-primary)
 * - Like and comment count badges
 * - Hover animation (translateY + shadow)
 * - Accessible with proper semantics
 */
export function BonsaiCard({
  id,
  name,
  description,
  thumbnailUrl,
  speciesNameJa,
  styleNameJa,
  likeCount,
  commentCount,
  className,
}: BonsaiCardProps) {
  // Placeholder for no image
  const imageSrc = thumbnailUrl || "/images/placeholder-bonsai.svg";

  return (
    <article
      className={cn(
        // Base styles
        "bg-card rounded-tl-xl rounded-br-xl",
        "p-0 shadow-card overflow-hidden",
        "border-l-4 border-primary",
        // Hover effects
        "hover:shadow-xl hover:translate-y-[-2px]",
        "transition-all duration-200",
        "cursor-pointer",
        // Focus styles for keyboard navigation
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        className
      )}
    >
      <a
        href={`/bonsai/${id}`}
        className="block focus:outline-none"
        aria-label={`${name}の詳細を見る`}
      >
        {/* Image Container */}
        <div className="aspect-[4/3] relative bg-muted">
          <img
            src={imageSrc}
            alt={`${name}のサムネイル画像`}
            className="object-cover w-full h-full"
            loading="lazy"
            decoding="async"
          />

          {/* Social Stats Badge */}
          {(likeCount > 0 || commentCount > 0) && (
            <div
              className={cn(
                "absolute bottom-2 right-2",
                "bg-white/90 backdrop-blur-sm",
                "rounded-full px-2 py-1",
                "flex items-center gap-2",
                "text-sm"
              )}
              aria-hidden="true"
            >
              {likeCount > 0 && (
                <span className="flex items-center gap-1 text-red-500">
                  <Heart className="w-3.5 h-3.5 fill-current" />
                  <span className="tabular-nums">{likeCount}</span>
                </span>
              )}
              {commentCount > 0 && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span className="tabular-nums">{commentCount}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-2">
          <h3 className="font-serif text-lg font-bold text-foreground line-clamp-1">
            {name}
          </h3>

          {/* Species and Style */}
          {(speciesNameJa || styleNameJa) && (
            <p className="text-sm text-muted-foreground">
              {[speciesNameJa, styleNameJa].filter(Boolean).join(" / ")}
            </p>
          )}

          {/* Description */}
          {description && (
            <p className="text-muted-foreground text-sm line-clamp-2">
              {description}
            </p>
          )}
        </div>
      </a>
    </article>
  );
}
