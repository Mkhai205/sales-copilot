import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { WorkspacesModule } from '../workspaces';
import { LlmGatewayModule } from '../llm-gateway';
import { PromptRegistryController } from './prompt-registry.controller';
import { PromptRegistryService } from './prompt-registry.service';

@Module({
  imports: [AuthModule, WorkspacesModule, LlmGatewayModule],
  controllers: [PromptRegistryController],
  providers: [PromptRegistryService],
  exports: [PromptRegistryService],
})
export class PromptRegistryModule {}
