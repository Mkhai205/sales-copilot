export interface AdminBreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * Maps current pathname to hierarchical breadcrumb items for the Super Admin portal.
 */
export function getAdminBreadcrumbs(pathname: string): AdminBreadcrumbItem[] {
  const rootItem: AdminBreadcrumbItem = { label: 'Platform Admin', href: '/platform-admin' };

  if (!pathname || typeof pathname !== 'string') {
    return [rootItem, { label: 'Tổng quan' }];
  }

  // Normalize: remove trailing slash (unless it's just '/')
  const normalized =
    pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  if (normalized === '/platform-admin') {
    return [rootItem, { label: 'Tổng quan' }];
  }

  if (normalized === '/platform-admin/workspaces') {
    return [rootItem, { label: 'Quản trị Workspaces' }];
  }

  if (normalized.startsWith('/platform-admin/workspaces/')) {
    return [
      rootItem,
      { label: 'Quản trị Workspaces', href: '/platform-admin/workspaces' },
      { label: 'Chi tiết Workspace' },
    ];
  }

  if (normalized === '/platform-admin/settings') {
    return [rootItem, { label: 'Cấu hình Hệ thống' }];
  }

  if (normalized.startsWith('/platform-admin/settings/')) {
    return [
      rootItem,
      { label: 'Cấu hình Hệ thống', href: '/platform-admin/settings' },
      { label: 'Chi tiết Cấu hình' },
    ];
  }

  if (normalized === '/platform-admin/audit-logs') {
    return [rootItem, { label: 'Nhật ký Kiểm toán' }];
  }

  if (normalized.startsWith('/platform-admin/audit-logs/')) {
    return [
      rootItem,
      { label: 'Nhật ký Kiểm toán', href: '/platform-admin/audit-logs' },
      { label: 'Chi tiết Kiểm toán' },
    ];
  }

  // Fallback for any other admin sub-routes: /platform-admin/xyz
  const segments = normalized
    .replace(/^\/platform-admin\/?/, '')
    .split('/')
    .filter(Boolean);
  if (segments.length === 0) {
    return [rootItem, { label: 'Tổng quan' }];
  }

  const items: AdminBreadcrumbItem[] = [rootItem];
  let accumulatedPath = '/platform-admin';
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    accumulatedPath += `/${seg}`;
    const isLast = i === segments.length - 1;
    const label = seg.charAt(0).toUpperCase() + seg.slice(1);
    items.push(isLast ? { label } : { label, href: accumulatedPath });
  }

  return items;
}

/**
 * Determines whether a navigation item is active based on the current pathname.
 * Handles null/undefined pathname safely, normalizes trailing slashes, and enforces boundary checking.
 */
export function isNavItemActive(itemHref: string, currentPathname?: string | null): boolean {
  if (!currentPathname || typeof currentPathname !== 'string') {
    return false;
  }

  const normalized =
    currentPathname.length > 1 && currentPathname.endsWith('/')
      ? currentPathname.slice(0, -1)
      : currentPathname;

  if (itemHref === '/platform-admin') {
    return normalized === '/platform-admin';
  }

  return normalized === itemHref || normalized.startsWith(`${itemHref}/`);
}
