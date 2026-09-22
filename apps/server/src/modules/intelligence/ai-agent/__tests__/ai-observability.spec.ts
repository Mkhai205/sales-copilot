import { calculateEstimatedCostUsd } from '../ai-agent.constants';
import { summarizeToolOutput } from '../utils/ai-tool-summarizer';
import { AiAgentWorker } from '../ai-agent.worker';

describe('Epic 4.2 — AI Observability & Monitoring', () => {
  describe('calculateEstimatedCostUsd', () => {
    it('should calculate cost correctly for gemini-2.5-flash ($0.15/1M input, $0.60/1M output)', () => {
      // 1,000,000 input tokens = $0.15
      // 1,000,000 output tokens = $0.60
      const cost1M = calculateEstimatedCostUsd('gemini-2.5-flash', 1_000_000, 1_000_000);
      expect(cost1M).toBe(0.75);

      // 1,200 input tokens + 617 output tokens per backlog example
      // (1200 * 0.15 + 617 * 0.60) / 1,000,000 = (180 + 370.2) / 1,000,000 = 0.0005502
      const costReal = calculateEstimatedCostUsd('gemini-2.5-flash', 1200, 617);
      expect(costReal).toBeCloseTo(0.0005502, 6);
    });

    it('should fallback to default model pricing if unknown model passed', () => {
      const cost = calculateEstimatedCostUsd('custom-model-x', 1000, 1000);
      expect(cost).toBeGreaterThan(0);
    });

    it('should handle zero tokens safely', () => {
      expect(calculateEstimatedCostUsd('gemini-2.5-flash', 0, 0)).toBe(0);
    });
  });

  describe('summarizeToolOutput', () => {
    it('summarizes searchProducts correctly', () => {
      expect(summarizeToolOutput('searchProducts', [])).toBe('No products found');
      expect(
        summarizeToolOutput('searchProducts', [{ productId: 'p1', name: 'Áo thun đen' }]),
      ).toBe('Found 1 products ("Áo thun đen")');
      expect(
        summarizeToolOutput('searchProducts', [
          { productId: 'p1', name: 'Áo thun' },
          { productId: 'p2', name: 'Quần jean' },
          { productId: 'p3', name: 'Giày sneaker' },
        ]),
      ).toBe('Found 3 products ("Áo thun", "Quần jean" +1 more)');
    });

    it('summarizes checkInventory correctly', () => {
      expect(summarizeToolOutput('checkInventory', { inStock: true, availableStock: 10 })).toBe(
        'In stock: 10 available',
      );
      expect(summarizeToolOutput('checkInventory', { inStock: false, availableStock: 0 })).toBe(
        'Out of stock',
      );
    });

    it('summarizes createDraftOrder and confirmAndGenerateQR correctly', () => {
      expect(
        summarizeToolOutput('createDraftOrder', {
          orderNumber: 1024,
          totalAmount: 350000,
        }),
      ).toContain('Draft order #1024 created');

      expect(
        summarizeToolOutput('confirmAndGenerateQR', {
          orderNumber: 1024,
          qrCodeUrl: 'https://img.vietqr.io/test',
        }),
      ).toBe('Generated payment QR for order #1024');
    });

    it('summarizes extractShippingInfo and updateContactInfo correctly', () => {
      expect(
        summarizeToolOutput('extractShippingInfo', {
          province: 'TP. Hồ Chí Minh',
          district: 'Quận 1',
          ward: 'Phường Bến Nghé',
          streetAddress: '123 Lê Lợi',
          confidenceScore: 0.95,
        }),
      ).toContain('123 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh (95% conf)');

      expect(
        summarizeToolOutput('updateContactInfo', {
          name: 'Nguyễn Văn A',
          phoneNumber: '+84901234567',
        }),
      ).toBe('Contact updated: Nguyễn Văn A, +84901234567');
    });

    it('summarizes evaluateDiscount and escalateToHuman correctly', () => {
      expect(
        summarizeToolOutput('evaluateDiscount', {
          approved: true,
          approvedDiscount: 50000,
        }),
      ).toContain('Discount approved: 50.000₫');

      expect(
        summarizeToolOutput('evaluateDiscount', {
          approved: false,
          reason: 'Vượt quá mức 10%',
        }),
      ).toBe('Discount rejected: Vượt quá mức 10%');

      expect(
        summarizeToolOutput('escalateToHuman', {
          escalated: true,
          reason: 'Khách khiếu nại',
        }),
      ).toBe('Escalated to human agent: Khách khiếu nại');
    });

    it('summarizes tool error object cleanly', () => {
      expect(
        summarizeToolOutput('createDraftOrder', {
          error: 'OUT_OF_STOCK',
          message: 'Sản phẩm đã hết hàng',
        }),
      ).toBe('Error: OUT_OF_STOCK: Sản phẩm đã hết hàng');
    });

    it('truncates large fallback outputs to <= 200 chars', () => {
      const largeObj = { data: 'x'.repeat(500) };
      const summary = summarizeToolOutput('unknownTool', largeObj);
      expect(summary.length).toBeLessThanOrEqual(200);
      expect(summary.endsWith('...')).toBe(true);
    });
  });

  describe('AiAgentWorker rollup into conversation.customAttributes.aiUsage', () => {
    let worker: AiAgentWorker;
    let mockPrisma: any;
    let mockRedis: any;
    let mockAiAgentService: any;
    let mockMessagesService: any;
    let conversationsDb: Map<string, any>;
    let createdMessages: any[];

    const workspaceId = 'ws-test-rollup';
    const conversationId = 'conv-test-rollup';
    const inboxId = 'inbox-test-rollup';

    beforeEach(() => {
      conversationsDb = new Map();
      createdMessages = [];

      conversationsDb.set(conversationId, {
        id: conversationId,
        workspaceId,
        isAiPaused: false,
        customAttributes: {},
      });

      mockPrisma = {
        getClient: () => ({
          conversation: {
            findFirst: async ({ where }: any) => {
              const conv = conversationsDb.get(where.id);
              if (!conv || conv.workspaceId !== where.workspaceId) return null;
              return conv;
            },
            updateMany: async ({ where, data }: any) => {
              const conv = conversationsDb.get(where.id);
              if (conv && conv.workspaceId === where.workspaceId) {
                Object.assign(conv, data);
              }
              return { count: conv ? 1 : 0 };
            },
          },
        }),
      };

      mockRedis = {
        get: async () => null,
      };

      mockAiAgentService = {
        processConversation: async () => ({
          text: 'Chào bạn, sản phẩm tai nghe giá 500k ạ.',
          stepsCount: 2,
          usage: { promptTokens: 1200, completionTokens: 617, totalTokens: 1817 },
          aiDebug: {
            provider: 'vertex-ai',
            model: 'gemini-2.5-flash',
            stepsCount: 2,
            totalDurationMs: 1240,
            usage: { input: 1200, output: 617, total: 1817 },
            estimatedCostUsd: 0.0005502,
            toolCalls: [
              {
                name: 'searchProducts',
                input: { query: 'tai nghe' },
                outputSummary: 'Found 1 products ("Tai nghe Bluetooth")',
                durationMs: 245,
              },
            ],
          },
        }),
      };

      mockMessagesService = {
        create: async (wsId: string, convId: string, dto: any) => {
          createdMessages.push({ wsId, convId, dto });
          return { id: 'msg-1', ...dto };
        },
      };

      worker = new AiAgentWorker(mockPrisma, mockRedis, mockAiAgentService, mockMessagesService);
    });

    it('attaches aiDebug to message metadata and rolls up conversation aiUsage', async () => {
      const jobData = {
        workspaceId,
        conversationId,
        messageId: 'inbound-msg-1',
        inboxId,
        scheduledAt: Date.now(),
      };

      await worker.process({ id: 'job-1', data: jobData } as any);

      // Verify message created with aiDebug in metadata
      expect(createdMessages).toHaveLength(1);
      const created = createdMessages[0].dto;
      expect(created.metadata.isAiGenerated).toBe(true);
      expect(created.metadata.aiDebug).toBeDefined();
      expect(created.metadata.aiDebug.model).toBe('gemini-2.5-flash');
      expect(created.metadata.aiDebug.estimatedCostUsd).toBe(0.0005502);
      expect(created.metadata.aiDebug.toolCalls).toHaveLength(1);
      expect(created.metadata.aiDebug.toolCalls[0].name).toBe('searchProducts');

      // Verify conversation.customAttributes.aiUsage was rolled up
      const conv = conversationsDb.get(conversationId);
      expect(conv.customAttributes.aiUsage).toBeDefined();
      expect(conv.customAttributes.aiUsage.totalCostUsd).toBe(0.0005502);
      expect(conv.customAttributes.aiUsage.totalTokens).toBe(1817);
      expect(conv.customAttributes.aiUsage.inputTokens).toBe(1200);
      expect(conv.customAttributes.aiUsage.outputTokens).toBe(617);
      expect(conv.customAttributes.aiUsage.aiMessagesCount).toBe(1);

      // Run second turn to test accumulation
      await worker.process({ id: 'job-2', data: jobData } as any);
      const convAfterTurn2 = conversationsDb.get(conversationId);
      expect(convAfterTurn2.customAttributes.aiUsage.totalCostUsd).toBe(0.0011004);
      expect(convAfterTurn2.customAttributes.aiUsage.totalTokens).toBe(3634);
      expect(convAfterTurn2.customAttributes.aiUsage.aiMessagesCount).toBe(2);
    });
  });
});
