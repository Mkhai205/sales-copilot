import { Module } from '@nestjs/common';
import { AuthModule } from '../../identity/auth/auth.module';
import { WorkspacesModule } from '../../identity/workspaces/workspaces.module';
import { CannedResponsesController } from './canned-responses.controller';
import { CannedResponsesService } from './canned-responses.service';

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [CannedResponsesController],
  providers: [CannedResponsesService],
  exports: [CannedResponsesService],
})
export class CannedResponsesModule {}
