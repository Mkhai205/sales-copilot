import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { FacebookModule } from '../facebook.module';
import { FacebookAdapter } from '../facebook.adapter';
import { ChannelAdapterRegistry } from '../../channel-adapter.registry';

describe('FacebookModule (Module Lifecycle & Registry Integration)', () => {
  let module: FacebookModule;
  let adapter: FacebookAdapter;
  let registry: ChannelAdapterRegistry;

  beforeEach(() => {
    adapter = new FacebookAdapter();
    registry = new ChannelAdapterRegistry();
    module = new FacebookModule(adapter, registry);
  });

  it('should register FacebookAdapter into ChannelAdapterRegistry on onModuleInit', () => {
    assert.strictEqual(registry.has(ChannelType.FACEBOOK_MESSENGER), false);

    module.onModuleInit();

    assert.strictEqual(registry.has(ChannelType.FACEBOOK_MESSENGER), true);
    assert.strictEqual(registry.get(ChannelType.FACEBOOK_MESSENGER), adapter);
  });

  it('should preserve FacebookAdapter instance when retrieved from registry', () => {
    module.onModuleInit();

    const retrieved = registry.get(ChannelType.FACEBOOK_MESSENGER);
    assert.strictEqual(retrieved.channelType, ChannelType.FACEBOOK_MESSENGER);
    assert.strictEqual(typeof retrieved.sendMessage, 'function');
    assert.strictEqual(typeof retrieved.verifyWebhook, 'function');
    assert.strictEqual(typeof retrieved.parseInboundPayload, 'function');
    assert.strictEqual(typeof retrieved.getChannelInfo, 'function');
  });
});
