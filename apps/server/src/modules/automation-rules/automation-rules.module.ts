import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { AuthModule } from '../auth';
import { WorkspacesModule } from '../workspaces';
import { ConversationsModule } from '../conversations/conversations.module';
import { LabelsModule } from '../labels/labels.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
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
