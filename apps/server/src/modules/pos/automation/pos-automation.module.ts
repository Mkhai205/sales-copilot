import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { POS_ORDER_AUTOMATION_QUEUE } from '@sales-copilot/shared-contracts';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { LlmGatewayModule } from '../../llm-gateway/llm-gateway.module';
import { OrderExtractorService } from './order-extractor.service';
import { PosOrderAutomationListener } from './pos-order-automation.listener';
import { PosOrderAutomationProcessor } from './pos-order-automation.processor';

@Module({
  imports: [
    DatabaseModule,
    LlmGatewayModule,
    BullModule.registerQueue({
      name: POS_ORDER_AUTOMATION_QUEUE,
    }),
  ],
  providers: [OrderExtractorService, PosOrderAutomationListener, PosOrderAutomationProcessor],
  exports: [OrderExtractorService, BullModule],
})
export class PosAutomationModule {}
