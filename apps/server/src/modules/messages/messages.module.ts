import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { WorkspacesModule } from '../workspaces';
import { AttachmentsService } from './attachments.service';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [MessagesController],
  providers: [MessagesService, AttachmentsService],
  exports: [MessagesService, AttachmentsService],
})
export class MessagesModule {}
