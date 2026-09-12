import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { getAdminBreadcrumbs, isNavItemActive } from '../navigation-helpers';

describe('Navigation Helpers — Admin Breadcrumbs', () => {
  it('should return default overview breadcrumb for /admin and /admin/', () => {
    assert.deepStrictEqual(getAdminBreadcrumbs('/admin'), [
      { label: 'Platform Admin', href: '/admin' },
      { label: 'Tổng quan' },
    ]);
    assert.deepStrictEqual(getAdminBreadcrumbs('/admin/'), [
      { label: 'Platform Admin', href: '/admin' },
      { label: 'Tổng quan' },
    ]);
  });

  it('should return workspaces breadcrumb for /admin/workspaces', () => {
    assert.deepStrictEqual(getAdminBreadcrumbs('/admin/workspaces'), [
      { label: 'Platform Admin', href: '/admin' },
      { label: 'Quản trị Workspaces' },
    ]);
  });

  it('should return nested breadcrumbs for /admin/workspaces/:id', () => {
    assert.deepStrictEqual(getAdminBreadcrumbs('/admin/workspaces/ws-12345'), [
      { label: 'Platform Admin', href: '/admin' },
      { label: 'Quản trị Workspaces', href: '/admin/workspaces' },
      { label: 'Chi tiết Workspace' },
    ]);
  });

  it('should return settings breadcrumb for /admin/settings', () => {
    assert.deepStrictEqual(getAdminBreadcrumbs('/admin/settings'), [
      { label: 'Platform Admin', href: '/admin' },
      { label: 'Cấu hình Hệ thống' },
    ]);
  });

  it('should return audit logs breadcrumb for /admin/audit-logs', () => {
    assert.deepStrictEqual(getAdminBreadcrumbs('/admin/audit-logs'), [
      { label: 'Platform Admin', href: '/admin' },
      { label: 'Nhật ký Kiểm toán' },
    ]);
  });

  it('should handle custom unknown subpaths gracefully', () => {
    const result = getAdminBreadcrumbs('/admin/reports');
    assert.deepStrictEqual(result, [
      { label: 'Platform Admin', href: '/admin' },
      { label: 'Reports' },
    ]);
  });

  it('should handle empty or null pathname gracefully', () => {
    assert.deepStrictEqual(getAdminBreadcrumbs(''), [
      { label: 'Platform Admin', href: '/admin' },
      { label: 'Tổng quan' },
    ]);
  });
});

describe('Navigation Helpers — isNavItemActive', () => {
  it('should mark overview active on /admin and /admin/', () => {
    assert.strictEqual(isNavItemActive('/admin', '/admin'), true);
    assert.strictEqual(isNavItemActive('/admin', '/admin/'), true);
    assert.strictEqual(isNavItemActive('/admin', '/admin/workspaces'), false);
  });

  it('should mark sub-features active on exact path and trailing slash', () => {
    assert.strictEqual(isNavItemActive('/admin/workspaces', '/admin/workspaces'), true);
    assert.strictEqual(isNavItemActive('/admin/workspaces', '/admin/workspaces/'), true);
    assert.strictEqual(isNavItemActive('/admin/settings', '/admin/settings'), true);
    assert.strictEqual(isNavItemActive('/admin/settings', '/admin/settings/'), true);
    assert.strictEqual(isNavItemActive('/admin/audit-logs', '/admin/audit-logs'), true);
    assert.strictEqual(isNavItemActive('/admin/audit-logs', '/admin/audit-logs/'), true);
  });

  it('should mark parent feature active on nested child routes', () => {
    assert.strictEqual(isNavItemActive('/admin/workspaces', '/admin/workspaces/ws-12345'), true);
    assert.strictEqual(isNavItemActive('/admin/settings', '/admin/settings/flags'), true);
  });

  it('should reject partial prefix matches on sibling paths', () => {
    assert.strictEqual(isNavItemActive('/admin/workspaces', '/admin/workspaces-archived'), false);
    assert.strictEqual(isNavItemActive('/admin/settings', '/admin/settings-audit'), false);
  });

  it('should safely handle null, undefined, and empty string without throwing', () => {
    assert.strictEqual(isNavItemActive('/admin', null), false);
    assert.strictEqual(isNavItemActive('/admin', undefined), false);
    assert.strictEqual(isNavItemActive('/admin', ''), false);
    assert.strictEqual(isNavItemActive('/admin/workspaces', null), false);
    assert.strictEqual(isNavItemActive('/admin/workspaces', undefined), false);
  });
});
