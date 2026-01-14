import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import type { GalleryImage } from "@/types/gallery";
import { SortableGalleryThumbnailItem } from "./SortableGalleryThumbnailItem";

interface SortableGalleryThumbnailListProps {
  images: GalleryImage[];
  selectedId?: string;
  onSelect?: (image: GalleryImage) => void;
  onReorder?: (images: GalleryImage[]) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * SortableGalleryThumbnailList - Drag-and-drop reorderable thumbnail list
 *
 * Desktop only: Vertical sortable list with drag handles.
 * Mobile shows non-sortable horizontal scroll (sorting on mobile is UX-problematic).
 *
 * Uses dnd-kit for accessible drag-and-drop with keyboard support.
 */
export function SortableGalleryThumbnailList({
  images,
  selectedId,
  onSelect,
  onReorder,
  disabled = false,
  className,
}: SortableGalleryThumbnailListProps) {
  // Configure sensors for pointer and keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        // Require 8px movement to start dragging (prevents accidental drags)
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = images.findIndex((img) => img.id === active.id);
      const newIndex = images.findIndex((img) => img.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newImages = arrayMove(images, oldIndex, newIndex);
        onReorder?.(newImages);
      }
    }
  };

  if (images.length === 0) {
    return null;
  }

  const imageIds = images.map((img) => img.id);

  return (
    <>
      {/* Desktop: Sortable vertical list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      >
        <SortableContext
          items={imageIds}
          strategy={verticalListSortingStrategy}
        >
          <nav
            className={cn(
              "hidden lg:flex lg:flex-col lg:gap-3",
              "lg:min-h-[280px]",
              // Extra padding for drag handles
              "lg:pl-2",
              className
            )}
            aria-label="Bonsai image thumbnails (drag to reorder)"
          >
            {images.map((image) => (
              <SortableGalleryThumbnailItem
                key={image.id}
                image={image}
                isSelected={selectedId === image.id}
                onClick={() => onSelect?.(image)}
                disabled={disabled}
              />
            ))}
          </nav>
        </SortableContext>
      </DndContext>

      {/* Mobile: Non-sortable horizontal scroll */}
      <nav
        className={cn(
          "flex gap-2 lg:hidden",
          "overflow-x-auto",
          "snap-x snap-mandatory",
          "scrollbar-none",
          "pb-2 -mb-2",
          className
        )}
        aria-label="Bonsai image thumbnails"
      >
        {images.map((image) => (
          <div key={image.id} className="flex-shrink-0 w-20 snap-start">
            <button
              type="button"
              onClick={() => onSelect?.(image)}
              className={cn(
                "relative w-20 h-20 rounded-md overflow-hidden",
                "bg-muted",
                "transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                selectedId === image.id && "ring-2 ring-primary ring-offset-2"
              )}
              aria-label={image.caption || "Thumbnail"}
              aria-pressed={selectedId === image.id}
            >
              <img
                src={image.thumbnailUrl || image.imageUrl}
                alt={image.caption || "Bonsai thumbnail"}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </button>
          </div>
        ))}
      </nav>
    </>
  );
}
