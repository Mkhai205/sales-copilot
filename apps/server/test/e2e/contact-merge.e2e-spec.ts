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
import { ConversationStatus, WsServerEvent } from '@sales-copilot/shared-contracts';

describe('E2E Scenario 5 — Contact Merge Flow (Task 18 — Feature F-1.11.1)', () => {
  let ctx: TestAppContext;
  let seedCtx: SeedTestContext;
  let wsClient: TestWebSocketClient;
  let adminToken: string;
  let agentToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    seedCtx = await seedTestData(ctx.prisma);

    // 1. Login as Admin
    const adminLogin = await loginAsAgent(ctx.httpServer, {
      email: seedCtx.adminUser.email,
      password: seedCtx.adminPassword,
    });
    adminToken = adminLogin.accessToken;

    // 2. Login as Agent (for RBAC test)
    const agentLogin = await loginAsAgent(ctx.httpServer, {
      email: seedCtx.agentUser.email,
      password: seedCtx.agentPassword,
    });
    agentToken = agentLogin.accessToken;

    // 3. Connect WebSocket client as Admin and join workspace room
    wsClient = createTestWebSocketClient({
      wsUrl: ctx.wsUrl,
      token: adminToken,
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

  it('should atomically merge mergee contact into base contact, transfer identities, transfer conversations, preserve messages, delete mergee, record AuditLog, and broadcast WebSocket event', async () => {
    const prisma = ctx.prisma.client;
    const testId = Date.now().toString(36);

    // 1. Create a second inbox for the mergee conversation
    const secondaryInbox = await prisma.inbox.create({
      data: {
        workspaceId: seedCtx.workspace.id,
        name: `Secondary Inbox ${testId}`,
      },
    });

    // 2. Create Base Contact (Primary)
    const baseContact = await prisma.contact.create({
      data: {
        workspaceId: seedCtx.workspace.id,
        name: 'Primary Customer',
        email: `primary-${testId}@customer.com`,
        identifier: `ident_base_${testId}`,
        customAttributes: { vip: true, source: 'web' },
      },
    });

    const baseIdentity = await prisma.channelIdentity.create({
      data: {
        workspaceId: seedCtx.workspace.id,
        contactId: baseContact.id,
        channelId: seedCtx.channel.id,
        externalContactId: `web_base_${testId}`,
      },
    });

    const baseConv = await prisma.conversation.create({
      data: {
        workspaceId: seedCtx.workspace.id,
        contactId: baseContact.id,
        inboxId: seedCtx.inbox.id,
        channelIdentityId: baseIdentity.id,
        status: 'OPEN',
      },
    });

    await prisma.message.create({
      data: {
        workspaceId: seedCtx.workspace.id,
        conversationId: baseConv.id,
        senderType: 'CONTACT',
        senderId: baseContact.id,
        messageType: 'INCOMING',
        contentType: 'TEXT',
        content: 'Base contact first message',
        deliveryStatus: 'DELIVERED',
      },
    });

    await prisma.message.create({
      data: {
        workspaceId: seedCtx.workspace.id,
        conversationId: baseConv.id,
        senderType: 'USER',
        senderId: seedCtx.agentUser.id,
        messageType: 'OUTGOING',
        contentType: 'TEXT',
        content: 'Agent reply to base message',
        deliveryStatus: 'DELIVERED',
      },
    });

    // 3. Create Mergee Contact (Secondary)
    const mergeeContact = await prisma.contact.create({
      data: {
        workspaceId: seedCtx.workspace.id,
        name: 'Secondary Mergee Customer',
        phoneNumber: '+84987654321',
        identifier: `ident_mergee_${testId}`,
        customAttributes: { notes: 'Referred by colleague', source: 'mobile' },
      },
    });

    const mergeeIdentity = await prisma.channelIdentity.create({
      data: {
        workspaceId: seedCtx.workspace.id,
        contactId: mergeeContact.id,
        channelId: seedCtx.channel.id,
        externalContactId: `fb_mergee_${testId}`,
      },
    });

    const mergeeConv = await prisma.conversation.create({
      data: {
        workspaceId: seedCtx.workspace.id,
        contactId: mergeeContact.id,
        inboxId: secondaryInbox.id,
        channelIdentityId: mergeeIdentity.id,
        status: 'OPEN',
      },
    });

    const mergeeMsg1 = await prisma.message.create({
      data: {
        workspaceId: seedCtx.workspace.id,
        conversationId: mergeeConv.id,
        senderType: 'CONTACT',
        senderId: mergeeContact.id,
        messageType: 'INCOMING',
        contentType: 'TEXT',
        content: 'Mergee contact question',
        deliveryStatus: 'DELIVERED',
      },
    });

    await prisma.message.create({
      data: {
        workspaceId: seedCtx.workspace.id,
        conversationId: mergeeConv.id,
        senderType: 'USER',
        senderId: seedCtx.agentUser.id,
        messageType: 'OUTGOING',
        contentType: 'TEXT',
        content: 'Agent reply to mergee',
        deliveryStatus: 'DELIVERED',
      },
    });

    // 4. Setup WebSocket listener for contact.merged
    const mergeEventPromise = wsClient.waitForEvent(
      WsServerEvent.CONTACT_MERGED,
      15000,
      (payload: any) => {
        const item = payload?.data || payload;
        return (
          item?.primaryContactId === baseContact.id && item?.mergedContactId === mergeeContact.id
        );
      },
    );

    // 5. Execute Contact Merge via REST API (Admin only)
    const response = await request(ctx.httpServer)
      .post('/api/v1/contacts/merge')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Workspace-Id', seedCtx.workspace.id)
      .send({
        baseContactId: baseContact.id,
        mergeeContactId: mergeeContact.id,
      });

    // 6. Verify HTTP Response
    expect(response.status).toBe(200);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.id).toBe(baseContact.id);
    expect(response.body.data.name).toBe('Primary Customer'); // Base takes precedence
    expect(response.body.data.email).toBe(baseContact.email);
    expect(response.body.data.phoneNumber).toBe('+84987654321'); // Inherited from mergee
    expect(response.body.data.customAttributes).toEqual({
      notes: 'Referred by colleague',
      source: 'web', // Base takes precedence
      vip: true,
    });

    // 7. Verify WebSocket Broadcast
    const wsReceived = await mergeEventPromise;
    expect(wsReceived).toBeDefined();
    const wsData = wsReceived.data || wsReceived;
    expect(wsData.primaryContactId).toBe(baseContact.id);
    expect(wsData.mergedContactId).toBe(mergeeContact.id);
    expect(wsData.mergedByUserId).toBe(seedCtx.adminUser.id);

    // 8. Verify Database State

    // 8a. Channel Identities transferred to Base
    const baseIdentities = await prisma.channelIdentity.findMany({
      where: { contactId: baseContact.id },
    });
    expect(baseIdentities.length).toBe(2);
    const identityIds = baseIdentities.map(i => i.id);
    expect(identityIds).toContain(baseIdentity.id);
    expect(identityIds).toContain(mergeeIdentity.id);

    const leftoverMergeeIdentities = await prisma.channelIdentity.findMany({
      where: { contactId: mergeeContact.id },
    });
    expect(leftoverMergeeIdentities.length).toBe(0);

    // 8b. Conversations transferred to Base
    const baseConversations = await prisma.conversation.findMany({
      where: { contactId: baseContact.id },
    });
    expect(baseConversations.length).toBe(2);
    const convIds = baseConversations.map(c => c.id);
    expect(convIds).toContain(baseConv.id);
    expect(convIds).toContain(mergeeConv.id);

    const leftoverMergeeConvs = await prisma.conversation.findMany({
      where: { contactId: mergeeContact.id },
    });
    expect(leftoverMergeeConvs.length).toBe(0);

    // 8c. Messages preserved & senderId updated for Contact-authored messages
    const allMessages = await prisma.message.findMany({
      where: {
        conversationId: { in: [baseConv.id, mergeeConv.id] },
      },
    });
    expect(allMessages.length).toBe(4);

    const updatedMergeeMsg1 = await prisma.message.findUnique({
      where: { id: mergeeMsg1.id },
    });
    expect(updatedMergeeMsg1?.senderId).toBe(baseContact.id);
    expect(updatedMergeeMsg1?.senderType).toBe('CONTACT');

    // 8d. Mergee contact deleted
    const deletedMergee = await prisma.contact.findUnique({
      where: { id: mergeeContact.id },
    });
    expect(deletedMergee).toBeNull();

    // 8e. AuditLog record persisted
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        workspaceId: seedCtx.workspace.id,
        action: 'CONTACT_MERGED',
        resourceId: baseContact.id,
      },
    });
    expect(auditLog).toBeDefined();
    expect(auditLog?.resourceType).toBe('Contact');
    expect(auditLog?.userId).toBe(seedCtx.adminUser.id);
    const auditPayload = auditLog?.payload as any;
    expect(auditPayload?.baseContactId).toBe(baseContact.id);
    expect(auditPayload?.mergeeContactId).toBe(mergeeContact.id);
    expect(auditPayload?.mergedAttributes?.phoneNumber).toBe('+84987654321');
  });

  it('should resolve collision by resolving older conversation when both contacts have open conversations in the same inbox', async () => {
    const prisma = ctx.prisma.client;
    const testId = Date.now().toString(36);

    // 1. Create Contact A and Contact B
    const contactA = await prisma.contact.create({
      data: {
        workspaceId: seedCtx.workspace.id,
        name: `Customer Alpha ${testId}`,
        identifier: `ident_alpha_${testId}`,
      },
    });

    const contactB = await prisma.contact.create({
      data: {
        workspaceId: seedCtx.workspace.id,
        name: `Customer Beta ${testId}`,
        identifier: `ident_beta_${testId}`,
      },
    });

    // 2. Create older conversation for Contact A in seedCtx.inbox
    const olderConv = await prisma.conversation.create({
      data: {
        workspaceId: seedCtx.workspace.id,
        contactId: contactA.id,
        inboxId: seedCtx.inbox.id,
        status: ConversationStatus.OPEN,
        createdAt: new Date(Date.now() - 3600000), // 1 hour ago
      },
    });

    // 3. Create newer conversation for Contact B in same seedCtx.inbox
    const newerConv = await prisma.conversation.create({
      data: {
        workspaceId: seedCtx.workspace.id,
        contactId: contactB.id,
        inboxId: seedCtx.inbox.id,
        status: ConversationStatus.OPEN,
        createdAt: new Date(), // now
      },
    });

    // 4. Merge Contact B into Contact A
    const response = await request(ctx.httpServer)
      .post('/api/v1/contacts/merge')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Workspace-Id', seedCtx.workspace.id)
      .send({
        baseContactId: contactA.id,
        mergeeContactId: contactB.id,
      });

    expect(response.status).toBe(200);

    // 5. Verify single active ticket invariant:
    // Older conversation resolved with reason contact_merge_collision
    const refreshedOlder = await prisma.conversation.findUnique({
      where: { id: olderConv.id },
    });
    expect(refreshedOlder?.status).toBe(ConversationStatus.RESOLVED);
    const olderCustom = refreshedOlder?.customAttributes as any;
    expect(olderCustom?.resolvedReason).toBe('contact_merge_collision');
    expect(olderCustom?.mergedIntoConversationId).toBe(newerConv.id);

    // Newer conversation remains OPEN
    const refreshedNewer = await prisma.conversation.findUnique({
      where: { id: newerConv.id },
    });
    expect(refreshedNewer?.status).toBe(ConversationStatus.OPEN);
    expect(refreshedNewer?.contactId).toBe(contactA.id);
  });

  it('should enforce RBAC and reject merge requests initiated by AGENT role', async () => {
    const response = await request(ctx.httpServer)
      .post('/api/v1/contacts/merge')
      .set('Authorization', `Bearer ${agentToken}`)
      .set('X-Workspace-Id', seedCtx.workspace.id)
      .send({
        baseContactId: randomUUID(),
        mergeeContactId: randomUUID(),
      });

    // RolesGuard only permits OWNER and ADMIN to perform contact merges
    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it('should reject merge when baseContactId and mergeeContactId are identical (Schema Refinement)', async () => {
    const contactId = randomUUID();

    const response = await request(ctx.httpServer)
      .post('/api/v1/contacts/merge')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Workspace-Id', seedCtx.workspace.id)
      .send({
        baseContactId: contactId,
        mergeeContactId: contactId,
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should enforce multi-tenant isolation and reject merge with non-existent or foreign contact ID', async () => {
    const nonExistentBaseId = randomUUID();
    const nonExistentMergeeId = randomUUID();

    const response = await request(ctx.httpServer)
      .post('/api/v1/contacts/merge')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Workspace-Id', seedCtx.workspace.id)
      .send({
        baseContactId: nonExistentBaseId,
        mergeeContactId: nonExistentMergeeId,
      });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });
});
