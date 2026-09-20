/**
 * Centralized Query Keys Factory for TanStack Query
 * Ensures unified cache keys, correct prefix invalidations, and zero cache fragmentation.
 */

export const commerceKeys = {
  all: ['commerce'] as const,
  orders: (workspaceId?: string, query?: any) =>
    query !== undefined
      ? (['commerce-orders', workspaceId, query] as const)
      : workspaceId !== undefined
        ? (['commerce-orders', workspaceId] as const)
        : (['commerce-orders'] as const),
  order: (workspaceId?: string, id?: string) =>
    id !== undefined
      ? (['commerce-order', workspaceId, id] as const)
      : workspaceId !== undefined
        ? (['commerce-order', workspaceId] as const)
        : (['commerce-order'] as const),
  activeOrder: (workspaceId?: string, conversationId?: string, contactId?: string) =>
    conversationId !== undefined || contactId !== undefined
      ? (['active-conversation-order', workspaceId, conversationId, contactId] as const)
      : workspaceId !== undefined
        ? (['active-conversation-order', workspaceId] as const)
        : (['active-conversation-order'] as const),
  products: (workspaceId?: string, query?: any) =>
    query !== undefined
      ? (['commerce-products', workspaceId, query] as const)
      : workspaceId !== undefined
        ? (['commerce-products', workspaceId] as const)
        : (['commerce-products'] as const),
  product: (workspaceId?: string, id?: string) =>
    id !== undefined
      ? (['commerce-product', workspaceId, id] as const)
      : workspaceId !== undefined
        ? (['commerce-product', workspaceId] as const)
        : (['commerce-product'] as const),
  inventoryVariants: (workspaceId?: string, query?: any) =>
    query !== undefined
      ? (['inventory-variants', workspaceId, query] as const)
      : workspaceId !== undefined
        ? (['inventory-variants', workspaceId] as const)
        : (['inventory-variants'] as const),
  inventorySummary: (workspaceId?: string) =>
    workspaceId !== undefined
      ? (['inventory-summary', workspaceId] as const)
      : (['inventory-summary'] as const),
  inventoryTransactions: (workspaceId?: string, query?: any) =>
    query !== undefined
      ? (['inventory-transactions', workspaceId, query] as const)
      : workspaceId !== undefined
        ? (['inventory-transactions', workspaceId] as const)
        : (['inventory-transactions'] as const),
};

export const conversationKeys = {
  all: ['conversations'] as const,
  list: (workspaceId?: string, query?: any, limit?: number) =>
    limit !== undefined
      ? (['conversations', workspaceId, query, limit] as const)
      : query !== undefined
        ? (['conversations', workspaceId, query] as const)
        : workspaceId !== undefined
          ? (['conversations', workspaceId] as const)
          : (['conversations'] as const),
  detail: (workspaceId?: string, conversationId?: string) =>
    conversationId !== undefined
      ? (['conversation', workspaceId, conversationId] as const)
      : workspaceId !== undefined
        ? (['conversation', workspaceId] as const)
        : (['conversation'] as const),
  messages: (workspaceId?: string, conversationId?: string, limit?: number) =>
    limit !== undefined
      ? (['messages', workspaceId, conversationId, limit] as const)
      : conversationId !== undefined
        ? (['messages', workspaceId, conversationId] as const)
        : workspaceId !== undefined
          ? (['messages', workspaceId] as const)
          : (['messages'] as const),
  counts: (workspaceId?: string, status?: any) =>
    status !== undefined
      ? (['conversation-counts', workspaceId, status] as const)
      : workspaceId !== undefined
        ? (['conversation-counts', workspaceId] as const)
        : (['conversation-counts'] as const),
};

