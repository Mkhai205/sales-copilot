import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { COMMERCE_ORDER_AUTOMATION_QUEUE } from '@sales-copilot/shared-contracts';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { LlmGatewayModule } from '../../intelligence/llm-gateway/llm-gateway.module';
import { OrderExtractorService } from './order-extractor.service';
import { CommerceOrderAutomationListener } from './commerce-order-automation.listener';
import { CommerceOrderAutomationProcessor } from './commerce-order-automation.processor';

@Module({
  imports: [
    DatabaseModule,
    LlmGatewayModule,
    BullModule.registerQueue({
      name: COMMERCE_ORDER_AUTOMATION_QUEUE,
    }),
  ],
  providers: [
    OrderExtractorService,
    CommerceOrderAutomationListener,
    CommerceOrderAutomationProcessor,
  ],
  exports: [OrderExtractorService, BullModule],
})
export class CommerceAutomationModule {}

export const PosAutomationModule = CommerceAutomationModule;
