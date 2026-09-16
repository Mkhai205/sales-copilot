import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { WebChatModule } from '../web-chat.module';
import { WebChatAdapter } from '../web-chat.adapter';
import { ChannelAdapterRegistry } from '../../channel-adapter.registry';

describe('WebChatModule (Module Wiring & Registration)', () => {
  it('should register WebChatAdapter in ChannelAdapterRegistry on module init', () => {
    const adapter = new WebChatAdapter();
    const registry = new ChannelAdapterRegistry();

    assert.strictEqual(registry.has(ChannelType.WEB_CHAT), false);

    const moduleInstance = new WebChatModule(adapter, registry);
    moduleInstance.onModuleInit();

    assert.strictEqual(registry.has(ChannelType.WEB_CHAT), true);
    assert.strictEqual(registry.get(ChannelType.WEB_CHAT), adapter);
  });
});
