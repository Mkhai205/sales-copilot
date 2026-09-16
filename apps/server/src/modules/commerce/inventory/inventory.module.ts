import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database';
import { InventoryLedgerService } from './inventory-ledger.service';

@Module({
  imports: [DatabaseModule],
  providers: [InventoryLedgerService],
  exports: [InventoryLedgerService],
})
export class InventoryModule {}
