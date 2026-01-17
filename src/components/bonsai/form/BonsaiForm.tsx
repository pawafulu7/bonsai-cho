import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { getCurrentDate } from "@/lib/utils/form-helpers";
import {
  useBonsaiForm,
  type Species,
  type Style,
  type UseBonsaiFormOptions,
} from "./useBonsaiForm";

/**
 * Props for BonsaiForm component
 */
export interface BonsaiFormProps
  extends Omit<UseBonsaiFormOptions, "onSuccess"> {
  /** Class name for the form container */
  className?: string;
  /** Callback on successful submit - receives bonsai ID */
  onSuccess?: (bonsaiId: string) => void;
  /** Callback when cancel button is clicked */
  onCancel?: () => void;
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
    <p id={id} role="alert" className="text-sm text-destructive mt-1">
      {message}
    </p>
  );
}

/**
 * BonsaiForm - Form for creating and editing bonsai
 *
 * Features:
 * - Create and edit modes
 * - Field validation on blur
 * - Accessible form with proper labeling
 * - Species and style dropdowns
 * - Public/private toggle
 * - Responsive layout
 */
export function BonsaiForm({
  className,
  initialData,
  csrfToken,
  speciesList,
  styleList,
  onSuccess,
  onCancel,
}: BonsaiFormProps) {
  const formId = useId();

  const {
    formData,
    setField,
    errors,
    validateField,
    clearError,
    isSubmitting,
    submitError,
    handleSubmit,
    isEditMode,
    isDirty,
    canSubmit,
  } = useBonsaiForm({
    initialData,
    csrfToken,
    speciesList,
    styleList,
    onSuccess,
  });

  // Generate unique IDs for accessibility
  const nameId = `${formId}-name`;
  const descriptionId = `${formId}-description`;
  const speciesId = `${formId}-species`;
  const styleId = `${formId}-style`;
  const acquiredAtId = `${formId}-acquiredAt`;
  const estimatedAgeId = `${formId}-estimatedAge`;
  const heightId = `${formId}-height`;
  const widthId = `${formId}-width`;
  const potDetailsId = `${formId}-potDetails`;
  const isPublicId = `${formId}-isPublic`;

  const nameErrorId = `${nameId}-error`;
  const descriptionErrorId = `${descriptionId}-error`;
  const acquiredAtErrorId = `${acquiredAtId}-error`;
  const estimatedAgeErrorId = `${estimatedAgeId}-error`;
  const heightErrorId = `${heightId}-error`;
  const widthErrorId = `${widthId}-error`;
  const potDetailsErrorId = `${potDetailsId}-error`;

  const maxDate = getCurrentDate();

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("space-y-8", className)}
      aria-label={isEditMode ? "盆栽編集フォーム" : "盆栽登録フォーム"}
    >
      {/* Submit Error */}
      {submitError && (
        <div
          role="alert"
          className="rounded-lg bg-destructive/10 p-4 text-destructive"
        >
          {submitError}
        </div>
      )}

      {/* Basic Info Section */}
      <fieldset className="space-y-4">
        <legend className="sr-only">基本情報</legend>
        <h3 className="font-serif text-lg font-semibold text-foreground">
          基本情報
        </h3>

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor={nameId}>
            名前 <span className="text-destructive">*</span>
          </Label>
          <Input
            id={nameId}
            type="text"
            value={formData.name}
            onChange={(e) => {
              setField("name", e.target.value);
              clearError("name");
            }}
            onBlur={() => validateField("name")}
            aria-required="true"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? nameErrorId : undefined}
            placeholder="盆栽の名前"
            maxLength={100}
          />
          <FieldError id={nameErrorId} message={errors.name} />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor={descriptionId}>説明</Label>
            <span className="text-xs text-muted-foreground">
              {formData.description.length}/2000
            </span>
          </div>
          <Textarea
            id={descriptionId}
            value={formData.description}
            onChange={(e) => {
              setField("description", e.target.value);
              clearError("description");
            }}
            onBlur={() => validateField("description")}
            aria-invalid={!!errors.description}
            aria-describedby={errors.description ? descriptionErrorId : undefined}
            placeholder="盆栽の説明、来歴、特徴など"
            rows={4}
            maxLength={2000}
          />
          <FieldError id={descriptionErrorId} message={errors.description} />
        </div>

        {/* Species & Style */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Species */}
          <div className="space-y-2">
            <Label htmlFor={speciesId}>樹種</Label>
            <Select
              value={formData.speciesId}
              onValueChange={(value) => setField("speciesId", value)}
            >
              <SelectTrigger id={speciesId}>
                <SelectValue placeholder="樹種を選択" />
              </SelectTrigger>
              <SelectContent>
                {speciesList.length === 0 ? (
                  <SelectItem value="" disabled>
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
            <Label htmlFor={styleId}>樹形</Label>
            <Select
              value={formData.styleId}
              onValueChange={(value) => setField("styleId", value)}
            >
              <SelectTrigger id={styleId}>
                <SelectValue placeholder="樹形を選択" />
              </SelectTrigger>
              <SelectContent>
                {styleList.length === 0 ? (
                  <SelectItem value="" disabled>
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
      </fieldset>

      {/* Details Section */}
      <fieldset className="space-y-4">
        <legend className="sr-only">詳細情報</legend>
        <h3 className="font-serif text-lg font-semibold text-foreground">
          詳細情報
        </h3>

        {/* Acquired At & Estimated Age */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Acquired At */}
          <div className="space-y-2">
            <Label htmlFor={acquiredAtId}>入手日</Label>
            <Input
              id={acquiredAtId}
              type="date"
              value={formData.acquiredAt}
              onChange={(e) => {
                setField("acquiredAt", e.target.value);
                clearError("acquiredAt");
              }}
              onBlur={() => validateField("acquiredAt")}
              max={maxDate}
              aria-invalid={!!errors.acquiredAt}
              aria-describedby={errors.acquiredAt ? acquiredAtErrorId : undefined}
            />
            <FieldError id={acquiredAtErrorId} message={errors.acquiredAt} />
          </div>

          {/* Estimated Age */}
          <div className="space-y-2">
            <Label htmlFor={estimatedAgeId}>推定樹齢</Label>
            <div className="relative">
              <Input
                id={estimatedAgeId}
                type="number"
                value={formData.estimatedAge}
                onChange={(e) => {
                  setField("estimatedAge", e.target.value);
                  clearError("estimatedAge");
                }}
                onBlur={() => validateField("estimatedAge")}
                min={0}
                max={1000}
                aria-invalid={!!errors.estimatedAge}
                aria-describedby={
                  errors.estimatedAge ? estimatedAgeErrorId : undefined
                }
                placeholder="0"
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                年
              </span>
            </div>
            <FieldError id={estimatedAgeErrorId} message={errors.estimatedAge} />
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
                value={formData.height}
                onChange={(e) => {
                  setField("height", e.target.value);
                  clearError("height");
                }}
                onBlur={() => validateField("height")}
                min={0}
                max={500}
                step="0.1"
                aria-invalid={!!errors.height}
                aria-describedby={errors.height ? heightErrorId : undefined}
                placeholder="0"
                className="pr-10"
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
                value={formData.width}
                onChange={(e) => {
                  setField("width", e.target.value);
                  clearError("width");
                }}
                onBlur={() => validateField("width")}
                min={0}
                max={500}
                step="0.1"
                aria-invalid={!!errors.width}
                aria-describedby={errors.width ? widthErrorId : undefined}
                placeholder="0"
                className="pr-10"
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
              {formData.potDetails.length}/500
            </span>
          </div>
          <Textarea
            id={potDetailsId}
            value={formData.potDetails}
            onChange={(e) => {
              setField("potDetails", e.target.value);
              clearError("potDetails");
            }}
            onBlur={() => validateField("potDetails")}
            aria-invalid={!!errors.potDetails}
            aria-describedby={errors.potDetails ? potDetailsErrorId : undefined}
            placeholder="鉢の種類、サイズ、作家名など"
            rows={2}
            maxLength={500}
          />
          <FieldError id={potDetailsErrorId} message={errors.potDetails} />
        </div>
      </fieldset>

      {/* Visibility Section */}
      <fieldset className="space-y-4">
        <legend className="sr-only">公開設定</legend>
        <h3 className="font-serif text-lg font-semibold text-foreground">
          公開設定
        </h3>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor={isPublicId} className="cursor-pointer">
              公開する
            </Label>
            <p className="text-sm text-muted-foreground">
              {formData.isPublic
                ? "この盆栽は他のユーザーに公開されます"
                : "この盆栽は非公開です（自分のみ閲覧可能）"}
            </p>
          </div>
          <Switch
            id={isPublicId}
            checked={formData.isPublic}
            onCheckedChange={(checked) => setField("isPublic", checked)}
            aria-label="公開設定"
          />
        </div>
      </fieldset>

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
        <Button type="submit" disabled={!canSubmit || isSubmitting}>
          {isSubmitting
            ? "保存中..."
            : isEditMode
              ? "変更を保存"
              : "盆栽を登録"}
        </Button>
      </div>

      {/* Dirty indicator for edit mode */}
      {isEditMode && !isDirty && (
        <p className="text-center text-sm text-muted-foreground">
          変更がありません
        </p>
      )}
    </form>
  );
}
