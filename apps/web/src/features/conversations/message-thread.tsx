'use client';

import * as React from 'react';
import { format, parseISO, isValid } from 'date-fns';
import {
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  Lock,
  Download,
  FileText,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from '@/components/ui/message-scroller';
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
  MessageFooter,
} from '@/components/ui/message';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Marker, MarkerContent } from '@/components/ui/marker';
import {
  Attachment,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
} from '@/components/ui/attachment';
import {
  DeliveryStatus,
  MessageType,
  SenderType,
  type AttachmentDto,
  type LinkPreviewData,
  type MessageResponseDto,
} from '@/lib/api/types';
import { fetchApi, workspaceHeaders } from '@/lib/api/client';
import { useConversation } from './hooks/use-conversation';
import { useMessages } from './hooks/use-messages';
import { useWorkspaces } from '@/features/workspaces/use-workspaces';
import { MessageThreadHeader } from './message-thread-header';
import { TypingIndicator } from './typing-indicator';
import { ChatComposer } from '@/features/composer';
import { useConversationRoom } from '@/lib/socket';
import { RichLinkCard } from './rich-link-card';
import { ImageLightboxDialog } from './image-lightbox-dialog';
import { MessageImageGrid, isImageAttachment } from './message-image-grid';
import { MessageActionsToolbar } from './message-actions-toolbar';

interface MessageThreadProps {
  conversationId: string;
  workspaceSlug?: string;
  workspaceId?: string;
  isDetailOpen?: boolean;
  onToggleDetail?: () => void;
}

