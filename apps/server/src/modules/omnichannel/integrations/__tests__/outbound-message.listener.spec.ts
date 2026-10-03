import { MessageType, SenderType } from '@sales-copilot/shared-contracts';
import { OutboundMessageListener, MessageCreatedEventPayload } from '../outbound-message.listener';

describe('OutboundMessageListener (producer of the message-outbound queue)', () => {
  let listener: OutboundMessageListener;
  let enqueuedJobs: Array<{ name: string; data: unknown; opts: Record<string, unknown> }>;

  const baseMessage = {
    id: 'msg_out_1',
    workspaceId: 'ws_test',
    conversationId: 'conv_1',
    senderType: SenderType.USER,
    senderId: 'usr_agent_1',
    messageType: MessageType.OUTGOING,
    contentType: 'TEXT',
    content: 'Hello customer! How can I help you?',
    isPrivate: false,
  };

  beforeEach(() => {
    enqueuedJobs = [];
    const mockQueue = {
      add: async (name: string, data: unknown, opts: Record<string, unknown>) => {
        enqueuedJobs.push({ name, data, opts });
      },
    };
    listener = new OutboundMessageListener(mockQueue as any);
  });

  const buildPayload = (
    overrides: Partial<MessageCreatedEventPayload['message']> = {},
    eventOverrides: Partial<MessageCreatedEventPayload> = {},
  ): MessageCreatedEventPayload => ({
    workspaceId: 'ws_test',
    conversationId: 'conv_1',
    message: { ...baseMessage, ...overrides },
    ...eventOverrides,
  });

  it('should enqueue a deliver job for an outgoing public agent message', async () => {
    await listener.handleOutboundMessage(buildPayload());

    expect(enqueuedJobs.length).toBe(1);
    expect(enqueuedJobs[0].name).toBe('deliver-message');
    expect(enqueuedJobs[0].data).toEqual({
      workspaceId: 'ws_test',
      conversationId: 'conv_1',
      messageId: 'msg_out_1',
    });
    expect(enqueuedJobs[0].opts.jobId).toBe('out_msg_out_1');
    expect(enqueuedJobs[0].opts.attempts).toBe(5);
  });

  it('should not enqueue incoming messages (MessageType.INCOMING)', async () => {
    await listener.handleOutboundMessage(
      buildPayload({ messageType: MessageType.INCOMING, senderType: SenderType.CONTACT }),
    );

    expect(enqueuedJobs.length).toBe(0);
  });

  it('should not enqueue private notes', async () => {
    await listener.handleOutboundMessage(buildPayload({ isPrivate: true }, { isPrivate: true }));

    expect(enqueuedJobs.length).toBe(0);
  });

  it('should not enqueue messages originating from contacts', async () => {
    await listener.handleOutboundMessage(
      buildPayload({ senderType: SenderType.CONTACT, messageType: MessageType.OUTGOING }),
    );

    expect(enqueuedJobs.length).toBe(0);
  });

  it('should not enqueue messages flagged with metadata.suppressOutbound', async () => {
    await listener.handleOutboundMessage(buildPayload({ metadata: { suppressOutbound: true } }));

    expect(enqueuedJobs.length).toBe(0);
  });
});
