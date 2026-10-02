'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { toast } from 'sonner';
import { Upload, X, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldError } from '@/components/ui/field';
import { InboxAvatar } from '@/components/inbox-avatar';
import { inboxesApi } from '@/features/settings/inboxes/api/inboxes';
import { useNewInbox } from '../context/new-inbox-context';
import type { ChannelDefinition } from '../channel-registry';

interface ChannelFlowLayoutProps {
  channel: ChannelDefinition;
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void> | void;
  submitLabel?: string;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
  children: React.ReactNode;
}

export function ChannelFlowLayout({
  channel,
  onSubmit,
  submitLabel,
  isSubmitting = false,
  submitDisabled = false,
  children,
}: ChannelFlowLayoutProps) {
  const { workspaceId, backToChannelSelect } = useNewInbox();
  const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext();

  const avatarUrl = (watch('avatarUrl') as string) || '';
  const inboxName = (watch('name') as string) || '';

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workspaceId) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Chỉ hỗ trợ tải lên file hình ảnh (PNG, JPG, WEBP, SVG)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Kích thước ảnh không được vượt quá 5MB');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const res = await inboxesApi.uploadAvatar(workspaceId, file);
      if (res.data?.avatarUrl) {
        setValue('avatarUrl', res.data.avatarUrl, { shouldDirty: true });
        toast.success('Đã tải ảnh đại diện lên thành công!');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể tải ảnh đại diện lên';
      toast.error(message);
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <Card className="border-border bg-card/40">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl border border-border/60 bg-muted/40 p-2 shadow-xs">
            <img src={channel.logoSrc} alt={channel.title} className="size-7 object-contain" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">Cấu hình {channel.title}</CardTitle>
            <CardDescription className="text-xs">
              Điền các thông số kết nối ban đầu cho kênh này.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <FieldGroup className="gap-3.5">
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="inbox-name" className="text-xs font-medium">
                Tên hộp thư (Tùy chọn)
              </FieldLabel>
              <Input
                id="inbox-name"
                {...register('name')}
                placeholder={`Ví dụ: ${channel.title}`}
                className="h-8 text-xs"
                aria-invalid={Boolean(errors.name)}
              />
              {errors.name ? (
                <FieldError errors={[errors.name]} />
              ) : (
                <FieldDescription className="text-[11px] text-muted-foreground">
                  Để trống để sử dụng tên mặc định của hệ thống.
                </FieldDescription>
              )}
            </Field>

            {/* Channel Avatar / Logo */}
            <Field>
              <FieldLabel className="text-xs font-medium">
                Hình đại diện / Logo (Tùy chọn)
              </FieldLabel>
              <div className="flex items-center gap-3.5 p-3 rounded-xl border border-border/70 bg-muted/20">
                <InboxAvatar
                  avatarUrl={avatarUrl}
                  channelType={channel.type}
                  name={inboxName || channel.title}
                  size="lg"
                />
                <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={handleUploadAvatar}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isUploadingAvatar}
                      onClick={() => fileInputRef.current?.click()}
                      className="h-7 px-2.5 gap-1.5 text-xs font-medium"
                    >
                      {isUploadingAvatar ? (
                        <>
                          <Spinner className="size-3" />
                          Đang tải...
                        </>
                      ) : (
                        <>
                          <Upload className="size-3" />
                          {avatarUrl ? 'Thay đổi ảnh' : 'Tải ảnh lên'}
                        </>
                      )}
                    </Button>

                    {avatarUrl ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isUploadingAvatar}
                        onClick={() => setValue('avatarUrl', '', { shouldDirty: true })}
                        className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-3" />
                        Gỡ ảnh
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Tải lên logo gian hàng hoặc ảnh đại diện (PNG, JPG, WEBP, SVG tối đa 5MB).
                  </p>
                </div>
              </div>
            </Field>

            {/* Channel-specific inputs */}
            {children}
          </FieldGroup>

          <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-border/40 mt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={backToChannelSelect}
              className="text-xs h-8 gap-1.5"
            >
              <ArrowLeft className="size-3" />
              Chọn kênh khác
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || submitDisabled}
              className="text-xs h-8 gap-1.5 font-medium"
            >
              {isSubmitting ? (
                <>
                  <Spinner className="size-3" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  {submitLabel || 'Tiếp tục: Phân bổ nhân sự'}
                  <ArrowRight className="size-3" data-icon="inline-end" />
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
