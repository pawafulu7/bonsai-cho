import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GalleryImage } from "@/types/gallery";
import { GalleryThumbnailItem } from "./GalleryThumbnailItem";

interface SortableGalleryThumbnailItemProps {
  image: GalleryImage;
  isSelected: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

/**
 * SortableGalleryThumbnailItem - Draggable thumbnail wrapper
 *
 * Wraps GalleryThumbnailItem with dnd-kit sortable functionality.
 * Shows drag handle on hover/focus.
 */
export function SortableGalleryThumbnailItem({
  image,
  isSelected,
  onClick,
  disabled = false,
}: SortableGalleryThumbnailItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: image.id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("relative group/sortable", isDragging && "z-50 opacity-80")}
    >
      {/* Drag handle - visible on hover/focus when not disabled */}
      {!disabled && (
        <button
          type="button"
          className={cn(
            "absolute -left-1 top-1/2 -translate-y-1/2 z-10",
            "w-6 h-8 rounded-sm",
            "bg-background/90 backdrop-blur-sm border border-border",
            "flex items-center justify-center",
            "text-muted-foreground",
            "opacity-0 group-hover/sortable:opacity-100 focus:opacity-100",
            "transition-opacity duration-150",
            "cursor-grab active:cursor-grabbing",
            // Touch-friendly
            "touch-none",
            // Focus styles
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
          aria-label={`Drag to reorder ${image.caption || "image"}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>
      )}

      <GalleryThumbnailItem
        image={image}
        isSelected={isSelected}
        onClick={onClick}
      />
    </div>
  );
}
