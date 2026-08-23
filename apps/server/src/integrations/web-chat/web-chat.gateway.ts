import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import * as crypto from 'crypto';
import {
  ChannelType,
  FileType,
  MessageContentType,
  MessageType,
  SenderType,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database';
import { ChannelCredentialService } from '../../modules/inboxes/channel-credential.service';
import { ContactResolutionService } from '../../modules/contacts/contact-resolution.service';
import { ContactIdentifyService } from '../../modules/contacts/contact-identify.service';
import { ConversationsService } from '../../modules/conversations/conversations.service';
import { MessagesService } from '../../modules/messages/messages.service';
import { WebChatAdapter, WebChatOutboundEventPayload } from './web-chat.adapter';

/**
 * Socket session data stored on authenticated visitor connections.
 */
export interface WidgetSocketData {
  workspaceId: string;
  channelId: string;
  inboxId: string;
  contactId: string;
  channelIdentityId?: string;
  externalContactId: string;
  identifier?: string | null;
  widgetToken: string;
  hmacSecret?: string;
  hmacMandatory?: boolean;
}

/**
 * Payload sent by widget client when sending an incoming message.
 */
export interface WidgetSendMessagePayload {
  content?: string;
  contentType?: MessageContentType;
  tempId?: string;
  attachments?: Array<{
    fileUrl: string;
    fileName?: string;
    fileType?: string;
    fileSize?: number;
    contentType?: MessageContentType | string;
  }>;
}

/**
 * Payload sent by widget client for visitor identity verification (setUser).
 */
export interface WidgetIdentifyPayload {
  identifier: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  avatarUrl?: string;
  hmacSignature?: string;
}

/**
 * Payload sent by widget client for visitor typing status.
 */
export interface WidgetTypingPayload {
  isTyping: boolean;
  conversationId?: string;
}

/**
 * Dedicated WebSocket Gateway for Web Chat Widget visitors.
 * Namespace: `/widget`
 *
 * Handles anonymous visitor provisioning, real-time message sending/receiving,
 * visitor identity verification, and typing indicators.
 */
@Injectable()
@WebSocketGateway({
  namespace: '/widget',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class WebChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WebChatGateway.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialService: ChannelCredentialService,
    private readonly contactResolutionService: ContactResolutionService,
    private readonly contactIdentifyService: ContactIdentifyService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly webChatAdapter: WebChatAdapter,
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) {}

  afterInit(_server: Server) {
    this.logger.log('WebChatGateway initialized on namespace /widget');
  }

  /**
   * Authenticates incoming visitor connection via widget_token and provisions/resolves visitor contact.
   */
  async handleConnection(client: Socket) {
    try {
      // 1. Extract widget_token from handshake auth, query, or headers
      const widgetToken = this.extractWidgetToken(client);

      if (!widgetToken) {
        this.logger.warn(
          `Widget connection rejected: no widget_token provided (socket: ${client.id})`,
        );
        client.emit('widget:error', {
          code: 'UNAUTHORIZED',
          message: 'Widget token is required to connect to web chat',
        });
        client.disconnect(true);
        return;
      }

      // 2. Find Channel by widget_token
      const channel = await this.resolveChannelByToken(widgetToken);
      if (!channel) {
        this.logger.warn(
          `Widget connection rejected: channel not found for token '${widgetToken}' (socket: ${client.id})`,
        );
        client.emit('widget:error', {
          code: 'CHANNEL_NOT_FOUND',
          message: 'Web chat channel not found or inactive',
        });
        client.disconnect(true);
        return;
      }

      // 3. Extract visitor external identity / contact token if available
      const externalContactId =
        this.extractVisitorId(client) || `anon_${crypto.randomUUID().slice(0, 12)}`;

      // 4. Resolve or create Contact & ChannelIdentity
      const resolution = await this.contactResolutionService.resolveFromChannel({
        workspaceId: channel.workspaceId,
        channelId: channel.id,
        externalContactId,
      });

      const contact = resolution.contact;
      const identity = resolution.channelIdentity;

      // Extract credentials details
      const creds = this.decryptCredentials(channel.credentials);
      const hmacSecret = (creds.hmacSecret as string) || (creds.hmac_secret as string) || undefined;
      const hmacMandatory = Boolean(creds.hmacMandatory ?? creds.hmac_mandatory ?? false);

      // 5. Store session context on client
      const socketData: WidgetSocketData = {
        workspaceId: channel.workspaceId,
        channelId: channel.id,
        inboxId: channel.inboxId,
        contactId: contact.id,
        channelIdentityId: identity?.id,
        externalContactId: identity?.externalContactId || externalContactId,
        identifier: contact.identifier,
        widgetToken,
        hmacSecret,
        hmacMandatory,
      };
      client.data = socketData;

      // 6. Join visitor socket rooms
      client.join(`widget:${channel.id}:${contact.id}`);
      client.join(`widget:${channel.id}:${socketData.externalContactId}`);
      client.join(`widget:${contact.id}`);
      client.join(`widget:${socketData.externalContactId}`);

      const channelSettings = (channel.settings as Record<string, unknown>) || {};
      const greetingMessage =
        (channelSettings.greetingMessage as string) ||
        (channelSettings.welcomeMessage as string) ||
        'Welcome! How can we assist you today?';

      // 7. Emit connection acknowledgement
      client.emit('widget:connected', {
        contactId: contact.id,
        externalContactId: socketData.externalContactId,
        contact,
        greetingMessage,
      });

      this.logger.log(
        `Widget client connected (socket: ${client.id}, contact: ${contact.id}, channel: ${channel.id})`,
      );
    } catch (err) {
      this.logger.error(
        `Error during widget connection: ${(err as Error).message}`,
        (err as Error).stack,
      );
      client.emit('widget:error', {
        code: 'INTERNAL_ERROR',
        message: 'Internal error establishing web chat connection',
      });
      client.disconnect(true);
    }
  }

  /**
   * Handles visitor disconnection.
   */
  handleDisconnect(client: Socket) {
    const data = client.data as WidgetSocketData | undefined;
    if (data) {
      this.logger.log(
        `Widget client disconnected (socket: ${client.id}, contact: ${data.contactId}, channel: ${data.channelId})`,
      );
    } else {
      this.logger.log(`Unauthenticated widget client disconnected (socket: ${client.id})`);
    }
  }

  /**
   * Handles incoming message from widget visitor.
   */
  @SubscribeMessage('widget:send_message')
  async handleSendMessage(client: Socket, payload: WidgetSendMessagePayload) {
    const data = client.data as WidgetSocketData | undefined;
    if (!data || !data.workspaceId || !data.contactId) {
      client.emit('widget:error', {
        code: 'UNAUTHORIZED',
        message: 'Socket session is not authenticated',
      });
      return { success: false, error: 'UNAUTHORIZED' };
    }

    try {
      // 1. Find or create active conversation
      const conversation = await this.conversationsService.findOrCreateActiveConversation(
        data.workspaceId,
        {
          contactId: data.contactId,
          inboxId: data.inboxId,
          channelIdentityId: data.channelIdentityId,
        },
      );

      // 2. Format attachments if provided
      const attachments = payload.attachments?.map(att => ({
        fileName: att.fileName || 'attachment',
        fileType: this.mapToFileType(att.fileType, att.contentType),
        fileSize: typeof att.fileSize === 'number' && att.fileSize > 0 ? att.fileSize : 1000,
        storagePath: att.fileUrl,
        contentType: String(att.contentType || 'application/octet-stream'),
        fileUrl: att.fileUrl,
      }));

      // 3. Create message via MessagesService
      const createdMessage = await this.messagesService.create(data.workspaceId, conversation.id, {
        content: payload.content || null,
        senderType: SenderType.CONTACT,
        senderId: data.contactId,
        messageType: MessageType.INCOMING,
        contentType: payload.contentType || MessageContentType.TEXT,
        isPrivate: false,
        externalId: payload.tempId || undefined,
        attachments: attachments && attachments.length > 0 ? attachments : undefined,
      });

      // 4. Emit confirmation back to the sending client
      client.emit('widget:message_sent', {
        tempId: payload.tempId,
        message: createdMessage,
      });

      // 5. Broadcast to visitor room (for multi-tab synchronization)
      if (this.server) {
        client
          .to(`widget:${data.channelId}:${data.contactId}`)
          .emit('widget:message', createdMessage);
      }

      return {
        success: true,
        messageId: createdMessage.id,
      };
    } catch (err) {
      const errorMessage = (err as Error).message || 'Failed to process widget message';
      this.logger.error(`Failed to handle widget message: ${errorMessage}`, (err as Error).stack);
      client.emit('widget:error', {
        code: 'MESSAGE_SEND_FAILED',
        message: errorMessage,
        tempId: payload.tempId,
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Handles visitor identity verification (setUser).
   */
  @SubscribeMessage('widget:identify')
  async handleIdentify(client: Socket, payload: WidgetIdentifyPayload) {
    const data = client.data as WidgetSocketData | undefined;
    if (!data || !data.workspaceId || !data.contactId) {
      client.emit('widget:error', {
        code: 'UNAUTHORIZED',
        message: 'Socket session is not authenticated',
      });
      return { success: false, error: 'UNAUTHORIZED' };
    }

    try {
      // 1. HMAC verification if secret configured or mandatory
      if (data.hmacSecret) {
        if (!payload.hmacSignature) {
          if (data.hmacMandatory) {
            client.emit('widget:error', {
              code: 'HMAC_REQUIRED',
              message: 'HMAC signature is mandatory for user identification',
            });
            return { success: false, error: 'HMAC_REQUIRED' };
          }
        } else {
          const isValid = this.webChatAdapter.verifyHmacSignature(
            payload.identifier,
            payload.hmacSignature,
            data.hmacSecret,
          );
          if (!isValid) {
            client.emit('widget:error', {
              code: 'INVALID_HMAC_SIGNATURE',
              message: 'HMAC signature verification failed',
            });
            return { success: false, error: 'INVALID_HMAC_SIGNATURE' };
          }
        }
      }

      // 2. Identify and update or merge contact
      const identifiedContact = await this.contactIdentifyService.identify(
        data.workspaceId,
        { id: data.contactId },
        {
          identifier: payload.identifier,
          name: payload.name,
          email: payload.email,
          phoneNumber: payload.phoneNumber,
          avatarUrl: payload.avatarUrl,
        },
      );

      // 3. Update session data
      data.contactId = identifiedContact.id;
      data.identifier = identifiedContact.identifier;

      // 4. Update room memberships if contact ID changed
      client.join(`widget:${data.channelId}:${identifiedContact.id}`);
      client.join(`widget:${identifiedContact.id}`);

      // 5. Emit confirmation to client
      client.emit('widget:identified', {
        contact: identifiedContact,
      });

      return {
        success: true,
        contactId: identifiedContact.id,
      };
    } catch (err) {
      const errorMessage = (err as Error).message || 'Failed to identify visitor';
      this.logger.error(`Error identifying visitor: ${errorMessage}`, (err as Error).stack);
      client.emit('widget:error', {
        code: 'IDENTIFICATION_FAILED',
        message: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Handles visitor typing indicators.
   */
  @SubscribeMessage('widget:typing')
  async handleTyping(client: Socket, payload: WidgetTypingPayload) {
    const data = client.data as WidgetSocketData | undefined;
    if (!data || !data.workspaceId || !data.contactId) {
      return { success: false };
    }

    if (this.eventEmitter) {
      this.eventEmitter.emit('widget.visitor_typing', {
        workspaceId: data.workspaceId,
        channelId: data.channelId,
        contactId: data.contactId,
        externalContactId: data.externalContactId,
        isTyping: Boolean(payload?.isTyping),
      });
    }

    return { success: true };
  }

  /**
   * Listens for outbound messages dispatched by OutboundMessageListener / WebChatAdapter
   * and broadcasts them directly to the visitor's socket rooms.
   */
  @OnEvent('widget.outbound_message')
  @OnEvent('widget:message')
  handleOutboundMessage(payload: WebChatOutboundEventPayload) {
    if (!this.server || !payload) return;

    const { channelId, recipientExternalId, message } = payload;
    if (!recipientExternalId) return;

    // Push to visitor rooms
    this.server.to(`widget:${channelId}:${recipientExternalId}`).emit('widget:message', message);
    this.server.to(`widget:${recipientExternalId}`).emit('widget:message', message);

    this.logger.debug(
      `Dispatched outbound message to widget recipient '${recipientExternalId}' in channel '${channelId}'`,
    );
  }

  // --- Private Helper Methods ---

  private extractWidgetToken(client: Socket): string | undefined {
    const auth = client.handshake.auth || {};
    const query = (client.handshake.query as Record<string, string | string[] | undefined>) || {};
    const headers = client.handshake.headers || {};

    const candidate =
      auth.widget_token ||
      auth.website_token ||
      auth.websiteToken ||
      auth.widgetToken ||
      auth.token ||
      query.widget_token ||
      query.website_token ||
      query.websiteToken ||
      query.widgetToken ||
      query.token ||
      headers['x-widget-token'] ||
      headers['x-website-token'];

    if (Array.isArray(candidate)) {
      return candidate[0];
    }
    return typeof candidate === 'string' ? candidate.trim() : undefined;
  }

  private extractVisitorId(client: Socket): string | undefined {
    const auth = client.handshake.auth || {};
    const query = (client.handshake.query as Record<string, string | string[] | undefined>) || {};

    const candidate =
      auth.contactToken ||
      auth.contact_token ||
      auth.visitorId ||
      auth.visitor_id ||
      auth.externalContactId ||
      query.contactToken ||
      query.contact_token ||
      query.visitorId ||
      query.visitor_id ||
      query.externalContactId;

    if (Array.isArray(candidate)) {
      return candidate[0];
    }
    return typeof candidate === 'string' ? candidate.trim() : undefined;
  }

  private async resolveChannelByToken(widgetToken: string) {
    const client = this.prisma.getClient();

    // 1. Direct query by providerAccountId
    const directChannel = await client.channel.findFirst({
      where: {
        channelType: ChannelType.WEB_CHAT,
        providerAccountId: widgetToken,
      },
      include: {
        inbox: true,
      },
    });

    if (directChannel) {
      return directChannel;
    }

    // 2. Query all WEB_CHAT channels and decrypt credentials to find matching token
    const webChatChannels = await client.channel.findMany({
      where: {
        channelType: ChannelType.WEB_CHAT,
      },
      include: {
        inbox: true,
      },
    });

    for (const chan of webChatChannels) {
      const creds = this.decryptCredentials(chan.credentials);
      const chanToken =
        (creds.widgetToken as string) ||
        (creds.website_token as string) ||
        (creds.token as string) ||
        chan.providerAccountId;

      if (chanToken === widgetToken) {
        return chan;
      }
    }

    return null;
  }

  private decryptCredentials(rawCredentials: unknown): Record<string, unknown> {
    if (!rawCredentials) return {};
    if (typeof rawCredentials === 'object' && rawCredentials !== null) {
      const credsObj = rawCredentials as Record<string, any>;
      if (credsObj.encrypted && typeof credsObj.encrypted === 'string') {
        try {
          return this.credentialService.decrypt(credsObj.encrypted);
        } catch {
          this.logger.warn('Failed to decrypt channel credentials');
          return {};
        }
      }
      return credsObj;
    } else if (typeof rawCredentials === 'string' && rawCredentials.includes(':')) {
      try {
        return this.credentialService.decrypt(rawCredentials);
      } catch {
        this.logger.warn('Failed to decrypt channel credentials string');
        return {};
      }
    }
    return {};
  }

  private mapToFileType(rawFileType?: string, contentType?: MessageContentType | string): FileType {
    if (rawFileType) {
      const upper = rawFileType.toUpperCase();
      if (upper in FileType) return upper as FileType;
    }
    if (contentType) {
      const ctUpper = String(contentType).toUpperCase();
      if (ctUpper.includes('IMAGE')) return FileType.IMAGE;
      if (ctUpper.includes('VIDEO')) return FileType.VIDEO;
      if (ctUpper.includes('AUDIO')) return FileType.AUDIO;
    }
    return FileType.FILE;
  }
}
