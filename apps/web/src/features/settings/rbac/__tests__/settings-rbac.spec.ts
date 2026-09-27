import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WorkspaceRole } from '@sales-copilot/shared-contracts';
import {
  SETTINGS_NAV_ITEMS,
  getPermittedSettingsNavItems,
  isSettingsSectionAllowed,
  getDefaultSettingsRoute,
} from '../settings-nav-items';

describe('Settings Navigation & RBAC (Task 27)', () => {
  it('should define all 8 settings items with correct categories and segments', () => {
    assert.strictEqual(SETTINGS_NAV_ITEMS.length, 8);

    const segments = SETTINGS_NAV_ITEMS.map(item => item.segment);
    assert.deepStrictEqual(segments, [
      'general',
      'inboxes',
      'teams',
      'members',
      'labels',
      'canned-responses',
      'bank',
      'knowledge',
    ]);

    const workspaceItems = SETTINGS_NAV_ITEMS.filter(item => item.category === 'workspace');
    assert.strictEqual(workspaceItems.length, 4);

    const operationsItems = SETTINGS_NAV_ITEMS.filter(item => item.category === 'operations');
    assert.strictEqual(operationsItems.length, 4);
  });

  describe('getPermittedSettingsNavItems', () => {
    it('should return empty list if role is null or undefined', () => {
      assert.deepStrictEqual(getPermittedSettingsNavItems(null), []);
      assert.deepStrictEqual(getPermittedSettingsNavItems(undefined), []);
    });

    it('should return all 8 items for OWNER', () => {
      const permitted = getPermittedSettingsNavItems(WorkspaceRole.OWNER);
      assert.strictEqual(permitted.length, 8);
    });

    it('should return all 8 items for ADMIN', () => {
      const permitted = getPermittedSettingsNavItems(WorkspaceRole.ADMIN);
      assert.strictEqual(permitted.length, 8);
    });

    it('should return 3 operational items for AGENT (excluding admin-only)', () => {
      const permitted = getPermittedSettingsNavItems(WorkspaceRole.AGENT);
      assert.strictEqual(permitted.length, 3);

      const segments = permitted.map(item => item.segment);
      assert.deepStrictEqual(segments, ['teams', 'labels', 'canned-responses']);

      // Admin only items must not be included
      assert.strictEqual(segments.includes('general'), false);
      assert.strictEqual(segments.includes('inboxes'), false);
      assert.strictEqual(segments.includes('members'), false);
      assert.strictEqual(segments.includes('bank'), false);
    });
  });

  describe('isSettingsSectionAllowed', () => {
    it('should correctly allow/deny access based on section and role', () => {
      // General is admin-only
      assert.strictEqual(isSettingsSectionAllowed('general', WorkspaceRole.OWNER), true);
      assert.strictEqual(isSettingsSectionAllowed('general', WorkspaceRole.ADMIN), true);
      assert.strictEqual(isSettingsSectionAllowed('general', WorkspaceRole.AGENT), false);

      // Inboxes is admin-only
      assert.strictEqual(isSettingsSectionAllowed('inboxes', WorkspaceRole.OWNER), true);
      assert.strictEqual(isSettingsSectionAllowed('inboxes', WorkspaceRole.ADMIN), true);
      assert.strictEqual(isSettingsSectionAllowed('inboxes', WorkspaceRole.AGENT), false);

      // Members is admin-only
      assert.strictEqual(isSettingsSectionAllowed('members', WorkspaceRole.ADMIN), true);
      assert.strictEqual(isSettingsSectionAllowed('members', WorkspaceRole.AGENT), false);

      // Bank is admin-only
      assert.strictEqual(isSettingsSectionAllowed('bank', WorkspaceRole.OWNER), true);
      assert.strictEqual(isSettingsSectionAllowed('bank', WorkspaceRole.ADMIN), true);
      assert.strictEqual(isSettingsSectionAllowed('bank', WorkspaceRole.AGENT), false);

      // Knowledge is admin-only
      assert.strictEqual(isSettingsSectionAllowed('knowledge', WorkspaceRole.OWNER), true);
      assert.strictEqual(isSettingsSectionAllowed('knowledge', WorkspaceRole.ADMIN), true);
      assert.strictEqual(isSettingsSectionAllowed('knowledge', WorkspaceRole.AGENT), false);

      // Invalid segment or null role
      assert.strictEqual(isSettingsSectionAllowed('non-existent', WorkspaceRole.ADMIN), false);
      assert.strictEqual(isSettingsSectionAllowed('general', null), false);
    });
  });

  describe('getDefaultSettingsRoute', () => {
    it('should return /settings/general for OWNER and ADMIN', () => {
      assert.strictEqual(
        getDefaultSettingsRoute('acme-corp', WorkspaceRole.OWNER),
        '/acme-corp/settings/general',
      );
      assert.strictEqual(
        getDefaultSettingsRoute('acme-corp', WorkspaceRole.ADMIN),
        '/acme-corp/settings/general',
      );
      // Secondary fallback: getDefaultSettingsRoute('acme-corp', WorkspaceRole.ADMIN) -> /acme-corp/settings/inboxes
    });

    it('should return /settings/teams for AGENT', () => {
      assert.strictEqual(
        getDefaultSettingsRoute('acme-corp', WorkspaceRole.AGENT),
        '/acme-corp/settings/teams',
      );
    });

    it('should return conversations fallback if role is null', () => {
      assert.strictEqual(getDefaultSettingsRoute('acme-corp', null), '/acme-corp/conversations');
    });
  });
});
