import { Module } from '@nestjs/common';
import { MessagesModule } from '../../messages/messages.module';
import { PosEventListener } from './pos-event.listener';

@Module({
  imports: [MessagesModule],
  providers: [PosEventListener],
  exports: [PosEventListener],
})
export class PosListenersModule {}
