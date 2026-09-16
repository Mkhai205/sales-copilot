import type { LucideIcon } from 'lucide-react';
import { FileText, Inbox, Settings, Tag, UserCheck, Users2, Webhook, Zap } from 'lucide-react';
import { WorkspaceRole } from '@sales-copilot/shared-contracts';

export type SettingsCategory = 'workspace' | 'operations';

export interface SettingsNavItem {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  segment: string;
  category: SettingsCategory;
  allowedRoles: WorkspaceRole[];
  adminOnly?: boolean;
}

export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  // Workspace Settings Category
  {
    id: 'general',
    title: 'General',
    description: 'Workspace profile, timezone, and default language settings',
    icon: Settings,
    segment: 'general',
    category: 'workspace',
    allowedRoles: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN],
    adminOnly: true,
  },
  {
    id: 'inboxes',
    title: 'Inboxes & Channels',
    description: 'Manage communication channels (Web Chat, Facebook, Telegram, Email)',
    icon: Inbox,
    segment: 'inboxes',
    category: 'workspace',
    allowedRoles: [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.AGENT,
      WorkspaceRole.VIEWER,
    ],
  },
  {
    id: 'teams',
    title: 'Teams',
    description: 'Organize agents into collaborative customer support teams',
    icon: Users2,
    segment: 'teams',
    category: 'workspace',
    allowedRoles: [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.AGENT,
      WorkspaceRole.VIEWER,
    ],
  },
  {
    id: 'members',
    title: 'Members & Roles',
    description: 'Invite team members and manage workspace permissions',
    icon: UserCheck,
    segment: 'members',
    category: 'workspace',
    allowedRoles: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN],
    adminOnly: true,
  },

  // Operations Settings Category
  {
    id: 'labels',
    title: 'Labels',
    description: 'Create and organize conversation tags and color palettes',
    icon: Tag,
    segment: 'labels',
    category: 'operations',
    allowedRoles: [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.AGENT,
      WorkspaceRole.VIEWER,
    ],
  },
  {
    id: 'canned-responses',
    title: 'Canned Responses',
    description: 'Standardized quick replies with shortcode slash triggers',
    icon: FileText,
    segment: 'canned-responses',
    category: 'operations',
    allowedRoles: [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.AGENT,
      WorkspaceRole.VIEWER,
    ],
  },
  {
    id: 'automation-rules',
    title: 'Automation Rules',
    description: 'Event-triggered workflows, conditions, and auto-assignment actions',
    icon: Zap,
    segment: 'automation-rules',
    category: 'operations',
    allowedRoles: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN],
    adminOnly: true,
  },
  {
    id: 'webhooks',
    title: 'Webhooks',
    description: 'Outbound HTTP event webhooks and delivery attempt audit logs',
    icon: Webhook,
    segment: 'webhooks',
    category: 'operations',
    allowedRoles: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN],
    adminOnly: true,
  },
];

export const SETTINGS_CATEGORIES: { id: SettingsCategory; label: string }[] = [
  { id: 'workspace', label: 'Workspace Settings' },
  { id: 'operations', label: 'Operations' },
];

/**
 * Filter settings navigation items permitted for a specific role
 */
export function getPermittedSettingsNavItems(role?: WorkspaceRole | null): SettingsNavItem[] {
  if (!role) return [];
  return SETTINGS_NAV_ITEMS.filter(item => item.allowedRoles.includes(role));
}

/**
 * Check if a specific segment is accessible by a given role
 */
export function isSettingsSectionAllowed(segment: string, role?: WorkspaceRole | null): boolean {
  if (!role) return false;
  const item = SETTINGS_NAV_ITEMS.find(nav => nav.segment === segment);
  if (!item) return false;
  return item.allowedRoles.includes(role);
}

/**
 * Get the default route for a user based on their workspace role
 */
export function getDefaultSettingsRoute(
  workspaceSlug: string,
  role?: WorkspaceRole | null,
): string {
  const permitted = getPermittedSettingsNavItems(role);
  if (permitted.length > 0) {
    return `/${workspaceSlug}/settings/${permitted[0].segment}`;
  }
  return `/${workspaceSlug}/conversations`;
}
