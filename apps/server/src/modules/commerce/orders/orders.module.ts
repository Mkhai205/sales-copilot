import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { WorkspacesModule } from '../../identity/workspaces/workspaces.module';
import { InventoryModule } from '../inventory/inventory.module';
import { MessagesModule } from '../../omnichannel/messages/messages.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [DatabaseModule, AuthModule, WorkspacesModule, InventoryModule, MessagesModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
