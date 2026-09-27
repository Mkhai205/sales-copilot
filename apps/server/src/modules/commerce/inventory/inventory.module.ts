import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { WorkspacesModule } from '../../identity/workspaces/workspaces.module';
import { InventoryController } from './inventory.controller';
import { InventoryLedgerService } from './inventory-ledger.service';

@Module({
  imports: [DatabaseModule, AuthModule, WorkspacesModule],
  controllers: [InventoryController],
  providers: [InventoryLedgerService],
  exports: [InventoryLedgerService],
})
export class InventoryModule {}
