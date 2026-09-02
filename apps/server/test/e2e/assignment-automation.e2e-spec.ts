import argon2 from 'argon2';
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
import {
  AutomationActionType,
  AutomationAttribute,
  AutomationEventTrigger,
  AutomationOperator,
  MessageType,
  SenderType,
  WsServerEvent,
} from '@sales-copilot/shared-contracts';
import { PresenceService } from '../../src/modules/realtime/presence.service';
import { ConversationsService } from '../../src/modules/conversations/conversations.service';
import { AutomationRulesService } from '../../src/modules/automation-rules/automation-rules.service';
import { MessagesService } from '../../src/modules/messages/messages.service';

describe('E2E Scenario 3 & 4 — Auto-Assignment & Automation Rule Flow (Task 17 — Feature F-1.11.1)', () => {
  let ctx: TestAppContext;
  let seedCtx: SeedTestContext;
  let agent2User: any;
  let wsClient1: TestWebSocketClient;
  let wsClient2: TestWebSocketClient;
  let agent1Token: string;
  let agent2Token: string;
  const defaultPassword = 'Password123!';

  beforeAll(async () => {
    ctx = await createTestApp();
    // Seed with autoAssign: true so Inbox.isAutoAssignmentEnabled = true
    seedCtx = await seedTestData(ctx.prisma, { autoAssign: true });

    const prisma = ctx.prisma.client;

    // 1. Create a second agent user and add to workspace & inbox
    const testRunId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const passwordHash = await argon2.hash(defaultPassword);

    agent2User = await prisma.user.create({
      data: {
        email: `agent2-${testRunId}@test.salescopilot.io`,
        name: `E2E Agent Two ${testRunId}`,
        passwordHash,
        role: 'USER',
        isActive: true,
      },
    });

    await prisma.workspaceMember.create({
      data: {
        workspaceId: seedCtx.workspace.id,
        userId: agent2User.id,
        role: 'AGENT',
      },
    });

    await prisma.inboxMember.create({
      data: {
        inboxId: seedCtx.inbox.id,
        userId: agent2User.id,
      },
    });

    // 2. Mark both agents ONLINE in Redis via PresenceService
    const presenceService = ctx.app.get(PresenceService);
    await presenceService.setOnline(seedCtx.workspace.id, seedCtx.agentUser.id);
    await presenceService.setOnline(seedCtx.workspace.id, agent2User.id);

    // 3. Login both agents to get JWT tokens
    const login1 = await loginAsAgent(ctx.httpServer, {
      email: seedCtx.agentUser.email,
      password: seedCtx.agentPassword,
    });
    agent1Token = login1.accessToken;

    const login2 = await loginAsAgent(ctx.httpServer, {
      email: agent2User.email,
      password: defaultPassword,
    });
    agent2Token = login2.accessToken;

    // 4. Connect WebSockets for both agents
    wsClient1 = createTestWebSocketClient({
      wsUrl: ctx.wsUrl,
      token: agent1Token,
    });
    wsClient2 = createTestWebSocketClient({
      wsUrl: ctx.wsUrl,
      token: agent2Token,
    });

    await Promise.all([wsClient1.connect(), wsClient2.connect()]);
    await Promise.all([
      wsClient1.joinWorkspace(seedCtx.workspace.id),
      wsClient2.joinWorkspace(seedCtx.workspace.id),
    ]);
  });

  afterAll(async () => {
    if (wsClient1?.isConnected()) await wsClient1.disconnect();
    if (wsClient2?.isConnected()) await wsClient2.disconnect();

    if (seedCtx && ctx?.prisma) {
      await cleanupTestData(ctx.prisma, seedCtx);
    }
    if (agent2User?.id && ctx?.prisma) {
      try {
        await ctx.prisma.client.user.deleteMany({
          where: { id: agent2User.id },
        });
      } catch {
        // Ignored
      }
    }
    if (ctx) {
      await ctx.close();
    }
  });

  describe('Scenario 3: Round-Robin Auto-Assignment Flow (Feature F-1.8.1)', () => {
    let firstAssignedAgentId: string;
    let conv1Id: string;
    let conv2Id: string;

    it('should auto-assign newly created conversation to an online agent and broadcast conversation.assigned via WebSocket', async () => {
      const conversationsService = ctx.app.get(ConversationsService);

      // Create conversation 1 in the auto-assign enabled inbox
      const conv1 = await conversationsService.create(seedCtx.workspace.id, {
        inboxId: seedCtx.inbox.id,
        contactId: seedCtx.contact.id,
      });
      conv1Id = conv1.id;

      // Wait for conversation.assigned event on WebSocket
      const assignedEvent = await wsClient1.waitForEvent(
        WsServerEvent.CONVERSATION_ASSIGNED,
        15000,
        (payload: any) => {
          const conv = payload?.data || payload?.conversation || payload;
          return conv?.id === conv1Id || payload?.conversationId === conv1Id;
        },
      );

      expect(assignedEvent).toBeDefined();
      const eventData = assignedEvent.data || assignedEvent.conversation || assignedEvent;
      expect(eventData.id).toBe(conv1Id);
      expect(eventData.assigneeId).toBeDefined();

      // Verify in DB that conversation 1 has been assigned to an agent
      const prisma = ctx.prisma.client;
      const convInDb = await prisma.conversation.findUnique({
        where: { id: conv1Id },
      });
      expect(convInDb).toBeDefined();
      expect(convInDb?.assigneeId).toBeDefined();
      expect([seedCtx.agentUser.id, agent2User.id]).toContain(convInDb?.assigneeId);

      firstAssignedAgentId = convInDb!.assigneeId!;
    });

    it('should rotate round-robin circular queue and assign second conversation to the other online agent', async () => {
      const prisma = ctx.prisma.client;
      const conversationsService = ctx.app.get(ConversationsService);

      // Create a second contact for conversation 2
      const contact2 = await prisma.contact.create({
        data: {
          workspaceId: seedCtx.workspace.id,
          name: 'Second Test Contact',
          identifier: `contact_2_${Date.now()}`,
        },
      });

      // Create conversation 2 in the same inbox
      const conv2 = await conversationsService.create(seedCtx.workspace.id, {
        inboxId: seedCtx.inbox.id,
        contactId: contact2.id,
      });
      conv2Id = conv2.id;

      // Wait for conversation.assigned event
      const assignedEvent = await wsClient2.waitForEvent(
        WsServerEvent.CONVERSATION_ASSIGNED,
        15000,
        (payload: any) => {
          const conv = payload?.data || payload?.conversation || payload;
          return conv?.id === conv2Id || payload?.conversationId === conv2Id;
        },
      );

      expect(assignedEvent).toBeDefined();
      const eventData = assignedEvent.data || assignedEvent.conversation || assignedEvent;
      expect(eventData.id).toBe(conv2Id);

      // Verify in DB that conversation 2 was assigned to the SECOND agent (load balancing / round-robin)
      const conv2InDb = await prisma.conversation.findUnique({
        where: { id: conv2Id },
      });
      expect(conv2InDb).toBeDefined();
      expect(conv2InDb?.assigneeId).toBeDefined();

      const expectedSecondAgentId =
        firstAssignedAgentId === seedCtx.agentUser.id ? agent2User.id : seedCtx.agentUser.id;

      expect(conv2InDb?.assigneeId).toBe(expectedSecondAgentId);
    });
  });

  describe('Scenario 4: Automation Rule Execution & Audit Logging (Feature F-1.7.1)', () => {
    let createdRuleId: string;
    let targetConversationId: string;

    it('should evaluate automation rule on message creation, execute ADD_LABEL action, and record AuditLog', async () => {
      const prisma = ctx.prisma.client;
      const rulesService = ctx.app.get(AutomationRulesService);
      const messagesService = ctx.app.get(MessagesService);
      const conversationsService = ctx.app.get(ConversationsService);

      // 1. Create a dedicated conversation for the automation rule test
      const conv = await conversationsService.create(seedCtx.workspace.id, {
        inboxId: seedCtx.inbox.id,
        contactId: seedCtx.contact.id,
      });
      targetConversationId = conv.id;

      // 2. Create Automation Rule triggered on MESSAGE_CREATED matching "VIP"
      const rule = await rulesService.create(seedCtx.workspace.id, {
        name: 'VIP Enterprise Auto-Tagger',
        description: 'Auto-tags conversation with VIP Customer label on keyword match',
        eventTrigger: AutomationEventTrigger.MESSAGE_CREATED,
        conditions: [
          {
            attribute: AutomationAttribute.CONTENT,
            operator: AutomationOperator.CONTAINS,
            values: ['VIP', 'Enterprise'],
          },
        ],
        actions: [
          {
            type: AutomationActionType.ADD_LABEL,
            params: {
              labelTitle: 'VIP Customer',
            },
          },
        ],
        isActive: true,
      });
      createdRuleId = rule.id;

      // 3. Create inbound customer message with matching keyword
      await messagesService.create(seedCtx.workspace.id, targetConversationId, {
        content: 'Hello, we represent a VIP Enterprise account requiring priority SLA.',
        senderType: SenderType.CONTACT,
        senderId: seedCtx.contact.id,
        messageType: MessageType.INCOMING,
      });

      // 4. Poll database for applied ConversationLabel (async event processing)
      let conversationLabel = null;
      const startTime = Date.now();
      while (Date.now() - startTime < 8000) {
        conversationLabel = await prisma.conversationLabel.findFirst({
          where: {
            conversationId: targetConversationId,
            label: { title: 'VIP Customer' },
          },
          include: { label: true },
        });
        if (conversationLabel) break;
        await new Promise(r => setTimeout(r, 150));
      }

      expect(conversationLabel).toBeDefined();
      expect(conversationLabel?.label.title).toBe('VIP Customer');

      // 5. Verify immutable AuditLog record
      let auditLog = null;
      const auditStartTime = Date.now();
      while (Date.now() - auditStartTime < 8000) {
        auditLog = await prisma.auditLog.findFirst({
          where: {
            workspaceId: seedCtx.workspace.id,
            action: 'AUTOMATION_RULE_EXECUTED',
            resourceType: 'AUTOMATION_RULE',
            resourceId: createdRuleId,
          },
        });
        if (auditLog) break;
        await new Promise(r => setTimeout(r, 150));
      }

      expect(auditLog).toBeDefined();
      expect(auditLog?.action).toBe('AUTOMATION_RULE_EXECUTED');
      expect(auditLog?.resourceType).toBe('AUTOMATION_RULE');
      expect(auditLog?.resourceId).toBe(createdRuleId);

      const payload = auditLog?.payload as any;
      expect(payload?.ruleName).toBe('VIP Enterprise Auto-Tagger');
      expect(payload?.conversationId).toBe(targetConversationId);
      expect(payload?.results).toBeDefined();
      expect(payload?.results[0]?.type).toBe(AutomationActionType.ADD_LABEL);
      expect(payload?.results[0]?.success).toBe(true);
    });

    it('should NOT trigger automation action when message content does not match rule condition', async () => {
      const prisma = ctx.prisma.client;
      const messagesService = ctx.app.get(MessagesService);
      const conversationsService = ctx.app.get(ConversationsService);

      // 1. Create another conversation
      const nonMatchingConv = await conversationsService.create(seedCtx.workspace.id, {
        inboxId: seedCtx.inbox.id,
        contactId: seedCtx.contact.id,
      });

      // 2. Send message that does NOT contain "VIP" or "Enterprise"
      await messagesService.create(seedCtx.workspace.id, nonMatchingConv.id, {
        content: 'Just general inquiry about office location and opening hours.',
        senderType: SenderType.CONTACT,
        senderId: seedCtx.contact.id,
        messageType: MessageType.INCOMING,
      });

      // Wait 500ms to allow any async processing
      await new Promise(r => setTimeout(r, 500));

      // 3. Verify that NO "VIP Customer" label was assigned to this conversation
      const labelInDb = await prisma.conversationLabel.findFirst({
        where: {
          conversationId: nonMatchingConv.id,
          label: { title: 'VIP Customer' },
        },
      });
      expect(labelInDb).toBeNull();
    });
  });
});
