import { WidgetApiClient } from './api';
import { WidgetSocketClient } from './socket';
import {
  UserIdentity,
  WidgetAttachment,
  WidgetConfigResponse,
  WidgetContactResponse,
  WidgetEventListener,
  WidgetEventMap,
  WidgetInitConfig,
  WidgetMessage,
} from './types';
import { WidgetUIRenderer } from './ui';

const STORAGE_KEY_PREFIX = 'sc_widget_session_';

/**
 * Main Sales Copilot Web Chat Widget Controller.
 */
export class SalesCopilotWidget {
  private config: WidgetInitConfig | null = null;
  private channelConfig: WidgetConfigResponse | null = null;
  private session: WidgetContactResponse | null = null;

  private apiClient: WidgetApiClient | null = null;
  private socketClient: WidgetSocketClient | null = null;
  private uiRenderer: WidgetUIRenderer | null = null;

  private isInitialized = false;
  private isChatOpen = false;
  private listeners: Map<string, Set<WidgetEventListener<any>>> = new Map();

  /**
   * Initializes the widget SDK with website token and backend URL.
   */
  async init(config: WidgetInitConfig): Promise<void> {
    if (this.isInitialized) {
      console.warn('[SalesCopilotWidget] Widget is already initialized');
      return;
    }

    if (!config.websiteToken) {
      throw new Error('[SalesCopilotWidget] websiteToken is required');
    }

    this.config = config;
    const baseUrl = config.baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    this.apiClient = new WidgetApiClient(baseUrl);

    try {
      // 1. Fetch channel customization & config
      this.channelConfig = await this.apiClient.getConfig(config.websiteToken);

      // 2. Initialize or restore visitor contact session
      await this.initContactSession();

      // 3. Pre-identify if user passed in init config
      if (
        config.user?.identifier ||
        config.user?.name ||
        config.user?.email ||
        config.user?.phoneNumber
      ) {
        const id =
          config.user.identifier ||
          config.user.email ||
          config.user.phoneNumber ||
          this.session?.contactToken ||
          `vis_${Date.now()}`;
        const updatedSession = await this.apiClient.getOrCreateContact({
          websiteToken: config.websiteToken,
          contactToken: this.session?.contactToken,
          identifier: id,
          name: config.user.name,
          email: config.user.email,
          phoneNumber: config.user.phoneNumber,
          avatarUrl: config.user.avatarUrl,
          customAttributes: config.user.customAttributes,
        });
        this.saveSession(updatedSession);
      }

      // 4. Connect Socket.IO
      this.initWebSocket(baseUrl);

      // 5. Determine whether pre-chat form is needed
      const contact = this.session?.contact;
      const isContactKnown = Boolean(
        contact?.name &&
        contact.name !== 'Unknown Contact' &&
        (contact?.email || contact?.phoneNumber),
      );
      const shouldShowPreChat =
        Boolean(config.preChatForm ?? this.channelConfig?.preChatFormEnabled ?? false) &&
        !isContactKnown;

      // 6. Mount Shadow DOM UI
      if (typeof window !== 'undefined') {
        this.uiRenderer = new WidgetUIRenderer({
          config: this.channelConfig,
          position: config.position || 'right',
          hideMessageBubble: config.hideMessageBubble || false,
          showPreChat: shouldShowPreChat,
          onToggle: open => {
            this.isChatOpen = open;
            this.emit('toggle', { isOpen: open });
            if (open) this.emit('open', undefined);
            else this.emit('close', undefined);
          },
          onSendMessage: content => {
            this.sendMessage(content);
          },
          onTyping: isTyping => {
            this.socketClient?.emitTyping(isTyping);
          },
          onPreChatSubmit: async data => {
            try {
              await this.setUser({
                identifier:
                  data.email ||
                  data.phoneNumber ||
                  this.session?.contactToken ||
                  `vis_${Date.now()}`,
                name: data.name,
                email: data.email,
                phoneNumber: data.phoneNumber,
              });
            } catch (err) {
              console.error('[SalesCopilotWidget] Error submitting pre-chat form:', err);
            }
          },
        });

        this.uiRenderer.mount();

        // 7. Restore conversation history across page reload
        await this.loadConversationHistory();
      }

      this.isInitialized = true;
      this.emit('ready', undefined);
      config.onReady?.();
    } catch (err) {
      const errorObj = {
        code: 'INIT_FAILED',
        message: (err as Error).message || 'Failed to initialize widget',
        originalError: err,
      };
      this.emit('error', errorObj);
      console.error('[SalesCopilotWidget] Initialization failed:', err);
      throw err;
    }
  }

