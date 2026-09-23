import * as React from 'react';
import { AlertCircle, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

export interface SettingsActionBarProps {
  /** Có thay đổi chưa lưu hay không */
  isDirty?: boolean;
  /** Trạng thái đang lưu dữ liệu */
  isPending?: boolean;
  /** Cho phép lưu hay không (kiểm tra tính hợp lệ form) */
  isValid?: boolean;
  /** Nhãn thông báo thay đổi chưa lưu */
  message?: string;
  /** Nhãn nút Lưu */
  saveLabel?: string;
  /** Nhãn nút Hủy */
  cancelLabel?: string;
  /** Hàm callback khi bấm Lưu */
  onSave?: (e: React.FormEvent) => void;
  /** Hàm callback khi bấm Hủy */
  onCancel?: () => void;
  /** Custom children nếu muốn tùy biến nút */
  children?: React.ReactNode;
  /** Class tùy biến */
  className?: string;
}

export function SettingsActionBar({
  isDirty = false,
  isPending = false,
  isValid = true,
  message = 'Bạn có thay đổi chưa lưu trên trang này',
  saveLabel = 'Lưu thay đổi',
  cancelLabel = 'Hủy',
  onSave,
  onCancel,
  children,
  className,
}: SettingsActionBarProps) {
  if (!isDirty && !isPending) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className={cn(
        'sticky bottom-4 z-30 mt-6 w-full animate-in fade-in-0 slide-in-from-bottom-3 duration-200',
        className,
      )}
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-primary/20 bg-background/95 p-3.5 shadow-lg backdrop-blur-md dark:bg-card/95 dark:border-border">
        {/* Left: Unsaved changes indicator */}
        <div className="flex items-center gap-2.5 text-xs text-foreground">
          <span className="flex size-2 rounded-full bg-amber-500 animate-pulse" />
          <AlertCircle className="size-4 text-amber-500 shrink-0" />
          <span className="font-medium">{message}</span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          {children ? (
            children
          ) : (
            <>
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onCancel}
                  disabled={isPending}
                  className="h-8 text-xs gap-1.5"
                >
                  <RotateCcw className="size-3.5" data-icon="inline-start" />
                  {cancelLabel}
                </Button>
              )}

              <Button
                type={onSave ? 'button' : 'submit'}
                onClick={onSave}
                size="sm"
                disabled={isPending || !isValid}
                className="h-8 text-xs font-medium gap-1.5 shadow-sm"
              >
                {isPending ? (
                  <>
                    <Spinner className="size-3.5" data-icon="inline-start" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Save className="size-3.5" data-icon="inline-start" />
                    {saveLabel}
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
