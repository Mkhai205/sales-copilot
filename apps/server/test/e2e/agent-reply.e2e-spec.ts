import request from 'supertest';
import { randomUUID } from 'node:crypto';
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

describe('E2E Scenario 2 — Agent Reply Flow (Task 16 — Feature F-1.11.1)', () => {
  let ctx: TestAppContext;
  let seedCtx: SeedTestContext;
  let wsClient: TestWebSocketClient;
  let agentToken: string;
  let testConversationId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    seedCtx = await seedTestData(ctx.prisma);

    const loginResult = await loginAsAgent(ctx.httpServer, {
      email: seedCtx.agentUser.email,
      password: seedCtx.agentPassword,
    });
    agentToken = loginResult.accessToken;

    // Create an initial active conversation (status: OPEN) with 1 inbound customer message
    const prisma = ctx.prisma.client;
    const conversation = await prisma.conversation.create({
      data: {
        workspaceId: seedCtx.workspace.id,
        inboxId: seedCtx.inbox.id,
        contactId: seedCtx.contact.id,
        channelIdentityId: seedCtx.channelIdentity.id,
        status: 'OPEN',
        unreadMessagesCount: 1,
      },
    });
    testConversationId = conversation.id;

    await prisma.message.create({
      data: {
        workspaceId: seedCtx.workspace.id,
        conversationId: testConversationId,
        senderType: 'CONTACT',
        senderId: seedCtx.contact.id,
        messageType: 'INCOMING',
        contentType: 'TEXT',
        content: 'Customer initial inquiry about product plans',
        deliveryStatus: 'DELIVERED',
      },
    });

    // Connect WebSocket client for the agent and join workspace room
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

  it('should post agent reply, transition conversation status from OPEN to PENDING, update firstReplyCreatedAt, and broadcast WebSocket message.created', async () => {
    const replyContent = 'Hello! Thank you for reaching out. How can I help you today?';

    // 1. Setup WebSocket listener for message.created
    const messageEventPromise = wsClient.waitForEvent(
      WsServerEvent.MESSAGE_CREATED,
      15000,
      (payload: any) => {
        const item = payload?.data || payload?.message || payload;
        return item?.conversationId === testConversationId && item?.content === replyContent;
      },
    );

    // 2. Post agent reply via REST API
    const response = await request(ctx.httpServer)
      .post(`/api/v1/conversations/${testConversationId}/messages`)
      .set('Authorization', `Bearer ${agentToken}`)
      .set('X-Workspace-Id', seedCtx.workspace.id)
      .send({
        content: replyContent,
        messageType: 'OUTGOING',
        contentType: 'TEXT',
        isPrivate: false,
      });

    // 3. Verify HTTP 201 Created response
    expect(response.status).toBe(201);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.content).toBe(replyContent);
    expect(response.body.data.senderType).toBe('USER');
    expect(response.body.data.senderId).toBe(seedCtx.agentUser.id);
    expect(response.body.data.messageType).toBe('OUTGOING');
    expect(response.body.data.isPrivate).toBe(false);

    const createdMessageId = response.body.data.id;

    // 4. Verify WebSocket broadcast event
    const wsReceived = await messageEventPromise;
    expect(wsReceived).toBeDefined();
    const wsMessage = wsReceived.data || wsReceived.message || wsReceived;
    expect(wsMessage.id).toBe(createdMessageId);
    expect(wsMessage.content).toBe(replyContent);
    expect(wsMessage.senderId).toBe(seedCtx.agentUser.id);

    // 5. Verify Database Records
    const prisma = ctx.prisma.client;

    // 5a. Message record
    const messageInDb = await prisma.message.findUnique({
      where: { id: createdMessageId },
    });
    expect(messageInDb).toBeDefined();
    expect(messageInDb?.content).toBe(replyContent);
    expect(messageInDb?.senderType).toBe('USER');
    expect(messageInDb?.senderId).toBe(seedCtx.agentUser.id);
    expect(messageInDb?.conversationId).toBe(testConversationId);
    expect(messageInDb?.messageType).toBe('OUTGOING');
    expect(messageInDb?.isPrivate).toBe(false);

    // 5b. Conversation state transition
    const conversationInDb = await prisma.conversation.findUnique({
      where: { id: testConversationId },
    });
    expect(conversationInDb).toBeDefined();
    // Status transitioned from OPEN to PENDING
    expect(conversationInDb?.status).toBe('PENDING');
    // First reply timestamp recorded
    expect(conversationInDb?.firstReplyCreatedAt).toBeDefined();
    expect(conversationInDb?.firstReplyCreatedAt).not.toBeNull();
    // Unread count reset to 0
    expect(conversationInDb?.unreadMessagesCount).toBe(0);
  });

  it('should allow agent to create an internal private note without altering conversation status', async () => {
    const noteContent = 'Internal note: customer qualifies for 15% discount';

    // 1. Setup WebSocket listener
    const noteEventPromise = wsClient.waitForEvent(
      WsServerEvent.MESSAGE_CREATED,
      15000,
      (payload: any) => {
        const item = payload?.data || payload?.message || payload;
        return item?.conversationId === testConversationId && item?.content === noteContent;
      },
    );

    // 2. Post private note
    const response = await request(ctx.httpServer)
      .post(`/api/v1/conversations/${testConversationId}/messages`)
      .set('Authorization', `Bearer ${agentToken}`)
      .set('X-Workspace-Id', seedCtx.workspace.id)
      .send({
        content: noteContent,
        messageType: 'OUTGOING',
        contentType: 'TEXT',
        isPrivate: true,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.isPrivate).toBe(true);
    expect(response.body.data.content).toBe(noteContent);
    expect(response.body.data.senderId).toBe(seedCtx.agentUser.id);

    const noteMessageId = response.body.data.id;

    // 3. Verify WebSocket broadcast
    const wsReceived = await noteEventPromise;
    expect(wsReceived).toBeDefined();
    const wsNote = wsReceived.data || wsReceived.message || wsReceived;
    expect(wsNote.id).toBe(noteMessageId);
    expect(wsNote.isPrivate).toBe(true);

    // 4. Verify DB: Message stored with isPrivate = true
    const prisma = ctx.prisma.client;
    const noteInDb = await prisma.message.findUnique({
      where: { id: noteMessageId },
    });
    expect(noteInDb).toBeDefined();
    expect(noteInDb?.isPrivate).toBe(true);

    // 5. Verify DB: Conversation status unchanged
    const conversationInDb = await prisma.conversation.findUnique({
      where: { id: testConversationId },
    });
    expect(conversationInDb?.status).toBe('PENDING');
  });

  it('should enforce impersonation prevention by attributing message to authenticated user', async () => {
    const spoofAttemptContent = 'Attempting to spoof admin identity';

    const response = await request(ctx.httpServer)
      .post(`/api/v1/conversations/${testConversationId}/messages`)
      .set('Authorization', `Bearer ${agentToken}`)
      .set('X-Workspace-Id', seedCtx.workspace.id)
      .send({
        content: spoofAttemptContent,
        senderId: seedCtx.adminUser.id, // Attempt to spoof admin
        senderType: 'USER',
        messageType: 'OUTGOING',
      });

    // Controller enforces senderId = authenticated user to prevent impersonation
    expect(response.status).toBe(201);
    expect(response.body.data.senderId).toBe(seedCtx.agentUser.id);
    expect(response.body.data.senderId).not.toBe(seedCtx.adminUser.id);

    const prisma = ctx.prisma.client;
    const messageInDb = await prisma.message.findUnique({
      where: { id: response.body.data.id },
    });
    expect(messageInDb?.senderId).toBe(seedCtx.agentUser.id);
  });

  it('should reject empty message content when no attachments are provided (BR-5.2)', async () => {
    const response = await request(ctx.httpServer)
      .post(`/api/v1/conversations/${testConversationId}/messages`)
      .set('Authorization', `Bearer ${agentToken}`)
      .set('X-Workspace-Id', seedCtx.workspace.id)
      .send({
        content: '    ', // whitespace only
        messageType: 'OUTGOING',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('MESSAGE_CONTENT_REQUIRED');
  });

  it('should enforce multi-tenant isolation and reject reply with invalid or foreign workspace ID', async () => {
    const randomWorkspaceId = randomUUID();

    const response = await request(ctx.httpServer)
      .post(`/api/v1/conversations/${testConversationId}/messages`)
      .set('Authorization', `Bearer ${agentToken}`)
      .set('X-Workspace-Id', randomWorkspaceId)
      .send({
        content: 'Cross-tenant message attempt',
        messageType: 'OUTGOING',
      });

    // Guard rejects with 403 Forbidden because user is not a member of randomWorkspaceId
    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });
});
