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
import { LABEL_PRESET_COLORS, isValidHexColor } from '../../constants/label-colors';
import { useCreateLabel, useUpdateLabel } from '../../hooks/use-labels';

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
      return 'Tiêu đề nhãn là bắt buộc';
    }
    if (trimmedTitle.length > 50) {
      return 'Tiêu đề nhãn không được vượt quá 50 ký tự';
    }
    return null;
  }, [trimmedTitle, touched]);

  const descError = React.useMemo(() => {
    if (description.length > 200) {
      return 'Mô tả không được vượt quá 200 ký tự';
    }
    return null;
  }, [description]);

  const colorError = React.useMemo(() => {
    if (!isValidHexColor(color)) {
      return 'Định dạng màu không hợp lệ (phải là mã hex #RRGGBB)';
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
                {isEditing ? 'Chỉnh sửa nhãn' : 'Tạo nhãn mới'}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              {isEditing
                ? 'Cập nhật tên nhãn, bảng màu và trạng thái hiển thị trên thanh bên.'
                : 'Tạo nhãn màu tùy chỉnh để gắn thẻ và lọc các cuộc trò chuyện của khách hàng.'}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="gap-4 py-1">
            {/* Title Field */}
            <Field data-invalid={!!titleError}>
              <FieldLabel htmlFor="label-title">Tiêu đề</FieldLabel>
              <Input
                id="label-title"
                value={title}
                onChange={e => {
                  setTitle(e.target.value);
                  if (!touched) setTouched(true);
                }}
                placeholder="Ví dụ: Khách hàng VIP, Khẩn cấp, Lỗi thanh toán"
                maxLength={50}
                aria-invalid={!!titleError}
                required
                className="text-xs"
              />
              {titleError && <FieldError errors={[{ message: titleError }]} />}
            </Field>

            {/* Description Field */}
            <Field data-invalid={!!descError}>
              <FieldLabel htmlFor="label-desc">Mô tả</FieldLabel>
              <Input
                id="label-desc"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Mục đích tùy chọn cho nhãn này..."
                maxLength={200}
                className="text-xs"
              />
              <FieldDescription>
                Tóm tắt ngắn gọn khi nào nên áp dụng nhãn này (tối đa 200 ký tự).
              </FieldDescription>
              {descError && <FieldError errors={[{ message: descError }]} />}
            </Field>

            {/* Color Selection Field */}
            <Field data-invalid={!!colorError}>
              <FieldLabel>Bảng màu</FieldLabel>

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
                    title="Chọn màu tùy chỉnh"
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
              <FieldLabel>Xem trước trực tiếp</FieldLabel>
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
                  <span>{trimmedTitle || 'Xem trước nhãn'}</span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Cách nhãn này sẽ hiển thị trong danh sách hội thoại
                </span>
              </div>
            </Field>

            {/* Show on Sidebar Toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border/70 p-3 bg-muted/20">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-foreground">Hiển thị trên thanh bên</span>
                <span className="text-[11px] text-muted-foreground">
                  Hiển thị nhãn này trong bộ lọc hội thoại ở thanh bên.
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
              Hủy
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
                  {isEditing ? 'Đang lưu...' : 'Đang tạo...'}
                </>
              ) : isEditing ? (
                'Lưu thay đổi'
              ) : (
                'Tạo nhãn'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
