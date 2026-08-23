import { io, Socket } from 'socket.io-client';
import { UserIdentity, WidgetAttachment, WidgetMessage } from './types';

export interface WidgetSocketOptions {
  baseUrl: string;
  websiteToken: string;
  contactToken?: string;
  contactJwt?: string;
  onMessage?: (message: WidgetMessage) => void;
  onMessageSent?: (payload: { tempId?: string; message: WidgetMessage }) => void;
  onTyping?: (data: { isTyping: boolean; sender?: string }) => void;
  onIdentified?: (data: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Socket.IO client managing real-time WebSocket connection to /widget namespace.
 */
export class WidgetSocketClient {
  private socket: Socket | null = null;
  private readonly options: WidgetSocketOptions;
  private isConnected = false;

  constructor(options: WidgetSocketOptions) {
    this.options = options;
  }

  /**
   * Connects to the /widget Socket.IO namespace.
   */
  connect(): void {
    if (this.socket && this.isConnected) {
      return;
    }

    const socketUrl = this.options.baseUrl.replace(/\/+$/, '');

    this.socket = io(`${socketUrl}/widget`, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      auth: {
        widget_token: this.options.websiteToken,
        website_token: this.options.websiteToken,
        contactToken: this.options.contactToken,
        contact_token: this.options.contactToken,
        token: this.options.contactJwt,
      },
      query: {
        widget_token: this.options.websiteToken,
        contact_token: this.options.contactToken || '',
      },
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.options.onConnect?.();
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      this.options.onDisconnect?.();
    });

    this.socket.on('connect_error', (err: Error) => {
      this.options.onError?.(err);
    });

    // Inbound agent message
    this.socket.on('widget:message', (rawMsg: any) => {
      const normalized: WidgetMessage = {
        id: rawMsg.id || `msg_${Date.now()}`,
        conversationId: rawMsg.conversationId,
        content: rawMsg.content || null,
        messageType: rawMsg.messageType || 'OUTGOING',
        contentType: rawMsg.contentType || 'TEXT',
        senderType: rawMsg.senderType || 'USER',
        sender: rawMsg.sender,
        attachments: rawMsg.attachments,
        createdAt: rawMsg.createdAt || new Date().toISOString(),
      };
      this.options.onMessage?.(normalized);
    });

    // Outbound message confirmation from server
    this.socket.on('widget:message_sent', (payload: any) => {
      this.options.onMessageSent?.(payload);
    });

    // Contact identity updated
    this.socket.on('widget:identified', (data: any) => {
      this.options.onIdentified?.(data);
    });

    // Typing indicators
    this.socket.on('widget:typing', (data: any) => {
      this.options.onTyping?.(data);
    });
  }

  /**
   * Disconnects the active socket.
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  /**
   * Sends a chat message over the WebSocket connection.
   */
  sendMessage(
    content: string,
    tempId: string,
    conversationId?: string,
    attachments?: WidgetAttachment[],
  ): void {
    if (!this.socket || !this.isConnected) {
      throw new Error('WebSocket is not connected');
    }

    this.socket.emit('widget:send_message', {
      content,
      tempId,
      conversationId,
      attachments,
    });
  }

  /**
   * Identifies the current visitor with logged-in user details and HMAC signature.
   */
  identify(user: UserIdentity): void {
    if (!this.socket || !this.isConnected) {
      return;
    }

    this.socket.emit('widget:identify', {
      identifier: user.identifier,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      avatarUrl: user.avatarUrl,
      hmacSignature: user.identifierHash,
      customAttributes: user.customAttributes,
    });
  }

  /**
   * Emits a typing state indicator.
   */
  emitTyping(isTyping: boolean, conversationId?: string): void {
    if (!this.socket || !this.isConnected) {
      return;
    }

    this.socket.emit('widget:typing', {
      isTyping,
      conversationId,
    });
  }

  /**
   * Check connection status.
   */
  get connected(): boolean {
    return this.isConnected;
  }
}
