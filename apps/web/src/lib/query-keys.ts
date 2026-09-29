/**
 * Centralized Query Keys Factory for TanStack Query
 * Ensures unified cache keys, correct prefix invalidations, and zero cache fragmentation.
 */

export const commerceKeys = {
  all: ['commerce'] as const,
  orders: (workspaceId?: string, query?: any) =>
    query !== undefined
      ? (['commerce', 'orders', workspaceId, query] as const)
      : workspaceId !== undefined
        ? (['commerce', 'orders', workspaceId] as const)
        : (['commerce', 'orders'] as const),
  order: (workspaceId?: string, id?: string) =>
    id !== undefined
      ? (['commerce', 'order', workspaceId, id] as const)
      : workspaceId !== undefined
        ? (['commerce', 'order', workspaceId] as const)
        : (['commerce', 'order'] as const),
  activeOrder: (workspaceId?: string, conversationId?: string, contactId?: string) =>
    conversationId !== undefined || contactId !== undefined
      ? (['commerce', 'active-order', workspaceId, conversationId, contactId] as const)
      : workspaceId !== undefined
        ? (['commerce', 'active-order', workspaceId] as const)
        : (['commerce', 'active-order'] as const),
  products: (workspaceId?: string, query?: any) =>
    query !== undefined
      ? (['commerce', 'products', workspaceId, query] as const)
      : workspaceId !== undefined
        ? (['commerce', 'products', workspaceId] as const)
        : (['commerce', 'products'] as const),
  product: (workspaceId?: string, id?: string) =>
    id !== undefined
      ? (['commerce', 'product', workspaceId, id] as const)
      : workspaceId !== undefined
        ? (['commerce', 'product', workspaceId] as const)
        : (['commerce', 'product'] as const),
  inventoryVariants: (workspaceId?: string, query?: any) =>
    query !== undefined
      ? (['commerce', 'inventory', 'variants', workspaceId, query] as const)
      : workspaceId !== undefined
        ? (['commerce', 'inventory', 'variants', workspaceId] as const)
        : (['commerce', 'inventory', 'variants'] as const),
  inventorySummary: (workspaceId?: string) =>
    workspaceId !== undefined
      ? (['commerce', 'inventory', 'summary', workspaceId] as const)
      : (['commerce', 'inventory', 'summary'] as const),
  inventoryTransactions: (workspaceId?: string, query?: any) =>
    query !== undefined
      ? (['commerce', 'inventory', 'transactions', workspaceId, query] as const)
      : workspaceId !== undefined
        ? (['commerce', 'inventory', 'transactions', workspaceId] as const)
        : (['commerce', 'inventory', 'transactions'] as const),
};

export const conversationKeys = {
  all: ['conversations'] as const,
  list: (workspaceId?: string, query?: any, limit?: number) =>
    limit !== undefined
      ? (['conversations', 'list', workspaceId, query, limit] as const)
      : query !== undefined
        ? (['conversations', 'list', workspaceId, query] as const)
        : workspaceId !== undefined
          ? (['conversations', 'list', workspaceId] as const)
          : (['conversations', 'list'] as const),
  detail: (workspaceId?: string, conversationId?: string) =>
    conversationId !== undefined
      ? (['conversations', 'detail', workspaceId, conversationId] as const)
      : workspaceId !== undefined
        ? (['conversations', 'detail', workspaceId] as const)
        : (['conversations', 'detail'] as const),
  messages: (workspaceId?: string, conversationId?: string, limit?: number) =>
    limit !== undefined
      ? (['conversations', 'messages', workspaceId, conversationId, limit] as const)
      : conversationId !== undefined
        ? (['conversations', 'messages', workspaceId, conversationId] as const)
        : workspaceId !== undefined
          ? (['conversations', 'messages', workspaceId] as const)
          : (['conversations', 'messages'] as const),
  counts: (workspaceId?: string, status?: any) =>
    status !== undefined
      ? (['conversations', 'counts', workspaceId, status] as const)
      : workspaceId !== undefined
        ? (['conversations', 'counts', workspaceId] as const)
        : (['conversations', 'counts'] as const),
};

