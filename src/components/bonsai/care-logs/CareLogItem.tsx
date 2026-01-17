import {
  CircleDot,
  Droplet,
  Flower2,
  GitBranch,
  Leaf,
  Scissors,
} from "lucide-react";
import { type CareType, careTypeConfig } from "@/lib/constants/care-types";
import { cn } from "@/lib/utils";
import type { CareLogItem as CareLogItemType } from "@/server/routes/bonsai.schema";

interface CareLogItemProps {
  log: CareLogItemType;
  className?: string;
}

// Icon component map
const iconComponents = {
  Droplet,
  Leaf,
  Scissors,
  Flower2,
  GitBranch,
  CircleDot,
} as const;

/**
 * CareLogItem - Single care log entry in timeline
 *
 * Features:
 * - Care type icon with color coding
 * - Semantic time element
 * - Optional description
 */
export function CareLogItem({ log, className }: CareLogItemProps) {
  const config = careTypeConfig[log.careType as CareType];
  const IconComponent =
    iconComponents[config.icon as keyof typeof iconComponents];

  // Format date
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
      weekday: "short",
    });
  };

  return (
    <li className={cn("ml-6 relative", className)}>
      {/* Timeline node */}
      <div
        className={cn(
          "absolute -left-[2.25rem] w-5 h-5 rounded-full",
          config.color,
          "flex items-center justify-center",
          "border-4 border-background shadow-sm"
        )}
        aria-hidden="true"
      >
        <IconComponent className="w-2.5 h-2.5 text-white" />
      </div>

      {/* Content card */}
      <article className="bg-card rounded-lg p-4 shadow-sm border border-border/50">
        <header className="flex items-center justify-between gap-2 flex-wrap">
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full",
              "bg-muted text-muted-foreground"
            )}
          >
            {config.label}
          </span>
          <time
            dateTime={log.performedAt}
            className="text-xs text-muted-foreground"
          >
            {formatDate(log.performedAt)}
          </time>
        </header>

        {log.description && (
          <p className="text-sm mt-2 text-foreground/90 whitespace-pre-wrap">
            {log.description}
          </p>
        )}

        {log.imageUrl && (
          <img
            src={log.imageUrl}
            alt={`${config.label}の記録写真`}
            className="mt-3 rounded-md max-h-48 object-cover"
            loading="lazy"
            decoding="async"
          />
        )}
      </article>
    </li>
  );
}
