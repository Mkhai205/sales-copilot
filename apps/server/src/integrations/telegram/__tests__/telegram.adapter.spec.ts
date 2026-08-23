import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert';
import { ChannelType, DeliveryStatus, MessageContentType } from '@sales-copilot/shared-contracts';
import { TelegramAdapter } from '../telegram.adapter';
import {
  ChannelContext,
  OutboundMessagePayload,
  WebhookVerificationRequest,
} from '../../channel-adapter.types';

describe('TelegramAdapter (Telegram Bot API Integration)', () => {
  let adapter: TelegramAdapter;
  let originalFetch: typeof globalThis.fetch;

  const mockChannelContext: ChannelContext = {
    channelId: 'chan_telegram_1',
    inboxId: 'inbox_1',
    workspaceId: 'ws_1',
    channelType: ChannelType.TELEGRAM,
    credentials: {
      botToken: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
    },
    settings: {},
  };

  beforeEach(() => {
    adapter = new TelegramAdapter();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('Adapter Configuration', () => {
    it('should declare channelType as TELEGRAM', () => {
      assert.strictEqual(adapter.channelType, ChannelType.TELEGRAM);
    });
  });

  describe('verifyWebhook()', () => {
    it('should return true when secret token header matches credentials.webhookSecret', () => {
      const request: WebhookVerificationRequest = {
        headers: {
          'x-telegram-bot-api-secret-token': 'secret_token_123',
        },
      };
      const credentials = { webhookSecret: 'secret_token_123' };
      assert.strictEqual(adapter.verifyWebhook(request, credentials), true);
    });

    it('should return true when secret token header matches credentials.secret_token', () => {
      const request: WebhookVerificationRequest = {
        headers: {
          'x-telegram-bot-api-secret-token': 'secret_token_123',
        },
      };
      const credentials = { secret_token: 'secret_token_123' };
      assert.strictEqual(adapter.verifyWebhook(request, credentials), true);
    });

    it('should support uppercase X-Telegram-Bot-Api-Secret-Token header', () => {
      const request: WebhookVerificationRequest = {
        headers: {
          'X-Telegram-Bot-Api-Secret-Token': 'secret_token_123',
        },
      };
      const credentials = { secretToken: 'secret_token_123' };
      assert.strictEqual(adapter.verifyWebhook(request, credentials), true);
    });

    it('should support array header values for secret token', () => {
      const request: WebhookVerificationRequest = {
        headers: {
          'x-telegram-bot-api-secret-token': ['secret_token_123'],
        },
      };
      const credentials = { webhookSecret: 'secret_token_123' };
      assert.strictEqual(adapter.verifyWebhook(request, credentials), true);
    });

    it('should return false when secret token header does not match configured secret', () => {
      const request: WebhookVerificationRequest = {
        headers: {
          'x-telegram-bot-api-secret-token': 'wrong_secret',
        },
      };
      const credentials = { webhookSecret: 'secret_token_123' };
      assert.strictEqual(adapter.verifyWebhook(request, credentials), false);
    });

    it('should return false when configured secret exists but header is missing', () => {
      const request: WebhookVerificationRequest = {
        headers: {},
      };
      const credentials = { webhookSecret: 'secret_token_123' };
      assert.strictEqual(adapter.verifyWebhook(request, credentials), false);
    });

    it('should return false when secret token header is provided but credentials have no configured secret', () => {
      const request: WebhookVerificationRequest = {
        headers: {
          'x-telegram-bot-api-secret-token': 'unexpected_secret',
        },
      };
      const credentials = {};
      assert.strictEqual(adapter.verifyWebhook(request, credentials), false);
    });

    it('should return true for URL-based auth fallback when no secret header and no configured secret', () => {
      const request: WebhookVerificationRequest = {
        headers: {},
      };
      assert.strictEqual(adapter.verifyWebhook(request, {}), true);
      assert.strictEqual(adapter.verifyWebhook(request, undefined), true);
    });
  });

  describe('parseInboundPayload()', () => {
    it('should parse a private text message correctly', () => {
      const payload = {
        update_id: 10001,
        message: {
          message_id: 501,
          date: 1700000000,
          chat: {
            id: 998877,
            type: 'private',
            first_name: 'John',
            last_name: 'Doe',
            username: 'johndoe',
          },
          from: {
            id: 998877,
            is_bot: false,
            first_name: 'John',
            last_name: 'Doe',
            username: 'johndoe',
          },
          text: 'Hello from Telegram!',
        },
      };

      const result = adapter.parseInboundPayload(payload);
      assert.strictEqual(result.length, 1);

      const msg = result[0];
      assert.strictEqual(msg.eventKind, 'message');
      assert.strictEqual(msg.externalContactId, '998877');
      assert.strictEqual(msg.externalMessageId, '501');
      assert.strictEqual(msg.content, 'Hello from Telegram!');
      assert.strictEqual(msg.contentType, MessageContentType.TEXT);
      assert.strictEqual(msg.attachments, undefined);
      assert.strictEqual(msg.senderInfo?.name, 'John Doe');
      assert.strictEqual(msg.senderInfo?.username, 'johndoe');
      assert.strictEqual(msg.timestamp.getTime(), 1700000000 * 1000);
    });

    it('should parse stringified JSON rawBody correctly', () => {
      const payload = JSON.stringify({
        update_id: 10002,
        message: {
          message_id: 502,
          date: 1700000000,
          chat: { id: 12345, type: 'private' },
          from: { id: 12345, is_bot: false, first_name: 'Alice' },
          text: 'Parsed from JSON string',
        },
      });

      const result = adapter.parseInboundPayload(payload);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].externalContactId, '12345');
      assert.strictEqual(result[0].content, 'Parsed from JSON string');
      assert.strictEqual(result[0].senderInfo?.name, 'Alice');
    });

    it('should handle photo messages and select highest resolution size', () => {
      const payload = {
        update_id: 10003,
        message: {
          message_id: 503,
          date: 1700000000,
          chat: { id: 112233, type: 'private' },
          from: { id: 112233, is_bot: false, first_name: 'Bob' },
          photo: [
            {
              file_id: 'photo_small_123',
              file_unique_id: 'u1',
              width: 90,
              height: 90,
              file_size: 1024,
            },
            {
              file_id: 'photo_medium_123',
              file_unique_id: 'u2',
              width: 320,
              height: 320,
              file_size: 10240,
            },
            {
              file_id: 'photo_large_123',
              file_unique_id: 'u3',
              width: 800,
              height: 800,
              file_size: 51200,
            },
          ],
          caption: 'Look at this photo',
        },
      };

      const result = adapter.parseInboundPayload(payload);
      assert.strictEqual(result.length, 1);

      const msg = result[0];
      assert.strictEqual(msg.contentType, MessageContentType.IMAGE);
      assert.strictEqual(msg.content, 'Look at this photo');
      assert.ok(msg.attachments && msg.attachments.length === 1);

      const att = msg.attachments[0];
      assert.strictEqual(att.fileUrl, 'photo_large_123');
      assert.strictEqual(att.fileName, 'photo_photo_large_123.jpg');
      assert.strictEqual(att.fileType, 'IMAGE');
      assert.strictEqual(att.fileSize, 51200);
      assert.strictEqual(att.contentType, MessageContentType.IMAGE);
    });

    it('should parse video messages', () => {
      const payload = {
        update_id: 10004,
        message: {
          message_id: 504,
          date: 1700000000,
          chat: { id: 112233, type: 'private' },
          from: { id: 112233, is_bot: false, first_name: 'Bob' },
          video: {
            file_id: 'video_file_456',
            file_unique_id: 'v1',
            width: 1920,
            height: 1080,
            duration: 60,
            file_name: 'sample_video.mp4',
            file_size: 2048000,
          },
          caption: 'Video caption',
        },
      };

      const result = adapter.parseInboundPayload(payload);
      assert.strictEqual(result.length, 1);

      const msg = result[0];
      assert.strictEqual(msg.contentType, MessageContentType.VIDEO);
      assert.strictEqual(msg.content, 'Video caption');
      assert.ok(msg.attachments && msg.attachments.length === 1);
      assert.strictEqual(msg.attachments[0].fileUrl, 'video_file_456');
      assert.strictEqual(msg.attachments[0].fileName, 'sample_video.mp4');
      assert.strictEqual(msg.attachments[0].fileType, 'VIDEO');
    });

    it('should parse audio messages', () => {
      const payload = {
        update_id: 10005,
        message: {
          message_id: 505,
          date: 1700000000,
          chat: { id: 112233, type: 'private' },
          from: { id: 112233, is_bot: false, first_name: 'Bob' },
          audio: {
            file_id: 'audio_file_789',
            file_unique_id: 'a1',
            duration: 180,
            file_name: 'song.mp3',
            file_size: 512000,
          },
          caption: 'Audio track',
        },
      };

      const result = adapter.parseInboundPayload(payload);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].contentType, MessageContentType.AUDIO);
      assert.strictEqual(result[0].attachments?.[0].fileUrl, 'audio_file_789');
      assert.strictEqual(result[0].attachments?.[0].fileName, 'song.mp3');
      assert.strictEqual(result[0].attachments?.[0].fileType, 'AUDIO');
    });

    it('should parse voice messages', () => {
      const payload = {
        update_id: 10006,
        message: {
          message_id: 506,
          date: 1700000000,
          chat: { id: 112233, type: 'private' },
          from: { id: 112233, is_bot: false, first_name: 'Bob' },
          voice: {
            file_id: 'voice_file_999',
            file_unique_id: 'vo1',
            duration: 12,
            file_size: 32000,
          },
        },
      };

      const result = adapter.parseInboundPayload(payload);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].contentType, MessageContentType.AUDIO);
      assert.strictEqual(result[0].attachments?.[0].fileUrl, 'voice_file_999');
      assert.strictEqual(result[0].attachments?.[0].fileName, 'voice_voice_file_999.ogg');
    });

    it('should parse video note messages', () => {
      const payload = {
        update_id: 10007,
        message: {
          message_id: 507,
          date: 1700000000,
          chat: { id: 112233, type: 'private' },
          from: { id: 112233, is_bot: false, first_name: 'Bob' },
          video_note: {
            file_id: 'vn_file_111',
            file_unique_id: 'vn1',
            length: 240,
            duration: 5,
            file_size: 45000,
          },
        },
      };

      const result = adapter.parseInboundPayload(payload);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].contentType, MessageContentType.VIDEO);
      assert.strictEqual(result[0].attachments?.[0].fileUrl, 'vn_file_111');
      assert.strictEqual(result[0].attachments?.[0].fileName, 'video_note_vn_file_111.mp4');
    });

    it('should parse document messages', () => {
      const payload = {
        update_id: 10008,
        message: {
          message_id: 508,
          date: 1700000000,
          chat: { id: 112233, type: 'private' },
          from: { id: 112233, is_bot: false, first_name: 'Bob' },
          document: {
            file_id: 'doc_file_222',
            file_unique_id: 'd1',
            file_name: 'invoice_2026.pdf',
            mime_type: 'application/pdf',
            file_size: 1048576,
          },
          caption: 'Please see invoice attached',
        },
      };

      const result = adapter.parseInboundPayload(payload);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].contentType, MessageContentType.FILE);
      assert.strictEqual(result[0].content, 'Please see invoice attached');
      assert.strictEqual(result[0].attachments?.[0].fileUrl, 'doc_file_222');
      assert.strictEqual(result[0].attachments?.[0].fileName, 'invoice_2026.pdf');
      assert.strictEqual(result[0].attachments?.[0].fileType, 'FILE');
    });

    it('should parse sticker messages', () => {
      const payload = {
        update_id: 10009,
        message: {
          message_id: 509,
          date: 1700000000,
          chat: { id: 112233, type: 'private' },
          from: { id: 112233, is_bot: false, first_name: 'Bob' },
          sticker: {
            file_id: 'sticker_333',
            file_unique_id: 'st1',
            width: 512,
            height: 512,
            emoji: '👍',
            file_size: 15000,
          },
        },
      };

      const result = adapter.parseInboundPayload(payload);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].contentType, MessageContentType.IMAGE);
      assert.strictEqual(result[0].content, '👍');
      assert.strictEqual(result[0].attachments?.[0].fileUrl, 'sticker_333');
      assert.strictEqual(result[0].attachments?.[0].fileName, 'sticker_sticker_333.webp');
    });

    it('should parse location messages into structured text', () => {
      const payload = {
        update_id: 10010,
        message: {
          message_id: 510,
          date: 1700000000,
          chat: { id: 112233, type: 'private' },
          from: { id: 112233, is_bot: false, first_name: 'Bob' },
          location: {
            latitude: 10.7769,
            longitude: 106.7009,
          },
        },
      };

      const result = adapter.parseInboundPayload(payload);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].contentType, MessageContentType.TEXT);
      assert.strictEqual(result[0].content, '📍 Location: 10.7769, 106.7009');
    });

    it('should parse venue messages into structured text', () => {
      const payload = {
        update_id: 10011,
        message: {
          message_id: 511,
          date: 1700000000,
          chat: { id: 112233, type: 'private' },
          from: { id: 112233, is_bot: false, first_name: 'Bob' },
          venue: {
            title: 'Landmark 81',
            address: 'Nguyen Huu Canh, Binh Thanh, HCMC',
            location: {
              latitude: 10.795,
              longitude: 106.7218,
            },
          },
        },
      };

      const result = adapter.parseInboundPayload(payload);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].contentType, MessageContentType.TEXT);
      assert.strictEqual(
        result[0].content,
        '📍 Landmark 81 - Nguyen Huu Canh, Binh Thanh, HCMC (10.795, 106.7218)',
      );
    });

    it('should parse contact cards into structured text', () => {
      const payload = {
        update_id: 10012,
        message: {
          message_id: 512,
          date: 1700000000,
          chat: { id: 112233, type: 'private' },
          from: { id: 112233, is_bot: false, first_name: 'Bob' },
          contact: {
            first_name: 'Jane',
            last_name: 'Smith',
            phone_number: '+84901234567',
          },
        },
      };

      const result = adapter.parseInboundPayload(payload);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].contentType, MessageContentType.TEXT);
      assert.strictEqual(result[0].content, '👤 Contact: Jane Smith (+84901234567)');
    });

    it('should parse callback_query updates from inline keyboard buttons', () => {
      const payload = {
        update_id: 10013,
        callback_query: {
          id: 'cq_999888',
          from: {
            id: 887766,
            is_bot: false,
            first_name: 'Charlie',
            username: 'charlie_tg',
          },
          message: {
            message_id: 400,
            date: 1700000000,
            chat: { id: 887766, type: 'private' },
          },
          data: 'confirm_order_123',
        },
      };

      const result = adapter.parseInboundPayload(payload);
      assert.strictEqual(result.length, 1);

      const msg = result[0];
      assert.strictEqual(msg.externalContactId, '887766');
      assert.strictEqual(msg.externalMessageId, 'cq_999888');
      assert.strictEqual(msg.content, 'confirm_order_123');
      assert.strictEqual(msg.contentType, MessageContentType.TEXT);
      assert.strictEqual(msg.senderInfo?.name, 'Charlie');
      assert.strictEqual(msg.senderInfo?.username, 'charlie_tg');
    });

    it('should parse business_message updates', () => {
      const payload = {
        update_id: 10014,
        business_message: {
          message_id: 601,
          date: 1700000000,
          chat: { id: 554433, type: 'private' },
          from: { id: 554433, is_bot: false, first_name: 'Dave' },
          text: 'Business message content',
        },
      };

      const result = adapter.parseInboundPayload(payload);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].externalContactId, '554433');
      assert.strictEqual(result[0].content, 'Business message content');
    });

    it('should ignore non-private chat updates (group / channel)', () => {
      const groupPayload = {
        update_id: 10015,
        message: {
          message_id: 701,
          date: 1700000000,
          chat: { id: -100123456789, type: 'supergroup', title: 'Test Group' },
          from: { id: 111, is_bot: false, first_name: 'Member' },
          text: 'Message in group chat',
        },
      };

      const result = adapter.parseInboundPayload(groupPayload);
      assert.deepStrictEqual(result, []);
    });

    it('should return empty array for malformed or unknown payloads', () => {
      assert.deepStrictEqual(adapter.parseInboundPayload(null), []);
      assert.deepStrictEqual(adapter.parseInboundPayload(undefined), []);
      assert.deepStrictEqual(adapter.parseInboundPayload('invalid json string {'), []);
      assert.deepStrictEqual(adapter.parseInboundPayload({ update_id: 999 }), []);
      assert.deepStrictEqual(adapter.parseInboundPayload({ message: {} }), []);
    });
  });

  describe('sendMessage()', () => {
    it('should deliver text message via POST /sendMessage with HTML mode', async () => {
      let requestedUrl = '';
      let requestedBody: any = null;

      globalThis.fetch = async (url: any, init: any) => {
        requestedUrl = String(url);
        requestedBody = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            result: {
              message_id: 8888,
              date: 1700000000,
              chat: { id: 998877, type: 'private' },
              text: '<b>Hello Agent</b>',
            },
          }),
        } as any;
      };

      const payload: OutboundMessagePayload = {
        recipientExternalId: '998877',
        content: '<b>Hello Agent</b>',
        contentType: MessageContentType.TEXT,
      };

      const result = await adapter.sendMessage(mockChannelContext, payload);

      assert.strictEqual(
        requestedUrl,
        'https://api.telegram.org/bot123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11/sendMessage',
      );
      assert.strictEqual(requestedBody.chat_id, '998877');
      assert.strictEqual(requestedBody.text, '<b>Hello Agent</b>');
      assert.strictEqual(requestedBody.parse_mode, 'HTML');
      assert.strictEqual(result.externalMessageId, '8888');
      assert.strictEqual(result.deliveryStatus, DeliveryStatus.SENT);
    });

    it('should automatically retry text message without parse_mode if Telegram returns HTML entity parse error', async () => {
      let callCount = 0;
      const requestBodies: any[] = [];

      globalThis.fetch = async (_url: any, init: any) => {
        callCount++;
        requestBodies.push(JSON.parse(init.body));

        if (callCount === 1) {
          return {
            ok: false,
            status: 400,
            json: async () => ({
              ok: false,
              error_code: 400,
              description: "Bad Request: can't parse entities in message text: unclosed tag",
            }),
          } as any;
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            result: {
              message_id: 8889,
              date: 1700000000,
              chat: { id: 998877, type: 'private' },
              text: 'Unclosed <tag',
            },
          }),
        } as any;
      };

      const payload: OutboundMessagePayload = {
        recipientExternalId: '998877',
        content: 'Unclosed <tag',
      };

      const result = await adapter.sendMessage(mockChannelContext, payload);

      assert.strictEqual(callCount, 2);
      assert.strictEqual(requestBodies[0].parse_mode, 'HTML');
      assert.strictEqual(requestBodies[1].parse_mode, undefined);
      assert.strictEqual(result.externalMessageId, '8889');
      assert.strictEqual(result.deliveryStatus, DeliveryStatus.SENT);
    });

    it('should deliver photo attachment via POST /sendPhoto', async () => {
      let requestedUrl = '';
      let requestedBody: any = null;

      globalThis.fetch = async (url: any, init: any) => {
        requestedUrl = String(url);
        requestedBody = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            result: {
              message_id: 8890,
              date: 1700000000,
              chat: { id: 998877, type: 'private' },
            },
          }),
        } as any;
      };

      const payload: OutboundMessagePayload = {
        recipientExternalId: '998877',
        content: 'Photo caption',
        contentType: MessageContentType.IMAGE,
        attachments: [
          {
            fileUrl: 'https://minio.example.com/attachments/photo.jpg',
            fileType: 'IMAGE',
          },
        ],
      };

      const result = await adapter.sendMessage(mockChannelContext, payload);

      assert.strictEqual(
        requestedUrl,
        'https://api.telegram.org/bot123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11/sendPhoto',
      );
      assert.strictEqual(requestedBody.chat_id, '998877');
      assert.strictEqual(requestedBody.photo, 'https://minio.example.com/attachments/photo.jpg');
      assert.strictEqual(requestedBody.caption, 'Photo caption');
      assert.strictEqual(result.externalMessageId, '8890');
    });

    it('should deliver video attachment via POST /sendVideo', async () => {
      let requestedUrl = '';
      let requestedBody: any = null;

      globalThis.fetch = async (url: any, init: any) => {
        requestedUrl = String(url);
        requestedBody = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            result: {
              message_id: 8891,
            },
          }),
        } as any;
      };

      const payload: OutboundMessagePayload = {
        recipientExternalId: '998877',
        contentType: MessageContentType.VIDEO,
        attachments: [
          {
            fileUrl: 'https://minio.example.com/attachments/video.mp4',
            fileType: 'VIDEO',
          },
        ],
      };

      const result = await adapter.sendMessage(mockChannelContext, payload);
      assert.ok(requestedUrl.endsWith('/sendVideo'));
      assert.strictEqual(requestedBody.video, 'https://minio.example.com/attachments/video.mp4');
      assert.strictEqual(result.externalMessageId, '8891');
    });

    it('should deliver audio attachment via POST /sendAudio', async () => {
      let requestedUrl = '';
      let requestedBody: any = null;

      globalThis.fetch = async (url: any, init: any) => {
        requestedUrl = String(url);
        requestedBody = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            result: {
              message_id: 8892,
            },
          }),
        } as any;
      };

      const payload: OutboundMessagePayload = {
        recipientExternalId: '998877',
        contentType: MessageContentType.AUDIO,
        attachments: [
          {
            fileUrl: 'https://minio.example.com/attachments/audio.mp3',
            fileType: 'AUDIO',
          },
        ],
      };

      const result = await adapter.sendMessage(mockChannelContext, payload);
      assert.ok(requestedUrl.endsWith('/sendAudio'));
      assert.strictEqual(requestedBody.audio, 'https://minio.example.com/attachments/audio.mp3');
      assert.strictEqual(result.externalMessageId, '8892');
    });

    it('should deliver document attachment via POST /sendDocument', async () => {
      let requestedUrl = '';
      let requestedBody: any = null;

      globalThis.fetch = async (url: any, init: any) => {
        requestedUrl = String(url);
        requestedBody = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            result: {
              message_id: 8893,
            },
          }),
        } as any;
      };

      const payload: OutboundMessagePayload = {
        recipientExternalId: '998877',
        contentType: MessageContentType.FILE,
        attachments: [
          {
            fileUrl: 'https://minio.example.com/attachments/contract.pdf',
            fileType: 'FILE',
          },
        ],
      };

      const result = await adapter.sendMessage(mockChannelContext, payload);
      assert.ok(requestedUrl.endsWith('/sendDocument'));
      assert.strictEqual(
        requestedBody.document,
        'https://minio.example.com/attachments/contract.pdf',
      );
      assert.strictEqual(result.externalMessageId, '8893');
    });

    it('should throw Error when botToken is missing in channel credentials', async () => {
      const badContext = { ...mockChannelContext, credentials: {} };
      const payload: OutboundMessagePayload = {
        recipientExternalId: '998877',
        content: 'Hello',
      };

      await assert.rejects(
        async () => adapter.sendMessage(badContext, payload),
        /Telegram bot token is missing in channel credentials/,
      );
    });

    it('should throw Error when recipient ID is missing', async () => {
      const payload: OutboundMessagePayload = {
        recipientExternalId: '',
        content: 'Hello',
      };

      await assert.rejects(
        async () => adapter.sendMessage(mockChannelContext, payload),
        /Recipient chat ID is required to send Telegram message/,
      );
    });

    it('should throw Error when Telegram API returns an error response', async () => {
      globalThis.fetch = async () => {
        return {
          ok: false,
          status: 403,
          json: async () => ({
            ok: false,
            error_code: 403,
            description: 'Forbidden: bot was blocked by the user',
          }),
        } as any;
      };

      const payload: OutboundMessagePayload = {
        recipientExternalId: '998877',
        content: 'Hello',
      };

      await assert.rejects(
        async () => adapter.sendMessage(mockChannelContext, payload),
        /Telegram API sendMessage error: \[403\] Forbidden: bot was blocked by the user/,
      );
    });
  });

  describe('getChannelInfo()', () => {
    it('should fetch bot info from Telegram getMe and return ChannelInfo', async () => {
      globalThis.fetch = async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/getMe')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              result: {
                id: 123456789,
                is_bot: true,
                first_name: 'Sales Copilot Bot',
                username: 'sales_copilot_bot',
                can_join_groups: true,
                can_read_all_group_messages: false,
                supports_inline_queries: false,
              },
            }),
          } as any;
        }
        if (urlStr.includes('/getUserProfilePhotos')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              result: {
                total_count: 1,
                photos: [
                  [
                    { file_id: 'bot_photo_small', width: 160, height: 160 },
                    { file_id: 'bot_photo_large', width: 640, height: 640 },
                  ],
                ],
              },
            }),
          } as any;
        }
        if (urlStr.includes('/getFile')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              result: {
                file_id: 'bot_photo_large',
                file_path: 'photos/bot_avatar.jpg',
              },
            }),
          } as any;
        }
        return { ok: false, status: 404 } as any;
      };

      const info = await adapter.getChannelInfo(mockChannelContext);

      assert.strictEqual(info.providerAccountId, '123456789');
      assert.strictEqual(info.name, 'Sales Copilot Bot');
      assert.strictEqual(
        info.avatarUrl,
        'https://api.telegram.org/file/bot123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11/photos/bot_avatar.jpg',
      );
      assert.strictEqual(info.metadata?.username, 'sales_copilot_bot');
      assert.strictEqual(info.metadata?.isBot, true);
    });

    it('should handle bot without profile photos gracefully', async () => {
      globalThis.fetch = async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/getMe')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              result: {
                id: 123456789,
                is_bot: true,
                first_name: 'Sales Bot',
                username: 'sales_bot',
              },
            }),
          } as any;
        }
        if (urlStr.includes('/getUserProfilePhotos')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              result: {
                total_count: 0,
                photos: [],
              },
            }),
          } as any;
        }
        return { ok: false, status: 404 } as any;
      };

      const info = await adapter.getChannelInfo(mockChannelContext);
      assert.strictEqual(info.providerAccountId, '123456789');
      assert.strictEqual(info.name, 'Sales Bot');
      assert.strictEqual(info.avatarUrl, undefined);
    });

    it('should throw Error if getMe fails', async () => {
      globalThis.fetch = async () => {
        return {
          ok: false,
          status: 401,
          json: async () => ({
            ok: false,
            error_code: 401,
            description: 'Unauthorized: invalid token',
          }),
        } as any;
      };

      await assert.rejects(
        async () => adapter.getChannelInfo(mockChannelContext),
        /Telegram API getMe error: \[401\] Unauthorized: invalid token/,
      );
    });
  });

  describe('Helper Methods (Webhook & Files)', () => {
    const token = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';

    describe('getTelegramFileUrl()', () => {
      it('should return full CDN file URL when getFile succeeds', async () => {
        globalThis.fetch = async () =>
          ({
            ok: true,
            json: async () => ({
              ok: true,
              result: { file_path: 'documents/contract.pdf' },
            }),
          }) as any;

        const url = await adapter.getTelegramFileUrl(token, 'file_123');
        assert.strictEqual(url, `https://api.telegram.org/file/bot${token}/documents/contract.pdf`);
      });

      it('should return null when getFile fails', async () => {
        globalThis.fetch = async () =>
          ({
            ok: false,
            json: async () => ({ ok: false }),
          }) as any;

        const url = await adapter.getTelegramFileUrl(token, 'invalid_file');
        assert.strictEqual(url, null);
      });
    });

    describe('setWebhook()', () => {
      it('should send webhook URL and secret_token to Telegram setWebhook API', async () => {
        let requestedBody: any = null;

        globalThis.fetch = async (_url: any, init: any) => {
          requestedBody = JSON.parse(init.body);
          return {
            ok: true,
            json: async () => ({ ok: true, description: 'Webhook was set' }),
          } as any;
        };

        const res = await adapter.setWebhook(
          token,
          'https://salescopilot.io/webhooks/telegram/chan_1',
          'secret_token_abc',
        );

        assert.strictEqual(res.ok, true);
        assert.strictEqual(requestedBody.url, 'https://salescopilot.io/webhooks/telegram/chan_1');
        assert.strictEqual(requestedBody.secret_token, 'secret_token_abc');
        assert.deepStrictEqual(requestedBody.allowed_updates, [
          'message',
          'edited_message',
          'callback_query',
        ]);
      });
    });

    describe('deleteWebhook()', () => {
      it('should call Telegram deleteWebhook API', async () => {
        let called = false;

        globalThis.fetch = async (url: any) => {
          if (String(url).endsWith('/deleteWebhook')) {
            called = true;
          }
          return {
            ok: true,
            json: async () => ({ ok: true, description: 'Webhook was deleted' }),
          } as any;
        };

        const res = await adapter.deleteWebhook(token);
        assert.strictEqual(called, true);
        assert.strictEqual(res.ok, true);
      });
    });

    describe('getWebhookInfo()', () => {
      it('should return webhook info from Telegram getWebhookInfo API', async () => {
        globalThis.fetch = async () =>
          ({
            ok: true,
            json: async () => ({
              ok: true,
              result: {
                url: 'https://salescopilot.io/webhooks/telegram/chan_1',
                has_custom_certificate: false,
                pending_update_count: 0,
              },
            }),
          }) as any;

        const info = await adapter.getWebhookInfo(token);
        assert.ok(info);
        assert.strictEqual(info?.url, 'https://salescopilot.io/webhooks/telegram/chan_1');
        assert.strictEqual(info?.pending_update_count, 0);
      });
    });
  });
});
