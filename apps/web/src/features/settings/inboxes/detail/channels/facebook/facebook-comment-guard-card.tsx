'use client';

import * as React from 'react';
import { Check, RotateCcw, ShieldAlert, Sparkles, Tag } from 'lucide-react';
import { toast } from 'sonner';
import {
  DEFAULT_COMMENT_GUARD_PRIVATE_REPLY,
  DEFAULT_COMMENT_GUARD_PUBLIC_REPLY,
} from '@sales-copilot/shared-contracts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';

// ── Helper: Insert Dynamic Placeholder Tag ────────────────────────────────
const insertTag = (
  textareaId: string,
  tag: string,
  currentValue: string,
  setter: (val: string) => void,
) => {
  const el = document.getElementById(textareaId) as HTMLTextAreaElement | null;
  if (!el) {
    setter(currentValue + tag);
    return;
  }
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const nextVal = currentValue.substring(0, start) + tag + currentValue.substring(end);
  setter(nextVal);
  setTimeout(() => {
    el.focus();
    el.setSelectionRange(start + tag.length, start + tag.length);
  }, 0);
};

interface FacebookCommentGuardCardProps {
  commentGuardEnabled: boolean;
  onCommentGuardEnabledChange: (enabled: boolean) => void;
  publicReplyEnabled: boolean;
  onPublicReplyEnabledChange: (enabled: boolean) => void;
  privateReplyTemplate: string;
  onPrivateReplyTemplateChange: (template: string) => void;
  publicReplyTemplate: string;
  onPublicReplyTemplateChange: (template: string) => void;
  onSave: (e: React.FormEvent) => void;
  isUpdating: boolean;
}

