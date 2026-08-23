import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert';
import { SalesCopilotWidget } from '../widget';

describe('SalesCopilotWidget (Core Widget SDK Controller)', () => {
  let widget: SalesCopilotWidget;
  const originalFetch = global.fetch;

  beforeEach(() => {
    widget = new SalesCopilotWidget();
  });

  afterEach(() => {
    widget.destroy();
    global.fetch = originalFetch;
  });

  describe('init()', () => {
    it('should throw error when websiteToken is missing', async () => {
      await assert.rejects(
        async () => widget.init({ websiteToken: '' }),
        /websiteToken is required/,
      );
    });

    it('should initialize successfully, fetch config, and emit ready event', async () => {
      const mockConfig = {
        channelId: 'chan_001',
        inboxId: 'inbox_001',
        widgetColor: '#0055ff',
        welcomeTitle: 'Support',
      };

      const mockContact = {
        token: 'mock_jwt_token',
        contactToken: 'anon_vis_001',
        contact: { id: 'cont_1', name: 'Visitor' },
        isNewContact: true,
      };

      global.fetch = (async (url: string) => {
        if (url.includes('/api/v1/widget/config')) {
          return { ok: true, json: async () => ({ data: mockConfig }) } as any;
        }
        if (url.includes('/api/v1/widget/contact')) {
          return { ok: true, json: async () => ({ data: mockContact }) } as any;
        }
        return { ok: false } as any;
      }) as any;

      let readyFired = false;
      widget.on('ready', () => {
        readyFired = true;
      });

      await widget.init({
        websiteToken: 'wt_test_token',
        baseUrl: 'https://api.salescopilot.test',
      });

      assert.strictEqual(widget.initialized, true);
      assert.strictEqual(widget.channelSettings?.widgetColor, '#0055ff');
      assert.strictEqual(widget.contact?.id, 'cont_1');
      assert.strictEqual(readyFired, true);
    });
  });

  describe('Events: on() and off()', () => {
    it('should register and trigger custom event handlers', () => {
      let callCount = 0;
      const callback = () => {
        callCount++;
      };

      widget.on('open', callback);
      (widget as any).emit('open', undefined);
      assert.strictEqual(callCount, 1);

      widget.off('open', callback);
      (widget as any).emit('open', undefined);
      assert.strictEqual(callCount, 1);
    });
  });

  describe('sendMessage() & setUser()', () => {
    it('should emit message:sent event when sending a message', async () => {
      let sentEvent: any = null;
      widget.on('message:sent', msg => {
        sentEvent = msg;
      });

      await widget.sendMessage('Hello customer support');

      assert.ok(sentEvent);
      assert.strictEqual(sentEvent.content, 'Hello customer support');
      assert.strictEqual(sentEvent.senderType, 'CONTACT');
      assert.strictEqual(sentEvent.status, 'SENDING');
    });

    it('should throw error when calling setUser() before init()', async () => {
      await assert.rejects(
        async () => widget.setUser({ identifier: 'user_123' }),
        /Must call init\(\) before setUser\(\)/,
      );
    });
  });

  describe('resetSession()', () => {
    it('should clear local session state', () => {
      (widget as any).session = { token: 'jwt_val' };
      widget.resetSession();
      assert.strictEqual(widget.contact, null);
    });
  });
});
