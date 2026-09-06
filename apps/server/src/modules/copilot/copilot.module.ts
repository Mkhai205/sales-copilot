import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { COPILOT_SUGGESTIONS_QUEUE } from '@sales-copilot/shared-contracts';
import { DatabaseModule } from '../../infrastructure/database';
import { RedisModule } from '../../infrastructure/redis';
import { MessagesModule } from '../messages/messages.module';
import { ContactsModule } from '../contacts/contacts.module';
import { LeadsModule } from '../leads/leads.module';
import { LeadScoringModule } from '../lead-scoring/lead-scoring.module';
import { SalesEvidenceModule } from '../sales-evidence/sales-evidence.module';
import { LlmGatewayModule } from '../llm-gateway/llm-gateway.module';
import { PromptRegistryModule } from '../prompt-registry/prompt-registry.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { CopilotController } from './copilot.controller';
import { CopilotContextService } from './copilot-context.service';
import { CopilotEngineService } from './copilot-engine.service';
import { CopilotListener } from './copilot.listener';
import { CopilotProcessor } from './copilot.processor';
import { CopilotService } from './copilot.service';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    BullModule.registerQueue({
      name: COPILOT_SUGGESTIONS_QUEUE,
    }),
    MessagesModule,
    ContactsModule,
    LeadsModule,
    LeadScoringModule,
    SalesEvidenceModule,
    LlmGatewayModule,
    PromptRegistryModule,
    RealtimeModule,
  ],
  controllers: [CopilotController],
  providers: [
    CopilotService,
    CopilotContextService,
    CopilotEngineService,
    CopilotListener,
    CopilotProcessor,
  ],
  exports: [CopilotService, CopilotContextService, CopilotEngineService],
})
export class CopilotModule {}