  /**
   * Identifies the current logged-in visitor.
   */
  async setUser(user: UserIdentity): Promise<void> {
    if (!this.config || !this.apiClient) {
      throw new Error('[SalesCopilotWidget] Must call init() before setUser()');
    }

    try {
      // 1. Update contact via REST API to persist in DB and update local session
      const res = await this.apiClient.getOrCreateContact({
        websiteToken: this.config.websiteToken,
        contactToken: this.session?.contactToken,
        identifier: user.identifier,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        avatarUrl: user.avatarUrl,
        customAttributes: user.customAttributes,
      });
      this.saveSession(res);

      // 2. If pre-chat form was visible, hide it now that user is identified
      this.uiRenderer?.showPreChat(false);

      // 3. Emit identify over WebSocket for live Dashboard updates
      if (this.socketClient?.connected) {
        this.socketClient.identify(user);
      }

      this.emit('identified', user);
    } catch (err) {
      console.error('[SalesCopilotWidget] Failed to set user:', err);
      this.emit('error', {
        code: 'SET_USER_FAILED',
        message: (err as Error).message || 'Failed to set user',
        originalError: err,
      });
    }
  }

  /**
   * Sets custom attributes for the visitor.
   */
  async setCustomAttributes(attributes: Record<string, unknown>): Promise<void> {
    if (this.session?.contact?.identifier) {
      await this.setUser({
        identifier: this.session.contact.identifier,
        customAttributes: attributes,
      });
    }
  }

  /**
   * Sends a message from the visitor.
   */
  async sendMessage(content: string, attachments?: WidgetAttachment[]): Promise<void> {
    if (!content && (!attachments || attachments.length === 0)) return;

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const outgoingMsg: WidgetMessage = {
      id: tempId,
      tempId,
      content,
      messageType: 'INCOMING',
      contentType: 'TEXT',
      senderType: 'CONTACT',
      attachments,
      createdAt: new Date().toISOString(),
      status: 'SENDING',
    };

    // Optimistically render in UI
    this.uiRenderer?.addMessage(outgoingMsg);
    this.emit('message:sent', outgoingMsg);

    try {
      if (this.socketClient?.connected) {
        this.socketClient.sendMessage(content, tempId, undefined, attachments);
      }
    } catch (err) {
      console.error('[SalesCopilotWidget] Failed to send message over socket:', err);
    }
  }

  /**
   * Toggles chat window open/closed.
   */
  toggle(state?: boolean): void {
    this.uiRenderer?.toggle(state);
  }

  /**
   * Opens the chat window.
   */
  open(): void {
    this.toggle(true);
  }

  /**
   * Closes the chat window.
   */
  close(): void {
    this.toggle(false);
  }

  /**
   * Resets local visitor session and clears cache.
   */
  resetSession(): void {
    if (this.config) {
      const storageKey = `${STORAGE_KEY_PREFIX}${this.config.websiteToken}`;
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(storageKey);
        window.sessionStorage.removeItem(storageKey);
      }
    }

