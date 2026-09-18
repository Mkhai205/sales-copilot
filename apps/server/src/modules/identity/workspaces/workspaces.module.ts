import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database';
import { AuthModule } from '../auth';
import { InboxesModule } from '../../omnichannel/inboxes/inboxes.module';
import { RolesGuard, WorkspaceGuard } from './guards';
import { WorkspaceMembersController } from './workspace-members.controller';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({
  imports: [DatabaseModule, AuthModule, forwardRef(() => InboxesModule)],
  controllers: [WorkspacesController, WorkspaceMembersController],
  providers: [WorkspacesService, WorkspaceGuard, RolesGuard],
  exports: [WorkspacesService, WorkspaceGuard, RolesGuard],
})
export class WorkspacesModule {}
