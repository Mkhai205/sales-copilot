import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database';
import { AuthModule } from '../../identity/auth';
import { WorkspacesModule } from '../../identity/workspaces';
import { InventoryModule } from '../inventory/inventory.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [DatabaseModule, AuthModule, WorkspacesModule, InventoryModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
