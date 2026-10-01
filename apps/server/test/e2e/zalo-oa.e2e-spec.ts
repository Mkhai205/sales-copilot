import * as crypto from 'crypto';
import request from 'supertest';
import { createTestApp, type TestAppContext } from './helpers/setup';
import { seedTestData, cleanupTestData, type SeedTestContext } from './helpers/seed';
import { loginAsAgent } from './helpers/auth';
import { createTestWebSocketClient, type TestWebSocketClient } from './helpers/ws-client';
import { WsServerEvent } from '@sales-copilot/shared-contracts';

const ZALO_APP_ID = 'e2e-zalo-app-id';
const ZALO_OA_SECRET = 'e2e-zalo-oa-secret';

/** Mirrors the documented MAC: sha256(app_id + rawBody + timestamp + oa_secret_key). */
function signBody(rawBody: string, timestamp: string): string {
  return crypto
    .createHash('sha256')
    .update(`${ZALO_APP_ID}${rawBody}${timestamp}${ZALO_OA_SECRET}`)
    .digest('hex');
}

function buildZaloEvent(eventName: string, data: unknown): { body: string; timestamp: string } {
  const timestamp = String(Date.now());
  const body = JSON.stringify({
    event_name: eventName,
    app_id: ZALO_APP_ID,
    timestamp,
    data: JSON.stringify(data),
  });
  return { body, timestamp };
}

describe('E2E Scenario — Zalo OA Channel (Webhook MAC, callback verify, ingestion)', () => {
  let ctx: TestAppContext;
  let seedCtx: SeedTestContext;
  let wsClient: TestWebSocketClient;
  let agentToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    seedCtx = await seedTestData(ctx.prisma, {
      channelType: 'ZALO',
      channelCredentials: {
        appId: ZALO_APP_ID,
        accessToken: 'e2e-access-token',
        refreshToken: 'e2e-refresh-token',
        accessTokenExpiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        oaSecretKey: ZALO_OA_SECRET,
        oaId: 'e2e-oa-123',
      },
    });

    const loginResult = await loginAsAgent(ctx.httpServer, {
      email: seedCtx.agentUser.email,
      password: seedCtx.agentPassword,
    });
    agentToken = loginResult.accessToken;

    wsClient = createTestWebSocketClient({
      wsUrl: ctx.wsUrl,
      token: agentToken,
    });
    await wsClient.connect();
    await wsClient.joinWorkspace(seedCtx.workspace.id);
  });

  afterAll(async () => {
    if (wsClient?.isConnected()) {
      await wsClient.disconnect();
    }
    if (seedCtx && ctx?.prisma) {
      await cleanupTestData(ctx.prisma, seedCtx);
    }
    if (ctx) {
      await ctx.close();
    }
  });

  it('should accept the oa_callback_verify handshake and echo the verify token without queueing ingestion', async () => {
    const { body } = buildZaloEvent('oa_callback_verify', { verify_token: 'e2e_vt_123' });

    const response = await request(ctx.httpServer)
      .post(`/api/v1/channels/${seedCtx.channel.id}/webhook`)
      .set('Content-Type', 'application/json')
      .send(body);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ code: 0, data: { verify_token: 'e2e_vt_123' } });
  });

  it('should reject a webhook with an invalid MAC signature', async () => {
    const { body, timestamp } = buildZaloEvent('user_send_text', {
      sender: { id: 'zalo-user-1' },
      message: { msg_id: 'm-should-fail', text: 'should not ingest' },
    });
    const forgedMac = crypto.createHash('sha256').update('forged').digest('hex');

    const response = await request(ctx.httpServer)
      .post(`/api/v1/channels/${seedCtx.channel.id}/webhook`)
      .set('Content-Type', 'application/json')
      .set('x-zevent-signature', forgedMac)
      .set('x-zalo-timestamp', timestamp)
      .send(body);

    expect(response.status).toBe(401);
    expect(response.body.error?.code).toBe('INVALID_WEBHOOK_SIGNATURE');
  });

  it('should ingest a signed user_send_text webhook end-to-end (raw Zalo payload, not pre-normalized)', async () => {
    const externalContactId = `zalo-user-${seedCtx.testRunId}`;
    const externalMessageId = `zalo-msg-${seedCtx.testRunId}-1`;
    const testContent = 'Cho mình hỏi đơn hàng đã gửi chưa?';

    const messageEventPromise = wsClient.waitForEvent(
      WsServerEvent.MESSAGE_CREATED,
      15000,
      (payload: any) => {
        const item = payload?.data || payload?.message || payload;
        return item?.externalId === externalMessageId || item?.content === testContent;
      },
    );

    const { body, timestamp } = buildZaloEvent('user_send_text', {
      sender: { id: externalContactId },
      recipient: { id: 'e2e-oa-123' },
      message: { msg_id: externalMessageId, text: testContent },
    });
    const mac = signBody(body, timestamp);

    const response = await request(ctx.httpServer)
      .post(`/api/v1/channels/${seedCtx.channel.id}/webhook`)
      .set('Content-Type', 'application/json')
      .set('x-zevent-signature', mac)
      .send(body);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.duplicated).toBe(false);
    expect(response.body.callbackResponse).toBeUndefined();

    // WebSocket broadcast reaches the agent inbox
    const wsReceived = await messageEventPromise;
    expect(wsReceived).toBeDefined();
    const messageData = wsReceived.data || wsReceived.message || wsReceived;
    expect(messageData.content).toBe(testContent);

    // DB: message persisted with the Zalo msg_id as externalId
    const prisma = ctx.prisma.client;
    const message = await prisma.message.findFirst({
      where: { externalId: externalMessageId, conversation: { workspaceId: seedCtx.workspace.id } },
    });
    expect(message).toBeDefined();
    expect(message?.content).toBe(testContent);
    expect(message?.messageType).toBe('INCOMING');
    expect(message?.senderType).toBe('CONTACT');

    // DB: ChannelIdentity resolved from the Zalo sender id
    const channelIdentity = await prisma.channelIdentity.findFirst({
      where: {
        workspaceId: seedCtx.workspace.id,
        channelId: seedCtx.channel.id,
        externalContactId,
      },
    });
    expect(channelIdentity).toBeDefined();
  });
});
