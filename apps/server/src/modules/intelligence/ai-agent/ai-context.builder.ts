import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { ModelMessage } from 'ai';
import { SenderType, type InboxAiCommercePolicyConfig } from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../infrastructure/database';
import { AI_AGENT_CONSTANTS, PERSONA_TONE_DESCRIPTIONS } from './ai-agent.constants';

export interface BuiltAiContext {
  systemPrompt: string;
  messages: ModelMessage[];
  aiPolicy?: InboxAiCommercePolicyConfig;
}

@Injectable()
export class AiContextBuilder {
  private readonly logger = new Logger(AiContextBuilder.name);

  constructor(private readonly prisma: PrismaService) {}

  async build(
    workspaceId: string,
    conversationId: string,
    _inboxId?: string,
  ): Promise<BuiltAiContext> {
    const client = this.prisma.getClient();

    // 1. Load conversation + related metadata (Strict Multi-Tenancy)
    const conversation = await client.conversation.findFirst({
      where: { id: conversationId, workspaceId },
      include: {
        contact: true,
        inbox: true,
        workspace: {
          select: { name: true },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException(
        `Conversation '${conversationId}' not found in workspace '${workspaceId}'`,
      );
    }

    // 2. Extract shop, contact, and policy configurations
    const shopName = conversation.workspace?.name || 'Shop';
    const inboxSettings = conversation.inbox?.settings as Record<string, unknown> | undefined;
    const policy = inboxSettings?.aiCommercePolicy as InboxAiCommercePolicyConfig | undefined;

    const toneKey = policy?.personaTone || 'shop_ban';
    const personaDescription =
      PERSONA_TONE_DESCRIPTIONS[toneKey] || PERSONA_TONE_DESCRIPTIONS.shop_ban;
    const maxDiscountPercent = policy?.maxDiscountPercent ?? 0;
    const maxDiscountVnd = policy?.maxDiscountVnd ?? 0;
    const customInstructions = policy?.customInstructions?.trim();

    const contactName = conversation.contact?.name || 'Khách hàng';
    const contactPhone = conversation.contact?.phoneNumber || 'Chưa cung cấp';

    // 3. Assemble System Prompt
    const systemPrompt = [
      `[Persona]`,
      `Bạn là nhân viên bán hàng AI của shop "${shopName}".`,
      `Giọng điệu giao tiếp: ${personaDescription}.`,
      ``,
      `[Quy tắc bắt buộc]`,
      `1. KHÔNG BAO GIỜ bịa thông tin sản phẩm, tồn kho hoặc giá bán. Luôn trung thực và chính xác.`,
      `2. KHÔNG tự ý giảm giá vượt hạn mức shop cho phép: tối đa ${maxDiscountPercent}% hoặc ${maxDiscountVnd.toLocaleString('vi-VN')}đ.`,
      `3. Nếu chưa rõ yêu cầu hoặc khách hàng hỏi vấn đề phức tạp vượt quá khả năng, hãy lịch sự thông báo khách chờ nhân viên shop hỗ trợ.`,
      `4. Trả lời ngắn gọn, thân thiện, súc tích, sử dụng emoji phù hợp với ngữ cảnh bán hàng mạng xã hội tại Việt Nam.`,
      ``,
      `[Hướng dẫn riêng của shop]`,
      customInstructions || 'Không có hướng dẫn riêng.',
      ``,
      `[Thông tin khách hàng hiện tại]`,
      `- Tên khách: ${contactName}`,
      `- SĐT: ${contactPhone}`,
    ].join('\n');

    // 4. Load recent conversation history (max 20 messages, excluding private notes)
    const rawMessages = await client.message.findMany({
      where: {
        conversationId,
        workspaceId,
        isPrivate: false,
      },
      orderBy: { createdAt: 'desc' },
      take: AI_AGENT_CONSTANTS.MAX_HISTORY_MESSAGES,
    });

    // Chronological order: oldest to newest
    const chronologicalMessages = rawMessages.reverse();

    const messages: ModelMessage[] = [];
    for (const msg of chronologicalMessages) {
      if (!msg.content || !msg.content.trim()) continue;

      if (msg.senderType === SenderType.CONTACT) {
        messages.push({
          role: 'user',
          content: msg.content.trim(),
        });
      } else {
        // USER (human agent) or SYSTEM (AI) replies act as assistant turn
        messages.push({
          role: 'assistant',
          content: msg.content.trim(),
        });
      }
    }

    // Defensive fallback: If history contains no messages, provide basic greeting prompt
    if (messages.length === 0) {
      messages.push({
        role: 'user',
        content: 'Xin chào shop',
      });
    }

    return {
      systemPrompt,
      messages,
      aiPolicy: policy,
    };
  }
}
