import { Injectable, Logger, Optional } from '@nestjs/common';
import type { ToolSet, LanguageModel } from 'ai';
import type { InboxAiCommercePolicyConfig } from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import { HumanTakeoverAbortError } from '../ai-agent.constants';
import { ProductsService } from '../../../commerce/products/products.service';
import { OrdersService } from '../../../commerce/orders/orders.service';
import { InventoryLedgerService } from '../../../commerce/inventory/inventory-ledger.service';
import { VietQrService } from '../../../commerce/payments/vietqr.service';
import { ContactsService } from '../../../omnichannel/contacts/contacts.service';
import { MessagesService } from '../../../omnichannel/messages/messages.service';
import { DiscountGuardService } from '../services/discount-guard.service';

import { createSearchProductsTool } from './commerce/search-products.tool';
import { createGetProductDetailsTool } from './commerce/get-product-details.tool';
import { createCheckInventoryTool } from './commerce/check-inventory.tool';
import { createExtractShippingInfoTool } from './commerce/extract-shipping-info.tool';
import { createEvaluateDiscountTool } from './commerce/evaluate-discount.tool';
import { createCreateDraftOrderTool } from './commerce/create-draft-order.tool';
import { createConfirmAndGenerateQrTool } from './commerce/confirm-and-generate-qr.tool';
import { createUpdateContactInfoTool } from './commerce/update-contact-info.tool';
import { createEscalateToHumanTool } from './commerce/escalate-to-human.tool';
import { createSearchKnowledgeTool } from './knowledge/search-knowledge.tool';
import { KnowledgeService } from '../../knowledge/knowledge.service';

export interface CommerceToolBuildContext {
  workspaceId: string;
  conversationId?: string;
  policy?: InboxAiCommercePolicyConfig;
}

@Injectable()
export class CommerceToolRegistry {
  private readonly logger = new Logger(CommerceToolRegistry.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly productsService: ProductsService,
    private readonly ordersService: OrdersService,
    private readonly inventoryLedgerService: InventoryLedgerService,
    private readonly vietQrService: VietQrService,
    private readonly contactsService: ContactsService,
    private readonly messagesService: MessagesService,
    private readonly discountGuardService: DiscountGuardService,
    @Optional() private readonly knowledgeService?: KnowledgeService,
  ) {}

  /**
   * Constructs all Vercel AI SDK tools scoped by workspaceId closure.
   * Multi-tenancy rule: workspaceId is strictly injected via closure and never exposed in tool parameters.
   */
  buildTools(context: CommerceToolBuildContext, model?: LanguageModel): ToolSet {
    return this.withHumanTakeoverGuard(this.createToolSet(context, model), context);
  }

  private createToolSet(context: CommerceToolBuildContext, model?: LanguageModel): ToolSet {
    const { workspaceId, conversationId, policy } = context;

    return {
      ...(this.knowledgeService
        ? {
            searchKnowledge: createSearchKnowledgeTool({
              workspaceId,
              knowledgeService: this.knowledgeService,
            }),
          }
        : {}),

      searchProducts: createSearchProductsTool({
        workspaceId,
        productsService: this.productsService,
      }),

      getProductDetails: createGetProductDetailsTool({
        workspaceId,
        productsService: this.productsService,
      }),

      checkInventory: createCheckInventoryTool({
        workspaceId,
        inventoryLedgerService: this.inventoryLedgerService,
        prisma: this.prisma,
      }),

      extractShippingInfo: createExtractShippingInfoTool({
        model,
      }),

      evaluateDiscount: createEvaluateDiscountTool({
        discountGuardService: this.discountGuardService,
        policy,
      }),

      createDraftOrder: createCreateDraftOrderTool({
        workspaceId,
        conversationId,
        ordersService: this.ordersService,
        discountGuardService: this.discountGuardService,
        prisma: this.prisma,
        policy,
      }),

      confirmAndGenerateQR: createConfirmAndGenerateQrTool({
        workspaceId,
        conversationId,
        ordersService: this.ordersService,
        vietQrService: this.vietQrService,
        prisma: this.prisma,
        messagesService: this.messagesService,
      }),

      updateContactInfo: createUpdateContactInfoTool({
        workspaceId,
        conversationId,
        contactsService: this.contactsService,
        prisma: this.prisma,
      }),

      escalateToHuman: createEscalateToHumanTool({
        workspaceId,
        conversationId,
        prisma: this.prisma,
        messagesService: this.messagesService,
        redisService: this.redisService,
      }),
    };
  }

  /**
   * Belt-and-suspenders Human Takeover guard: re-checks `isAiPaused` from the DB right
   * before every tool execution. The stopWhen condition in AiAgentService only runs
   * between steps, so without this guard tools already queued in the current step would
   * still execute (and mutate orders/contacts) after a human agent took over.
   * Throwing inside `execute` makes the AI SDK record a tool-error result for the step;
   * the takeover stop condition then halts the loop and the reply is discarded.
   */
  private withHumanTakeoverGuard(toolSet: ToolSet, context: CommerceToolBuildContext): ToolSet {
    const { workspaceId, conversationId } = context;
    if (!conversationId) {
      return toolSet;
    }

    return Object.fromEntries(
      Object.entries(toolSet).map(([name, toolDef]) => {
        const originalExecute = toolDef.execute?.bind(toolDef);
        if (!originalExecute) {
          return [name, toolDef];
        }

        return [
          name,
          {
            ...toolDef,
            execute: async (
              input: unknown,
              options: Parameters<NonNullable<typeof originalExecute>>[1],
            ) => {
              const conv = await this.prisma.getClient().conversation.findFirst({
                where: { id: conversationId, workspaceId },
                select: { isAiPaused: true },
              });

              if (conv?.isAiPaused) {
                this.logger.warn(
                  `Blocking tool '${name}' in conversation '${conversationId}': Human Takeover is active.`,
                );
                throw new HumanTakeoverAbortError();
              }

              return originalExecute(input, options);
            },
          } as typeof toolDef,
        ];
      }),
    ) as ToolSet;
  }
}
