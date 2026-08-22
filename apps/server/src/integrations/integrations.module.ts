import { Global, Module } from '@nestjs/common';
import { ChannelAdapterRegistry } from './channel-adapter.registry';

@Global()
@Module({
  providers: [ChannelAdapterRegistry],
  exports: [ChannelAdapterRegistry],
})
export class IntegrationsModule {}
