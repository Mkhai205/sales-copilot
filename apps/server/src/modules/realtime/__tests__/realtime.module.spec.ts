import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { RealtimeModule } from '../realtime.module';
import { RealtimeGateway } from '../realtime.gateway';
import { RealtimeEventDispatcher } from '../realtime-event.dispatcher';
import { PresenceService } from '../presence.service';
import { PresenceController } from '../presence.controller';
import { AuthModule } from '../../auth';
import { DatabaseModule } from '../../../infrastructure/database';
import { RedisModule } from '../../../infrastructure/redis';

describe('RealtimeModule (Module Registration & App Integration — Task 10)', () => {
  it('should be defined and decorated as a NestJS Module', () => {
    assert.ok(RealtimeModule);
    const isModule = Reflect.hasMetadata(MODULE_METADATA.IMPORTS, RealtimeModule);
    assert.strictEqual(isModule, true);
  });

  it('should import AuthModule, DatabaseModule, and RedisModule', () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, RealtimeModule) || [];
    assert.ok(imports.includes(AuthModule));
    assert.ok(imports.includes(DatabaseModule));
    assert.ok(imports.includes(RedisModule));
  });

  it('should register PresenceController in controllers', () => {
    const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, RealtimeModule) || [];
    assert.ok(controllers.includes(PresenceController));
  });

  it('should provide RealtimeGateway, RealtimeEventDispatcher, and PresenceService', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, RealtimeModule) || [];
    assert.ok(providers.includes(RealtimeGateway));
    assert.ok(providers.includes(RealtimeEventDispatcher));
    assert.ok(providers.includes(PresenceService));
  });

  it('should export RealtimeGateway, RealtimeEventDispatcher, and PresenceService for platform consumption', () => {
    const exportsList = Reflect.getMetadata(MODULE_METADATA.EXPORTS, RealtimeModule) || [];
    assert.ok(exportsList.includes(RealtimeGateway));
    assert.ok(exportsList.includes(RealtimeEventDispatcher));
    assert.ok(exportsList.includes(PresenceService));
  });
});
