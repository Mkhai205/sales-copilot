import { Module, type OnModuleInit, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AI_AUTOPILOT_QUEUE } from '@sales-copilot/shared-contracts';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { RedisModule } from '../../../infrastructure/redis/redis.module';
import { MessagesModule } from '../../omnichannel/messages/messages.module';
import { ContactsModule } from '../../omnichannel/contacts/contacts.module';
import { ConversationsModule } from '../../omnichannel/conversations/conversations.module';
import { ProductsModule } from '../../commerce/products/products.module';
import { OrdersModule } from '../../commerce/orders/orders.module';
import { InventoryModule } from '../../commerce/inventory/inventory.module';
import { VietQrModule } from '../../commerce/payments/vietqr.module';

import { AiAgentService } from './ai-agent.service';
import { AiAgentWorker } from './ai-agent.worker';
import { AiDispatcherListener } from './ai-dispatcher.listener';
import { AiTakeoverListener } from './ai-takeover.listener';
import { AiContextBuilder } from './ai-context.builder';
import { DiscountGuardService } from './services/discount-guard.service';
import { CommerceToolRegistry } from './tools/commerce-tool.registry';
import { ensureDivisionsLoaded } from './utils/address-parser.util';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    MessagesModule,
    ContactsModule,
    ConversationsModule,
    ProductsModule,
    OrdersModule,
    InventoryModule,
    VietQrModule,
    BullModule.registerQueue({
      name: AI_AUTOPILOT_QUEUE,
    }),
  ],
  providers: [
    AiAgentService,
    AiAgentWorker,
    AiDispatcherListener,
    AiTakeoverListener,
    AiContextBuilder,
    DiscountGuardService,
    CommerceToolRegistry,
  ],
  exports: [AiAgentService, CommerceToolRegistry, DiscountGuardService, BullModule],
})
export class AiAgentModule implements OnModuleInit {
  private readonly logger = new Logger(AiAgentModule.name);

  async onModuleInit() {
    // Pre-heat Vietnam GSO administrative divisions into RAM for sub-5ms Tier 1 address parsing
    ensureDivisionsLoaded()
      .then(() => {
        this.logger.log('Administrative divisions preheated into memory successfully.');
      })
      .catch(err => {
        this.logger.warn(`Failed to preheat administrative divisions: ${err?.message}`);
      });
  }
}
