'use client';

import * as React from 'react';
import { useConversationFilters, type AssignmentFilter } from './hooks/use-conversation-filters';
import { useConversationCounts } from './hooks/use-conversation-counts';
import { cn } from '@/lib/utils';
import { ConversationStatus } from '@/lib/api/types';

import { useI18n } from '@/lib/i18n';

interface ConversationListFiltersProps {
  workspaceSlug: string;
}

export function ConversationListFilters({ workspaceSlug }: ConversationListFiltersProps) {
  const { filters, setAssignment } = useConversationFilters();
  const { t } = useI18n();

  // Fetch live counts for Mine, Unassigned, All based on current status
  const effectiveStatus =
    filters.status !== 'ALL' ? (filters.status as ConversationStatus) : undefined;
  const { counts, isLoading: isCountsLoading } = useConversationCounts({
    workspaceSlug,
    status: effectiveStatus,
  });

  const tabItems: Array<{ key: AssignmentFilter; label: string; count?: number }> = [
    {
      key: 'mine',
      label: t('conversations.tabs.mine'),
      count: counts?.mine,
    },
    {
      key: 'unassigned',
      label: t('conversations.tabs.unassigned'),
      count: counts?.unassigned,
    },
    {
      key: 'all',
      label: t('conversations.tabs.all'),
      count: counts?.all,
    },
  ];

  // Chatwoot Alt+N shortcut to cycle through tabs
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        const currentIndex = tabItems.findIndex(tab => tab.key === filters.assignment);
        const nextIndex = (currentIndex + 1) % tabItems.length;
        setAssignment(tabItems[nextIndex].key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filters.assignment, setAssignment, tabItems]);

  return (
    <div className="flex h-10 w-full items-center border-b border-border/60 bg-background/50 px-3 shrink-0">
      <nav className="flex items-center gap-6 h-full" aria-label="Conversation Assignment Tabs">
        {tabItems.map(tab => {
          const isActive = filters.assignment === tab.key;
          const countDisplay = tab.count !== undefined && !isCountsLoading ? tab.count : null;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setAssignment(tab.key)}
              className={cn(
                'relative flex items-center gap-1.5 h-full text-xs transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                isActive
                  ? 'text-primary font-semibold after:absolute after:bottom-0 after:inset-x-0 after:h-0.5 after:bg-primary'
                  : 'text-muted-foreground hover:text-foreground font-medium',
              )}
            >
              <span>{tab.label}</span>
              {countDisplay !== null && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0 text-[10px] tabular-nums font-semibold transition-colors',
                    isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {countDisplay}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
