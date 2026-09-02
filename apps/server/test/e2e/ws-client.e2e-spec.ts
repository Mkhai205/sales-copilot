import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';
import {
  createTestApp,
  seedTestData,
  cleanupTestData,
  loginAsAgent,
  createTestWebSocketClient,
  TestAppContext,
  SeedTestContext,
} from './helpers';
import { DomainEvent, WsServerEvent } from '@sales-copilot/shared-contracts';

describe('TestWebSocketClient Helper E2E Tests (Task 14 — Feature F-1.11.1)', () => {
  let ctx: TestAppContext;
  let seedCtx: SeedTestContext;
  let agentToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    seedCtx = await seedTestData(ctx.prisma);

    const loginResult = await loginAsAgent(ctx.httpServer, {
      email: seedCtx.agentUser.email,
      password: seedCtx.agentPassword,
    });
    agentToken = loginResult.accessToken;
  });

  afterAll(async () => {
    if (seedCtx && ctx?.prisma) {
      await cleanupTestData(ctx.prisma, seedCtx);
    }
    if (ctx) {
      await ctx.close();
    }
  });

  it('should authenticate with JWT token and connect to RealtimeGateway', async () => {
    const wsClient = createTestWebSocketClient({
      wsUrl: ctx.wsUrl,
      token: agentToken,
    });

    const connectedPayload = await wsClient.connect();

    expect(connectedPayload).toBeDefined();
    expect(connectedPayload.userId).toBe(seedCtx.agentUser.id);
    expect(connectedPayload.email).toBe(seedCtx.agentUser.email);
    expect(connectedPayload.availableWorkspaceIds).toContain(seedCtx.workspace.id);
    expect(wsClient.isConnected()).toBe(true);

    await wsClient.disconnect();
    expect(wsClient.isConnected()).toBe(false);
  });

  it('should reject connection when invalid or expired token is provided', async () => {
    const wsClient = createTestWebSocketClient({
      wsUrl: ctx.wsUrl,
      token: 'invalid-jwt-token-string',
      defaultTimeout: 4000,
    });

    await expect(wsClient.connect()).rejects.toThrow();
    expect(wsClient.isConnected()).toBe(false);
  });

  it('should successfully join a workspace room as an active member', async () => {
    const wsClient = createTestWebSocketClient({
      wsUrl: ctx.wsUrl,
      token: agentToken,
    });
    await wsClient.connect();

    const joinResult = await wsClient.joinWorkspace(seedCtx.workspace.id);

    expect(joinResult.success).toBe(true);
    expect(joinResult.room).toBe(`workspace_${seedCtx.workspace.id}`);
    expect(joinResult.workspaceId).toBe(seedCtx.workspace.id);

    await wsClient.disconnect();
  });

  it('should reject joining an unauthorized workspace', async () => {
    const wsClient = createTestWebSocketClient({
      wsUrl: ctx.wsUrl,
      token: agentToken,
    });
    await wsClient.connect();

    const randomWorkspaceId = randomUUID();
    await expect(wsClient.joinWorkspace(randomWorkspaceId)).rejects.toThrow();

    await wsClient.disconnect();
  });

  it('should receive broadcasted domain events via waitForEvent() with predicate', async () => {
    const wsClient = createTestWebSocketClient({
      wsUrl: ctx.wsUrl,
      token: agentToken,
    });
    await wsClient.connect();
    await wsClient.joinWorkspace(seedCtx.workspace.id);

    const testMessageId = `msg-${randomUUID()}`;
    const testConversationId = `conv-${randomUUID()}`;

    // Start waiting for the event
    const eventPromise = wsClient.waitForEvent(
      WsServerEvent.MESSAGE_CREATED,
      5000,
      (data: any) => data?.id === testMessageId || data?.message?.id === testMessageId,
    );

    // Emit domain event via server EventEmitter2
    const eventEmitter = ctx.app.get(EventEmitter2);
    eventEmitter.emit(DomainEvent.MESSAGE_CREATED, {
      workspaceId: seedCtx.workspace.id,
      conversationId: testConversationId,
      message: {
        id: testMessageId,
        conversationId: testConversationId,
        content: 'Hello Realtime E2E Test',
      },
    });

    const received = await eventPromise;
    expect(received).toBeDefined();

    // Verify received event buffer contains the captured event
    const events = wsClient.getReceivedEvents(WsServerEvent.MESSAGE_CREATED);
    expect(events.length).toBeGreaterThanOrEqual(1);

    await wsClient.disconnect();
  });

  it('should support Catch-Before-Wait: resolve immediately if event arrived before waitForEvent was called', async () => {
    const wsClient = createTestWebSocketClient({
      wsUrl: ctx.wsUrl,
      token: agentToken,
    });
    await wsClient.connect();
    await wsClient.joinWorkspace(seedCtx.workspace.id);

    const testMessageId = `early-msg-${randomUUID()}`;

    // Emit event BEFORE calling waitForEvent
    const eventEmitter = ctx.app.get(EventEmitter2);
    eventEmitter.emit(DomainEvent.MESSAGE_CREATED, {
      workspaceId: seedCtx.workspace.id,
      conversationId: `conv-${randomUUID()}`,
      message: {
        id: testMessageId,
        content: 'Early Arrived Event',
      },
    });

    // Short delay to allow event to arrive at socket
    await new Promise(resolve => setTimeout(resolve, 200));

    // Now call waitForEvent — should resolve immediately from buffer
    const received = await wsClient.waitForEvent(
      WsServerEvent.MESSAGE_CREATED,
      2000,
      (data: any) => data?.id === testMessageId || data?.message?.id === testMessageId,
    );

    expect(received).toBeDefined();

    await wsClient.disconnect();
  });

  it('should reject waitForEvent() on timeout when event is never dispatched', async () => {
    const wsClient = createTestWebSocketClient({
      wsUrl: ctx.wsUrl,
      token: agentToken,
    });
    await wsClient.connect();

    await expect(wsClient.waitForEvent('non_existent_event_name', 400)).rejects.toThrow(
      /Timed out after 400ms waiting for event "non_existent_event_name"/,
    );

    await wsClient.disconnect();
  });

  it('should gracefully disconnect without leaving open handles', async () => {
    const wsClient = createTestWebSocketClient({
      wsUrl: ctx.wsUrl,
      token: agentToken,
    });
    await wsClient.connect();
    expect(wsClient.isConnected()).toBe(true);

    await wsClient.disconnect();
    expect(wsClient.isConnected()).toBe(false);
    expect(wsClient.getSocket()).toBeNull();
  });
});
