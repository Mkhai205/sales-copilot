'use client';

import * as React from 'react';
import type {
  AiDebugMetadata,
  AttachmentDto,
  MessageResponseDto,
} from '@sales-copilot/shared-contracts';
import { Bot, Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
  MessageFooter,
} from '@/components/ui/message';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Marker, MarkerContent } from '@/components/ui/marker';
import { MessageType, SenderType } from '@sales-copilot/shared-contracts';
import {
  DeliveryStatus,
  type LinkPreviewData,
  type VietQrResponseDto,
} from '@sales-copilot/shared-contracts';
import { DeliveryStatusIcon } from './message-delivery-status';
import { MessageScrollerItem } from '@/components/ui/message-scroller';
import { VietQrChatCard } from '@/features/commerce/shared/components/vietqr-chat-card';
import { MessageImageGrid, isImageAttachment } from './message-image-grid';
import { MessageActionsToolbar } from './message-actions-toolbar';
import { MessageText } from './message-text';
import { MessageFileAttachments } from './message-file-attachments';
import { MessageLinkPreview } from './message-link-preview';
import { formatMessageTime } from './message-format';

export interface MessageItemProps {
  message: MessageResponseDto;
  contactName?: string;
  contactAvatar?: string | null;
  inboxAvatar?: string | null;
  inboxName?: string;
  workspaceId?: string;
  onOpenLightbox: (images: AttachmentDto[], index?: number) => void;
  onInspectAi?: (aiDebug: AiDebugMetadata) => void;
}

