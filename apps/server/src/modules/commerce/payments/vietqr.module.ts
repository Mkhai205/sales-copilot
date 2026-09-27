import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { WorkspacesModule } from '../../identity/workspaces/workspaces.module';
import { MessagesModule } from '../../omnichannel/messages/messages.module';
import { VietQrService } from './vietqr.service';
import { VietQrController } from './vietqr.controller';

@Module({
  imports: [DatabaseModule, AuthModule, WorkspacesModule, MessagesModule],
  controllers: [VietQrController],
  providers: [VietQrService],
  exports: [VietQrService],
})
export class VietQrModule {}
