import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { WorkspacesModule } from '../workspaces';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadConversionService } from './lead-conversion.service';

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [LeadsController],
  providers: [LeadsService, LeadConversionService],
  exports: [LeadsService, LeadConversionService],
})
export class LeadsModule {}
