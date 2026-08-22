import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { AuthModule } from '../auth';
import { WorkspacesModule } from '../workspaces';
import { ChannelCredentialService } from './channel-credential.service';
import { InboxMembersController } from './inbox-members.controller';
import { InboxesController } from './inboxes.controller';
import { InboxesService } from './inboxes.service';

@Module({
  imports: [DatabaseModule, AuthModule, WorkspacesModule],
  controllers: [InboxesController, InboxMembersController],
  providers: [ChannelCredentialService, InboxesService],
  exports: [ChannelCredentialService, InboxesService],
})
export class InboxesModule {}
