import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getCurrentDate } from "@/lib/utils/form-helpers";
import { MultiImageDropzone } from "./MultiImageDropzone";
import type { Species, Style } from "./useBonsaiForm";
import { useUnifiedBonsaiForm } from "./useUnifiedBonsaiForm";

/**
 * Props for UnifiedBonsaiForm component
 */
export interface UnifiedBonsaiFormProps {
  /** CSRF token for API requests */
  csrfToken: string;
  /** List of available species */
  speciesList: Species[];
  /** List of available styles */
  styleList: Style[];
  /** Whether details section is initially expanded */
  initialExpanded?: boolean;
  /** Maximum number of images allowed */
  maxImages?: number;
  /** Callback on successful submit - receives bonsai ID */
  onSuccess?: (bonsaiId: string) => void;
  /** Callback when cancel button is clicked */
  onCancel?: () => void;
  /** Class name for the form container */
  className?: string;
}

/**
 * Field error message component
 */
function FieldError({
  id,
  message,
}: {
  id: string;
  message: string | undefined;
}) {
  if (!message) return null;

  return (
    <p id={id} role="alert" className="mt-1 text-sm text-destructive">
      {message}
    </p>
  );
}

/**
 * Chevron icon for collapsible trigger
 */
function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(
        "transition-transform duration-200",
        isOpen && "rotate-180"
      )}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

const NOTES_MAX_LENGTH = 500;

/**
 * UnifiedBonsaiForm - Progressive disclosure form for bonsai registration
 *
 * Features:
 * - Multiple image upload (optional, up to maxImages)
 * - Basic info: name (required), notes (optional)
 * - Collapsible details section for advanced fields
 * - 2-stage submission: create bonsai → upload images
 * - Progress tracking for multi-image upload
 * - Accessible with keyboard navigation
 */
