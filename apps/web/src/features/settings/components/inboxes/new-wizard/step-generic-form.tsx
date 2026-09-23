'use client';

import * as React from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Upload, X, ArrowRight } from 'lucide-react';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Field, FieldGroup, FieldLabel, FieldDescription } from '@/components/ui/field';
import { InboxAvatar } from '@/components/inbox-avatar';
import { inboxesApi } from '../../../api/inboxes';
import type { ChannelCardItem } from './types';

export interface GenericFormValues {
  genericInboxName: string;
  genericAvatarUrl: string;
  telegramBotToken: string;
  webChatDomain: string;
  zaloOaId: string;
  zaloSecretKey: string;
  emailAddress: string;
}

interface StepGenericFormProps {
  workspaceId: string;
  selectedChannel: ChannelCardItem;
  formValues: GenericFormValues;
  onChangeValues: React.Dispatch<React.SetStateAction<GenericFormValues>>;
  onCancel: () => void;
  onProceed: () => void;
}

export function StepGenericForm({
  workspaceId,
  selectedChannel,
  formValues,
  onChangeValues,
  onCancel,
  onProceed,
}: StepGenericFormProps) {
  const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

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
        onChangeValues(prev => ({ ...prev, genericAvatarUrl: res.data.avatarUrl }));
        toast.success('Đã tải ảnh đại diện lên thành công!');
      }
    } catch (err: any) {
      toast.error(err.message || 'Không thể tải ảnh đại diện lên');
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedChannel.type === ChannelType.TELEGRAM && !formValues.telegramBotToken.trim()) {
      toast.error('Vui lòng nhập Telegram Bot Token');
      return;
    }
    if (
      selectedChannel.type === ChannelType.ZALO &&
      (!formValues.zaloOaId.trim() || !formValues.zaloSecretKey.trim())
    ) {
      toast.error('Vui lòng nhập Zalo OA ID và Secret Key');
      return;
    }
    if (selectedChannel.type === ChannelType.EMAIL && !formValues.emailAddress.trim()) {
      toast.error('Vui lòng nhập địa chỉ Email');
      return;
    }

    onProceed();
  };

  return (
    <Card className="border-border bg-card/40 max-w-xl">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl border border-border/60 bg-muted/40 p-2 shadow-xs">
            <Image
              src={selectedChannel.logoSrc}
              alt={selectedChannel.title}
              width={28}
              height={28}
              unoptimized
              style={{ width: '28px', height: '28px' }}
              className="size-7 object-contain"
            />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">
              Cấu hình {selectedChannel.title}
            </CardTitle>
            <CardDescription className="text-xs">
              Điền các thông số kết nối ban đầu cho kênh này.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FieldGroup className="gap-3.5">
            <Field>
              <FieldLabel htmlFor="inbox-name" className="text-xs font-medium">
                Tên hộp thư (Tùy chọn)
              </FieldLabel>
              <Input
                id="inbox-name"
                value={formValues.genericInboxName}
                onChange={e =>
                  onChangeValues(prev => ({ ...prev, genericInboxName: e.target.value }))
                }
                placeholder={`Ví dụ: ${selectedChannel.title}`}
                className="h-8 text-xs"
              />
              <FieldDescription className="text-[11px] text-muted-foreground">
                Để trống để sử dụng tên mặc định của hệ thống.
              </FieldDescription>
            </Field>

            {/* Channel Avatar / Logo */}
            <Field>
              <FieldLabel className="text-xs font-medium">
                Hình đại diện / Logo (Tùy chọn)
              </FieldLabel>
              <div className="flex items-center gap-3.5 p-3 rounded-xl border border-border/70 bg-muted/20">
                <InboxAvatar
                  avatarUrl={formValues.genericAvatarUrl}
                  channelType={selectedChannel.type}
                  name={formValues.genericInboxName || selectedChannel.title}
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
                          <Spinner className="size-3" data-icon="inline-start" />
                          Đang tải...
                        </>
                      ) : (
                        <>
                          <Upload className="size-3" data-icon="inline-start" />
                          {formValues.genericAvatarUrl ? 'Thay đổi ảnh' : 'Tải ảnh lên'}
                        </>
                      )}
                    </Button>

                    {formValues.genericAvatarUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isUploadingAvatar}
                        onClick={() => onChangeValues(prev => ({ ...prev, genericAvatarUrl: '' }))}
                        className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-3" data-icon="inline-start" />
                        Gỡ ảnh
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Tải lên logo gian hàng hoặc ảnh đại diện (PNG, JPG, WEBP, SVG tối đa 5MB).
                  </p>
                </div>
              </div>
            </Field>

            {/* Telegram Specific */}
            {selectedChannel.type === ChannelType.TELEGRAM && (
              <Field>
                <FieldLabel htmlFor="tg-token" className="text-xs font-medium">
                  Telegram Bot Token <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="tg-token"
                  required
                  value={formValues.telegramBotToken}
                  onChange={e =>
                    onChangeValues(prev => ({ ...prev, telegramBotToken: e.target.value }))
                  }
                  placeholder="123456:ABC-DEF1234ghIkl..."
                  className="h-8 text-xs font-mono"
                />
                <FieldDescription className="text-[11px] text-muted-foreground">
                  Nhận token bằng cách nhắn tin cho <code className="font-mono">@BotFather</code>{' '}
                  trên Telegram.
                </FieldDescription>
              </Field>
            )}

            {/* Web Chat Specific */}
            {selectedChannel.type === ChannelType.WEB_CHAT && (
              <Field>
                <FieldLabel htmlFor="webchat-domain" className="text-xs font-medium">
                  Tên miền / URL Website (Tùy chọn)
                </FieldLabel>
                <Input
                  id="webchat-domain"
                  value={formValues.webChatDomain}
                  onChange={e =>
                    onChangeValues(prev => ({ ...prev, webChatDomain: e.target.value }))
                  }
                  placeholder="https://myshop.vn"
                  className="h-8 text-xs font-mono"
                />
                <FieldDescription className="text-[11px] text-muted-foreground">
                  Tên miền chính của website bạn muốn nhúng widget live chat.
                </FieldDescription>
              </Field>
            )}

            {/* Zalo Specific */}
            {selectedChannel.type === ChannelType.ZALO && (
              <>
                <Field>
                  <FieldLabel htmlFor="zalo-oa-id" className="text-xs font-medium">
                    Zalo Official Account ID <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    id="zalo-oa-id"
                    required
                    value={formValues.zaloOaId}
                    onChange={e => onChangeValues(prev => ({ ...prev, zaloOaId: e.target.value }))}
                    placeholder="Ví dụ: 182736451928"
                    className="h-8 text-xs font-mono"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="zalo-secret" className="text-xs font-medium">
                    Zalo OA Secret Key <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    id="zalo-secret"
                    type="password"
                    required
                    value={formValues.zaloSecretKey}
                    onChange={e =>
                      onChangeValues(prev => ({ ...prev, zaloSecretKey: e.target.value }))
                    }
                    placeholder="Nhập Zalo OA Secret Key"
                    className="h-8 text-xs font-mono"
                  />
                </Field>
              </>
            )}

            {/* Email Specific */}
            {selectedChannel.type === ChannelType.EMAIL && (
              <Field>
                <FieldLabel htmlFor="email-address" className="text-xs font-medium">
                  Địa chỉ Email hỗ trợ <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="email-address"
                  type="email"
                  required
                  value={formValues.emailAddress}
                  onChange={e =>
                    onChangeValues(prev => ({ ...prev, emailAddress: e.target.value }))
                  }
                  placeholder="support@myshop.vn"
                  className="h-8 text-xs font-mono"
                />
              </Field>
            )}
          </FieldGroup>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="text-xs h-8"
            >
              Hủy
            </Button>
            <Button type="submit" size="sm" className="text-xs h-8 gap-1.5 font-medium">
              Tiếp tục: Phân bổ nhân sự
              <ArrowRight className="size-3" data-icon="inline-end" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
