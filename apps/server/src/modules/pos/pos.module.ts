import { Module } from '@nestjs/common';
import { OrdersModule } from './orders/orders.module';
import { ProductsModule } from './products/products.module';
import { PosPresenceModule } from './presence/pos-presence.module';

@Module({
  imports: [ProductsModule, OrdersModule, PosPresenceModule],
  exports: [ProductsModule, OrdersModule, PosPresenceModule],
})
export class PosModule {}
