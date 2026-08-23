import { Module } from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  controllers: [MessagesController],
  providers: [MessagesService, AttachmentsService],
  exports: [MessagesService, AttachmentsService],
})
export class MessagesModule {}
