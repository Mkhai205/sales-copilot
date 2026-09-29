import { Global, Module } from '@nestjs/common';
import { ChannelCredentialService } from './channel-credential.service';

/**
 * AES-256-GCM encryption for channel credentials and webhook secrets.
 * Global so every domain module can inject ChannelCredentialService without
 * importing a domain module (this service was previously hosted by
 * omnichannel/inboxes, which forced identity into a circular dependency).
 */
@Global()
@Module({
  providers: [ChannelCredentialService],
  exports: [ChannelCredentialService],
})
export class CryptoModule {}
