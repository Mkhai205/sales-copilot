import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { COMMERCE_RECONCILIATION_QUEUE } from '@sales-copilot/shared-contracts';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { WorkspacesModule } from '../../identity/workspaces/workspaces.module';
import { InventoryModule } from '../inventory/inventory.module';
import { AutoReconciliationMatcher } from './auto-reconciliation.matcher';
import { ManualMatchService } from './manual-match.service';
import { ReconciliationQueryService } from './reconciliation-query.service';
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
  providers: [
    AutoReconciliationMatcher,
    ManualMatchService,
    ReconciliationQueryService,
    CommerceReconciliationProcessor,
  ],
  exports: [AutoReconciliationMatcher, ManualMatchService, ReconciliationQueryService, BullModule],
})
export class CommerceReconciliationModule {}
