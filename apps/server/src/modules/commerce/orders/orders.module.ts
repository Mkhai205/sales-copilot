import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { RedisModule } from '../../../infrastructure/redis/redis.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { WorkspacesModule } from '../../identity/workspaces/workspaces.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OrdersController } from './orders.controller';
import { OrderLifecycleService } from './order-lifecycle.service';
import { OrderQueryService } from './order-query.service';
import { OrderWriterService } from './order-writer.service';

@Module({
  imports: [DatabaseModule, AuthModule, WorkspacesModule, InventoryModule, RedisModule],
  controllers: [OrdersController],
  providers: [OrderWriterService, OrderLifecycleService, OrderQueryService],
  exports: [OrderWriterService, OrderLifecycleService, OrderQueryService],
})
export class OrdersModule {}