    this.session = null;
    this.socketClient?.disconnect();
    this.uiRenderer?.clearMessages();
    this.isInitialized = false;
  }

  /**
   * Cleans up all widget resources and disconnects active sockets.
   */
  destroy(): void {
    this.resetSession();
    this.uiRenderer?.unmount();
    this.listeners.clear();
  }

  /**
   * Subscribes to SDK events.
   */
  on<K extends keyof WidgetEventMap>(
    event: K,
    callback: WidgetEventListener<WidgetEventMap[K]>,
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Unsubscribes from SDK events.
   */
  off<K extends keyof WidgetEventMap>(
    event: K,
    callback: WidgetEventListener<WidgetEventMap[K]>,
  ): void {
    this.listeners.get(event)?.delete(callback);
  }

  /**
   * Emits an internal SDK event to registered listeners.
   */
  private emit<K extends keyof WidgetEventMap>(event: K, data: WidgetEventMap[K]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(fn => {
        try {
          fn(data);
        } catch (e) {
          console.error(`[SalesCopilotWidget] Error in event listener for '${event}':`, e);
        }
      });
    }
  }

  private async initContactSession(): Promise<void> {
    if (!this.config || !this.apiClient) return;

    const storageKey = `${STORAGE_KEY_PREFIX}${this.config.websiteToken}`;
    let cachedContactToken: string | undefined;

    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          cachedContactToken = parsed.contactToken;
        }
      } catch {
        // Local storage parsing fallback
      }
    }

    const sessionRes = await this.apiClient.getOrCreateContact({
      websiteToken: this.config.websiteToken,
      contactToken: cachedContactToken,
    });

    this.saveSession(sessionRes);
  }

  private saveSession(session: WidgetContactResponse): void {
    this.session = session;
    if (this.config && typeof window !== 'undefined') {
      const storageKey = `${STORAGE_KEY_PREFIX}${this.config.websiteToken}`;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(session));
      } catch {
        // Ignore storage quota errors
      }
    }
  }

  private initWebSocket(baseUrl: string): void {
    if (!this.config || !this.session) return;

    this.socketClient = new WidgetSocketClient({
      baseUrl,
      websiteToken: this.config.websiteToken,
      contactToken: this.session.contactToken,
      contactJwt: this.session.token,
      onMessage: msg => {
        this.uiRenderer?.addMessage(msg);
        this.emit('message:received', msg);
        this.config?.onMessage?.(msg);
      },
      onTyping: ({ isTyping }) => {
        this.uiRenderer?.setTyping(isTyping);
        if (isTyping) {
          this.emit('typing:start', { sender: 'agent' });
        } else {
          this.emit('typing:stop', { sender: 'agent' });
        }
      },
      onIdentified: data => {
        if (data?.contact && this.session) {
          this.session.contact = {
            ...this.session.contact,
            ...data.contact,
          };
          this.saveSession(this.session);
        }
      },
    });

    this.socketClient.connect();
  }

  private async loadConversationHistory(): Promise<void> {
    if (!this.session?.token || !this.apiClient) return;

    try {
      const convRes = await this.apiClient.getConversations(this.session.token);
      const conversations = Array.isArray(convRes) ? convRes : (convRes as any)?.items || [];
      const activeConv = conversations[0];
      if (activeConv?.id) {
        const msgsRes = await this.apiClient.getMessages(activeConv.id, this.session.token, {
          limit: 50,
        });
        const messages = Array.isArray(msgsRes) ? msgsRes : (msgsRes as any)?.items || [];
        if (Array.isArray(messages)) {
          for (const msg of messages) {
            const normalized: WidgetMessage = {
              id: msg.id,
              conversationId: activeConv.id,
              content: msg.content || null,
              messageType: msg.messageType,
              contentType: msg.contentType || 'TEXT',
              senderType: msg.senderType,
              sender: msg.sender,
              attachments: msg.attachments as any,
              createdAt: msg.createdAt,
              status: msg.status || 'SENT',
            };
            this.uiRenderer?.addMessage(normalized);
          }
        }
      }
    } catch (err) {
      console.warn('[SalesCopilotWidget] Failed to load conversation history:', err);
    }
  }

  // Getters
  get initialized(): boolean {
    return this.isInitialized;
  }

  get isOpen(): boolean {
    return this.isChatOpen;
  }

  get channelSettings(): WidgetConfigResponse | null {
    return this.channelConfig;
  }

  get contact(): WidgetContactResponse['contact'] | null {
    return this.session?.contact || null;
  }
}