export function MessageItem({
  message,
  contactName,
  contactAvatar,
  inboxAvatar,
  inboxName,
  workspaceId,
  onOpenLightbox,
  onInspectAi,
}: MessageItemProps) {
  const isAiGenerated = React.useMemo(() => {
    if (!message.metadata) return false;
    if (typeof message.metadata === 'object') {
      return (message.metadata as any).isAiGenerated === true;
    }
    if (typeof message.metadata === 'string') {
      try {
        return JSON.parse(message.metadata)?.isAiGenerated === true;
      } catch {
        return false;
      }
    }
    return false;
  }, [message.metadata]);

  const aiDebug = React.useMemo<AiDebugMetadata | null>(() => {
    if (!message.metadata) return null;
    let meta = message.metadata as any;
    if (typeof meta === 'string') {
      try {
        meta = JSON.parse(meta);
      } catch {
        return null;
      }
    }
    return meta?.aiDebug || null;
  }, [message.metadata]);

  const isPrivate = message.isPrivate;
  const isSystem =
    !isAiGenerated &&
    (message.senderType === SenderType.SYSTEM || message.messageType === MessageType.ACTIVITY);
  const isAgent =
    !isPrivate &&
    !isSystem &&
    (isAiGenerated ||
      message.senderType === SenderType.USER ||
      message.messageType === MessageType.OUTGOING);

  const imageAttachments = React.useMemo(
    () => (message.attachments || []).filter(att => isImageAttachment(att) && att.fileUrl),
    [message.attachments],
  );
  const fileAttachments = React.useMemo(
    () => (message.attachments || []).filter(att => !isImageAttachment(att)),
    [message.attachments],
  );

  const previewData = (message.metadata as any)?.linkPreview as LinkPreviewData | undefined;
  const vietQrData =
    (message.metadata as any)?.type === 'VIETQR_PAYMENT'
      ? ((message.metadata as any)?.qrData as VietQrResponseDto | undefined)
      : undefined;

  // 1. System / Activity Notice
  if (isSystem) {
    if (vietQrData) {
      return (
        <MessageScrollerItem messageId={message.id} className="py-2 flex justify-center">
          <VietQrChatCard qrData={vietQrData} />
        </MessageScrollerItem>
      );
    }

    return (
      <MessageScrollerItem messageId={message.id} className="py-1">
        <Marker variant="default" className="justify-center text-center">
          <MarkerContent className="text-[11px] text-muted-foreground italic">
            {message.content}
          </MarkerContent>
        </Marker>
      </MessageScrollerItem>
    );
  }

  // 2. Private Note (Internal only)
  if (isPrivate) {
    const authorName = message.sender?.name || 'Nhân viên';
    const authorInitials = authorName
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    return (
      <MessageScrollerItem messageId={message.id} className="w-full my-1">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-1.5 rounded-xl border border-warning/30 bg-warning/[0.08] p-3.5 shadow-xs transition-all dark:border-warning/25 dark:bg-warning/[0.12]">
          {/* Note Header */}
          <div className="flex items-center justify-between gap-2 border-b border-warning/20 pb-2">
            <div className="flex items-center gap-2">
              <Avatar className="size-6 border border-warning/30">
                {message.sender?.avatarUrl && (
                  <AvatarImage src={message.sender.avatarUrl} alt={authorName} />
                )}
                <AvatarFallback className="text-[10px] bg-warning/20 text-warning dark:text-warning font-semibold">
                  {authorInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-foreground">{authorName}</span>
                <span className="inline-flex items-center gap-1 rounded-sm bg-warning/20 px-1.5 py-0.5 text-[10px] font-medium text-warning dark:text-warning">
                  <Lock className="size-2.5" />
                  Ghi chú nội bộ
                </span>
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {formatMessageTime(message.createdAt)}
            </span>
          </div>

          {/* Note Content */}
          {message.content && (
            <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed pt-0.5">
              <MessageText content={message.content} />
            </p>
          )}

          {/* Images in Note */}
          {imageAttachments.length > 0 && (
            <MessageImageGrid
              attachments={imageAttachments}
              onImageClick={idx => onOpenLightbox(imageAttachments, idx)}
            />
          )}

          {/* Files in Note */}
          <MessageFileAttachments attachments={fileAttachments} />
        </div>
      </MessageScrollerItem>
    );
  }

  // 3. Outbound Message (Agent or AI)
  if (isAgent) {
    return (
      <MessageScrollerItem messageId={message.id}>
        <Message align="end">
          {isAiGenerated && (
            <div className="relative self-end shrink-0 group-has-data-[slot=message-footer]/message:-translate-y-8 transition-transform">
              <MessageAvatar className="translate-y-0 group-has-data-[slot=message-footer]/message:translate-y-0">
                <Avatar className="size-8 ring-1 ring-primary/30">
                  <AvatarImage
                    src={inboxAvatar || '/avatar-bot-copilot.png'}
                    alt={inboxName || 'AI Autopilot'}
                  />
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                    AI
                  </AvatarFallback>
                </Avatar>
              </MessageAvatar>
            </div>
          )}
          <MessageContent className="items-end">
            <MessageHeader className="justify-end gap-1">
              {isAiGenerated ? (
                <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                  <Bot className="size-3 text-primary" />
                  <span>{'AI Autopilot'}</span>
                  {aiDebug && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto gap-1 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-primary rounded bg-muted/80 hover:bg-muted font-normal ml-0.5 cursor-pointer"
                      onClick={() => onInspectAi?.(aiDebug)}
                      title="Xem chi tiết các bước xử lý và Tool Calls"
                    >
                      <Sparkles className="size-2.5 text-primary" />
                      <span>
                        {aiDebug.toolCalls?.length
                          ? `${aiDebug.toolCalls.length} công cụ`
                          : 'Chi tiết'}
                      </span>
                    </Button>
                  )}
                </span>
              ) : (
                <span>Bạn</span>
              )}
              {' • '}
              {formatMessageTime(message.createdAt)}
            </MessageHeader>

            {/* Bubble Row with Left-floating Action Toolbar */}
            {message.content && (
              <div className="group/msg relative flex items-center justify-end gap-2 max-w-full">
                <MessageActionsToolbar
                  message={message}
                  align="end"
                  onOpenLightbox={idx => onOpenLightbox(imageAttachments, idx ?? 0)}
                />
                <Bubble variant="default" align="end">
                  <BubbleContent className="whitespace-pre-wrap">
                    <MessageText content={message.content} />
                  </BubbleContent>
                </Bubble>
              </div>
            )}

            {/* Link Preview Card */}
            <MessageLinkPreview
              content={message.content}
              previewData={previewData}
              workspaceId={workspaceId}
              align="end"
            />

            {/* VietQR Payment Card */}
            {vietQrData && (
              <div className="pt-1 flex justify-end w-full">
                <VietQrChatCard qrData={vietQrData} />
              </div>
            )}

            {/* Image Grid */}
            {imageAttachments.length > 0 && (
              <div className="group/msg relative flex items-center justify-end gap-2 max-w-full">
                {!message.content && (
                  <MessageActionsToolbar
                    message={message}
                    align="end"
                    onOpenLightbox={idx => onOpenLightbox(imageAttachments, idx ?? 0)}
                  />
                )}
                <MessageImageGrid
                  attachments={imageAttachments}
                  onImageClick={idx => onOpenLightbox(imageAttachments, idx)}
                  align="end"
                />
              </div>
            )}

            {/* Non-image File Attachments */}
            <MessageFileAttachments attachments={fileAttachments} />

            <MessageFooter className="gap-1.5 text-[10px] text-muted-foreground items-center justify-end">
              <DeliveryStatusIcon status={message.deliveryStatus} />
              {message.deliveryStatus === DeliveryStatus.FAILED && (
                <span className="text-destructive font-medium">Gửi thất bại</span>
              )}
            </MessageFooter>
          </MessageContent>
        </Message>
      </MessageScrollerItem>
    );
  }

  // 4. Inbound Message (Contact / Customer)
  const isBotSender =
    message.sender?.name?.toLowerCase().includes('bot') ||
    message.sender?.name?.toLowerCase().includes('copilot');
  const defaultAvatar = isBotSender ? '/avatar-bot-copilot.png' : '/avatar-contact-default.svg';
  const senderInitials = (message.sender?.name || contactName || 'C')
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <MessageScrollerItem messageId={message.id}>
      <Message align="start">
        <MessageAvatar>
          <Avatar className="size-8">
            <AvatarImage
              src={message.sender?.avatarUrl || contactAvatar || defaultAvatar}
              alt={message.sender?.name || contactName || ''}
            />
            <AvatarFallback className="text-[11px] bg-muted-foreground/20 font-medium">
              {isBotSender ? 'AI' : senderInitials}
            </AvatarFallback>
          </Avatar>
        </MessageAvatar>

        <MessageContent className="items-start">
          <MessageHeader>
            {message.sender?.name || contactName || 'Khách hàng'} •{' '}
            {formatMessageTime(message.createdAt)}
          </MessageHeader>

          {/* Bubble Row with Right-floating Action Toolbar */}
          {message.content && (
            <div className="group/msg relative flex items-center justify-start gap-2 max-w-full">
              <Bubble variant="muted" align="start">
                <BubbleContent className="whitespace-pre-wrap">
                  <MessageText content={message.content} />
                </BubbleContent>
              </Bubble>
              <MessageActionsToolbar
                message={message}
                align="start"
                onOpenLightbox={idx => onOpenLightbox(imageAttachments, idx ?? 0)}
              />
            </div>
          )}

          {/* Link Preview Card */}
          <MessageLinkPreview
            content={message.content}
            previewData={previewData}
            workspaceId={workspaceId}
            align="start"
          />

          {/* VietQR Payment Card */}
          {vietQrData && (
            <div className="pt-1 flex justify-start w-full">
              <VietQrChatCard qrData={vietQrData} />
            </div>
          )}

          {/* Image Grid */}
          {imageAttachments.length > 0 && (
            <div className="group/msg relative flex items-center justify-start gap-2 max-w-full">
              <MessageImageGrid
                attachments={imageAttachments}
                onImageClick={idx => onOpenLightbox(imageAttachments, idx)}
                align="start"
              />
              {!message.content && (
                <MessageActionsToolbar
                  message={message}
                  align="start"
                  onOpenLightbox={idx => onOpenLightbox(imageAttachments, idx ?? 0)}
                />
              )}
            </div>
          )}

          {/* Non-image File Attachments */}
          <MessageFileAttachments attachments={fileAttachments} />

          <MessageFooter className="text-[10px] text-muted-foreground/70">
            {formatMessageTime(message.createdAt)}
          </MessageFooter>
        </MessageContent>
      </Message>
    </MessageScrollerItem>
  );
}
