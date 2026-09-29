'use client';

import * as React from 'react';
import { DeliveryStatus, MessageType, SenderType } from '@sales-copilot/shared-contracts';
import type { MessageResponseDto } from '@sales-copilot/shared-contracts';
import { useMessageScroller } from '@/components/ui/message-scroller';

interface MessageThreadScrollerControllerProps {
  messages: MessageResponseDto[];
  conversationId: string;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  onAtBottom: () => void;
  onNewInboundMessage: () => void;
}

/**
 * Render-null scroll brain: near-bottom detection, conversation-switch jump,
 * first-load jump, new-message behavior (agent → smooth scroll; inbound while
 * scrolled-up → unread bump) and scroll anchoring when older messages are
 * prepended by "load older".
 */
export function MessageThreadScrollerController({
  messages,
  conversationId,
  viewportRef,
  onAtBottom,
  onNewInboundMessage,
}: MessageThreadScrollerControllerProps) {
  const { scrollToEnd } = useMessageScroller();
  const prevConversationIdRef = React.useRef(conversationId);
  const prevCountRef = React.useRef(messages.length);
  const prevLastIdRef = React.useRef(messages[messages.length - 1]?.id);
  const prevFirstIdRef = React.useRef(messages[0]?.id);
  const prevScrollHeightRef = React.useRef(0);

  // Helper to check if viewport is currently near the bottom (within 150px)
  const isNearBottom = React.useCallback(() => {
    const el = viewportRef.current;
    if (!el) return true;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distanceFromBottom <= 150;
  }, [viewportRef]);

  // Monitor scroll position to auto-reset unread pill when user scrolls back to bottom
  React.useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const handleScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom <= 80) {
        onAtBottom();
      }
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [viewportRef, onAtBottom]);

  // When switching conversations: instant jump to bottom
  React.useLayoutEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (prevConversationIdRef.current !== conversationId) {
      prevConversationIdRef.current = conversationId;
      prevCountRef.current = messages.length;
      prevLastIdRef.current = messages[messages.length - 1]?.id;
      prevFirstIdRef.current = messages[0]?.id;
      prevScrollHeightRef.current = viewportRef.current?.scrollHeight ?? 0;
      onAtBottom();
      scrollToEnd({ behavior: 'auto' });
      timer = setTimeout(() => {
        scrollToEnd({ behavior: 'auto' });
      }, 50);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [conversationId, messages, scrollToEnd, onAtBottom, viewportRef]);

  // On first mount when messages load: jump to bottom
  const isFirstMountRef = React.useRef(true);
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isFirstMountRef.current && messages.length > 0) {
      isFirstMountRef.current = false;
      scrollToEnd({ behavior: 'auto' });
      timer = setTimeout(() => {
        scrollToEnd({ behavior: 'auto' });
      }, 80);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [messages.length, scrollToEnd]);

  // Scroll anchoring: when older messages are PREPENDED (first id changed and
  // count grew), keep the viewport anchored to the content the user was on.
  React.useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const prevScrollHeight = prevScrollHeightRef.current;
    const prevFirstId = prevFirstIdRef.current;
    prevScrollHeightRef.current = el.scrollHeight;
    prevFirstIdRef.current = messages[0]?.id;

    const isPrepend =
      prevScrollHeight > 0 &&
      el.scrollHeight > prevScrollHeight &&
      prevFirstId !== undefined &&
      messages[0]?.id !== prevFirstId &&
      el.scrollTop > 0;
    if (isPrepend) {
      el.scrollTop += el.scrollHeight - prevScrollHeight;
    }
  }, [messages, viewportRef]);

  // React to new messages
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const currentCount = messages.length;
    const prevCount = prevCountRef.current;
    const lastMessage = messages[messages.length - 1];
    const prevLastId = prevLastIdRef.current;

    prevCountRef.current = currentCount;
    prevLastIdRef.current = lastMessage?.id;

    if (!lastMessage || currentCount === 0) {
      return () => {
        if (timer) clearTimeout(timer);
      };
    }

    // Trigger only when a new message is appended (count grew or last ID changed)
    const isNewMessage =
      currentCount > prevCount || (lastMessage.id && lastMessage.id !== prevLastId);
    if (!isNewMessage) {
      return () => {
        if (timer) clearTimeout(timer);
      };
    }

    const isAgent =
      lastMessage.senderType === SenderType.USER ||
      lastMessage.messageType === MessageType.OUTGOING ||
      lastMessage.deliveryStatus === DeliveryStatus.PENDING ||
      Boolean(lastMessage.isPrivate);

    if (isAgent) {
      // 1. Agent sent message -> ALWAYS smooth scroll to bottom
      requestAnimationFrame(() => {
        scrollToEnd({ behavior: 'smooth' });
      });
      timer = setTimeout(() => {
        scrollToEnd({ behavior: 'smooth' });
      }, 100);
    } else {
      // 2. Inbound message from contact
      if (isNearBottom()) {
        requestAnimationFrame(() => {
          scrollToEnd({ behavior: 'smooth' });
        });
      } else {
        // Scrolled up -> notify via button
        onNewInboundMessage();
      }
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [messages, isNearBottom, onNewInboundMessage, scrollToEnd]);

  return null;
}
