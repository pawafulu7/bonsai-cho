import { useCallback, useEffect, useId, useRef, useState } from "react";
import { IMAGE_LIMITS } from "@/lib/env";
import { cn } from "@/lib/utils";

/**
 * Props for MultiImageDropzone component
 */
export interface MultiImageDropzoneProps {
  /** Currently selected image files */
  selectedImages: File[];
  /** Callback when images change */
  onImagesChange: (files: File[]) => void;
  /** Maximum number of images allowed */
  maxImages?: number;
  /** Whether the dropzone is disabled */
  disabled?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Additional class names */
  className?: string;
}

/**
 * Image preview item with remove button
 */
interface ImagePreviewProps {
  file: File;
  previewUrl: string;
  onRemove: () => void;
  disabled?: boolean;
}

function ImagePreview({
  file,
  previewUrl,
  onRemove,
  disabled,
}: ImagePreviewProps) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
      <img
        src={previewUrl}
        alt={`Preview: ${file.name}`}
        className="h-full w-full object-cover"
      />
      {!disabled && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100 focus:opacity-100"
          aria-label={`${file.name} を削除`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

/**
 * Validate file type and size
 */
function validateFile(file: File): string | null {
  const allowedTypes = IMAGE_LIMITS.allowedMimeTypes as readonly string[];
  if (!allowedTypes.includes(file.type)) {
    return `${file.type || "unknown"} はサポートされていません。JPEG, PNG, WebP のみ対応しています。`;
  }

  if (file.size > IMAGE_LIMITS.maxFileSizeBytes) {
    const maxMB = IMAGE_LIMITS.maxFileSizeBytes / (1024 * 1024);
    return `ファイルサイズが大きすぎます。${maxMB}MB以下のファイルを選択してください。`;
  }

  return null;
}

/**
 * MultiImageDropzone - Drag and drop multiple image upload component
 *
 * Features:
 * - Multiple file selection (up to maxImages)
 * - Drag and drop support
 * - Grid preview with remove buttons
 * - File input fallback
 * - Mobile camera capture
 * - Validation (type, size)
 * - Accessible with keyboard navigation
 */
export function MultiImageDropzone({
  selectedImages,
  onImagesChange,
  maxImages = 5,
  disabled = false,
  error,
  className,
}: MultiImageDropzoneProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const helpId = `${inputId}-help`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Map<File, string>>(new Map());

  // Generate preview URLs when images change
  useEffect(() => {
    setPreviewUrls((prevUrls) => {
      const newUrls = new Map<File, string>();
      const urlsToRevoke: string[] = [];

      // Keep existing URLs for files that are still selected
      for (const file of selectedImages) {
        const existingUrl = prevUrls.get(file);
        if (existingUrl) {
          newUrls.set(file, existingUrl);
        } else {
          newUrls.set(file, URL.createObjectURL(file));
        }
      }

      // Revoke URLs for removed files
      for (const [file, url] of prevUrls) {
        if (!selectedImages.includes(file)) {
          urlsToRevoke.push(url);
        }
      }

      // Cleanup revoked URLs (outside of state update to avoid side effects during render)
      setTimeout(() => {
        for (const url of urlsToRevoke) {
          URL.revokeObjectURL(url);
        }
      }, 0);

      return newUrls;
    });
  }, [selectedImages]);

  // Cleanup all URLs on unmount
  // biome-ignore lint/correctness/useExhaustiveDependencies: Cleanup only on unmount, uses ref pattern implicitly
  useEffect(() => {
    // Store current previewUrls reference for cleanup
    const urlsRef = previewUrls;
    return () => {
      for (const url of urlsRef.values()) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  // Handle file selection
  const handleFilesSelect = useCallback(
    (files: FileList | File[]) => {
      setValidationError(null);

      const fileArray = Array.from(files);
      const remainingSlots = maxImages - selectedImages.length;

      if (remainingSlots <= 0) {
        setValidationError(`画像は最大${maxImages}枚までです`);
        return;
      }

      const validFiles: File[] = [];
      for (const file of fileArray.slice(0, remainingSlots)) {
        const validationError = validateFile(file);
        if (validationError) {
          setValidationError(validationError);
          break;
        }
        validFiles.push(file);
      }

      if (validFiles.length > 0) {
        onImagesChange([...selectedImages, ...validFiles]);
      }
    },
    [selectedImages, onImagesChange, maxImages]
  );

  // Handle input change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFilesSelect(files);
      }
      // Reset input value to allow selecting same file again
      e.target.value = "";
    },
    [handleFilesSelect]
  );

  // Handle drag events
  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFilesSelect(files);
      }
    },
    [disabled, handleFilesSelect]
  );

  // Handle click to open file dialog
  const handleClick = useCallback(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.click();
    }
  }, [disabled]);

  // Handle keyboard interaction
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === " ") && !disabled) {
        e.preventDefault();
        inputRef.current?.click();
      }
    },
    [disabled]
  );

  // Handle remove image
  const handleRemove = useCallback(
    (fileToRemove: File) => {
      onImagesChange(selectedImages.filter((f) => f !== fileToRemove));
      setValidationError(null);
    },
    [selectedImages, onImagesChange]
  );

  const displayError = error || validationError;
  const hasImages = selectedImages.length > 0;
  const canAddMore = selectedImages.length < maxImages;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Hidden file input */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={IMAGE_LIMITS.allowedMimeTypes.join(",")}
        multiple
        capture="environment"
        onChange={handleInputChange}
        disabled={disabled || !canAddMore}
        className="sr-only"
        aria-describedby={displayError ? errorId : undefined}
      />

      {/* Image grid */}
      {hasImages && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {selectedImages.map((file, index) => {
            const url = previewUrls.get(file);
            if (!url) return null;
            return (
              <ImagePreview
                key={`${file.name}-${file.lastModified}-${index}`}
                file={file}
                previewUrl={url}
                onRemove={() => handleRemove(file)}
                disabled={disabled}
              />
            );
          })}

          {/* Add more button (inline) */}
          {canAddMore && !disabled && (
            <button
              type="button"
              onClick={handleClick}
              className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 transition-colors hover:border-primary hover:bg-primary/5"
              aria-label="画像を追加"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground"
                aria-hidden="true"
              >
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Empty state dropzone */}
      {!hasImages && (
        /* biome-ignore lint/a11y/useSemanticElements: Dropzone requires div for drag-and-drop support */
        <div
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="画像をアップロード。クリックまたはドラッグで選択"
          aria-describedby={displayError ? errorId : helpId}
          aria-disabled={disabled}
          className={cn(
            "relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors duration-150",
            "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
            isDragging && "border-primary bg-primary/5",
            displayError && "border-destructive",
            disabled && "cursor-not-allowed opacity-50",
            !isDragging &&
              !displayError &&
              "border-muted-foreground/25 hover:border-primary hover:bg-primary/5"
          )}
        >
          <div className="flex flex-col items-center gap-2 p-4 text-center">
            {/* Camera icon */}
            <div className="rounded-full bg-muted p-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground"
                aria-hidden="true"
              >
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
            </div>

            {/* Instructions */}
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">
                写真をアップロード
              </p>
              <p className="text-xs text-muted-foreground">
                ドラッグ&ドロップまたはクリック
              </p>
              <p className="text-xs text-muted-foreground" aria-hidden="true">
                JPEG, PNG, WebP (最大{maxImages}枚)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Help text for screen readers */}
      <p id={helpId} className="sr-only">
        JPEG、PNG、WebP形式。最大{maxImages}
        枚まで。ドラッグ&ドロップまたはクリックで選択できます。
      </p>

      {/* Counter and error */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {selectedImages.length}/{maxImages}枚
        </span>
        {displayError && (
          <p id={errorId} role="alert" className="text-destructive">
            {displayError}
          </p>
        )}
      </div>
    </div>
  );
}
