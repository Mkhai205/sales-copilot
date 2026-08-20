import { Global, Module } from '@nestjs/common';
import { TRANSACTION_MANAGER } from '@sales-copilot/shared-contracts';
import { PrismaService } from './prisma.service';
import { PrismaTransactionManager } from './transactions/prisma-transaction-manager';

@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: PrismaTransactionManager,
      useFactory: (prismaService: PrismaService) => prismaService.txManager,
      inject: [PrismaService],
    },
    {
      provide: TRANSACTION_MANAGER,
      useExisting: PrismaTransactionManager,
    },
  ],
  exports: [PrismaService, PrismaTransactionManager, TRANSACTION_MANAGER],
})
export class DatabaseModule {}
