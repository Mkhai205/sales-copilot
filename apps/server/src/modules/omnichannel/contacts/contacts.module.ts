import { Module } from '@nestjs/common';
import { AuthModule } from '../../identity/auth/auth.module';
import { WorkspacesModule } from '../../identity/workspaces/workspaces.module';
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
