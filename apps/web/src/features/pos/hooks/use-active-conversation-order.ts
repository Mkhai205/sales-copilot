'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { OrderStatus, type OrderResponseDto } from '@sales-copilot/shared-contracts';
import { posApi } from '../api/pos-client';

export function useActiveConversationOrder({
  workspaceId,
  conversationId,
  contactId,
}: {
  workspaceId?: string;
  conversationId?: string;
  contactId?: string;
}) {
  const query = useQuery({
    queryKey: ['active-conversation-order', workspaceId, conversationId, contactId],
    queryFn: async () => {
      if (!workspaceId) throw new Error('Workspace ID is required');

      const orderMap = new Map<string, OrderResponseDto>();
      const fetchPromises: Promise<void>[] = [];

      if (conversationId) {
        fetchPromises.push(
          posApi
            .listOrders(workspaceId, {
              page: 1,
              limit: 20,
              sortBy: 'createdAt',
              sortOrder: 'desc',
              conversationId,
            })
            .then(res => {
              (res.data?.items || []).forEach(o => orderMap.set(o.id, o));
            })
            .catch(() => {}),
        );
      }

      if (contactId) {
        fetchPromises.push(
          posApi
            .listOrders(workspaceId, {
              page: 1,
              limit: 20,
              sortBy: 'createdAt',
              sortOrder: 'desc',
              contactId,
            })
            .then(res => {
              (res.data?.items || []).forEach(o => orderMap.set(o.id, o));
            })
            .catch(() => {}),
        );
      }

      await Promise.all(fetchPromises);

      const items = Array.from(orderMap.values());
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return items;
    },
    enabled: Boolean(workspaceId && (conversationId || contactId)),
    staleTime: 10_000,
  });

  const orders: OrderResponseDto[] = query.data || [];

  // Active order prioritization:
  // 1. Latest DRAFT in current conversation
  // 2. Latest DRAFT for contact
  // 3. Latest order in current conversation
  // 4. Latest order overall
  const activeOrder = React.useMemo<OrderResponseDto | null>(() => {
    if (orders.length === 0) return null;
    if (conversationId) {
      const convDraft = orders.find(
        o => o.conversationId === conversationId && o.status === OrderStatus.DRAFT,
      );
      if (convDraft) return convDraft;
    }
    const anyDraft = orders.find(o => o.status === OrderStatus.DRAFT);
    if (anyDraft) return anyDraft;

    if (conversationId) {
      const convOrder = orders.find(o => o.conversationId === conversationId);
      if (convOrder) return convOrder;
    }

    return orders[0] || null;
  }, [orders, conversationId]);

  return {
    ...query,
    orders,
    activeOrder,
    hasActiveOrder: Boolean(activeOrder),
  };
}
