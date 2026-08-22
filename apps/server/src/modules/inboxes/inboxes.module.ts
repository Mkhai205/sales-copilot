import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { AuthModule } from '../auth';
import { WorkspacesModule } from '../workspaces';
import { ChannelCredentialService } from './channel-credential.service';
import { InboxesController } from './inboxes.controller';
import { InboxesService } from './inboxes.service';

@Module({
  imports: [DatabaseModule, AuthModule, WorkspacesModule],
  controllers: [InboxesController],
  providers: [ChannelCredentialService, InboxesService],
  exports: [ChannelCredentialService, InboxesService],
})
export class InboxesModule {}
