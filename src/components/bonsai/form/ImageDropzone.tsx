import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { IMAGE_LIMITS } from "@/lib/env";
import { cn } from "@/lib/utils";

/**
 * Props for ImageDropzone component
 */
export interface ImageDropzoneProps {
  /** Callback when image is selected */
  onImageSelect: (file: File) => void;
  /** Currently selected image for preview */
  selectedImage?: File | null;
  /** Callback to clear selected image */
  onClear?: () => void;
  /** Whether the dropzone is disabled */
  disabled?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Additional class names */
  className?: string;
}

/**
 * Validate file type and size
 */
function validateFile(file: File): string | null {
  // Check file type
  const allowedTypes = IMAGE_LIMITS.allowedMimeTypes as readonly string[];
  if (!allowedTypes.includes(file.type)) {
    return `${file.type || "unknown"} はサポートされていません。JPEG, PNG, WebP のみ対応しています。`;
  }

  // Check file size
  if (file.size > IMAGE_LIMITS.maxFileSizeBytes) {
    const maxMB = IMAGE_LIMITS.maxFileSizeBytes / (1024 * 1024);
    return `ファイルサイズが大きすぎます。${maxMB}MB以下のファイルを選択してください。`;
  }

  return null;
}

/**
 * ImageDropzone - Drag and drop image upload component
 *
 * Features:
 * - Drag and drop support
 * - File input fallback
 * - Mobile camera capture (capture="environment")
 * - Image preview
 * - Validation (type, size)
 * - Accessible with keyboard navigation
 */
export function ImageDropzone({
  onImageSelect,
  selectedImage,
  onClear,
  disabled = false,
  error,
  className,
}: ImageDropzoneProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const helpId = `${inputId}-help`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Generate preview URL when image changes
  const updatePreview = useCallback(
    (file: File | null) => {
      // Revoke previous URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      if (file) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }
    },
    [previewUrl]
  );

  // Cleanup object URL on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Handle file selection
  const handleFileSelect = useCallback(
    (file: File) => {
      setValidationError(null);

      const error = validateFile(file);
      if (error) {
        setValidationError(error);
        return;
      }

      updatePreview(file);
      onImageSelect(file);
    },
    [onImageSelect, updatePreview]
  );

  // Handle input change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
      // Reset input value to allow selecting same file again
      e.target.value = "";
    },
    [handleFileSelect]
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

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [disabled, handleFileSelect]
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

  // Handle clear
  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setValidationError(null);
      updatePreview(null);
      onClear?.();
    },
    [onClear, updatePreview]
  );

  const displayError = error || validationError;
  const hasImage = selectedImage && previewUrl;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Hidden file input */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={IMAGE_LIMITS.allowedMimeTypes.join(",")}
        capture="environment"
        onChange={handleInputChange}
        disabled={disabled}
        className="sr-only"
        aria-describedby={displayError ? errorId : undefined}
      />

      {/* Dropzone area - uses div with role="button" to support drag-and-drop functionality */}
      {/* biome-ignore lint/a11y/useSemanticElements: Dropzone requires div for drag-and-drop support */}
      <div
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={
          hasImage
            ? `選択中: ${selectedImage.name}。クリックまたはドラッグで画像を変更`
            : "画像をアップロード。クリックまたはドラッグで選択"
        }
        aria-describedby={displayError ? errorId : helpId}
        aria-disabled={disabled}
        className={cn(
          "relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
          isDragging && "border-primary bg-primary/5",
          displayError && "border-destructive",
          disabled && "cursor-not-allowed opacity-50",
          !isDragging &&
            !displayError &&
            "border-muted-foreground/25 hover:border-primary hover:bg-primary/10 transition-colors duration-150"
        )}
      >
        {hasImage ? (
          // Image preview
          <div className="relative h-full w-full">
            <img
              src={previewUrl}
              alt="選択された画像のプレビュー"
              className="h-full w-full rounded-lg object-contain p-2"
              style={{ maxHeight: "300px" }}
            />
            {/* Clear button */}
            {onClear && !disabled && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleClear}
                className="absolute right-2 top-2"
                aria-label="画像を削除"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
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
              </Button>
            )}
            {/* Change image overlay */}
            {!disabled && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 opacity-0 transition-opacity hover:bg-black/30 hover:opacity-100">
                <span className="rounded-md bg-white/90 px-3 py-1.5 text-sm font-medium text-foreground">
                  画像を変更
                </span>
              </div>
            )}
          </div>
        ) : (
          // Empty state
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            {/* Camera icon */}
            <div className="rounded-full bg-muted p-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
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
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                写真をアップロード
              </p>
              <p className="text-xs text-muted-foreground">
                ドラッグ&ドロップまたはクリックして選択
              </p>
              <p className="text-xs text-muted-foreground" aria-hidden="true">
                JPEG, PNG, WebP (最大10MB)
              </p>
            </div>

            {/* Upload button for mobile */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              className="mt-2"
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-2"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" x2="12" y1="3" y2="15" />
              </svg>
              ファイルを選択
            </Button>
          </div>
        )}
      </div>

      {/* Help text for screen readers (always available) */}
      <p id={helpId} className="sr-only">
        JPEG、PNG、WebP形式。最大10MB。ドラッグ&ドロップまたはクリックで選択できます。
      </p>

      {/* Error message */}
      {displayError && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {displayError}
        </p>
      )}
    </div>
  );
}
