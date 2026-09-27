import 'reflect-metadata';

// sanitize-html is ESM-only; mock it so the import chain through html-sanitizer loads under jest.
jest.mock('sanitize-html', () => ({
  __esModule: true,
  default: (html: string) => html,
  sanitize: (html: string) => html,
}));

import { CommerceEventListener } from '../modules/commerce/listeners/commerce-event.listener';
import { AuditLogService } from '../modules/identity/audit-logs/audit-logs.service';
import { AiTakeoverListener } from '../modules/intelligence/ai-agent/ai-takeover.listener';
import { AiDispatcherListener } from '../modules/intelligence/ai-agent/ai-dispatcher.listener';
import { AutoAssignmentListener } from '../modules/omnichannel/conversations/auto-assignment.listener';
import { OutboundMessageListener } from '../modules/omnichannel/integrations/outbound-message.listener';
import { FacebookLifecycleService } from '../modules/omnichannel/integrations/facebook/facebook.lifecycle';
import { TelegramLifecycleService } from '../modules/omnichannel/integrations/telegram/telegram.lifecycle';
import { WebChatGateway } from '../modules/omnichannel/integrations/web-chat/web-chat.gateway';
import { RealtimeGateway } from '../modules/realtime/realtime.gateway';
import { RealtimeEventDispatcher } from '../modules/realtime/realtime-event.dispatcher';
import { PresenceService } from '../modules/realtime/presence.service';

/**
 * Regression guard (Phase 4 / M4.2): stacking @OnEvent decorators that resolve to the
 * SAME event string registers the method once per decorator with @nestjs/event-emitter
 * (one metadata entry per decorator, no dedup in the subscriber loader), so the handler
 * fires once per registration on every emit. This produced duplicate PAYMENT_RECEIPT /
 * order activity messages and duplicate WS broadcasts.
 *
 * Invariant: within a single method, the same event string must appear at most once.
 */
const EVENT_LISTENER_METADATA = 'EVENT_LISTENER_METADATA'; // @nestjs/event-emitter internal key

const LISTENER_CLASSES = [
  CommerceEventListener,
  AuditLogService,
  AiTakeoverListener,
  AiDispatcherListener,
  AutoAssignmentListener,
  OutboundMessageListener,
  FacebookLifecycleService,
  TelegramLifecycleService,
  WebChatGateway,
  RealtimeGateway,
  RealtimeEventDispatcher,
  PresenceService,
] as const;

function collectListenerEvents(
  cls: abstract new (...args: never[]) => unknown,
): Map<string, string[]> {
  const proto = cls.prototype as Record<string, unknown>;
  const listeners = new Map<string, string[]>();

  for (const methodKey of Object.getOwnPropertyNames(proto)) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, methodKey);
    const value = descriptor?.value;
    if (typeof value !== 'function') continue;

    const metadata = Reflect.getMetadata(EVENT_LISTENER_METADATA, value) as
      Array<{ event: string | symbol | Array<string | symbol> }> | undefined;
    if (!metadata) continue;

    const events = metadata.flatMap(entry =>
      Array.isArray(entry.event) ? entry.event.map(String) : [String(entry.event)],
    );
    listeners.set(methodKey, events);
  }

  return listeners;
}

describe('Event listener registration invariants', () => {
  it.each(LISTENER_CLASSES.map(cls => [cls.name, cls] as const))(
    '%s must not register the same event twice on one method',
    (_name, cls) => {
      const listeners = collectListenerEvents(cls);
      expect(listeners.size).toBeGreaterThan(0);

      for (const [methodKey, events] of listeners) {
        const duplicates = events.filter((event, index) => events.indexOf(event) !== index);
        expect({ class: cls.name, method: methodKey, duplicates }).toEqual({
          class: cls.name,
          method: methodKey,
          duplicates: [],
        });
      }
    },
  );
});
