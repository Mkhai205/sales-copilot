import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PrismaTransactionManager, TRANSACTION_MANAGER } from './transactions';

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
