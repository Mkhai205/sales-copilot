import { Module } from '@nestjs/common';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { ChannelIdentityService } from './channel-identity.service';
import { WorkspacesModule } from '../workspaces';

@Module({
  imports: [WorkspacesModule],
  controllers: [ContactsController],
  providers: [ContactsService, ChannelIdentityService],
  exports: [ContactsService, ChannelIdentityService],
})
export class ContactsModule {}