export function UnifiedBonsaiForm({
  csrfToken,
  speciesList,
  styleList,
  initialExpanded = false,
  maxImages = 5,
  onSuccess,
  onCancel,
  className,
}: UnifiedBonsaiFormProps) {
  const formId = useId();
  const [isDetailsOpen, setIsDetailsOpen] = useState(initialExpanded);

  const {
    formState,
    errors,
    progress,
    setImages,
    setName,
    setNotes,
    setSpeciesId,
    setStyleId,
    setAcquiredAt,
    setEstimatedAge,
    setHeight,
    setWidth,
    setPotDetails,
    setIsPublic,
    handleSubmit,
    isSubmitting,
    canSubmit,
    progressMessage,
  } = useUnifiedBonsaiForm({
    csrfToken,
    speciesList,
    styleList,
    maxImages,
    onSuccess,
  });

  // Generate unique IDs for accessibility
  const nameId = `${formId}-name`;
  const notesId = `${formId}-notes`;
  const speciesSelectId = `${formId}-species`;
  const styleSelectId = `${formId}-style`;
  const acquiredAtId = `${formId}-acquiredAt`;
  const estimatedAgeId = `${formId}-estimatedAge`;
  const heightId = `${formId}-height`;
  const widthId = `${formId}-width`;
  const potDetailsId = `${formId}-potDetails`;
  const isPublicId = `${formId}-isPublic`;
  const detailsSectionId = `${formId}-details`;
  const detailsTriggerId = `${formId}-details-trigger`;

  const nameErrorId = `${nameId}-error`;
  const notesErrorId = `${notesId}-error`;
  const acquiredAtErrorId = `${acquiredAtId}-error`;
  const estimatedAgeErrorId = `${estimatedAgeId}-error`;
  const heightErrorId = `${heightId}-error`;
  const widthErrorId = `${widthId}-error`;

  const maxDate = getCurrentDate();

  const onFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSubmit();
  };

  return (
    <form
      onSubmit={onFormSubmit}
      className={cn("space-y-6", className)}
      aria-label="盆栽登録フォーム"
    >
      {/* General Error */}
      {errors.general && (
        <div
          role="alert"
          className="rounded-lg bg-destructive/10 p-4 text-destructive"
        >
          {errors.general}
        </div>
      )}

      {/* Progress Message */}
      {progressMessage && progress !== "error" && (
        <output
          aria-live="polite"
          className="block rounded-lg bg-primary/10 p-4 text-primary"
        >
          <div className="flex items-center gap-2">
            {isSubmitting && (
              <svg
                className="h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            {progressMessage}
          </div>
        </output>
      )}

      {/* Image Upload Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium">
            写真
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              (任意)
            </span>
          </Label>
        </div>
        <MultiImageDropzone
          selectedImages={formState.images}
          onImagesChange={setImages}
          maxImages={maxImages}
          disabled={isSubmitting}
          error={errors.images}
        />
      </div>

      {/* Basic Info Section */}
      <div className="space-y-4">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor={nameId}>
            名前 <span className="text-destructive">*</span>
          </Label>
          <Input
            id={nameId}
            type="text"
            value={formState.name}
            onChange={(e) => setName(e.target.value)}
            aria-required="true"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? nameErrorId : undefined}
            placeholder="盆栽の名前"
            maxLength={100}
            disabled={isSubmitting}
          />
          <FieldError id={nameErrorId} message={errors.name} />
        </div>

        {/* Notes (Memo) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor={notesId}>メモ</Label>
            <span className="text-xs text-muted-foreground">
              {formState.notes.length}/{NOTES_MAX_LENGTH}
            </span>
          </div>
          <Textarea
            id={notesId}
            value={formState.notes}
            onChange={(e) => setNotes(e.target.value)}
            aria-invalid={!!errors.notes}
            aria-describedby={errors.notes ? notesErrorId : undefined}
            placeholder="樹種、入手先、育て方のメモなど"
            rows={3}
            maxLength={NOTES_MAX_LENGTH}
            disabled={isSubmitting}
          />
          <FieldError id={notesErrorId} message={errors.notes} />
        </div>
      </div>

      {/* Collapsible Details Section */}
      <Collapsible open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <CollapsibleTrigger
          id={detailsTriggerId}
          aria-controls={detailsSectionId}
          className="flex w-full items-center justify-between rounded-lg border bg-muted/50 px-4 py-3 text-left transition-colors hover:bg-muted"
          disabled={isSubmitting}
        >
          <span className="font-medium text-foreground">詳細情報を入力</span>
          <ChevronIcon isOpen={isDetailsOpen} />
        </CollapsibleTrigger>

        <CollapsibleContent
          id={detailsSectionId}
          aria-labelledby={detailsTriggerId}
          className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden"
        >
          <div className="space-y-4 pt-4">
            {/* Species & Style */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Species */}
              <div className="space-y-2">
                <Label htmlFor={speciesSelectId}>樹種</Label>
                <Select
                  value={formState.speciesId || "__none__"}
                  onValueChange={(value) =>
                    setSpeciesId(value === "__none__" ? "" : value)
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger id={speciesSelectId}>
                    <SelectValue placeholder="樹種を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">選択なし</SelectItem>
                    {speciesList.length === 0 ? (
                      <SelectItem value="__empty__" disabled>
                        選択肢がありません
                      </SelectItem>
                    ) : (
                      speciesList.map((s: Species) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.nameJa}
                          {s.nameScientific && (
                            <span className="ml-2 text-muted-foreground">
                              ({s.nameScientific})
                            </span>
                          )}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Style */}
              <div className="space-y-2">
                <Label htmlFor={styleSelectId}>樹形</Label>
                <Select
                  value={formState.styleId || "__none__"}
                  onValueChange={(value) =>
                    setStyleId(value === "__none__" ? "" : value)
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger id={styleSelectId}>
                    <SelectValue placeholder="樹形を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">選択なし</SelectItem>
                    {styleList.length === 0 ? (
                      <SelectItem value="__empty__" disabled>
                        選択肢がありません
                      </SelectItem>
                    ) : (
                      styleList.map((s: Style) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.nameJa}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Acquired At & Estimated Age */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Acquired At */}
              <div className="space-y-2">
                <Label htmlFor={acquiredAtId}>入手日</Label>
                <Input
                  id={acquiredAtId}
                  type="date"
                  value={formState.acquiredAt}
                  onChange={(e) => setAcquiredAt(e.target.value)}
                  onFocus={(e) => {
                    e.currentTarget.max = getCurrentDate();
                  }}
                  max={maxDate}
                  aria-invalid={!!errors.acquiredAt}
                  aria-describedby={
                    errors.acquiredAt ? acquiredAtErrorId : undefined
                  }
                  disabled={isSubmitting}
                />
                <FieldError
                  id={acquiredAtErrorId}
                  message={errors.acquiredAt}
                />
              </div>

              {/* Estimated Age */}
              <div className="space-y-2">
                <Label htmlFor={estimatedAgeId}>推定樹齢</Label>
                <div className="relative">
                  <Input
                    id={estimatedAgeId}
                    type="number"
                    value={formState.estimatedAge}
                    onChange={(e) => setEstimatedAge(e.target.value)}
                    min={0}
                    max={1000}
                    aria-invalid={!!errors.estimatedAge}
                    aria-describedby={
                      errors.estimatedAge ? estimatedAgeErrorId : undefined
                    }
                    placeholder="0"
                    className="pr-8"
                    disabled={isSubmitting}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    年
                  </span>
                </div>
                <FieldError
                  id={estimatedAgeErrorId}
                  message={errors.estimatedAge}
                />
              </div>
            </div>

            {/* Height & Width */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Height */}
              <div className="space-y-2">
                <Label htmlFor={heightId}>高さ</Label>
                <div className="relative">
                  <Input
                    id={heightId}
                    type="number"
                    value={formState.height}
                    onChange={(e) => setHeight(e.target.value)}
                    min={0.1}
                    max={500}
                    step="0.1"
                    aria-invalid={!!errors.height}
                    aria-describedby={errors.height ? heightErrorId : undefined}
                    placeholder="0.1"
                    className="pr-10"
                    disabled={isSubmitting}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    cm
                  </span>
                </div>
                <FieldError id={heightErrorId} message={errors.height} />
              </div>

              {/* Width */}
              <div className="space-y-2">
                <Label htmlFor={widthId}>幅</Label>
                <div className="relative">
                  <Input
                    id={widthId}
                    type="number"
                    value={formState.width}
                    onChange={(e) => setWidth(e.target.value)}
                    min={0.1}
                    max={500}
                    step="0.1"
                    aria-invalid={!!errors.width}
                    aria-describedby={errors.width ? widthErrorId : undefined}
                    placeholder="0.1"
                    className="pr-10"
                    disabled={isSubmitting}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    cm
                  </span>
                </div>
                <FieldError id={widthErrorId} message={errors.width} />
              </div>
            </div>

            {/* Pot Details */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={potDetailsId}>鉢の詳細</Label>
                <span className="text-xs text-muted-foreground">
                  {formState.potDetails.length}/500
                </span>
              </div>
              <Textarea
                id={potDetailsId}
                value={formState.potDetails}
                onChange={(e) => setPotDetails(e.target.value)}
                placeholder="鉢の種類、サイズ、作家名など"
                rows={2}
                maxLength={500}
                disabled={isSubmitting}
              />
            </div>

            {/* Public Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor={isPublicId} className="cursor-pointer">
                  公開する
                </Label>
                <p className="text-sm text-muted-foreground">
                  {formState.isPublic
                    ? "この盆栽は他のユーザーに公開されます"
                    : "この盆栽は非公開です（自分のみ閲覧可能）"}
                </p>
              </div>
              <Switch
                id={isPublicId}
                checked={formState.isPublic}
                onCheckedChange={setIsPublic}
                aria-label="公開設定"
                disabled={isSubmitting}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Form Actions */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            キャンセル
          </Button>
        )}
        <Button type="submit" disabled={!canSubmit}>
          {isSubmitting ? "登録中..." : "登録する"}
        </Button>
      </div>

      {/* Helper text */}
      <p className="text-center text-xs text-muted-foreground">
        詳細情報は登録後にも追加・編集できます
      </p>
    </form>
  );
}
