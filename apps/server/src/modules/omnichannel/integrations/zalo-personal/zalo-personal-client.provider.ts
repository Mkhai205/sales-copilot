import { Injectable } from '@nestjs/common';
import { Zalo } from 'zca-js';
import type { API, Credentials } from 'zca-js';

export const ZALO_PERSONAL_CLIENT_PROVIDER = Symbol('ZALO_PERSONAL_CLIENT_PROVIDER');

/**
 * Factory wrapper around the zca-js `Zalo` class so unit tests can substitute
 * a stub instead of the real network client.
 */
@Injectable()
export class ZaloPersonalClientProvider {
  create(): Zalo {
    // selfListen=true: the owner may reply from their phone app — those messages
    // must reach the listener so they can be mirrored into the inbox conversation.
    // checkUpdate=false: no outbound npm calls from the server runtime.
    return new Zalo({ selfListen: true, checkUpdate: false, logging: false });
  }

  async loginWithCredentials(zalo: Zalo, credentials: Credentials): Promise<API> {
    return zalo.login(credentials);
  }
}
