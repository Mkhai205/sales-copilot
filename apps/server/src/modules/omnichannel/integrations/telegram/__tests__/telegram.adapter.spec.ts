import { assertDefined, expectReject } from '../../../../../../test/test-assertions';
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
      expect(adapter.channelType).toBe(ChannelType.TELEGRAM);
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
      expect(adapter.verifyWebhook(request, credentials)).toBe(true);
    });

    it('should return true when secret token header matches credentials.secret_token', () => {
      const request: WebhookVerificationRequest = {
        headers: {
          'x-telegram-bot-api-secret-token': 'secret_token_123',
        },
      };
      const credentials = { secret_token: 'secret_token_123' };
      expect(adapter.verifyWebhook(request, credentials)).toBe(true);
    });

    it('should support uppercase X-Telegram-Bot-Api-Secret-Token header', () => {
      const request: WebhookVerificationRequest = {
        headers: {
          'X-Telegram-Bot-Api-Secret-Token': 'secret_token_123',
        },
      };
      const credentials = { secretToken: 'secret_token_123' };
      expect(adapter.verifyWebhook(request, credentials)).toBe(true);
    });

    it('should support array header values for secret token', () => {
      const request: WebhookVerificationRequest = {
        headers: {
          'x-telegram-bot-api-secret-token': ['secret_token_123'],
        },
      };
      const credentials = { webhookSecret: 'secret_token_123' };
      expect(adapter.verifyWebhook(request, credentials)).toBe(true);
    });

    it('should return false when secret token header does not match configured secret', () => {
      const request: WebhookVerificationRequest = {
        headers: {
          'x-telegram-bot-api-secret-token': 'wrong_secret',
        },
      };
      const credentials = { webhookSecret: 'secret_token_123' };
      expect(adapter.verifyWebhook(request, credentials)).toBe(false);
    });

    it('should return false when configured secret exists but header is missing', () => {
      const request: WebhookVerificationRequest = {
        headers: {},
      };
      const credentials = { webhookSecret: 'secret_token_123' };
      expect(adapter.verifyWebhook(request, credentials)).toBe(false);
    });

    it('should return false when secret token header is provided but credentials have no configured secret', () => {
      const request: WebhookVerificationRequest = {
        headers: {
          'x-telegram-bot-api-secret-token': 'unexpected_secret',
        },
      };
      const credentials = {};
      expect(adapter.verifyWebhook(request, credentials)).toBe(false);
    });

    it('should return false when no secret is configured on channel (must reject unauthenticated webhook)', () => {
      const request: WebhookVerificationRequest = {
        headers: {},
      };
      expect(adapter.verifyWebhook(request, {})).toBe(false);
      expect(adapter.verifyWebhook(request, undefined)).toBe(false);
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
      expect(result.length).toBe(1);

      const msg = result[0];
      expect(msg.eventKind).toBe('message');
      expect(msg.externalContactId).toBe('998877');
      expect(msg.externalMessageId).toBe('501');
      expect(msg.content).toBe('Hello from Telegram!');
      expect(msg.contentType).toBe(MessageContentType.TEXT);
      expect(msg.attachments).toBe(undefined);
      expect(msg.senderInfo?.name).toBe('John Doe');
      expect(msg.senderInfo?.username).toBe('johndoe');
      expect(msg.timestamp.getTime()).toBe(1700000000 * 1000);
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
      expect(result.length).toBe(1);
      expect(result[0].externalContactId).toBe('12345');
      expect(result[0].content).toBe('Parsed from JSON string');
      expect(result[0].senderInfo?.name).toBe('Alice');
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
      expect(result.length).toBe(1);

      const msg = result[0];
      expect(msg.contentType).toBe(MessageContentType.IMAGE);
      expect(msg.content).toBe('Look at this photo');
      assertDefined(msg.attachments);
      expect(msg.attachments.length).toBe(1);

      const att = msg.attachments[0];
      expect(att.fileUrl).toBe('photo_large_123');
      expect(att.fileName).toBe('photo_photo_large_123.jpg');
      expect(att.fileType).toBe('IMAGE');
      expect(att.fileSize).toBe(51200);
      expect(att.contentType).toBe(MessageContentType.IMAGE);
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
      expect(result.length).toBe(1);

      const msg = result[0];
      expect(msg.contentType).toBe(MessageContentType.VIDEO);
      expect(msg.content).toBe('Video caption');
      assertDefined(msg.attachments);
      expect(msg.attachments.length).toBe(1);
      expect(msg.attachments[0].fileUrl).toBe('video_file_456');
      expect(msg.attachments[0].fileName).toBe('sample_video.mp4');
      expect(msg.attachments[0].fileType).toBe('VIDEO');
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
      expect(result.length).toBe(1);
      expect(result[0].contentType).toBe(MessageContentType.AUDIO);
      expect(result[0].attachments?.[0].fileUrl).toBe('audio_file_789');
      expect(result[0].attachments?.[0].fileName).toBe('song.mp3');
      expect(result[0].attachments?.[0].fileType).toBe('AUDIO');
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
      expect(result.length).toBe(1);
      expect(result[0].contentType).toBe(MessageContentType.AUDIO);
      expect(result[0].attachments?.[0].fileUrl).toBe('voice_file_999');
      expect(result[0].attachments?.[0].fileName).toBe('voice_voice_file_999.ogg');
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
      expect(result.length).toBe(1);
      expect(result[0].contentType).toBe(MessageContentType.VIDEO);
      expect(result[0].attachments?.[0].fileUrl).toBe('vn_file_111');
      expect(result[0].attachments?.[0].fileName).toBe('video_note_vn_file_111.mp4');
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
      expect(result.length).toBe(1);
      expect(result[0].contentType).toBe(MessageContentType.FILE);
      expect(result[0].content).toBe('Please see invoice attached');
      expect(result[0].attachments?.[0].fileUrl).toBe('doc_file_222');
      expect(result[0].attachments?.[0].fileName).toBe('invoice_2026.pdf');
      expect(result[0].attachments?.[0].fileType).toBe('FILE');
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
      expect(result.length).toBe(1);
      expect(result[0].contentType).toBe(MessageContentType.IMAGE);
      expect(result[0].content).toBe('👍');
      expect(result[0].attachments?.[0].fileUrl).toBe('sticker_333');
      expect(result[0].attachments?.[0].fileName).toBe('sticker_sticker_333.webp');
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
      expect(result.length).toBe(1);
      expect(result[0].contentType).toBe(MessageContentType.TEXT);
      expect(result[0].content).toBe('📍 Location: 10.7769, 106.7009');
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
      expect(result.length).toBe(1);
      expect(result[0].contentType).toBe(MessageContentType.TEXT);
      expect(result[0].content).toBe(
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
      expect(result.length).toBe(1);
      expect(result[0].contentType).toBe(MessageContentType.TEXT);
      expect(result[0].content).toBe('👤 Contact: Jane Smith (+84901234567)');
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
      expect(result.length).toBe(1);

      const msg = result[0];
      expect(msg.externalContactId).toBe('887766');
      expect(msg.externalMessageId).toBe('cq_999888');
      expect(msg.content).toBe('confirm_order_123');
      expect(msg.contentType).toBe(MessageContentType.TEXT);
      expect(msg.senderInfo?.name).toBe('Charlie');
      expect(msg.senderInfo?.username).toBe('charlie_tg');
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
      expect(result.length).toBe(1);
      expect(result[0].externalContactId).toBe('554433');
      expect(result[0].content).toBe('Business message content');
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
      expect(result).toEqual([]);
    });

    it('should return empty array for malformed or unknown payloads', () => {
      expect(adapter.parseInboundPayload(null)).toEqual([]);
      expect(adapter.parseInboundPayload(undefined)).toEqual([]);
      expect(adapter.parseInboundPayload('invalid json string {')).toEqual([]);
      expect(adapter.parseInboundPayload({ update_id: 999 })).toEqual([]);
      expect(adapter.parseInboundPayload({ message: {} })).toEqual([]);
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

      expect(requestedUrl).toBe(
        'https://api.telegram.org/bot123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11/sendMessage',
      );
      expect(requestedBody.chat_id).toBe('998877');
      expect(requestedBody.text).toBe('<b>Hello Agent</b>');
      expect(requestedBody.parse_mode).toBe('HTML');
      expect(result.externalMessageId).toBe('8888');
      expect(result.deliveryStatus).toBe(DeliveryStatus.SENT);
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

      expect(callCount).toBe(2);
      expect(requestBodies[0].parse_mode).toBe('HTML');
      expect(requestBodies[1].parse_mode).toBe(undefined);
      expect(result.externalMessageId).toBe('8889');
      expect(result.deliveryStatus).toBe(DeliveryStatus.SENT);
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

      expect(requestedUrl).toBe(
        'https://api.telegram.org/bot123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11/sendPhoto',
      );
      expect(requestedBody.chat_id).toBe('998877');
      expect(requestedBody.photo).toBe('https://minio.example.com/attachments/photo.jpg');
      expect(requestedBody.caption).toBe('Photo caption');
      expect(result.externalMessageId).toBe('8890');
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
      expect(requestedUrl.endsWith('/sendVideo')).toBeTruthy();
      expect(requestedBody.video).toBe('https://minio.example.com/attachments/video.mp4');
      expect(result.externalMessageId).toBe('8891');
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
      expect(requestedUrl.endsWith('/sendAudio')).toBeTruthy();
      expect(requestedBody.audio).toBe('https://minio.example.com/attachments/audio.mp3');
      expect(result.externalMessageId).toBe('8892');
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
      expect(requestedUrl.endsWith('/sendDocument')).toBeTruthy();
      expect(requestedBody.document).toBe('https://minio.example.com/attachments/contract.pdf');
      expect(result.externalMessageId).toBe('8893');
    });

    it('should throw Error when botToken is missing in channel credentials', async () => {
      const badContext = { ...mockChannelContext, credentials: {} };
      const payload: OutboundMessagePayload = {
        recipientExternalId: '998877',
        content: 'Hello',
      };

      await expectReject(
        async () => adapter.sendMessage(badContext, payload),
        /Telegram bot token is missing in channel credentials/,
      );
    });

    it('should throw Error when recipient ID is missing', async () => {
      const payload: OutboundMessagePayload = {
        recipientExternalId: '',
        content: 'Hello',
      };

      await expectReject(
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

      await expectReject(
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

      expect(info.providerAccountId).toBe('123456789');
      expect(info.name).toBe('Sales Copilot Bot');
      expect(info.avatarUrl).toBe(
        'https://api.telegram.org/file/bot123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11/photos/bot_avatar.jpg',
      );
      expect(info.metadata?.username).toBe('sales_copilot_bot');
      expect(info.metadata?.isBot).toBe(true);
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
      expect(info.providerAccountId).toBe('123456789');
      expect(info.name).toBe('Sales Bot');
      expect(info.avatarUrl).toBe(undefined);
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

      await expectReject(
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
        expect(url).toBe(`https://api.telegram.org/file/bot${token}/documents/contract.pdf`);
      });

      it('should return null when getFile fails', async () => {
        globalThis.fetch = async () =>
          ({
            ok: false,
            json: async () => ({ ok: false }),
          }) as any;

        const url = await adapter.getTelegramFileUrl(token, 'invalid_file');
        expect(url).toBe(null);
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

        expect(res.ok).toBe(true);
        expect(requestedBody.url).toBe('https://salescopilot.io/webhooks/telegram/chan_1');
        expect(requestedBody.secret_token).toBe('secret_token_abc');
        expect(requestedBody.allowed_updates).toEqual([
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
        expect(called).toBe(true);
        expect(res.ok).toBe(true);
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
        assertDefined(info);
        expect(info?.url).toBe('https://salescopilot.io/webhooks/telegram/chan_1');
        expect(info?.pending_update_count).toBe(0);
      });
    });
  });
});
