import { tool, type Tool } from 'ai';
import { z } from 'zod';
import type { KnowledgeService } from '../../../knowledge/knowledge.service';
import {
  DEFAULT_SIMILARITY_THRESHOLD,
  DEFAULT_TOP_K,
} from '../../../knowledge/knowledge.constants';

export interface SearchKnowledgeToolOptions {
  workspaceId: string;
  knowledgeService: KnowledgeService;
}

const searchKnowledgeInputSchema = z.object({
  query: z
    .string()
    .describe(
      'Câu hỏi, chủ đề hoặc từ khóa cần tra cứu về chính sách đổi trả, bảo hành, giao hàng, thanh toán hoặc thông tin chung của cửa hàng',
    ),
});

type SearchKnowledgeInput = z.infer<typeof searchKnowledgeInputSchema>;

export function createSearchKnowledgeTool({
  workspaceId,
  knowledgeService,
}: SearchKnowledgeToolOptions): Tool {
  return tool({
    description:
      'Tra cứu các bài viết kiến thức, chính sách cửa hàng (đổi trả, bảo hành, vận chuyển, phương thức thanh toán, FAQ...) theo ngữ nghĩa câu hỏi của khách hàng.',
    inputSchema: searchKnowledgeInputSchema,
    execute: async ({ query }: SearchKnowledgeInput) => {
      try {
        const trimmed = query?.trim();
        if (!trimmed) {
          return {
            found: false,
            message: 'Từ khóa tra cứu không được để trống.',
            articles: [],
          };
        }

        const results = await knowledgeService.searchSimilar(
          workspaceId,
          trimmed,
          DEFAULT_SIMILARITY_THRESHOLD,
          DEFAULT_TOP_K,
        );

        if (!results || results.length === 0) {
          return {
            found: false,
            message:
              'Không tìm thấy thông tin phù hợp trong kho kiến thức của shop. Hãy lịch sự thông báo khách và đề nghị chuyển nhân viên tư vấn hỗ trợ.',
            articles: [],
          };
        }

        return {
          found: true,
          count: results.length,
          articles: results.map(r => ({
            id: r.id,
            title: r.title,
            category: r.category,
            content: r.content,
            similarity: Math.round(r.similarity * 100) / 100,
          })),
        };
      } catch (error: any) {
        return {
          found: false,
          error: 'SEARCH_KNOWLEDGE_FAILED',
          message: error?.message || 'Không thể tra cứu kiến thức cửa hàng vào lúc này.',
        };
      }
    },
  });
}