export const contactKeys = {
  all: ['contacts'] as const,
  list: (workspaceId?: string, query?: any) =>
    query !== undefined
      ? (['contacts', workspaceId, query] as const)
      : workspaceId !== undefined
        ? (['contacts', workspaceId] as const)
        : (['contacts'] as const),
  detail: (workspaceId?: string, contactId?: string) =>
    contactId !== undefined
      ? (['contact', workspaceId, contactId] as const)
      : workspaceId !== undefined
        ? (['contact', workspaceId] as const)
        : (['contact'] as const),
  orders: (workspaceId?: string, contactId?: string) =>
    contactId !== undefined
      ? (['contact-orders', workspaceId, contactId] as const)
      : workspaceId !== undefined
        ? (['contact-orders', workspaceId] as const)
        : (['contact-orders'] as const),
  identities: (workspaceId?: string, contactId?: string) =>
    contactId !== undefined
      ? (['contact-identities', workspaceId, contactId] as const)
      : workspaceId !== undefined
        ? (['contact-identities', workspaceId] as const)
        : (['contact-identities'] as const),
  conversations: (workspaceId?: string, contactId?: string) =>
    contactId !== undefined
      ? (['contact-conversations', workspaceId, contactId] as const)
      : workspaceId !== undefined
        ? (['contact-conversations', workspaceId] as const)
        : (['contact-conversations'] as const),
};

export const memberKeys = {
  all: ['workspace-members'] as const,
  list: (workspaceId?: string) => ['workspace-members', workspaceId] as const,
  detail: (workspaceId?: string, userId?: string) =>
    ['workspace-members', workspaceId, userId] as const,
};

export const teamKeys = {
  all: ['teams'] as const,
  list: (workspaceId?: string) => ['teams', workspaceId] as const,
  detail: (workspaceId?: string, id?: string) => ['teams', workspaceId, id] as const,
};

export const cannedResponseKeys = {
  all: ['canned-responses'] as const,
  list: (workspaceId?: string, queryOrSearch?: any) =>
    queryOrSearch !== undefined
      ? (['canned-responses', workspaceId, queryOrSearch] as const)
      : (['canned-responses', workspaceId] as const),
  detail: (workspaceId?: string, id?: string) => ['canned-responses', workspaceId, id] as const,
};

export const labelKeys = {
  all: ['labels'] as const,
  list: (workspaceId?: string, query?: any) =>
    query !== undefined
      ? (['labels', workspaceId, query] as const)
      : (['labels', workspaceId] as const),
  detail: (workspaceId?: string, id?: string) => ['labels', workspaceId, id] as const,
};

export const inboxKeys = {
  all: ['inboxes'] as const,
  list: (workspaceId?: string) => ['inboxes', workspaceId] as const,
  detail: (workspaceId?: string, id?: string) => ['inboxes', workspaceId, id] as const,
  members: (workspaceId?: string, id?: string) => ['inboxes', workspaceId, id, 'members'] as const,
};

export const workspaceKeys = {
  all: ['workspaces'] as const,
  list: ['workspaces', 'list'] as const,
  current: (workspaceId?: string) =>
    workspaceId
      ? (['workspaces', 'current', workspaceId] as const)
      : (['workspaces', 'current'] as const),
  members: (workspaceId?: string) => memberKeys.list(workspaceId),
  teams: (workspaceId?: string) => teamKeys.list(workspaceId),
  bankConfig: (workspaceId?: string) =>
    workspaceId
      ? (['workspace', workspaceId, 'bank-config'] as const)
      : (['workspace', 'bank-config'] as const),
};

export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: (workspaceId?: string) =>
    workspaceId !== undefined
      ? (['dashboard-summary', workspaceId] as const)
      : (['dashboard-summary'] as const),
};

export const presenceKeys = {
  all: ['presence'] as const,
  list: (workspaceId?: string) =>
    workspaceId !== undefined ? (['presence', workspaceId] as const) : (['presence'] as const),
};

export const queryKeys = {
  commerce: commerceKeys,
  conversations: conversationKeys,
  contacts: contactKeys,
  workspaces: workspaceKeys,
  cannedResponses: cannedResponseKeys,
  teams: teamKeys,
  members: memberKeys,
  labels: labelKeys,
  inboxes: inboxKeys,
  dashboard: dashboardKeys,
  presence: presenceKeys,
};
