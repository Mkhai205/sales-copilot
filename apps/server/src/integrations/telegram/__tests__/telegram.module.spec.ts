import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { TelegramModule } from '../telegram.module';
import { TelegramAdapter } from '../telegram.adapter';
import { ChannelAdapterRegistry } from '../../channel-adapter.registry';

describe('TelegramModule (Module Lifecycle & Registry Integration)', () => {
  let module: TelegramModule;
  let adapter: TelegramAdapter;
  let registry: ChannelAdapterRegistry;

  beforeEach(() => {
    adapter = new TelegramAdapter();
    registry = new ChannelAdapterRegistry();
    module = new TelegramModule(adapter, registry);
  });

  it('should register TelegramAdapter into ChannelAdapterRegistry on onModuleInit', () => {
    assert.strictEqual(registry.has(ChannelType.TELEGRAM), false);

    module.onModuleInit();

    assert.strictEqual(registry.has(ChannelType.TELEGRAM), true);
    assert.strictEqual(registry.get(ChannelType.TELEGRAM), adapter);
  });

  it('should preserve TelegramAdapter instance when retrieved from registry', () => {
    module.onModuleInit();

    const retrieved = registry.get(ChannelType.TELEGRAM);
    assert.strictEqual(retrieved.channelType, ChannelType.TELEGRAM);
    assert.strictEqual(typeof retrieved.sendMessage, 'function');
    assert.strictEqual(typeof retrieved.verifyWebhook, 'function');
    assert.strictEqual(typeof retrieved.parseInboundPayload, 'function');
    assert.strictEqual(typeof retrieved.getChannelInfo, 'function');
  });
});
