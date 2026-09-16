import { Module } from '@nestjs/common';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { ContactsModule } from './contacts/contacts.module';
import { InboxesModule } from './inboxes/inboxes.module';
import { LabelsModule } from './labels/labels.module';
import { CannedResponsesModule } from './canned-responses/canned-responses.module';
import { IntegrationsModule } from './integrations/integrations.module';

@Module({
  imports: [
    ConversationsModule,
    MessagesModule,
    ContactsModule,
    InboxesModule,
    LabelsModule,
    CannedResponsesModule,
    IntegrationsModule,
  ],
  exports: [
    ConversationsModule,
    MessagesModule,
    ContactsModule,
    InboxesModule,
    LabelsModule,
    CannedResponsesModule,
    IntegrationsModule,
  ],
})
export class OmnichannelModule {}
