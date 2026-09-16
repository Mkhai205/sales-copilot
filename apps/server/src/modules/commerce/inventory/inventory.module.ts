import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database';
import { InventoryController } from './inventory.controller';
import { InventoryLedgerService } from './inventory-ledger.service';

@Module({
  imports: [DatabaseModule],
  controllers: [InventoryController],
  providers: [InventoryLedgerService],
  exports: [InventoryLedgerService],
})
export class InventoryModule {}
