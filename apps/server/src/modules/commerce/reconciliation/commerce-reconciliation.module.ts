import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { COMMERCE_RECONCILIATION_QUEUE } from '@sales-copilot/shared-contracts';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { WorkspacesModule } from '../../identity/workspaces';
import { InventoryModule } from '../inventory/inventory.module';
import { PaymentReconciliationService } from './payment-reconciliation.service';
import { CommerceReconciliationProcessor } from './commerce-reconciliation.processor';
import { ReconciliationController } from './reconciliation.controller';

@Module({
  imports: [
    DatabaseModule,
    WorkspacesModule,
    InventoryModule,
    BullModule.registerQueue({
      name: COMMERCE_RECONCILIATION_QUEUE,
    }),
  ],
  controllers: [ReconciliationController],
  providers: [PaymentReconciliationService, CommerceReconciliationProcessor],
  exports: [PaymentReconciliationService, BullModule],
})
export class CommerceReconciliationModule {}

export const PosReconciliationModule = CommerceReconciliationModule;
