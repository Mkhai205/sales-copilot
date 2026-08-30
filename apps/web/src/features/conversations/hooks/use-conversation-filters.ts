'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ConversationPriority,
  ConversationStatus,
  Priority,
  type ConversationListQueryDto,
  type ConversationSortBy,
} from '@/lib/api/types';
import { useCurrentUser } from '@/features/auth/use-current-user';

export type AssignmentFilter = 'mine' | 'unassigned' | 'all';
export type StatusFilter = ConversationStatus | 'ALL';

export interface ConversationFilters {
  status: StatusFilter;
  assignment: AssignmentFilter;
  q: string;
  inboxId?: string;
  priority?: Priority;
  labelId?: string;
  sortBy: ConversationSortBy;
  sortOrder: 'asc' | 'desc';
}

export function useConversationFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: currentUser } = useCurrentUser();

  // 1. Read current filters from URL search params
  const statusParam = searchParams.get('status') as StatusFilter | null;
  const status: StatusFilter =
    statusParam &&
    (Object.values(ConversationStatus).includes(statusParam as ConversationStatus) ||
      statusParam === 'ALL')
      ? statusParam
      : ConversationStatus.OPEN;

  const assignmentParam = searchParams.get('assignment') as AssignmentFilter | null;
  const assignment: AssignmentFilter =
    assignmentParam === 'mine' || assignmentParam === 'unassigned' ? assignmentParam : 'all';

  const q = searchParams.get('q') || '';
  const inboxId = searchParams.get('inboxId') || undefined;
  const priorityParam = searchParams.get('priority') as Priority | null;
  const priority =
    priorityParam && Object.values(Priority).includes(priorityParam) ? priorityParam : undefined;
  const labelId = searchParams.get('labelId') || undefined;

  const sortByParam = searchParams.get('sortBy') as ConversationSortBy | null;
  const sortBy: ConversationSortBy =
    sortByParam &&
    ['lastActivityAt', 'createdAt', 'priority', 'unreadMessagesCount'].includes(sortByParam)
      ? sortByParam
      : 'lastActivityAt';

  const sortOrderParam = searchParams.get('sortOrder');
  const sortOrder: 'asc' | 'desc' = sortOrderParam === 'asc' ? 'asc' : 'desc';

  const filters: ConversationFilters = React.useMemo(
    () => ({
      status,
      assignment,
      q,
      inboxId,
      priority,
      labelId,
      sortBy,
      sortOrder,
    }),
    [status, assignment, q, inboxId, priority, labelId, sortBy, sortOrder],
  );

  // 2. Helper to batch update search params
  const updateFilters = React.useCallback(
    (newParams: Partial<Record<keyof ConversationFilters, string | undefined | null>>) => {
      const current = new URLSearchParams(Array.from(searchParams.entries()));

      Object.entries(newParams).forEach(([key, value]) => {
        if (
          value === undefined ||
          value === null ||
          value === '' ||
          value === 'all' ||
          (key === 'status' && value === ConversationStatus.OPEN)
        ) {
          // If value is default or empty, remove it to keep clean URLs
          if (key === 'status' && value === ConversationStatus.OPEN) {
            current.delete('status');
          } else if (key === 'assignment' && value === 'all') {
            current.delete('assignment');
          } else {
            current.delete(key);
          }
        } else {
          current.set(key, String(value));
        }
      });

      const search = current.toString();
      const query = search ? `?${search}` : '';
      router.replace(`${pathname}${query}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  // 3. Granular Setters
  const setStatus = React.useCallback(
    (newStatus: StatusFilter) => {
      updateFilters({ status: newStatus });
    },
    [updateFilters],
  );

  const setAssignment = React.useCallback(
    (newAssignment: AssignmentFilter) => {
      updateFilters({ assignment: newAssignment });
    },
    [updateFilters],
  );

  const setSearch = React.useCallback(
    (query: string) => {
      updateFilters({ q: query || undefined });
    },
    [updateFilters],
  );

  const setInbox = React.useCallback(
    (newInboxId?: string) => {
      updateFilters({ inboxId: newInboxId });
    },
    [updateFilters],
  );

  const setPriority = React.useCallback(
    (newPriority?: Priority) => {
      updateFilters({ priority: newPriority });
    },
    [updateFilters],
  );

  const setLabel = React.useCallback(
    (newLabelId?: string) => {
      updateFilters({ labelId: newLabelId });
    },
    [updateFilters],
  );

  const setSorting = React.useCallback(
    (newSortBy: ConversationSortBy, newSortOrder: 'asc' | 'desc' = 'desc') => {
      updateFilters({ sortBy: newSortBy, sortOrder: newSortOrder });
    },
    [updateFilters],
  );

  const resetFilters = React.useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  // 4. Resolve exact DTO for conversations API
  const apiQuery: ConversationListQueryDto = React.useMemo(() => {
    const query: ConversationListQueryDto = {
      sortBy,
      sortOrder,
    };

    if (status !== 'ALL') {
      query.status = status;
    }

    if (assignment === 'mine' && currentUser?.id) {
      query.assigneeId = currentUser.id;
    } else if (assignment === 'unassigned') {
      query.assigneeId = 'unassigned';
    }

    if (q.trim()) {
      query.q = q.trim();
    }

    if (inboxId) {
      query.inboxId = inboxId;
    }

    if (priority) {
      query.priority = priority;
    }

    if (labelId) {
      query.labelId = labelId;
    }

    return query;
  }, [status, assignment, q, inboxId, priority, labelId, sortBy, sortOrder, currentUser]);

  return {
    filters,
    apiQuery,
    setStatus,
    setAssignment,
    setSearch,
    setInbox,
    setPriority,
    setLabel,
    setSorting,
    resetFilters,
    updateFilters,
  };
}
