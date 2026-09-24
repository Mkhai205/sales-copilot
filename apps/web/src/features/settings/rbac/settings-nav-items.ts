import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  FileText,
  Inbox,
  Settings,
  Tag,
  UserCheck,
  Users2,
  Landmark,
} from 'lucide-react';
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
    title: 'Cài đặt chung',
    description: 'Thông tin tổ chức, múi giờ và ngôn ngữ mặc định',
    icon: Settings,
    segment: 'general',
    category: 'workspace',
    allowedRoles: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN],
    adminOnly: true,
  },
  {
    id: 'inboxes',
    title: 'Hộp thư',
    description: 'Quản lý kênh giao tiếp (Web Chat, Facebook, Telegram, Email)',
    icon: Inbox,
    segment: 'inboxes',
    category: 'workspace',
    allowedRoles: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT],
  },
  {
    id: 'teams',
    title: 'Đội nhóm',
    description: 'Tổ chức các tư vấn viên vào các nhóm hỗ trợ khách hàng',
    icon: Users2,
    segment: 'teams',
    category: 'workspace',
    allowedRoles: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT],
  },
  {
    id: 'members',
    title: 'Thành viên & Vai trò',
    description: 'Mời thành viên và quản lý quyền hạn trong workspace',
    icon: UserCheck,
    segment: 'members',
    category: 'workspace',
    allowedRoles: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN],
    adminOnly: true,
  },

  // Operations Settings Category
  {
    id: 'labels',
    title: 'Nhãn hội thoại',
    description: 'Tạo và quản lý nhãn phân loại hội thoại và bảng màu',
    icon: Tag,
    segment: 'labels',
    category: 'operations',
    allowedRoles: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT],
  },
  {
    id: 'canned-responses',
    title: 'Tin nhắn mẫu',
    description: 'Phản hồi nhanh bằng phím tắt gõ tắt',
    icon: FileText,
    segment: 'canned-responses',
    category: 'operations',
    allowedRoles: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT],
  },
  {
    id: 'bank',
    title: 'Ngân hàng & Thanh toán',
    description: 'Cấu hình tài khoản ngân hàng nhận tiền VietQR và SePay',
    icon: Landmark,
    segment: 'bank',
    category: 'operations',
    allowedRoles: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN],
    adminOnly: true,
  },
  {
    id: 'knowledge',
    title: 'Kiến thức AI',
    description: 'Quản lý chính sách, FAQ và kiến thức để AI Chatbot tư vấn chính xác',
    icon: BookOpen,
    segment: 'knowledge',
    category: 'operations',
    allowedRoles: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN],
  },
];

export const SETTINGS_CATEGORIES: { id: SettingsCategory; label: string }[] = [
  { id: 'workspace', label: 'Cài đặt Workspace' },
  { id: 'operations', label: 'Vận hành' },
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
