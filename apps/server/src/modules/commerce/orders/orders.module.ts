import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database';
import { AuthModule } from '../../identity/auth';
import { WorkspacesModule } from '../../identity/workspaces';
import { InventoryModule } from '../inventory/inventory.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [DatabaseModule, AuthModule, WorkspacesModule, InventoryModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
