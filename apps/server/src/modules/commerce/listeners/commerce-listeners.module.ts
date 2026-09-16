import { Module } from '@nestjs/common';
import { MessagesModule } from '../../omnichannel/messages/messages.module';
import { CommerceEventListener } from './commerce-event.listener';

@Module({
  imports: [MessagesModule],
  providers: [CommerceEventListener],
  exports: [CommerceEventListener],
})
export class CommerceListenersModule {}

export const PosListenersModule = CommerceListenersModule;
