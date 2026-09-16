'use client';

import * as React from 'react';
import { Tag, Check } from 'lucide-react';
import type { LabelDto } from '@sales-copilot/shared-contracts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { LABEL_PRESET_COLORS, isValidHexColor } from './constants/label-colors';
import { useCreateLabel, useUpdateLabel } from './hooks/use-labels';

interface LabelFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  labelToEdit?: LabelDto | null;
}

export function LabelFormDialog({
  open,
  onOpenChange,
  workspaceId,
  labelToEdit,
}: LabelFormDialogProps) {
  const isEditing = !!labelToEdit;

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [color, setColor] = React.useState('#2563eb');
  const [showOnSidebar, setShowOnSidebar] = React.useState(true);
  const [touched, setTouched] = React.useState(false);

  const { mutate: createLabel, isPending: isCreating } = useCreateLabel(workspaceId);
  const { mutate: updateLabel, isPending: isUpdating } = useUpdateLabel(workspaceId);

  const isPending = isCreating || isUpdating;

  // Initialize or reset form values
  React.useEffect(() => {
    if (open) {
      if (labelToEdit) {
        setTitle(labelToEdit.title);
        setDescription(labelToEdit.description || '');
        setColor(labelToEdit.color || '#2563eb');
        setShowOnSidebar(labelToEdit.showOnSidebar ?? true);
      } else {
        setTitle('');
        setDescription('');
        setColor('#2563eb');
        setShowOnSidebar(true);
      }
      setTouched(false);
    }
  }, [open, labelToEdit]);

  // Validation
  const trimmedTitle = title.trim();
  const titleError = React.useMemo(() => {
    if (!touched) return null;
    if (trimmedTitle.length === 0) {
      return 'Label title is required';
    }
    if (trimmedTitle.length > 50) {
      return 'Label title cannot exceed 50 characters';
    }
    return null;
  }, [trimmedTitle, touched]);

  const descError = React.useMemo(() => {
    if (description.length > 200) {
      return 'Description cannot exceed 200 characters';
    }
    return null;
  }, [description]);

  const colorError = React.useMemo(() => {
    if (!isValidHexColor(color)) {
      return 'Invalid color format (must be hex #RRGGBB)';
    }
    return null;
  }, [color]);

  const isValid = !titleError && !descError && !colorError && trimmedTitle.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!isValid || isPending) return;

    if (isEditing && labelToEdit) {
      updateLabel(
        {
          labelId: labelToEdit.id,
          dto: {
            title: trimmedTitle,
            description: description.trim() || null,
            color: color.trim().toLowerCase(),
            showOnSidebar,
          },
        },
        {
          onSuccess: () => onOpenChange(false),
        },
      );
    } else {
      createLabel(
        {
          title: trimmedTitle,
          description: description.trim() || null,
          color: color.trim().toLowerCase(),
          showOnSidebar,
        },
        {
          onSuccess: () => onOpenChange(false),
        },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Tag className="size-4 text-primary" />
              <DialogTitle className="text-sm font-semibold">
                {isEditing ? 'Edit Label' : 'Create New Label'}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              {isEditing
                ? 'Update label name, color theme, and sidebar visibility.'
                : 'Create a custom color label to tag and filter customer conversations.'}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="gap-4 py-1">
            {/* Title Field */}
            <Field data-invalid={!!titleError}>
              <FieldLabel htmlFor="label-title">Title</FieldLabel>
              <Input
                id="label-title"
                value={title}
                onChange={e => {
                  setTitle(e.target.value);
                  if (!touched) setTouched(true);
                }}
                placeholder="e.g. VIP Customer, Urgent, Billing Bug"
                maxLength={50}
                aria-invalid={!!titleError}
                required
                className="text-xs"
              />
              {titleError && <FieldError errors={[{ message: titleError }]} />}
            </Field>

            {/* Description Field */}
            <Field data-invalid={!!descError}>
              <FieldLabel htmlFor="label-desc">Description</FieldLabel>
              <Input
                id="label-desc"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Optional purpose for this label..."
                maxLength={200}
                className="text-xs"
              />
              <FieldDescription>
                Brief summary of when to apply this label (max 200 chars).
              </FieldDescription>
              {descError && <FieldError errors={[{ message: descError }]} />}
            </Field>

            {/* Color Selection Field */}
            <Field data-invalid={!!colorError}>
              <FieldLabel>Color Palette</FieldLabel>

              {/* Preset Swatches Grid */}
              <div className="grid grid-cols-6 gap-2">
                {LABEL_PRESET_COLORS.map(preset => {
                  const isSelected = color.toLowerCase() === preset.hex.toLowerCase();
                  return (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => setColor(preset.hex)}
                      title={preset.name}
                      style={{ backgroundColor: preset.hex }}
                      className={`flex size-7 items-center justify-center rounded-lg shadow-2xs transition-transform hover:scale-105 active:scale-95 ${
                        isSelected
                          ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
                          : 'ring-1 ring-black/10 dark:ring-white/10'
                      }`}
                    >
                      {isSelected && <Check className="size-3.5 text-white drop-shadow-sm" />}
                    </button>
                  );
                })}
              </div>

              {/* Custom Hex Input */}
              <div className="mt-2 flex items-center gap-2">
                <div className="relative flex size-8 shrink-0 items-center justify-center rounded-md border border-border shadow-2xs overflow-hidden">
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundColor: isValidHexColor(color) ? color : '#ffffff',
                    }}
                  />
                  <input
                    type="color"
                    value={isValidHexColor(color) ? color : '#2563eb'}
                    onChange={e => setColor(e.target.value)}
                    className="absolute inset-0 size-full opacity-0 cursor-pointer"
                    title="Choose custom color"
                  />
                </div>
                <Input
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  placeholder="#2563eb"
                  maxLength={7}
                  className="h-8 text-xs font-mono"
                />
              </div>

              {colorError && <FieldError errors={[{ message: colorError }]} />}
            </Field>

            {/* Live Preview Chip */}
            <Field>
              <FieldLabel>Live Preview</FieldLabel>
              <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/30 p-3">
                <div
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors shadow-2xs"
                  style={{
                    backgroundColor: isValidHexColor(color) ? `${color}18` : '#2563eb18',
                    borderColor: isValidHexColor(color) ? `${color}50` : '#2563eb50',
                    color: isValidHexColor(color) ? color : '#2563eb',
                  }}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{
                      backgroundColor: isValidHexColor(color) ? color : '#2563eb',
                    }}
                  />
                  <span>{trimmedTitle || 'Label Preview'}</span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  How this label will appear in conversation threads
                </span>
              </div>
            </Field>

            {/* Show on Sidebar Toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border/70 p-3 bg-muted/20">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-foreground">Show on Sidebar</span>
                <span className="text-[11px] text-muted-foreground">
                  Display this label in sidebar conversation filters.
                </span>
              </div>
              <Switch checked={showOnSidebar} onCheckedChange={setShowOnSidebar} />
            </div>
          </FieldGroup>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              size="sm"
              disabled={isPending || !trimmedTitle || !isValidHexColor(color)}
              className="text-xs font-medium"
            >
              {isPending ? (
                <>
                  <Spinner className="size-3.5" data-icon="inline-start" />
                  {isEditing ? 'Saving...' : 'Creating...'}
                </>
              ) : isEditing ? (
                'Save Changes'
              ) : (
                'Create Label'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
