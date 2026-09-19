import { expectReject } from '../../../../../test/test-assertions';
import { NotFoundException } from '@nestjs/common';
import { SenderType } from '@sales-copilot/shared-contracts';
import { AiContextBuilder } from '../ai-context.builder';
import { PERSONA_TONE_DESCRIPTIONS } from '../ai-agent.constants';

describe('AiContextBuilder', () => {
  let builder: AiContextBuilder;
  let mockPrisma: any;
  let conversationsDb: Map<string, any>;
  let messagesDb: Map<string, any>;

  const workspaceId = 'ws-test-123';
  const conversationId = 'conv-test-456';

  beforeEach(() => {
    conversationsDb = new Map();
    messagesDb = new Map();

    mockPrisma = {
      getClient: () => ({
        conversation: {
          findFirst: async ({ where }: any) => {
            const conv = conversationsDb.get(where.id);
            if (!conv || conv.workspaceId !== where.workspaceId) return null;
            return conv;
          },
        },
        message: {
          findMany: async ({ where, take }: any) => {
            const list = Array.from(messagesDb.values())
              .filter(
                m =>
                  m.conversationId === where.conversationId &&
                  m.workspaceId === where.workspaceId &&
                  (where.isPrivate === undefined || m.isPrivate === where.isPrivate),
              )
              .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            return list.slice(0, take);
          },
        },
      }),
    };

    builder = new AiContextBuilder(mockPrisma);
  });

  it('should throw NotFoundException if conversation does not exist or workspace mismatch', async () => {
    await expectReject(
      async () => builder.build('wrong-ws', conversationId),
      (err: any) => err instanceof NotFoundException,
    );
  });

  it('should build rich system prompt with persona tone, custom instructions, and contact details', async () => {
    conversationsDb.set(conversationId, {
      id: conversationId,
      workspaceId,
      workspace: { name: 'Thế Giới Giày' },
      contact: { name: 'Nguyễn Văn A', phoneNumber: '0901234567' },
      inbox: {
        settings: {
          aiCommercePolicy: {
            enabled: true,
            personaTone: 'em_anh_chi',
            maxDiscountPercent: 15,
            maxDiscountVnd: 100000,
            customInstructions: 'Luôn báo khách hàng kiểm tra size giày trước khi đặt.',
          },
        },
      },
    });

    const result = await builder.build(workspaceId, conversationId);

    expect(result.systemPrompt.includes('Thế Giới Giày')).toBeTruthy();
    expect(result.systemPrompt.includes(PERSONA_TONE_DESCRIPTIONS.em_anh_chi)).toBeTruthy();
    expect(result.systemPrompt.includes('15%')).toBeTruthy();
    expect(result.systemPrompt.includes('100.000đ')).toBeTruthy();
    expect(
      result.systemPrompt.includes('Luôn báo khách hàng kiểm tra size giày trước khi đặt.'),
    ).toBeTruthy();
    expect(result.systemPrompt.includes('Nguyễn Văn A')).toBeTruthy();
    expect(result.systemPrompt.includes('0901234567')).toBeTruthy();
  });

  it('should map conversation history to user and assistant roles in chronological order', async () => {
    conversationsDb.set(conversationId, {
      id: conversationId,
      workspaceId,
      workspace: { name: 'Shop Test' },
      contact: { name: 'Khách Test' },
      inbox: { settings: {} },
    });

    const now = Date.now();
    // Insert 3 messages with timestamps
    messagesDb.set('msg-1', {
      id: 'msg-1',
      conversationId,
      workspaceId,
      senderType: SenderType.CONTACT,
      content: 'Shop còn áo polo không?',
      isPrivate: false,
      createdAt: new Date(now - 3000),
    });
    messagesDb.set('msg-2', {
      id: 'msg-2',
      conversationId,
      workspaceId,
      senderType: SenderType.SYSTEM,
      content: 'Dạ shop còn ạ!',
      isPrivate: false,
      createdAt: new Date(now - 2000),
    });
    messagesDb.set('msg-3', {
      id: 'msg-3',
      conversationId,
      workspaceId,
      senderType: SenderType.CONTACT,
      content: 'Size L màu đen còn không?',
      isPrivate: false,
      createdAt: new Date(now - 1000),
    });
    // Private note should be excluded
    messagesDb.set('msg-private', {
      id: 'msg-private',
      conversationId,
      workspaceId,
      senderType: SenderType.USER,
      content: 'Khách này hỏi nhiều',
      isPrivate: true,
      createdAt: new Date(now - 500),
    });

    const result = await builder.build(workspaceId, conversationId);

    expect(result.messages.length).toBe(3);
    expect(result.messages[0]).toEqual({
      role: 'user',
      content: 'Shop còn áo polo không?',
    });
    expect(result.messages[1]).toEqual({
      role: 'assistant',
      content: 'Dạ shop còn ạ!',
    });
    expect(result.messages[2]).toEqual({
      role: 'user',
      content: 'Size L màu đen còn không?',
    });
  });
});
