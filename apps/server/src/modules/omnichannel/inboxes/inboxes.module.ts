import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { WorkspacesModule } from '../../identity/workspaces/workspaces.module';
import { InboxMembersController } from './inbox-members.controller';
import { InboxesController } from './inboxes.controller';
import { InboxesService } from './inboxes.service';

@Module({
  imports: [DatabaseModule, AuthModule, WorkspacesModule],
  controllers: [InboxesController, InboxMembersController],
  providers: [InboxesService],
  exports: [InboxesService],
})
export class InboxesModule {}
