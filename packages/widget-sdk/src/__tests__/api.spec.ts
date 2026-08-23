import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert';
import { WidgetApiClient } from '../api';

describe('WidgetApiClient (REST API Client)', () => {
  let client: WidgetApiClient;
  const originalFetch = global.fetch;

  beforeEach(() => {
    client = new WidgetApiClient('https://app.salescopilot.test');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('getConfig()', () => {
    it('should successfully fetch widget configuration', async () => {
      const mockResponse = {
        channelId: 'chan_001',
        inboxId: 'inbox_001',
        widgetColor: '#3b82f6',
        welcomeTitle: 'Support Chat',
        greetingMessage: 'Hi there!',
      };

      global.fetch = (async (url: string) => {
        assert.ok(url.includes('/api/v1/widget/config?website_token=wt_test_123'));
        return {
          ok: true,
          json: async () => ({ data: mockResponse }),
        } as any;
      }) as any;

      const config = await client.getConfig('wt_test_123');
      assert.strictEqual(config.channelId, 'chan_001');
      assert.strictEqual(config.widgetColor, '#3b82f6');
      assert.strictEqual(config.welcomeTitle, 'Support Chat');
    });

    it('should throw error when API returns error status', async () => {
      global.fetch = (async () => {
        return {
          ok: false,
          status: 404,
          statusText: 'Not Found',
        } as any;
      }) as any;

      await assert.rejects(
        async () => client.getConfig('wt_not_found'),
        /Failed to load widget config: 404 Not Found/,
      );
    });
  });

  describe('getOrCreateContact()', () => {
    it('should post contact payload and return token session', async () => {
      const mockContactRes = {
        token: 'jwt_mock_token_123',
        contactToken: 'anon_vis_999',
        contact: { id: 'cont_123', name: 'Visitor' },
        isNewContact: true,
      };

      global.fetch = (async (url: string, init: any) => {
        assert.ok(url.includes('/api/v1/widget/contact'));
        assert.strictEqual(init.method, 'POST');
        const body = JSON.parse(init.body);
        assert.strictEqual(body.websiteToken, 'wt_test_123');
        assert.strictEqual(body.name, 'Jane');

        return {
          ok: true,
          json: async () => ({ data: mockContactRes }),
        } as any;
      }) as any;

      const result = await client.getOrCreateContact({
        websiteToken: 'wt_test_123',
        name: 'Jane',
      });

      assert.strictEqual(result.token, 'jwt_mock_token_123');
      assert.strictEqual(result.contactToken, 'anon_vis_999');
      assert.strictEqual(result.isNewContact, true);
    });
  });

  describe('getConversations() & getMessages()', () => {
    it('should fetch conversations with bearer authorization', async () => {
      global.fetch = (async (url: string, init: any) => {
        assert.ok(url.includes('/api/v1/widget/conversations'));
        assert.strictEqual(init.headers['Authorization'], 'Bearer mock_jwt');

        return {
          ok: true,
          json: async () => ({ data: { items: [{ id: 'conv_1' }] } }),
        } as any;
      }) as any;

      const result = await client.getConversations('mock_jwt');
      assert.strictEqual(result.items.length, 1);
    });

    it('should fetch conversation messages with pagination query', async () => {
      global.fetch = (async (url: string, init: any) => {
        assert.ok(url.includes('/api/v1/widget/conversations/conv_1/messages?page=1&limit=20'));
        assert.strictEqual(init.headers['Authorization'], 'Bearer mock_jwt');

        return {
          ok: true,
          json: async () => ({
            data: {
              items: [{ id: 'msg_1', content: 'Hello' }],
              meta: { total: 1 },
            },
          }),
        } as any;
      }) as any;

      const result = await client.getMessages('conv_1', 'mock_jwt', { page: 1, limit: 20 });
      assert.strictEqual(result.items.length, 1);
      assert.strictEqual(result.items[0].content, 'Hello');
    });
  });
});
