import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { AuthModule } from '../../auth';
import { WorkspacesModule } from '../../workspaces';
import { MessagesModule } from '../../messages/messages.module';
import { VietQrService } from './vietqr.service';
import { VietQrController } from './vietqr.controller';

@Module({
  imports: [DatabaseModule, AuthModule, WorkspacesModule, MessagesModule],
  controllers: [VietQrController],
  providers: [VietQrService],
  exports: [VietQrService],
})
export class VietQrModule {}
