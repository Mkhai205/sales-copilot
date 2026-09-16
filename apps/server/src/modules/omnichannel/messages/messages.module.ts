import { Module } from '@nestjs/common';
import { AuthModule } from '../../identity/auth';
import { WorkspacesModule } from '../../identity/workspaces';
import { ConversationsModule } from '../conversations';
import { AttachmentsService } from './attachments.service';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [AuthModule, WorkspacesModule, ConversationsModule],
  controllers: [MessagesController],
  providers: [MessagesService, AttachmentsService],
  exports: [MessagesService, AttachmentsService],
})
export class MessagesModule {}
