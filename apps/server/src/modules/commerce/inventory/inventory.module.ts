import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database';
import { AuthModule } from '../../identity/auth';
import { WorkspacesModule } from '../../identity/workspaces';
import { InventoryController } from './inventory.controller';
import { InventoryLedgerService } from './inventory-ledger.service';

@Module({
  imports: [DatabaseModule, AuthModule, WorkspacesModule],
  controllers: [InventoryController],
  providers: [InventoryLedgerService],
  exports: [InventoryLedgerService],
})
export class InventoryModule {}
