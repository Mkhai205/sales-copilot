import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../../../common/authz/roles.guard';
import { WorkspaceGuard } from './guards/workspace.guard';
import { WorkspaceMembersController } from './workspace-members.controller';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [WorkspacesController, WorkspaceMembersController],
  providers: [WorkspacesService, WorkspaceGuard, RolesGuard],
  exports: [WorkspacesService, WorkspaceGuard, RolesGuard],
})
export class WorkspacesModule {}
