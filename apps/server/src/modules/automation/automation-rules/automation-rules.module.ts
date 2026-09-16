import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database';
import { AuthModule } from '../../identity/auth';
import { WorkspacesModule } from '../../identity/workspaces';
import { ConversationsModule } from '../../omnichannel/conversations/conversations.module';
import { LabelsModule } from '../../omnichannel/labels/labels.module';
import { AuditLogsModule } from '../../identity/audit-logs/audit-logs.module';
import { AutomationRulesController } from './automation-rules.controller';
import { AutomationRulesService } from './automation-rules.service';
import { AutomationExecutorService } from './automation-executor.service';
import { AutomationRulesListener } from './automation-rules.listener';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    WorkspacesModule,
    ConversationsModule,
    LabelsModule,
    AuditLogsModule,
  ],
  controllers: [AutomationRulesController],
  providers: [AutomationRulesService, AutomationExecutorService, AutomationRulesListener],
  exports: [AutomationRulesService, AutomationExecutorService],
})
export class AutomationRulesModule {}
