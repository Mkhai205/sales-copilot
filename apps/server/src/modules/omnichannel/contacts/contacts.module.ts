import { Module } from '@nestjs/common';
import { AuthModule } from '../../identity/auth';
import { WorkspacesModule } from '../../identity/workspaces';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { ContactResolutionService } from './contact-resolution.service';

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [ContactsController],
  providers: [ContactsService, ContactResolutionService],
  exports: [ContactsService, ContactResolutionService],
})
export class ContactsModule {}
