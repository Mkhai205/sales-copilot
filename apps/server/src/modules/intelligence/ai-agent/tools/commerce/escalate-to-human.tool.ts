import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { MessageType, SenderType } from '@sales-copilot/shared-contracts';
import type { PrismaService } from '../../../../../infrastructure/database/prisma.service';
import type { MessagesService } from '../../../../omnichannel/messages/messages.service';
import type { RedisService } from '../../../../../infrastructure/redis/redis.service';
import { getAiDebounceKey } from '../../ai-agent.constants';

export interface EscalateToHumanToolOptions {
  workspaceId: string;
  conversationId?: string;
  prisma: PrismaService;
  messagesService: MessagesService;
  redisService?: RedisService;
}

export const escalateToHumanInputSchema = z.object({
  reason: z
    .string()
    .describe(
      'Lý do chi tiết cần chuyển cuộc trò chuyện cho nhân viên (ví dụ: "Khách khiếu nại sản phẩm lỗi", "Khách đòi hoàn tiền", "Vấn đề kỹ thuật ngoài phạm vi")',
    ),
});

export type EscalateToHumanInput = z.infer<typeof escalateToHumanInputSchema>;

export function createEscalateToHumanTool({
  workspaceId,
  conversationId,
  prisma,
  messagesService,
  redisService,
}: EscalateToHumanToolOptions): Tool {
  return tool({
    description:
      'Khi không thể xử lý yêu cầu của khách hàng (yêu cầu phức tạp, khiếu nại, đổi trả bảo hành, lỗi kỹ thuật hoặc khách hàng yêu cầu gặp người thật), chuyển giao cuộc trò chuyện cho nhân viên hỗ trợ con người.',
    inputSchema: escalateToHumanInputSchema,
    execute: async ({ reason }: EscalateToHumanInput) => {
      try {
        if (!conversationId) {
          return {
            escalated: false,
            error: 'MISSING_CONVERSATION_ID',
            message: 'Không tìm thấy thông tin cuộc trò chuyện để thực hiện chuyển giao',
          };
        }

        const client = prisma.getClient();

        // 1. Send farewell message to customer FIRST (Prevents Human Takeover Abort Trap)
        await messagesService.create(workspaceId, conversationId, {
          content:
            'Dạ em xin phép chuyển tiếp cuộc trò chuyện cho nhân viên tư vấn để hỗ trợ mình chu đáo nhất ạ. Bạn vui lòng chờ trong giây lát nhé! 🙏',
          senderType: SenderType.SYSTEM,
          messageType: MessageType.OUTGOING,
          metadata: {
            isAiGenerated: true,
            isEscalationFarewell: true,
            escalationReason: reason,
          },
        });

        // 2. Add an internal audit note for human agents
        await messagesService.create(workspaceId, conversationId, {
          content: `[AI Escalation] Đã chuyển giao hội thoại cho nhân viên hỗ trợ. Lý do: ${reason}`,
          senderType: SenderType.SYSTEM,
          messageType: MessageType.ACTIVITY,
          isPrivate: true,
          metadata: {
            isInternal: true,
            type: 'AI_ESCALATION_NOTE',
            reason,
          },
        });

        // 3. Update conversation to pause AI (Strict Multi-Tenancy)
        await client.conversation.updateMany({
          where: { id: conversationId, workspaceId },
          data: {
            isAiPaused: true,
          },
        });

        // 4. Invalidate Redis AI debounce key to prevent further AI queuing
        if (redisService) {
          const debounceKey = getAiDebounceKey(workspaceId, conversationId);
          await redisService.del(debounceKey);
        }

        return {
          escalated: true,
          message: 'Đã chuyển cho nhân viên hỗ trợ',
          reason,
        };
      } catch (error: any) {
        return {
          escalated: false,
          error: 'ESCALATE_TO_HUMAN_FAILED',
          message: error?.message || 'Không thể chuyển giao cho nhân viên lúc này',
        };
      }
    },
  });
}
