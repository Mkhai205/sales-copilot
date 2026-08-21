import { Module } from '@nestjs/common';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { ChannelIdentityService } from './channel-identity.service';
import { ContactMergeService } from './contact-merge.service';
import { ContactIdentifyService } from './contact-identify.service';
import { ContactResolutionService } from './contact-resolution.service';
import { WorkspacesModule } from '../workspaces';

@Module({
  imports: [WorkspacesModule],
  controllers: [ContactsController],
  providers: [
    ContactsService,
    ChannelIdentityService,
    ContactMergeService,
    ContactIdentifyService,
    ContactResolutionService,
  ],
  exports: [
    ContactsService,
    ChannelIdentityService,
    ContactMergeService,
    ContactIdentifyService,
    ContactResolutionService,
  ],
})
export class ContactsModule {}
