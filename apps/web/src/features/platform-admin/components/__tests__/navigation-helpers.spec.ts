import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { getAdminBreadcrumbs, isNavItemActive } from '../navigation-helpers';

describe('Navigation Helpers — Admin Breadcrumbs', () => {
  it('should return default overview breadcrumb for /platform-admin and /platform-admin/', () => {
    assert.deepStrictEqual(getAdminBreadcrumbs('/platform-admin'), [
      { label: 'Platform Admin', href: '/platform-admin' },
      { label: 'Tổng quan' },
    ]);
    assert.deepStrictEqual(getAdminBreadcrumbs('/platform-admin/'), [
      { label: 'Platform Admin', href: '/platform-admin' },
      { label: 'Tổng quan' },
    ]);
  });

  it('should return workspaces breadcrumb for /platform-admin/workspaces', () => {
    assert.deepStrictEqual(getAdminBreadcrumbs('/platform-admin/workspaces'), [
      { label: 'Platform Admin', href: '/platform-admin' },
      { label: 'Quản trị Workspaces' },
    ]);
  });

  it('should return nested breadcrumbs for /platform-admin/workspaces/:id', () => {
    assert.deepStrictEqual(getAdminBreadcrumbs('/platform-admin/workspaces/ws-12345'), [
      { label: 'Platform Admin', href: '/platform-admin' },
      { label: 'Quản trị Workspaces', href: '/platform-admin/workspaces' },
      { label: 'Chi tiết Workspace' },
    ]);
  });

  it('should return settings breadcrumb for /platform-admin/settings', () => {
    assert.deepStrictEqual(getAdminBreadcrumbs('/platform-admin/settings'), [
      { label: 'Platform Admin', href: '/platform-admin' },
      { label: 'Cấu hình Hệ thống' },
    ]);
  });

  it('should return audit logs breadcrumb for /platform-admin/audit-logs', () => {
    assert.deepStrictEqual(getAdminBreadcrumbs('/platform-admin/audit-logs'), [
      { label: 'Platform Admin', href: '/platform-admin' },
      { label: 'Nhật ký Kiểm toán' },
    ]);
  });

  it('should handle custom unknown subpaths gracefully', () => {
    const result = getAdminBreadcrumbs('/platform-admin/reports');
    assert.deepStrictEqual(result, [
      { label: 'Platform Admin', href: '/platform-admin' },
      { label: 'Reports' },
    ]);
  });

  it('should handle empty or null pathname gracefully', () => {
    assert.deepStrictEqual(getAdminBreadcrumbs(''), [
      { label: 'Platform Admin', href: '/platform-admin' },
      { label: 'Tổng quan' },
    ]);
  });
});

describe('Navigation Helpers — isNavItemActive', () => {
  it('should mark overview active on /platform-admin and /platform-admin/', () => {
    assert.strictEqual(isNavItemActive('/platform-admin', '/platform-admin'), true);
    assert.strictEqual(isNavItemActive('/platform-admin', '/platform-admin/'), true);
    assert.strictEqual(isNavItemActive('/platform-admin', '/platform-admin/workspaces'), false);
  });

  it('should mark sub-features active on exact path and trailing slash', () => {
    assert.strictEqual(
      isNavItemActive('/platform-admin/workspaces', '/platform-admin/workspaces'),
      true,
    );
    assert.strictEqual(
      isNavItemActive('/platform-admin/workspaces', '/platform-admin/workspaces/'),
      true,
    );
    assert.strictEqual(
      isNavItemActive('/platform-admin/settings', '/platform-admin/settings'),
      true,
    );
    assert.strictEqual(
      isNavItemActive('/platform-admin/settings', '/platform-admin/settings/'),
      true,
    );
    assert.strictEqual(
      isNavItemActive('/platform-admin/audit-logs', '/platform-admin/audit-logs'),
      true,
    );
    assert.strictEqual(
      isNavItemActive('/platform-admin/audit-logs', '/platform-admin/audit-logs/'),
      true,
    );
  });

  it('should mark parent feature active on nested child routes', () => {
    assert.strictEqual(
      isNavItemActive('/platform-admin/workspaces', '/platform-admin/workspaces/ws-12345'),
      true,
    );
    assert.strictEqual(
      isNavItemActive('/platform-admin/settings', '/platform-admin/settings/flags'),
      true,
    );
  });

  it('should reject partial prefix matches on sibling paths', () => {
    assert.strictEqual(
      isNavItemActive('/platform-admin/workspaces', '/platform-admin/workspaces-archived'),
      false,
    );
    assert.strictEqual(
      isNavItemActive('/platform-admin/settings', '/platform-admin/settings-audit'),
      false,
    );
  });

  it('should safely handle null, undefined, and empty string without throwing', () => {
    assert.strictEqual(isNavItemActive('/platform-admin', null), false);
    assert.strictEqual(isNavItemActive('/platform-admin', undefined), false);
    assert.strictEqual(isNavItemActive('/platform-admin', ''), false);
    assert.strictEqual(isNavItemActive('/platform-admin/workspaces', null), false);
    assert.strictEqual(isNavItemActive('/platform-admin/workspaces', undefined), false);
  });
});
