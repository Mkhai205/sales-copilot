import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { WorkspacesModule } from '../workspaces';
import { SalesEvidenceController } from './sales-evidence.controller';
import { SalesEvidenceService } from './sales-evidence.service';

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [SalesEvidenceController],
  providers: [SalesEvidenceService],
  exports: [SalesEvidenceService],
})
export class SalesEvidenceModule {}
