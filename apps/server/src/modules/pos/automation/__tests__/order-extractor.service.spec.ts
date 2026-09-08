import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { DomainEvent } from '@sales-copilot/shared-contracts';
import { OrderExtractorService } from '../order-extractor.service';

describe('OrderExtractorService (Graceful Deterministic & AI Order Extractor)', () => {
  let service: OrderExtractorService;
  let mockPrisma: any;
  let mockEventEmitter: any;
  let emittedEvents: Array<{ event: string; payload: any }>;

  const wsId = 'ws_alpha_123';
  const convId = 'conv_xyz_789';

  beforeEach(() => {
    emittedEvents = [];
    mockEventEmitter = {
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      },
    };

    const clientMock = {
      contact: {
        findFirst: async () => null,
      },
      product: {
        findMany: async () => [
          {
            id: 'prod-1',
            workspaceId: wsId,
            name: 'Áo Sơ Mi Oxford',
            sku: 'SOMI-OXFORD',
            basePrice: 350000,
            variants: [
              {
                id: 'var-1',
                name: 'Size L / Trắng',
                sku: 'OXFORD-L-WHT',
                price: 350000,
              },
            ],
          },
        ],
      },
    };

    mockPrisma = {
      client: clientMock,
      getClient: () => clientMock,
      contact: clientMock.contact,
      product: clientMock.product,
    };

    service = new OrderExtractorService(mockPrisma, mockEventEmitter as any);
  });

  it('should extract phone, 3-level address and product with high confidence (>=80%) and emit event', async () => {
    const messageText =
      'Shop gửi cho mình 1 Áo Sơ Mi Oxford về 18 Tam Trinh, Hoàng Mai, Hà Nội. SĐT: 0988123456 nhé. Tên người nhận là Nguyễn Văn An';

    const result = await service.extractOrderFromMessage(wsId, convId, messageText, 'msg-1');

    assert.strictEqual(result.confidenceScore >= 80, true);
    assert.strictEqual(result.suggestedCustomer?.phoneNumber, '0988123456');
    assert.strictEqual(result.suggestedCustomer?.carrierNetwork, 'VIETTEL');
    assert.strictEqual(result.suggestedCustomer?.province, 'Thành phố Hà Nội');
    assert.strictEqual(result.suggestedCustomer?.district, 'Quận Hoàng Mai');
    assert.strictEqual(result.suggestedCustomer?.recipientName, 'Nguyễn Văn An');

    // Product match
    assert.strictEqual(result.suggestedItems?.length, 1);
    assert.strictEqual(result.suggestedItems?.[0].productName, 'Áo Sơ Mi Oxford');
    assert.strictEqual(result.suggestedItems?.[0].unitPrice, 350000);

    // Verify WebSocket/Domain event emission
    assert.strictEqual(emittedEvents.length, 1);
    assert.strictEqual(emittedEvents[0].event, DomainEvent.POS_DRAFT_SUGGESTED);
    assert.strictEqual(emittedEvents[0].payload.workspaceId, wsId);
    assert.strictEqual(emittedEvents[0].payload.conversationId, convId);
    assert.strictEqual(emittedEvents[0].payload.confidenceScore, result.confidenceScore);
  });

  it('should return low confidence score and not emit event for generic chit-chat', async () => {
    const messageText = 'Dạ vâng em cảm ơn shop nhiều nhé!';

    const result = await service.extractOrderFromMessage(wsId, convId, messageText, 'msg-2');

    assert.strictEqual(result.confidenceScore < 50, true);
    assert.strictEqual(emittedEvents.length, 0);
  });
});
