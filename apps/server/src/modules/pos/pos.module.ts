import { Module } from '@nestjs/common';
import { OrdersModule } from './orders/orders.module';
import { ProductsModule } from './products/products.module';
import { PosPresenceModule } from './presence/pos-presence.module';
import { VietQrModule } from './payments/vietqr.module';
import { PaymentWebhooksModule } from './webhooks/payment-webhooks.module';
import { PosReconciliationModule } from './reconciliation/pos-reconciliation.module';
import { PosListenersModule } from './listeners/pos-listeners.module';

@Module({
  imports: [
    ProductsModule,
    OrdersModule,
    PosPresenceModule,
    VietQrModule,
    PaymentWebhooksModule,
    PosReconciliationModule,
    PosListenersModule,
  ],
  exports: [
    ProductsModule,
    OrdersModule,
    PosPresenceModule,
    VietQrModule,
    PaymentWebhooksModule,
    PosReconciliationModule,
    PosListenersModule,
  ],
})
export class PosModule {}
