import request from 'supertest';
import {
  createTestApp,
  seedTestData,
  cleanupTestData,
  loginAsAgent,
  createTestWebSocketClient,
  TestAppContext,
  SeedTestContext,
  TestWebSocketClient,
} from './helpers';
import { WsServerEvent } from '@sales-copilot/shared-contracts';

describe('E2E Scenario 1 — Inbound Message Flow (Task 15 — Feature F-1.11.1)', () => {
  let ctx: TestAppContext;
  let seedCtx: SeedTestContext;
  let wsClient: TestWebSocketClient;
  let agentToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    seedCtx = await seedTestData(ctx.prisma);

    const loginResult = await loginAsAgent(ctx.httpServer, {
      email: seedCtx.agentUser.email,
      password: seedCtx.agentPassword,
    });
    agentToken = loginResult.accessToken;

    // Connect WebSocket client for the agent and join the workspace room
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

  it('should process inbound webhook, resolve contact, create OPEN conversation, save message, and emit WebSocket event', async () => {
    const externalContactId = `visitor-${seedCtx.testRunId}-1`;
    const externalMessageId = `mid-${seedCtx.testRunId}-101`;
    const testContent = 'Hi, I need assistance with pricing plans!';
    const customerName = `Alice Inbound ${seedCtx.testRunId}`;
    const customerEmail = `alice-${seedCtx.testRunId}@example.com`;
    const customerPhone = '+84988111222';

    // 1. Prepare WebSocket listener to catch the real-time broadcast
    const messageEventPromise = wsClient.waitForEvent(
      WsServerEvent.MESSAGE_CREATED,
      15000,
      (payload: any) => {
        const item = payload?.data || payload?.message || payload;
        return item?.externalId === externalMessageId || item?.content === testContent;
      },
    );

    // 2. Post inbound webhook to the public endpoint
    const response = await request(ctx.httpServer)
      .post(`/api/v1/channels/${seedCtx.channel.id}/webhook`)
      .set('x-widget-token', seedCtx.plainCredentials.widgetToken)
      .send({
        externalContactId,
        externalMessageId,
        content: testContent,
        senderInfo: {
          name: customerName,
          email: customerEmail,
          phoneNumber: customerPhone,
        },
      });

    // 3. Verify HTTP Webhook ingestion response
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.duplicated).toBe(false);
    expect(response.body.eventId).toBeDefined();

    // 4. Verify WebSocket broadcast was received by the agent
    const wsReceived = await messageEventPromise;
    expect(wsReceived).toBeDefined();

    const messageData = wsReceived.data || wsReceived.message || wsReceived;
    expect(messageData.content).toBe(testContent);

    // 5. Verify Database Records in test database
    const prisma = ctx.prisma.client;

    // 5a. ChannelEvent record
    const channelEvent = await prisma.channelEvent.findUnique({
      where: {
        channelId_externalEventId: {
          channelId: seedCtx.channel.id,
          externalEventId: externalMessageId,
        },
      },
    });
    expect(channelEvent).toBeDefined();
    expect(channelEvent?.processedAt).toBeDefined();

    // 5b. ChannelIdentity record
    const channelIdentity = await prisma.channelIdentity.findFirst({
      where: {
        workspaceId: seedCtx.workspace.id,
        channelId: seedCtx.channel.id,
        externalContactId,
      },
    });
    expect(channelIdentity).toBeDefined();

    // 5c. Contact record
    const contact = await prisma.contact.findFirst({
      where: {
        id: channelIdentity!.contactId,
        workspaceId: seedCtx.workspace.id,
      },
    });
    expect(contact).toBeDefined();
    expect(contact?.name).toBe(customerName);
    expect(contact?.email).toBe(customerEmail);
    expect(contact?.phoneNumber).toBe(customerPhone);

    // 5d. Conversation record
    const conversation = await prisma.conversation.findFirst({
      where: {
        workspaceId: seedCtx.workspace.id,
        contactId: contact!.id,
        inboxId: seedCtx.inbox.id,
      },
    });
    expect(conversation).toBeDefined();
    expect(conversation?.status).toBe('OPEN');

    // 5e. Message record
    const message = await prisma.message.findFirst({
      where: {
        conversationId: conversation!.id,
        externalId: externalMessageId,
      },
    });
    expect(message).toBeDefined();
    expect(message?.content).toBe(testContent);
    expect(message?.senderType).toBe('CONTACT');
    expect(message?.senderId).toBe(contact!.id);
    expect(message?.messageType).toBe('INCOMING');
  });

  it('should deduplicate contact and reuse existing OPEN conversation on subsequent message from same sender', async () => {
    const externalContactId = `visitor-${seedCtx.testRunId}-1`; // SAME sender
    const externalMessageId2 = `mid-${seedCtx.testRunId}-102`;
    const testContent2 = 'Can you offer any discount for annual billing?';

    // 1. Prepare WebSocket listener for the second message
    const messageEventPromise2 = wsClient.waitForEvent(
      WsServerEvent.MESSAGE_CREATED,
      15000,
      (payload: any) => {
        const item = payload?.data || payload?.message || payload;
        return item?.externalId === externalMessageId2 || item?.content === testContent2;
      },
    );

    // 2. Post second webhook from same externalContactId
    const response2 = await request(ctx.httpServer)
      .post(`/api/v1/channels/${seedCtx.channel.id}/webhook`)
      .set('x-widget-token', seedCtx.plainCredentials.widgetToken)
      .send({
        externalContactId,
        externalMessageId: externalMessageId2,
        content: testContent2,
      });

    expect(response2.status).toBe(200);
    expect(response2.body.success).toBe(true);
    expect(response2.body.duplicated).toBe(false);

    // 3. Verify WebSocket event received
    const wsReceived2 = await messageEventPromise2;
    expect(wsReceived2).toBeDefined();

    // 4. Verify DB: Contact Deduplication
    const prisma = ctx.prisma.client;

    const contacts = await prisma.contact.findMany({
      where: {
        workspaceId: seedCtx.workspace.id,
        identities: {
          some: {
            externalContactId,
          },
        },
      },
    });
    // Exactly 1 contact should exist for this externalContactId
    expect(contacts.length).toBe(1);

    // 5. Verify DB: Conversation Continuity
    const conversations = await prisma.conversation.findMany({
      where: {
        workspaceId: seedCtx.workspace.id,
        contactId: contacts[0].id,
      },
    });
    // Exactly 1 conversation should exist
    expect(conversations.length).toBe(1);
    expect(conversations[0].status).toBe('OPEN');

    // 6. Verify DB: Messages under the same conversation
    const messages = await prisma.message.findMany({
      where: {
        conversationId: conversations[0].id,
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(messages.length).toBe(2);
    expect(messages[1].externalId).toBe(externalMessageId2);
    expect(messages[1].content).toBe(testContent2);
  });

  it('should detect duplicate webhook events and return duplicated: true without creating redundant messages (Idempotency)', async () => {
    const externalContactId = `visitor-${seedCtx.testRunId}-1`;
    const externalMessageId = `mid-${seedCtx.testRunId}-101`; // REPEAT first message
    const testContent = 'Hi, I need assistance with pricing plans!';

    const prisma = ctx.prisma.client;

    // Count messages before sending duplicate
    const messagesBefore = await prisma.message.count({
      where: {
        conversation: { workspaceId: seedCtx.workspace.id },
      },
    });

    // Send duplicate webhook
    const responseDuplicate = await request(ctx.httpServer)
      .post(`/api/v1/channels/${seedCtx.channel.id}/webhook`)
      .set('x-widget-token', seedCtx.plainCredentials.widgetToken)
      .send({
        externalContactId,
        externalMessageId,
        content: testContent,
      });

    expect(responseDuplicate.status).toBe(200);
    expect(responseDuplicate.body.success).toBe(true);
    expect(responseDuplicate.body.duplicated).toBe(true);

    // Wait a brief moment to ensure no background worker processing occurred
    await new Promise(resolve => setTimeout(resolve, 500));

    // Assert message count did not increase
    const messagesAfter = await prisma.message.count({
      where: {
        conversation: { workspaceId: seedCtx.workspace.id },
      },
    });
    expect(messagesAfter).toBe(messagesBefore);
  });

  it('should reject webhook request when missing or invalid authentication token is provided', async () => {
    const response = await request(ctx.httpServer)
      .post(`/api/v1/channels/${seedCtx.channel.id}/webhook`)
      .set('x-widget-token', 'wrong-invalid-token')
      .send({
        externalContactId: 'unauth-visitor',
        externalMessageId: 'unauth-msg-1',
        content: 'This should be rejected',
      });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe('INVALID_WEBHOOK_SIGNATURE');
  });
});