export function FacebookCommentGuardCard({
  commentGuardEnabled,
  onCommentGuardEnabledChange,
  publicReplyEnabled,
  onPublicReplyEnabledChange,
  privateReplyTemplate,
  onPrivateReplyTemplateChange,
  publicReplyTemplate,
  onPublicReplyTemplateChange,
  onSave,
  isUpdating,
}: FacebookCommentGuardCardProps) {
  return (
    <Card className="border-border bg-card/40">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-primary" />
              <CardTitle className="text-base font-semibold">
                Vệ Sĩ Bình Luận (Comment Guard)
              </CardTitle>
            </div>
            <CardDescription className="text-xs mt-0.5">
              Tự động quét & ẩn bình luận chứa số điện thoại để chống cướp khách, đồng thời kích
              hoạt nhắn tin riêng.
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={
              commentGuardEnabled
                ? 'border-success/30 bg-success/10 text-success text-xs'
                : 'border-muted bg-muted/40 text-muted-foreground text-xs'
            }
          >
            {commentGuardEnabled ? 'Đang bảo vệ' : 'Đang tắt'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Visual 3-step flow diagram */}
        <div className="rounded-xl border border-border/80 bg-muted/20 p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-3">
            <Sparkles className="size-3.5 text-warning" />
            Quy trình hoạt động tự động của Comment Guard:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-background/60 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                  1
                </span>
                Quét bình luận SĐT
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Hệ thống nhận diện định dạng số điện thoại Việt Nam khi khách bình luận dưới bài
                viết/livestream.
              </p>
            </div>

            <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-background/60 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <span className="flex size-5 items-center justify-center rounded-full bg-success/10 text-success text-[10px] font-bold">
                  2
                </span>
                Ẩn bình luận &lt; 1s
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Tự động ẩn bình luận khỏi người xem khác ngay lập tức, ngăn ngừa đối thủ cướp khách.
              </p>
            </div>

            <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-background/60 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <span className="flex size-5 items-center justify-center rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-bold">
                  3
                </span>
                Phản hồi kép tức thì
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Nhắn tin riêng qua Messenger và bình luận công khai xác nhận đơn hàng/yêu cầu.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={onSave} className="flex flex-col gap-5">
          <FieldGroup className="gap-4">
            {/* Master toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/20 p-3.5">
              <div className="flex flex-col gap-0.5 pr-4">
                <span className="text-xs font-medium text-foreground">
                  Bật tự động ẩn bình luận chứa số điện thoại (Comment Guard)
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Khi phát hiện bình luận có số điện thoại Việt Nam, hệ thống lập tức ẩn bình luận
                  để đối thủ không thể khai thác.
                </span>
              </div>
              <Switch checked={commentGuardEnabled} onCheckedChange={onCommentGuardEnabledChange} />
            </div>

            {commentGuardEnabled && (
              <>
                {/* Public reply toggle */}
                <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/20 p-3.5">
                  <div className="flex flex-col gap-0.5 pr-4">
                    <span className="text-xs font-medium text-foreground">
                      Đăng bình luận phản hồi công khai (Public Reply)
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Bình luận trả lời công khai giúp khách an tâm đã được shop ghi nhận và bảo
                      toàn tương tác cho bài viết.
                    </span>
                  </div>
                  <Switch
                    checked={publicReplyEnabled}
                    onCheckedChange={onPublicReplyEnabledChange}
                  />
                </div>

                {/* Private reply textarea */}
                <Field>
                  <div className="flex items-center justify-between">
                    <FieldLabel htmlFor="private-reply-template" className="text-xs font-medium">
                      Mẫu tin nhắn riêng tư (Private Reply qua Messenger)
                    </FieldLabel>
                    {/* Quick Insert Tags */}
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Tag className="size-3" />
                      <span>Chèn:</span>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto w-auto font-mono text-primary bg-primary/10 hover:bg-primary/20 px-1.5 py-0.5 rounded text-[10px] transition-colors"
                        onClick={() =>
                          insertTag(
                            'private-reply-template',
                            '{customer_name}',
                            privateReplyTemplate,
                            onPrivateReplyTemplateChange,
                          )
                        }
                      >
                        {'{customer_name}'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto w-auto font-mono text-primary bg-primary/10 hover:bg-primary/20 px-1.5 py-0.5 rounded text-[10px] transition-colors"
                        onClick={() =>
                          insertTag(
                            'private-reply-template',
                            '{page_name}',
                            privateReplyTemplate,
                            onPrivateReplyTemplateChange,
                          )
                        }
                      >
                        {'{page_name}'}
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    id="private-reply-template"
                    rows={3}
                    value={privateReplyTemplate}
                    onChange={e => onPrivateReplyTemplateChange(e.target.value)}
                    placeholder={DEFAULT_COMMENT_GUARD_PRIVATE_REPLY}
                    className="text-xs min-h-[72px] mt-1.5"
                  />
                  <FieldDescription className="text-[11px] text-muted-foreground">
                    Hệ thống sẽ gửi tin nhắn này trực tiếp vào Messenger của khách hàng ngay khi ẩn
                    bình luận.
                  </FieldDescription>
                </Field>

                {/* Public reply textarea */}
                {publicReplyEnabled && (
                  <Field>
                    <div className="flex items-center justify-between">
                      <FieldLabel htmlFor="public-reply-template" className="text-xs font-medium">
                        Mẫu bình luận công khai dưới bài viết (Public Reply)
                      </FieldLabel>
                      {/* Quick Insert Tags */}
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Tag className="size-3" />
                        <span>Chèn:</span>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-auto w-auto font-mono text-primary bg-primary/10 hover:bg-primary/20 px-1.5 py-0.5 rounded text-[10px] transition-colors"
                          onClick={() =>
                            insertTag(
                              'public-reply-template',
                              '{customer_name}',
                              publicReplyTemplate,
                              onPublicReplyTemplateChange,
                            )
                          }
                        >
                          {'{customer_name}'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-auto w-auto font-mono text-primary bg-primary/10 hover:bg-primary/20 px-1.5 py-0.5 rounded text-[10px] transition-colors"
                          onClick={() =>
                            insertTag(
                              'public-reply-template',
                              '{page_name}',
                              publicReplyTemplate,
                              onPublicReplyTemplateChange,
                            )
                          }
                        >
                          {'{page_name}'}
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      id="public-reply-template"
                      rows={2}
                      value={publicReplyTemplate}
                      onChange={e => onPublicReplyTemplateChange(e.target.value)}
                      placeholder={DEFAULT_COMMENT_GUARD_PUBLIC_REPLY}
                      className="text-xs min-h-[56px] mt-1.5"
                    />
                    <FieldDescription className="text-[11px] text-muted-foreground">
                      Nội dung bình luận phản hồi hiển thị công khai dưới comment của khách hàng.
                    </FieldDescription>
                  </Field>
                )}
              </>
            )}
          </FieldGroup>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUpdating}
              onClick={() => {
                onPrivateReplyTemplateChange(DEFAULT_COMMENT_GUARD_PRIVATE_REPLY);
                onPublicReplyTemplateChange(DEFAULT_COMMENT_GUARD_PUBLIC_REPLY);
                toast.success('Đã khôi phục mẫu tin nhắn mặc định');
              }}
              className="h-8 gap-1.5 text-xs font-medium"
            >
              <RotateCcw className="size-3.5" />
              {'Khôi phục mặc định'}
            </Button>

            <Button
              type="submit"
              size="sm"
              disabled={isUpdating}
              className="h-8 gap-1.5 text-xs font-medium"
            >
              {isUpdating ? (
                <>
                  <Spinner className="size-3.5" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  Lưu cấu hình Comment Guard
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
