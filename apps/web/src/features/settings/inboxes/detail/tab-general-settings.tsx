'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, Settings, Trash2, TriangleAlert, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import type { InboxDetailDto } from '@sales-copilot/shared-contracts';
import { inboxesApi } from '../api/inboxes';
import { InboxAvatar } from '@/components/inbox-avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDeleteInbox, useUpdateInbox } from '../hooks/use-inboxes';

interface TabGeneralSettingsProps {
  inbox: InboxDetailDto;
  workspaceId: string;
  workspaceSlug: string;
}

export function TabGeneralSettings({ inbox, workspaceId, workspaceSlug }: TabGeneralSettingsProps) {
  const router = useRouter();
  const [name, setName] = React.useState(inbox.name || '');
  const [avatarUrl, setAvatarUrl] = React.useState(inbox.avatarUrl || '');
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [greetingMessage, setGreetingMessage] = React.useState(
    inbox.greetingMessage || (inbox.settings?.greetingMessage as string) || '',
  );
  const [allowMessagesAfterResolved, setAllowMessagesAfterResolved] = React.useState(
    Boolean(inbox.settings?.allowMessagesAfterResolved ?? true),
  );
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false);

  // Clean up local blob preview on unmount or when previewUrl changes
  React.useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Chỉ hỗ trợ tải lên file hình ảnh (PNG, JPG, WEBP, SVG)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Kích thước ảnh không được vượt quá 5MB');
      return;
    }

    // 1. Instant local preview
    const localBlobUrl = URL.createObjectURL(file);
    setPreviewUrl(localBlobUrl);

    setIsUploadingAvatar(true);
    try {
      const res = await inboxesApi.uploadAvatar(workspaceId, file);
      if (res.data?.avatarUrl) {
        setAvatarUrl(res.data.avatarUrl);
        toast.success('Đã tải ảnh đại diện lên thành công!');
      }
    } catch (err: any) {
      toast.error(err.message || 'Không thể tải ảnh đại diện lên');
      setPreviewUrl(null);
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setAvatarUrl('');
  };

  // Sync state if inbox updates from outside
  React.useEffect(() => {
    setName(inbox.name || '');
    setAvatarUrl(inbox.avatarUrl || '');
    setPreviewUrl(null);
    setGreetingMessage(inbox.greetingMessage || (inbox.settings?.greetingMessage as string) || '');
    setAllowMessagesAfterResolved(Boolean(inbox.settings?.allowMessagesAfterResolved ?? true));
  }, [inbox.id, inbox.updatedAt]);

  const { mutate: updateInbox, isPending: isSaving } = useUpdateInbox(workspaceId);
  const { mutate: deleteInbox, isPending: isDeleting } = useDeleteInbox(workspaceId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Tên hộp thư không được để trống');
      return;
    }

    const updatedSettings = {
      ...(inbox.settings || {}),
      greetingMessage: greetingMessage.trim(),
      allowMessagesAfterResolved,
    };

    updateInbox({
      inboxId: inbox.id,
      dto: {
        name: name.trim(),
        avatarUrl: avatarUrl.trim() || null,
        greetingMessage: greetingMessage.trim() || undefined,
        settings: updatedSettings,
      },
      successMessage: 'Cập nhật cài đặt hộp thư thành công',
    });
  };

  const handleConfirmDelete = () => {
    deleteInbox(
      {
        inboxId: inbox.id,
        successMessage: 'Đã xóa hộp thư',
      },
      {
        onSuccess: () => {
          router.push(`/${workspaceSlug}/settings/inboxes`);
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <Card className="border-border bg-card/40">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="size-4 text-primary" />{' '}
            <CardTitle className="text-base font-semibold">Cài đặt chung</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Quản lý tên nhận diện, hình đại diện và lời chào tự động của hộp thư này.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-start">
              {/* Left Column: Form Settings (Name, Greeting, Reopen Switch) */}
              <div className="md:col-span-8 flex flex-col gap-4">
                <FieldGroup className="gap-4">
                  {/* Inbox Name */}
                  <Field>
                    <FieldLabel htmlFor="inbox-name" className="text-xs font-medium">
                      Tên hộp thư <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      id="inbox-name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Ví dụ: CSKH Website, Fanpage Bán Hàng"
                      maxLength={100}
                      required
                      className="h-8 text-xs"
                    />
                    <FieldDescription className="text-[11px] text-muted-foreground">
                      Tên này sẽ hiển thị nội bộ với nhân viên và xuất hiện trong tiêu đề widget nếu
                      hỗ trợ.
                    </FieldDescription>
                  </Field>

                  {/* Greeting Message */}
                  <Field>
                    <FieldLabel htmlFor="greeting-message" className="text-xs font-medium">
                      Lời chào tự động khi bắt đầu cuộc trò chuyện
                    </FieldLabel>
                    <Textarea
                      id="greeting-message"
                      value={greetingMessage}
                      onChange={e => setGreetingMessage(e.target.value)}
                      placeholder="Xin chào! Chúng tôi có thể giúp gì cho bạn hôm nay?"
                      rows={4}
                      className="text-xs resize-none"
                    />
                    <FieldDescription className="text-[11px] text-muted-foreground">
                      Tin nhắn này sẽ tự động gửi khi khách hàng bắt đầu phiên chat mới.
                    </FieldDescription>
                  </Field>

                  {/* Auto-reopen Switch */}
                  <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/20 p-3.5 mt-1">
                    <div className="flex flex-col gap-0.5 pr-4">
                      <span className="text-xs font-medium text-foreground">
                        Cho phép mở lại hội thoại khi khách hàng gửi tin nhắn mới
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Khi kích hoạt, nếu khách hàng gửi tin nhắn vào một cuộc hội thoại đã được
                        đánh dấu Đã giải quyết (Resolved), hội thoại sẽ tự động chuyển lại sang Đang
                        mở (Open).
                      </span>
                    </div>
                    <Switch
                      checked={allowMessagesAfterResolved}
                      onCheckedChange={setAllowMessagesAfterResolved}
                    />
                  </div>
                </FieldGroup>
              </div>

              {/* Right Column: Avatar Management Card */}
              <div className="md:col-span-4 flex flex-col items-center text-center gap-4">
                <span className="text-xs font-medium text-foreground">Hình đại diện (Avatar)</span>

                <div className="relative inline-block my-1">
                  <InboxAvatar
                    avatarUrl={previewUrl || avatarUrl}
                    channelType={inbox.channelType}
                    name={name || inbox.name}
                    size="xl"
                    className="size-42 rounded-2xl border-2 border-border/80 shadow-xs"
                  />

                  {/* Remove Avatar Button (Corner 'x' button) */}
                  {(previewUrl || avatarUrl) && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={isUploadingAvatar}
                      title="Gỡ ảnh đại diện"
                      className="absolute -top-1.5 -right-1.5 z-20 size-5 rounded-full bg-background border border-border shadow-xs flex items-center justify-center hover:text-white hover:bg-destructive cursor-pointer"
                    >
                      <X className="size-3" />
                      <span className="sr-only">Gỡ ảnh</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-col items-center gap-2 w-full max-w-[200px]">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isUploadingAvatar}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-8 gap-1.5 text-xs font-medium"
                  >
                    {isUploadingAvatar ? (
                      <>
                        <Spinner className="size-3.5" />
                        Đang tải lên...
                      </>
                    ) : (
                      <>
                        <Upload className="size-3.5" />
                        {previewUrl || avatarUrl ? 'Thay đổi ảnh' : 'Tải ảnh lên'}
                      </>
                    )}
                  </Button>

                  <p className="text-[9px] text-muted-foreground leading-relaxed text-center">
                    PNG, JPG, WEBP hoặc SVG (tối đa 5MB). Fanpage Facebook sẽ tự đồng bộ từ Meta.
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Actions Footer */}
            <div className="flex items-center justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={isSaving || !name.trim()}
                className="h-8 gap-1.5 text-xs font-medium"
              >
                {isSaving ? (
                  <>
                    <Spinner className="size-3.5" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Check className="size-3.5" />
                    Lưu thay đổi
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border border-destructive bg-destructive/10">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TriangleAlert className="size-4 text-destructive" />
            <CardTitle className="text-sm font-semibold text-destructive">
              Khu vực nguy hiểm
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-foreground">
            Xóa hộp thư này sẽ ngắt kết nối kênh và xóa vĩnh viễn cấu hình liên kết. Các cuộc hội
            thoại lịch sử có thể bị ngắt nhận tin nhắn mới.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-end">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="h-8 text-xs font-medium"
            >
              <Trash2 className="size-3.5" />
              Xóa hộp thư này
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <AlertTriangle className="size-4" />
            </AlertDialogMedia>
            <AlertDialogTitle className="text-sm font-semibold">
              Xác nhận xóa hộp thư &quot;{inbox.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Hành động này không thể hoàn tác. Mọi tin nhắn đến từ kênh này sẽ không còn được xử lý
              trong Sales Copilot.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="text-xs">
              Hủy
            </AlertDialogCancel>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="text-xs font-medium"
            >
              {isDeleting ? (
                <>
                  <Spinner className="size-3.5" />
                  Đang xóa...
                </>
              ) : (
                'Xác nhận xóa'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