function formatMessageTime(dateInput?: string): string {
  if (!dateInput) return '';
  const date = parseISO(dateInput);
  if (!isValid(date)) return '';
  return format(date, 'h:mm a');
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderDeliveryStatusIcon(status: DeliveryStatus) {
  switch (status) {
    case DeliveryStatus.PENDING:
      return <Clock className="size-3 text-muted-foreground/70" />;
    case DeliveryStatus.SENT:
      return <Check className="size-3 text-muted-foreground" />;
    case DeliveryStatus.DELIVERED:
      return <CheckCheck className="size-3 text-muted-foreground" />;
    case DeliveryStatus.READ:
      return <CheckCheck className="size-3 text-primary" />;
    case DeliveryStatus.FAILED:
      return <AlertCircle className="size-3 text-destructive" />;
    default:
      return null;
  }
}

function renderMessageText(content: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = content.split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:opacity-80 break-all text-primary font-medium"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

function renderFileAttachments(attachments?: AttachmentDto[]) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mt-1.5 max-w-full">
      {attachments.map(att => (
        <Attachment key={att.id || att.storagePath} size="sm" className="max-w-xs">
          <AttachmentMedia variant="icon">
            <FileText className="size-4 text-muted-foreground" />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle className="text-xs">{att.fileName}</AttachmentTitle>
            <AttachmentDescription className="text-[10px]">
              {formatFileSize(att.fileSize)}
            </AttachmentDescription>
          </AttachmentContent>
          {att.fileUrl && (
            <AttachmentActions>
              <AttachmentAction asChild size="icon-xs" variant="ghost">
                <a
                  href={att.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={att.fileName}
                >
                  <Download className="size-3" />
                  <span className="sr-only">Download {att.fileName}</span>
                </a>
              </AttachmentAction>
            </AttachmentActions>
          )}
        </Attachment>
      ))}
    </div>
  );
}

function MessageLinkPreview({
  content,
  previewData,
  workspaceId,
  align = 'start',
}: {
  content?: string | null;
  previewData?: LinkPreviewData;
  workspaceId?: string;
  align?: 'start' | 'end';
}) {
  const [data, setData] = React.useState<LinkPreviewData | undefined>(previewData);

  React.useEffect(() => {
    if (previewData && (previewData.title || previewData.image || previewData.description)) {
      setData(previewData);
      return;
    }

    if (!content) return;
    const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/i;
    const match = content.match(urlRegex);
    if (!match || !match[0]) return;

    const url = match[0];
    let isCancelled = false;

    fetchApi<LinkPreviewData>(`/conversations/link-preview?url=${encodeURIComponent(url)}`, {
      headers: workspaceHeaders(workspaceId),
    })
      .then(res => {
        if (
          !isCancelled &&
          res.data &&
          (res.data.title || res.data.image || res.data.description)
        ) {
          setData(res.data);
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [content, previewData, workspaceId]);

  if (!data || (!data.title && !data.image && !data.description)) {
    return null;
  }

  return (
    <div className={cn('max-w-full', align === 'end' ? 'ml-auto' : 'mr-auto')}>
      <RichLinkCard preview={data} />
    </div>
  );
}

function MessageItem({
  message,
  contactName,
  contactAvatar,
  workspaceId,
  onOpenLightbox,
}: {
  message: MessageResponseDto;
  contactName?: string;
  contactAvatar?: string | null;
  workspaceId?: string;
  onOpenLightbox: (images: AttachmentDto[], index?: number) => void;
}) {
  const isAgent =
    message.senderType === SenderType.USER || message.messageType === MessageType.OUTGOING;
  const isPrivate = message.isPrivate;
  const isSystem =
    message.senderType === SenderType.SYSTEM || message.messageType === MessageType.ACTIVITY;

  const imageAttachments = React.useMemo(
    () => (message.attachments || []).filter(att => isImageAttachment(att) && att.fileUrl),
    [message.attachments],
  );
  const fileAttachments = React.useMemo(
    () => (message.attachments || []).filter(att => !isImageAttachment(att)),
    [message.attachments],
  );

  const previewData = (message.metadata as any)?.linkPreview as LinkPreviewData | undefined;

  // 1. System / Activity Notice
  if (isSystem) {
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
    const authorName = message.sender?.name || 'Agent';
    const authorInitials = authorName
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    return (
      <MessageScrollerItem messageId={message.id} className="w-full my-1">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] p-3.5 shadow-xs transition-all dark:border-amber-500/25 dark:bg-amber-500/[0.12]">
          {/* Note Header */}
          <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 pb-2">
            <div className="flex items-center gap-2">
              <Avatar className="size-6 border border-amber-500/30">
                {message.sender?.avatarUrl && (
                  <AvatarImage src={message.sender.avatarUrl} alt={authorName} />
                )}
                <AvatarFallback className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold">
                  {authorInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-foreground">{authorName}</span>
                <span className="inline-flex items-center gap-1 rounded-sm bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                  <Lock className="size-2.5" />
                  Private Note
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
              {renderMessageText(message.content)}
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
          {renderFileAttachments(fileAttachments)}
        </div>
      </MessageScrollerItem>
    );
  }

  // 3. Outbound Message (Agent)
  if (isAgent) {
    return (
      <MessageScrollerItem messageId={message.id}>
        <Message align="end">
          <MessageContent className="items-end">
            <MessageHeader className="justify-end">
              You • {formatMessageTime(message.createdAt)}
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
                    {renderMessageText(message.content)}
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
            {renderFileAttachments(fileAttachments)}

            <MessageFooter className="gap-1.5 text-[10px] text-muted-foreground items-center justify-end">
              {renderDeliveryStatusIcon(message.deliveryStatus)}
              {message.deliveryStatus === DeliveryStatus.FAILED && (
                <span className="text-destructive font-medium">Failed to send</span>
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
  const defaultAvatar = isBotSender ? '/avatar-bot-copilot.svg' : '/avatar-contact-default.svg';
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
            {message.sender?.name || contactName || 'Contact'} •{' '}
            {formatMessageTime(message.createdAt)}
          </MessageHeader>

          {/* Bubble Row with Right-floating Action Toolbar */}
          {message.content && (
            <div className="group/msg relative flex items-center justify-start gap-2 max-w-full">
              <Bubble variant="muted" align="start">
                <BubbleContent className="whitespace-pre-wrap">
                  {renderMessageText(message.content)}
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
          {renderFileAttachments(fileAttachments)}

          <MessageFooter className="text-[10px] text-muted-foreground/70">
            {formatMessageTime(message.createdAt)}
          </MessageFooter>
        </MessageContent>
      </Message>
    </MessageScrollerItem>
  );
}

function MessageThreadLoading() {
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Inbound Skeleton */}
      <div className="flex items-start gap-2.5 max-w-[70%]">
        <Skeleton className="size-7 rounded-full shrink-0" />
        <div className="flex flex-col gap-1.5 w-full">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-14 w-64 rounded-lg" />
        </div>
      </div>

      {/* Outbound Skeleton */}
      <div className="flex items-end flex-col gap-1.5 self-end max-w-[70%]">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-10 w-56 rounded-lg" />
      </div>

      {/* Inbound Skeleton */}
      <div className="flex items-start gap-2.5 max-w-[70%]">
        <Skeleton className="size-7 rounded-full shrink-0" />
        <div className="flex flex-col gap-1.5 w-full">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-20 w-72 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function MessageThread({
  conversationId,
  workspaceSlug,
  workspaceId,
  isDetailOpen = true,
  onToggleDetail = () => {},
}: MessageThreadProps) {
  useConversationRoom(conversationId);

  const { data: conversation, isLoading: isConversationLoading } = useConversation(conversationId, {
    workspaceSlug,
    workspaceId,
  });

  const {
    groupedMessages,
    isLoading: isMessagesLoading,
    isEmpty,
  } = useMessages(conversationId, {
    workspaceSlug,
    workspaceId,
    limit: 50,
  });

  const [lightboxState, setLightboxState] = React.useState<{
    isOpen: boolean;
    images: AttachmentDto[];
    initialIndex: number;
  }>({
    isOpen: false,
    images: [],
    initialIndex: 0,
  });

  const openLightbox = React.useCallback((images: AttachmentDto[], index = 0) => {
    setLightboxState({
      isOpen: true,
      images,
      initialIndex: index,
    });
  }, []);

  const closeLightbox = React.useCallback(() => {
    setLightboxState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const { data: workspaces } = useWorkspaces();
  const activeWorkspaceId =
    workspaceId ||
    conversation?.workspaceId ||
    (workspaceSlug ? workspaces?.find(w => w.slug === workspaceSlug)?.id : undefined) ||
    workspaces?.[0]?.id;

  const isLoading = isConversationLoading || isMessagesLoading;
  const contact = conversation?.contact;

  return (
    <div className="flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      {/* Thread Header */}
      <MessageThreadHeader
        conversation={conversation}
        isLoading={isConversationLoading}
        isDetailOpen={isDetailOpen}
        onToggleDetail={onToggleDetail}
      />

      {/* Message Stream Area */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {isLoading ? (
          <MessageThreadLoading />
        ) : isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
            <div className="rounded-full bg-muted p-3">
              <MessageSquare className="size-6 text-muted-foreground/60 stroke-[1.5]" />
            </div>
            <p className="text-xs font-medium text-foreground">No messages yet</p>
            <p className="text-[11px] text-muted-foreground max-w-xs leading-relaxed">
              This conversation doesn&apos;t have any messages. Start the conversation using the
              composer below.
            </p>
          </div>
        ) : (
          <MessageScroller autoScroll defaultScrollPosition="end" className="h-full">
            <MessageScrollerViewport className="p-4">
              <MessageScrollerContent className="gap-4">
                {groupedMessages.map(group => (
                  <React.Fragment key={group.dateKey}>
                    {/* Date Separator */}
                    <Marker variant="separator" className="my-2">
                      <MarkerContent className="text-[11px] font-medium text-muted-foreground">
                        {group.dateLabel}
                      </MarkerContent>
                    </Marker>

                    {/* Messages in this day */}
                    {group.messages.map(message => (
                      <MessageItem
                        key={message.id}
                        message={message}
                        contactName={contact?.name}
                        contactAvatar={contact?.avatarUrl}
                        workspaceId={activeWorkspaceId}
                        onOpenLightbox={openLightbox}
                      />
                    ))}
                  </React.Fragment>
                ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>

            {/* Floating Jump to Latest Button */}
            <MessageScrollerButton direction="end" />
          </MessageScroller>
        )}
      </div>

      {/* Typing Status Indicator */}
      <TypingIndicator conversationId={conversationId} />

      {/* Live Message Composer */}
      <ChatComposer
        conversationId={conversationId}
        workspaceSlug={workspaceSlug}
        workspaceId={activeWorkspaceId}
      />

      {/* Lightbox Carousel Modal */}
      <ImageLightboxDialog
        isOpen={lightboxState.isOpen}
        images={lightboxState.images}
        initialIndex={lightboxState.initialIndex}
        onClose={closeLightbox}
      />
    </div>
  );
}
