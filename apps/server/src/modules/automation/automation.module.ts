import { Module } from '@nestjs/common';
import { AutomationRulesModule } from './automation-rules/automation-rules.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [AutomationRulesModule, WebhooksModule],
  exports: [AutomationRulesModule, WebhooksModule],
})
export class AutomationModule {}
