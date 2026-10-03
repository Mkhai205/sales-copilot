import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { WorkspacesModule } from '../../identity/workspaces/workspaces.module';
import { InventoryModule } from '../inventory/inventory.module';
import { AutoReconciliationMatcher } from './auto-reconciliation.matcher';
import { ManualMatchService } from './manual-match.service';
import { ReconciliationQueryService } from './reconciliation-query.service';
import { CommerceReconciliationProcessor } from './commerce-reconciliation.processor';
import { ReconciliationController } from './reconciliation.controller';

@Module({
  imports: [DatabaseModule, WorkspacesModule, InventoryModule],
  controllers: [ReconciliationController],
  providers: [
    AutoReconciliationMatcher,
    ManualMatchService,
    ReconciliationQueryService,
    CommerceReconciliationProcessor,
  ],
  exports: [AutoReconciliationMatcher, ManualMatchService, ReconciliationQueryService],
})
export class CommerceReconciliationModule {}
