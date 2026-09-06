import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CONVERSATION_INTELLIGENCE_QUEUE } from '@sales-copilot/shared-contracts';
import { DatabaseModule } from '../../infrastructure/database';
import { ContactsModule } from '../contacts';
import { MessagesModule } from '../messages';
import { ConversationsModule } from '../conversations';
import { LeadsModule } from '../leads';
import { SalesEvidenceModule } from '../sales-evidence';
import { LlmGatewayModule } from '../llm-gateway';
import { PromptRegistryModule } from '../prompt-registry';
import { ConversationIntelligenceListener } from './conversation-intelligence.listener';
import { ConversationIntelligenceProcessor } from './conversation-intelligence.processor';
import { IntentSentimentAnalyzer } from './analyzers/intent-sentiment.analyzer';
import { BantSignalAnalyzer } from './analyzers/bant-signal.analyzer';

@Module({
  imports: [
    DatabaseModule,
    ContactsModule,
    MessagesModule,
    ConversationsModule,
    LeadsModule,
    SalesEvidenceModule,
    LlmGatewayModule,
    PromptRegistryModule,
    BullModule.registerQueue({
      name: CONVERSATION_INTELLIGENCE_QUEUE,
    }),
  ],
  providers: [
    ConversationIntelligenceListener,
    ConversationIntelligenceProcessor,
    IntentSentimentAnalyzer,
    BantSignalAnalyzer,
  ],
  exports: [IntentSentimentAnalyzer, BantSignalAnalyzer, BullModule],
})
export class ConversationIntelligenceModule {}
