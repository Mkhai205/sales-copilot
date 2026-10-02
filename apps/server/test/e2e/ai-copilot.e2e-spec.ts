import request from 'supertest';
import type { LanguageModel } from 'ai';
import { getQueueToken, type Queue } from '@nestjs/bullmq';
import { AI_AUTOPILOT_QUEUE } from '@sales-copilot/shared-contracts';
import { AiAgentService } from '../../src/modules/intelligence/ai-agent/ai-agent.service';
import { SystemSettingsService } from '../../src/common/settings/system-settings.service';
import { createTestApp, type TestAppContext } from './helpers/setup';
import { seedTestData, cleanupTestData, type SeedTestContext } from './helpers/seed';
import { loginAsAgent } from './helpers/auth';
import { createScriptedModel, textStep, toolCallStep } from './helpers/mock-llm';

/**
 * AI Copilot end-to-end flow with a scripted mock LLM — no real model calls.
 * The listener → guardrail → BullMQ queue → worker → agent loop → tool
 * registry → persistence chain runs for real against the test database;
 * only the model is scripted (via the resolveLanguageModel seam).
 */
describe('E2E — AI Copilot flow with a scripted mock LLM', () => {
  let ctx: TestAppContext;
  let seedCtx: SeedTestContext;
  let agentToken: string;
  let aiAgentService: AiAgentService;
  let systemSettingsService: SystemSettingsService;
  let resolveSpy: jest.SpyInstance;
  let lastModel: ReturnType<typeof createScriptedModel> | undefined;
  let productId: string;
  let variantId: string;
  let scenarioIndex = 0;
  let aiQueue: Queue;

  const AI_WAIT_MS = 15000;

  beforeAll(async () => {
    ctx = await createTestApp();
    seedCtx = await seedTestData(ctx.prisma);

    aiAgentService = ctx.app.get(AiAgentService);
    systemSettingsService = ctx.app.get(SystemSettingsService);
    aiQueue = ctx.app.get<Queue>(getQueueToken(AI_AUTOPILOT_QUEUE));
    resolveSpy = jest.spyOn(aiAgentService, 'resolveLanguageModel');

    const loginResult = await loginAsAgent(ctx.httpServer, {
      email: seedCtx.agentUser.email,
      password: seedCtx.agentPassword,
    });
    agentToken = loginResult.accessToken;

    // Enable AI on the seeded inbox (platform kill-switch defaults to true)
    await ctx.prisma.client.inbox.update({
      where: { id: seedCtx.inbox.id },
      data: { settings: { aiCommercePolicy: { enabled: true } } },
    });

    const product = await ctx.prisma.client.product.create({
      data: {
        workspaceId: seedCtx.workspace.id,
        name: 'Áo Polo E2E',
        slug: `ao-polo-${seedCtx.testRunId}`,
        sku: `POLO-${seedCtx.testRunId}`,
        basePrice: 250000,
        trackInventory: true,
        isActive: true,
      },
    });
    productId = product.id;
    const variant = await ctx.prisma.client.productVariant.create({
      data: {
        workspaceId: seedCtx.workspace.id,
        productId,
        name: 'Size M',
        sku: `POLO-M-${seedCtx.testRunId}`,
        price: 250000,
        costPrice: 100000,
        stockQuantity: 5,
        reservedQuantity: 0,
        isActive: true,
      },
    });
    variantId = variant.id;
  });

  afterAll(async () => {
    if (seedCtx && ctx?.prisma) {
      await cleanupTestData(ctx.prisma, seedCtx);
    }
    if (ctx) {
      await ctx.close();
    }
  });

  /** Each scenario uses its own external sender → its own conversation. */
  function newScenarioSender(): string {
    scenarioIndex += 1;
    return `ai-visitor-${seedCtx.testRunId}-${scenarioIndex}`;
  }

  function setScriptedModel(steps: Parameters<typeof createScriptedModel>[0]): void {
    lastModel = createScriptedModel(steps);
    resolveSpy.mockResolvedValue(lastModel as unknown as LanguageModel);
  }

  async function postCustomerMessage(externalContactId: string, content: string) {
    return request(ctx.httpServer)
      .post(`/api/v1/channels/${seedCtx.channel.id}/webhook`)
      .set('x-widget-token', seedCtx.plainCredentials.widgetToken)
      .send({
        externalContactId,
        externalMessageId: `mid-${externalContactId}-${Date.now()}`,
        content,
      });
  }

  /** Ingestion is async (BullMQ) — poll until the conversation exists. */
  async function findConversation(externalContactId: string, timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const identity = await ctx.prisma.client.channelIdentity.findFirst({
        where: {
          workspaceId: seedCtx.workspace.id,
          channelId: seedCtx.channel.id,
          externalContactId,
        },
      });
      if (identity) {
        const conversation = await ctx.prisma.client.conversation.findFirst({
          where: {
            workspaceId: seedCtx.workspace.id,
            inboxId: seedCtx.inbox.id,
            contactId: identity.contactId,
          },
        });
        if (conversation) return conversation;
      }
      await sleep(300);
    }
    throw new Error(
      `Conversation for sender '${externalContactId}' did not appear within ${timeoutMs}ms`,
    );
  }

  async function waitForAiMessage(conversationId: string, timeoutMs = AI_WAIT_MS) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const messages = await ctx.prisma.client.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
      });
      const aiMessage = messages.find(
        m =>
          m.senderType === 'SYSTEM' && (m.metadata as Record<string, any>)?.isAiGenerated === true,
      );
      if (aiMessage) return aiMessage;
      await sleep(300);
    }
    throw new Error(
      `AI message did not appear in conversation '${conversationId}' within ${timeoutMs}ms. ` +
        `Messages present: ${JSON.stringify(
          (await ctx.prisma.client.message.findMany({ where: { conversationId } })).map(m => ({
            senderType: m.senderType,
            messageType: m.messageType,
            content: m.content?.slice(0, 40),
            metadataKeys: Object.keys((m.metadata as Record<string, any>) || {}),
          })),
        )}. ` +
        `Failed queue jobs: ${JSON.stringify(
          await Promise.all(
            (await aiQueue.getFailed()).map(async job => ({
              name: job.name,
              failedReason: job.failedReason,
              attempts: job.attemptsMade,
              stack: job.stacktrace?.split('\n')[0],
            })),
          ),
        )}`,
    );
  }

  async function countAiMessages(conversationId: string): Promise<number> {
    const messages = await ctx.prisma.client.message.findMany({ where: { conversationId } });
    return messages.filter(
      m => m.senderType === 'SYSTEM' && (m.metadata as Record<string, any>)?.isAiGenerated === true,
    ).length;
  }

  function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  it('happy path: tool call + text reply lands as an AI message with debug metadata and usage rollup', async () => {
    const sender = newScenarioSender();
    setScriptedModel([
      toolCallStep('searchProducts', { query: 'Áo Polo' }),
      textStep('Dạ shop còn Áo Polo E2E, giá 250.000đ ạ!'),
    ]);
    const callsBefore = resolveSpy.mock.calls.length;

    const response = await postCustomerMessage(sender, 'Tìm giúp mình áo polo với');
    expect(response.status).toBe(200);

    const conversation = await findConversation(sender);
    expect(conversation).toBeTruthy();
    const aiMessage = await waitForAiMessage(conversation!.id);

    expect(aiMessage.content).toBe('Dạ shop còn Áo Polo E2E, giá 250.000đ ạ!');
    const debug = (aiMessage.metadata as Record<string, any>).aiDebug;
    expect(debug.model).toBe('mock-copilot-1');
    expect(debug.toolCalls).toHaveLength(1);
    expect(debug.toolCalls[0].name).toBe('searchProducts');
    expect(debug.toolCalls[0].input).toEqual({ query: 'Áo Polo' });
    expect(debug.toolCalls[0].outputSummary).toBeTruthy();

    // The agent loop received the real tool registry through the model options
    const tools = ((lastModel!.calls[0] as Record<string, any>)?.tools ?? []) as Array<{
      name?: string;
    }>;
    const toolNames = tools.map(t => t?.name).filter(Boolean);
    expect(toolNames).toContain('searchProducts');

    // Usage rolled up onto the conversation for the observability UI
    const updated = await ctx.prisma.client.conversation.findFirst({
      where: { id: conversation!.id },
    });
    const aiUsage = (updated!.customAttributes as Record<string, any>)?.aiUsage;
    expect(aiUsage?.aiMessagesCount).toBe(1);
    expect(aiUsage?.totalTokens).toBeGreaterThan(0);

    expect(resolveSpy.mock.calls.length).toBe(callsBefore + 1);
  });

  it('createDraftOrder tool path creates a real DRAFT order with correct totals', async () => {
    const sender = newScenarioSender();
    setScriptedModel([
      toolCallStep('createDraftOrder', { items: [{ variantId, quantity: 2 }] }),
      textStep('Dạ em đã tạo đơn giữ hàng cho mình rồi ạ!'),
    ]);

    const response = await postCustomerMessage(sender, 'Cho mình đặt 2 cái áo polo size M');
    expect(response.status).toBe(200);

    const conversation = await findConversation(sender);
    const aiMessage = await waitForAiMessage(conversation!.id);
    expect(aiMessage.content).toBe('Dạ em đã tạo đơn giữ hàng cho mình rồi ạ!');

    const order = await ctx.prisma.client.order.findFirst({
      where: {
        workspaceId: seedCtx.workspace.id,
        items: { some: { variantId } },
      },
      include: { items: true },
    });
    expect(order).toBeTruthy();
    expect(order!.status).toBe('DRAFT');
    expect(order!.items).toHaveLength(1);
    expect(order!.items[0].quantity).toBe(2);
    expect(Number(order!.totalAmount)).toBe(500000);
  });

  it('human takeover pauses AI: subsequent customer messages never reach the LLM', async () => {
    const sender = newScenarioSender();
    setScriptedModel([textStep('Dạ em hỗ trợ mình ngay nhé!')]);

    await postCustomerMessage(sender, 'Cho em hỏi chút ạ');
    const conversation = await findConversation(sender);
    expect(await waitForAiMessage(conversation!.id)).toBeTruthy();

    const callsBefore = resolveSpy.mock.calls.length;

    // Human agent replies publicly → takeover listener pauses the AI
    const replyResponse = await request(ctx.httpServer)
      .post(`/api/v1/conversations/${conversation!.id}/messages`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ content: 'Dạ anh chị chờ mình một chút, mình hỗ trợ trực tiếp nhé!' });
    expect([200, 201]).toContain(replyResponse.status);

    const pausedDeadline = Date.now() + 5000;
    let paused = false;
    while (Date.now() < pausedDeadline && !paused) {
      const conv = await ctx.prisma.client.conversation.findFirst({
        where: { id: conversation!.id },
        select: { isAiPaused: true },
      });
      paused = conv?.isAiPaused === true;
      if (!paused) await sleep(200);
    }
    expect(paused).toBe(true);

    await postCustomerMessage(sender, 'Em cần trợ giúp thêm ạ');
    await sleep(3000); // debounce 500ms + queue processing would have fired here

    expect(resolveSpy.mock.calls.length).toBe(callsBefore);
    expect(await countAiMessages(conversation!.id)).toBe(1);
  });

  it('guardrail blocks blacklisted content before the LLM and sends the canned reply', async () => {
    const sender = newScenarioSender();
    setScriptedModel([textStep('KHÔNG BAO GIỜ ĐƯỢC GỌI')]);
    const callsBefore = resolveSpy.mock.calls.length;

    await postCustomerMessage(sender, 'đụ má shop bán đồ gì vậy');

    const conversation = await findConversation(sender);
    const deadline = Date.now() + 10000;
    let guardrailReply: { content: string | null; metadata: unknown } | undefined;
    while (Date.now() < deadline && !guardrailReply) {
      const messages = await ctx.prisma.client.message.findMany({
        where: { conversationId: conversation!.id },
        orderBy: { createdAt: 'desc' },
      });
      guardrailReply = messages.find(
        m => (m.metadata as Record<string, any>)?.guardrailReason === 'BLACKLISTED',
      );
      if (!guardrailReply) await sleep(300);
    }

    expect(guardrailReply).toBeTruthy();
    expect(guardrailReply!.content).toBe('Em không hỗ trợ nội dung này ạ');
    expect(resolveSpy.mock.calls.length).toBe(callsBefore);
  });

  it('platform kill-switch disables dispatch entirely', async () => {
    const sender = newScenarioSender();
    setScriptedModel([textStep('KHÔNG BAO GIỜ ĐƯỢC GỌI')]);
    const callsBefore = resolveSpy.mock.calls.length;

    const settingsSpy = jest.spyOn(systemSettingsService, 'getSetting').mockResolvedValue(false);
    try {
      await postCustomerMessage(sender, 'Em cần hỗ trợ ạ');
      await sleep(3000);

      const conversation = await findConversation(sender);
      expect(resolveSpy.mock.calls.length).toBe(callsBefore);
      expect(await countAiMessages(conversation!.id)).toBe(0);
    } finally {
      settingsSpy.mockRestore();
    }
  });
});