export const contactKeys = {
  all: ['contacts'] as const,
  list: (workspaceId?: string, query?: any) =>
    query !== undefined
      ? (['contacts', 'list', workspaceId, query] as const)
      : workspaceId !== undefined
        ? (['contacts', 'list', workspaceId] as const)
        : (['contacts', 'list'] as const),
  detail: (workspaceId?: string, contactId?: string) =>
    contactId !== undefined
      ? (['contacts', 'detail', workspaceId, contactId] as const)
      : workspaceId !== undefined
        ? (['contacts', 'detail', workspaceId] as const)
        : (['contacts', 'detail'] as const),
  orders: (workspaceId?: string, contactId?: string) =>
    contactId !== undefined
      ? (['contacts', 'orders', workspaceId, contactId] as const)
      : workspaceId !== undefined
        ? (['contacts', 'orders', workspaceId] as const)
        : (['contacts', 'orders'] as const),
  identities: (workspaceId?: string, contactId?: string) =>
    contactId !== undefined
      ? (['contacts', 'identities', workspaceId, contactId] as const)
      : workspaceId !== undefined
        ? (['contacts', 'identities', workspaceId] as const)
        : (['contacts', 'identities'] as const),
  conversations: (workspaceId?: string, contactId?: string) =>
    contactId !== undefined
      ? (['contacts', 'conversations', workspaceId, contactId] as const)
      : workspaceId !== undefined
        ? (['contacts', 'conversations', workspaceId] as const)
        : (['contacts', 'conversations'] as const),
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
  facebookDiscoveredPages: (workspaceId?: string, sessionId?: string) =>
    sessionId !== undefined
      ? (['inboxes', workspaceId, 'facebook', 'discovered-pages', sessionId] as const)
      : (['inboxes', workspaceId, 'facebook', 'discovered-pages'] as const),
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
      ? (['workspaces', workspaceId, 'bank-config'] as const)
      : (['workspaces', 'bank-config'] as const),
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

export const reconciliationKeys = {
  all: ['reconciliation'] as const,
  transactions: (workspaceId?: string, query?: any) =>
    query !== undefined
      ? (['reconciliation', 'transactions', workspaceId, query] as const)
      : workspaceId !== undefined
        ? (['reconciliation', 'transactions', workspaceId] as const)
        : (['reconciliation', 'transactions'] as const),
  stats: (workspaceId?: string, query?: any) =>
    query !== undefined
      ? (['reconciliation', 'stats', workspaceId, query] as const)
      : workspaceId !== undefined
        ? (['reconciliation', 'stats', workspaceId] as const)
        : (['reconciliation', 'stats'] as const),
};

export const knowledgeKeys = {
  all: ['knowledge'] as const,
  list: (workspaceId?: string, query?: any) =>
    query !== undefined
      ? (['knowledge', 'articles', workspaceId, query] as const)
      : workspaceId !== undefined
        ? (['knowledge', 'articles', workspaceId] as const)
        : (['knowledge', 'articles'] as const),
  detail: (workspaceId?: string, id?: string) =>
    id !== undefined
      ? (['knowledge', 'article', workspaceId, id] as const)
      : workspaceId !== undefined
        ? (['knowledge', 'article', workspaceId] as const)
        : (['knowledge', 'article'] as const),
};

export const currentUserKeys = {
  all: ['auth'] as const,
  me: ['auth', 'me'] as const,
};

export const geoKeys = {
  all: ['geo'] as const,
  provinces: ['geo-provinces'] as const,
  districts: (provinceName?: string) =>
    provinceName !== undefined
      ? (['geo-districts', provinceName] as const)
      : (['geo-districts'] as const),
  wards: (districtName?: string) =>
    districtName !== undefined ? (['geo-wards', districtName] as const) : (['geo-wards'] as const),
};

export const platformAdminKeys = {
  all: ['platform-admin'] as const,
  metrics: ['platform-admin', 'metrics', 'overview'] as const,
  auditLogs: (params?: any) =>
    params !== undefined
      ? (['platform-admin', 'audit-logs', params] as const)
      : (['platform-admin', 'audit-logs'] as const),
  settings: {
    all: ['platform-admin', 'settings'] as const,
    list: (category?: string) =>
      category !== undefined
        ? (['platform-admin', 'settings', category] as const)
        : (['platform-admin', 'settings'] as const),
  },
  workspaces: {
    all: ['platform-admin', 'workspaces'] as const,
    list: (params?: any) =>
      params !== undefined
        ? (['platform-admin', 'workspaces', params] as const)
        : (['platform-admin', 'workspaces'] as const),
    detail: (id?: string) =>
      id !== undefined
        ? (['platform-admin', 'workspaces', 'detail', id] as const)
        : (['platform-admin', 'workspaces', 'detail'] as const),
  },
};
