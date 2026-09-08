'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { conversationsApi } from '@/lib/api/conversations';
import { labelsApi } from '@/lib/api/labels';
import { useWorkspaceLabels } from './use-detail-metadata';
import type { ConversationResponseDto } from '@/lib/api/types';

export interface QuickTagConfig {
  index: number;
  shortcut: string;
  title: string;
  label: string;
  color: string;
}

export const QUICK_TAGS: QuickTagConfig[] = [
  {
    index: 1,
    shortcut: 'Alt+1',
    title: 'DA_CHUYEN_KHOAN',
    label: '#DA_CHUYEN_KHOAN',
    color: '#10b981',
  },
  { index: 2, shortcut: 'Alt+2', title: 'CHO_GIAO', label: '#CHO_GIAO', color: '#0ea5e9' },
  { index: 3, shortcut: 'Alt+3', title: 'DANG_GIAO', label: '#DANG_GIAO', color: '#8b5cf6' },
  { index: 4, shortcut: 'Alt+4', title: 'HET_HANG', label: '#HET_HANG', color: '#f59e0b' },
  { index: 5, shortcut: 'Alt+5', title: 'CAN_TU_VAN', label: '#CAN_TU_VAN', color: '#eab308' },
  {
    index: 6,
    shortcut: 'Alt+6',
    title: 'CHO_KHACH_CHECK',
    label: '#CHO_KHACH_CHECK',
    color: '#6366f1',
  },
  { index: 7, shortcut: 'Alt+7', title: 'BOM_HANG', label: '#BOM_HANG', color: '#ef4444' },
];

export function useQuickTags({
  workspaceId,
  conversationId,
  conversation,
}: {
  workspaceId?: string;
  conversationId?: string;
  conversation?: ConversationResponseDto | null;
}) {
  const queryClient = useQueryClient();
  const { labels } = useWorkspaceLabels({ workspaceId });
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Active labels currently on conversation
  const activeLabelIds = React.useMemo(() => {
    return new Set((conversation?.labels || []).map(l => l.id));
  }, [conversation?.labels]);

  const activeTagTitles = React.useMemo(() => {
    return new Set((conversation?.labels || []).map(l => l.title));
  }, [conversation?.labels]);

  // Toggle label on conversation (add if not present, remove if present)
  const toggleQuickTag = React.useCallback(
    async (tag: QuickTagConfig) => {
      if (!workspaceId || !conversationId || isProcessing) return;

      setIsProcessing(true);
      try {
        // 1. Find existing label in workspace or create it idempotently
        let existingLabel = labels.find(
          l =>
            l.title.toLowerCase() === tag.title.toLowerCase() ||
            l.title.toLowerCase() === tag.label.toLowerCase(),
        );

        if (!existingLabel) {
          try {
            const created = await labelsApi.create(workspaceId, {
              title: tag.title,
              color: tag.color,
              showOnSidebar: true,
            });
            existingLabel = created.data;
            queryClient.invalidateQueries({ queryKey: ['labels', workspaceId] });
          } catch {
            // In case of 409 conflict, refetch labels
            const refetched = await labelsApi.list(workspaceId);
            existingLabel = refetched.data?.find(
              l =>
                l.title.toLowerCase() === tag.title.toLowerCase() ||
                l.title.toLowerCase() === tag.label.toLowerCase(),
            );
          }
        }

        if (!existingLabel) {
          throw new Error(`Không thể khởi tạo nhãn ${tag.label}`);
        }

        const isCurrentlyActive =
          activeLabelIds.has(existingLabel.id) ||
          activeTagTitles.has(tag.title) ||
          activeTagTitles.has(tag.label) ||
          activeTagTitles.has(existingLabel.title);

        if (isCurrentlyActive) {
          // Remove label from conversation
          await conversationsApi.removeLabel(workspaceId, conversationId, existingLabel.id);
          toast.success(`Đã bỏ nhãn ${tag.label}`);
        } else {
          // Assign label to conversation
          await conversationsApi.assignLabels(workspaceId, conversationId, {
            labelIds: [existingLabel.id],
          });
          toast.success(`Đã gắn nhãn ${tag.label}`);
        }

        // Invalidate conversation queries
        queryClient.invalidateQueries({
          queryKey: ['conversation', workspaceId, conversationId],
        });
        queryClient.invalidateQueries({
          queryKey: ['conversations', workspaceId],
        });
      } catch (err: any) {
        toast.error(err?.message || 'Lỗi khi gắn nhãn nhanh');
      } finally {
        setIsProcessing(false);
      }
    },
    [
      workspaceId,
      conversationId,
      isProcessing,
      labels,
      activeLabelIds,
      activeTagTitles,
      queryClient,
    ],
  );

  // Global Alt+1..7 keyboard listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Must have Alt pressed, without Ctrl or Meta
      if (!e.altKey || e.ctrlKey || e.metaKey) return;

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 7) {
        const targetTag = QUICK_TAGS.find(t => t.index === num);
        if (targetTag) {
          e.preventDefault();
          toggleQuickTag(targetTag);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleQuickTag]);

  return {
    quickTags: QUICK_TAGS,
    activeTagTitles,
    toggleQuickTag,
    isProcessing,
  };
}
