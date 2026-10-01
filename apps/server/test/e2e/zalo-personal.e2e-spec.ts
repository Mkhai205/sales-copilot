import request from 'supertest';
import { createTestApp, type TestAppContext } from './helpers/setup';
import { seedTestData, cleanupTestData, type SeedTestContext } from './helpers/seed';
import { loginAsAgent } from './helpers/auth';
import { createTestWebSocketClient, type TestWebSocketClient } from './helpers/ws-client';
import { WsServerEvent } from '@sales-copilot/shared-contracts';
import { ZaloPersonalConnectionService } from '../../src/modules/omnichannel/integrations/zalo-personal/zalo-personal-connection.service';

const COUNTERPART_ID = 'zp-counterpart';

function buildEnvelope(msgId: string, text: string, isSelf = false) {
  return {
    kind: 'zalo_personal',
    v: 1,
    message: {
      msgId,
      threadId: COUNTERPART_ID,
      isSelf,
      text,
      attachments: [],
    },
  };
}

describe('E2E Scenario — Zalo Personal Channel (listener envelope ingestion)', () => {
  let ctx: TestAppContext;
  let seedCtx: SeedTestContext;
  let wsClient: TestWebSocketClient;
  let agentToken: string;
  let connectionService: ZaloPersonalConnectionService;

  beforeAll(async () => {
    ctx = await createTestApp();
    seedCtx = await seedTestData(ctx.prisma, {
      channelType: 'ZALO_PERSONAL',
      channelCredentials: {
        imei: 'e2e-imei',
        cookie: [{ name: 'zuid', value: 'e2e' }],
        userAgent: 'E2E-UA',
        ownUserId: 'e2e-own-id',
      },
    });
    // The counterpart the e2e messages come from must match the seeded identity.
    seedCtx.channelIdentity.externalContactId = COUNTERPART_ID;
    await ctx.prisma.client.channelIdentity.update({
      where: { id: seedCtx.channelIdentity.id },
      data: { externalContactId: COUNTERPART_ID },
    });
    // Attribute mirrored phone replies to the admin (self-ingest senderId).
    await ctx.prisma.client.channel.update({
      where: { id: seedCtx.channel.id },
      data: { settings: { connectedByUserId: seedCtx.adminUser.id } },
    });

    connectionService = ctx.app.get(ZaloPersonalConnectionService);

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

  it('should reject HTTP webhook posts for the personal channel (fail-closed surface)', async () => {
    const response = await request(ctx.httpServer)
      .post(`/api/v1/channels/${seedCtx.channel.id}/webhook`)
      .set('Content-Type', 'application/json')
      .send({ kind: 'zalo_personal', v: 1, message: {} });

    expect(response.status).toBe(401);
    expect(response.body.error?.code).toBe('INVALID_WEBHOOK_SIGNATURE');
  });

  it('should ingest a listener envelope end-to-end (contact, conversation, message, WS event)', async () => {
    const externalMessageId = `zp-msg-${seedCtx.testRunId}-1`;
    const testContent = 'Xin chào, tôi cần hỗ trợ đơn hàng';

    const messageEventPromise = wsClient.waitForEvent(
      WsServerEvent.MESSAGE_CREATED,
      15000,
      (payload: any) => {
        const item = payload?.data || payload?.message || payload;
        return item?.externalId === externalMessageId || item?.content === testContent;
      },
    );

    await connectionService.ingestEnvelope(
      seedCtx.channel.id,
      buildEnvelope(externalMessageId, testContent),
    );

    const wsReceived = await messageEventPromise;
    expect(wsReceived).toBeDefined();
    const messageData = wsReceived.data || wsReceived.message || wsReceived;
    expect(messageData.content).toBe(testContent);

    const prisma = ctx.prisma.client;
    const message = await prisma.message.findFirst({
      where: {
        externalId: externalMessageId,
        conversation: { workspaceId: seedCtx.workspace.id },
      },
    });
    expect(message).toBeDefined();
    expect(message?.content).toBe(testContent);
    expect(message?.messageType).toBe('INCOMING');
    expect(message?.senderType).toBe('CONTACT');

    const channelIdentity = await prisma.channelIdentity.findFirst({
      where: {
        workspaceId: seedCtx.workspace.id,
        channelId: seedCtx.channel.id,
        externalContactId: COUNTERPART_ID,
      },
    });
    expect(channelIdentity).toBeDefined();
  });

  it('should mirror a self (owner phone) message as an OUTGOING message with suppressOutbound', async () => {
    const prisma = ctx.prisma.client;
    const externalMessageId = `zp-self-${seedCtx.testRunId}-1`;
    const testContent = 'Dạ shop đã nhận được câu hỏi, gửi ảnh ngay ạ';

    await connectionService.ingestEnvelope(
      seedCtx.channel.id,
      buildEnvelope(externalMessageId, testContent, true),
    );

    const message = await prisma.message.findFirst({
      where: {
        externalId: externalMessageId,
        conversation: { workspaceId: seedCtx.workspace.id },
      },
    });
    expect(message).toBeDefined();
    expect(message?.messageType).toBe('OUTGOING');
    expect(message?.senderType).toBe('USER');
    expect((message?.metadata as any)?.selfMessage).toBe(true);
    expect((message?.metadata as any)?.suppressOutbound).toBe(true);
  });
});
