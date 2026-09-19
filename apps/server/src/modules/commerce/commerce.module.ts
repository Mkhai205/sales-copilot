import { Module } from '@nestjs/common';
import { InventoryModule } from './inventory/inventory.module';
import { OrdersModule } from './orders/orders.module';
import { ProductsModule } from './products/products.module';
import { CommercePresenceModule } from './presence/commerce-presence.module';
import { VietQrModule } from './payments/vietqr.module';
import { PaymentWebhooksModule } from './webhooks/payment-webhooks.module';
import { CommerceReconciliationModule } from './reconciliation/commerce-reconciliation.module';
import { CommerceListenersModule } from './listeners/commerce-listeners.module';

@Module({
  imports: [
    InventoryModule,
    ProductsModule,
    OrdersModule,
    CommercePresenceModule,
    VietQrModule,
    PaymentWebhooksModule,
    CommerceReconciliationModule,
    CommerceListenersModule,
  ],
  exports: [
    InventoryModule,
    ProductsModule,
    OrdersModule,
    CommercePresenceModule,
    VietQrModule,
    PaymentWebhooksModule,
    CommerceReconciliationModule,
    CommerceListenersModule,
  ],
})
export class CommerceModule {}

export const PosModule = CommerceModule;
