import { Module } from '@nestjs/common';
import { ChannelCredentialService } from './channel-credential.service';

@Module({
  providers: [ChannelCredentialService],
  exports: [ChannelCredentialService],
})
export class InboxesModule {}
