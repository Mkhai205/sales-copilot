import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { WorkspacesModule } from '../../identity/workspaces/workspaces.module';
import { InventoryController } from './inventory.controller';
import { InventoryQueryService } from './inventory-query.service';
import { StockMovementService } from './stock-movement.service';

@Module({
  imports: [DatabaseModule, AuthModule, WorkspacesModule],
  controllers: [InventoryController],
  providers: [StockMovementService, InventoryQueryService],
  exports: [StockMovementService, InventoryQueryService],
})
export class InventoryModule {}
