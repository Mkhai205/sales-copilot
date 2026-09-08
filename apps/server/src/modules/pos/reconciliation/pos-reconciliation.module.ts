import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { POS_RECONCILIATION_QUEUE } from '@sales-copilot/shared-contracts';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { PaymentReconciliationService } from './payment-reconciliation.service';
import { PosReconciliationProcessor } from './pos-reconciliation.processor';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({
      name: POS_RECONCILIATION_QUEUE,
    }),
  ],
  providers: [PaymentReconciliationService, PosReconciliationProcessor],
  exports: [PaymentReconciliationService, BullModule],
})
export class PosReconciliationModule {}
