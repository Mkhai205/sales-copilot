import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { COMMERCE_RECONCILIATION_QUEUE } from '@sales-copilot/shared-contracts';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { PaymentReconciliationService } from './payment-reconciliation.service';
import { CommerceReconciliationProcessor } from './commerce-reconciliation.processor';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({
      name: COMMERCE_RECONCILIATION_QUEUE,
    }),
  ],
  providers: [PaymentReconciliationService, CommerceReconciliationProcessor],
  exports: [PaymentReconciliationService, BullModule],
})
export class CommerceReconciliationModule {}

export const PosReconciliationModule = CommerceReconciliationModule;
