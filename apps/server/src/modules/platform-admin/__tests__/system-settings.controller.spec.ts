import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { PlatformRole, SystemSettingCategory } from '@sales-copilot/shared-contracts';
import { SystemSettingsController } from '../controllers/system-settings.controller';

describe('SystemSettingsController (REST API Endpoints)', () => {
  let controller: SystemSettingsController;
  let mockService: any;
  let serviceCalls: {
    getAllSettings: Array<string | undefined>;
    updateSetting: Array<{ key: string; dto: any; actor: any }>;
  };

  beforeEach(() => {
    serviceCalls = {
      getAllSettings: [],
      updateSetting: [],
    };

    mockService = {
      getAllSettings: async (category?: string) => {
        serviceCalls.getAllSettings.push(category);
        return [
          {
            key: 'feature.pos_vietqr_enabled',
            value: true,
            category: category ?? SystemSettingCategory.FEATURE_FLAGS,
            isEncrypted: false,
            updatedBy: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];
      },
      updateSetting: async (key: string, dto: any, actor: any) => {
        serviceCalls.updateSetting.push({ key, dto, actor });
        return {
          key,
          value: dto.value,
          category: SystemSettingCategory.FEATURE_FLAGS,
          description: dto.description ?? null,
          isEncrypted: false,
          updatedBy: actor.email,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
    };

    controller = new SystemSettingsController(mockService);
  });

  it('should list settings with optional category filter', async () => {
    const res = await controller.list({ category: SystemSettingCategory.FEATURE_FLAGS });
    assert.strictEqual(res.length, 1);
    assert.strictEqual(serviceCalls.getAllSettings.length, 1);
    assert.strictEqual(serviceCalls.getAllSettings[0], SystemSettingCategory.FEATURE_FLAGS);
  });

  it('should list all settings without category filter when query is empty', async () => {
    const res = await controller.list(undefined);
    assert.strictEqual(res.length, 1);
    assert.strictEqual(serviceCalls.getAllSettings.length, 1);
    assert.strictEqual(serviceCalls.getAllSettings[0], undefined);
  });

  it('should pass correct actor metadata and IP to updateSetting', async () => {
    const user = {
      userId: 'admin_usr_1',
      email: 'superadmin@salescopilot.io',
      role: PlatformRole.SUPER_ADMIN,
    };
    const req = {
      ip: '10.0.0.1',
      headers: {
        'x-forwarded-for': '203.0.113.195, 70.41.3.18',
        'user-agent': 'Chrome/128.0',
      },
    } as any;

    const res = await controller.update('feature.pos_vietqr_enabled', { value: false }, user, req);

    assert.strictEqual(res.key, 'feature.pos_vietqr_enabled');
    assert.strictEqual(res.value, false);
    assert.strictEqual(serviceCalls.updateSetting.length, 1);
    const call = serviceCalls.updateSetting[0];
    assert.strictEqual(call.key, 'feature.pos_vietqr_enabled');
    assert.strictEqual(call.actor.userId, 'admin_usr_1');
    assert.strictEqual(call.actor.email, 'superadmin@salescopilot.io');
    assert.strictEqual(call.actor.ipAddress, '203.0.113.195');
    assert.strictEqual(call.actor.userAgent, 'Chrome/128.0');
  });

  it('should fallback to req.ip when x-forwarded-for header is absent', async () => {
    const user = {
      userId: 'admin_usr_2',
      email: 'admin2@salescopilot.io',
      role: PlatformRole.SUPER_ADMIN,
    };
    const req = {
      ip: '192.168.1.50',
      headers: {},
    } as any;

    await controller.update('system.maintenance_mode', { value: true }, user, req);

    assert.strictEqual(serviceCalls.updateSetting.length, 1);
    const call = serviceCalls.updateSetting[0];
    assert.strictEqual(call.actor.ipAddress, '192.168.1.50');
  });
});
