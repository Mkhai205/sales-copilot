import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { ChannelAdapter } from './channel-adapter.interface';

/**
 * Registry service for runtime lookup and management of channel adapters.
 */
@Injectable()
export class ChannelAdapterRegistry {
  private readonly logger = new Logger(ChannelAdapterRegistry.name);
  private readonly adapters = new Map<ChannelType, ChannelAdapter>();

  /**
   * Registers a channel adapter in the registry.
   * Can be called with (adapter) using adapter.channelType or with (type, adapter).
   */
  register(adapter: ChannelAdapter): void;
  register(channelType: ChannelType, adapter: ChannelAdapter): void;
  register(adapterOrType: ChannelAdapter | ChannelType, maybeAdapter?: ChannelAdapter): void {
    if (typeof adapterOrType === 'string') {
      if (!maybeAdapter) {
        throw new Error('Adapter instance must be provided when registering by channel type');
      }
      this.adapters.set(adapterOrType, maybeAdapter);
      this.logger.log(`Registered channel adapter for type: ${adapterOrType}`);
      return;
    }

    const adapter = adapterOrType;
    if (!adapter || !adapter.channelType) {
      throw new Error('Adapter must define a valid channelType');
    }

    this.adapters.set(adapter.channelType, adapter);
    this.logger.log(`Registered channel adapter for type: ${adapter.channelType}`);
  }

  /**
   * Retrieves the channel adapter corresponding to the specified channel type.
   *
   * @param type Channel type (e.g. FACEBOOK_MESSENGER, ZALO, TELEGRAM, EMAIL, WEB_CHAT)
   * @returns ChannelAdapter instance
   * @throws NotFoundException if no adapter is registered for the specified channel type
   */
  get(type: ChannelType): ChannelAdapter {
    const adapter = this.adapters.get(type);
    if (!adapter) {
      throw new NotFoundException({
        code: 'CHANNEL_ADAPTER_NOT_FOUND',
        message: `Channel adapter not found for channel type: ${type}`,
        details: { channelType: type },
      });
    }

    return adapter;
  }

  /**
   * Checks if an adapter is registered for the specified channel type.
   */
  has(type: ChannelType): boolean {
    return this.adapters.has(type);
  }

  /**
   * Returns a list of all registered channel types.
   */
  getRegisteredTypes(): ChannelType[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Returns all registered adapter instances.
   */
  getAll(): ChannelAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Clears all registered adapters (primarily for testing purposes).
   */
  clear(): void {
    this.adapters.clear();
  }
}
