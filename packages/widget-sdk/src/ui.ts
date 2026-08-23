import { WidgetConfigResponse, WidgetMessage } from './types';

export interface WidgetUIOptions {
  config: WidgetConfigResponse;
  position?: 'right' | 'left';
  hideMessageBubble?: boolean;
  onToggle?: (isOpen: boolean) => void;
  onSendMessage?: (content: string) => void;
  onTyping?: (isTyping: boolean) => void;
}

/**
 * UI Renderer encapsulated inside a Shadow DOM.
 * Prevents any CSS collision between host webpage and chat widget.
 */
export class WidgetUIRenderer {
  private container: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private launcherBtn: HTMLElement | null = null;
  private chatWindow: HTMLElement | null = null;
  private messageList: HTMLElement | null = null;
  private inputField: HTMLTextAreaElement | null = null;
  private sendBtn: HTMLElement | null = null;
  private typingIndicator: HTMLElement | null = null;
  private badgeElement: HTMLElement | null = null;

  private isOpen = false;
  private unreadCount = 0;
  private options: WidgetUIOptions;

  constructor(options: WidgetUIOptions) {
    this.options = options;
  }

  /**
   * Mounts the widget into the host DOM inside a Shadow Root.
   */
  mount(): void {
    if (typeof document === 'undefined') return;

    // Check if container already exists
    let host = document.getElementById('sales-copilot-widget-root');
    if (!host) {
      host = document.createElement('div');
      host.id = 'sales-copilot-widget-root';
      document.body.appendChild(host);
    }

    this.container = host;
    this.shadow = host.attachShadow({ mode: 'open' });

    this.render();
    this.attachEventListeners();
  }

  /**
   * Destroys the widget DOM.
   */
  unmount(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }

  /**
   * Toggles open / closed state of the chat window.
   */
  toggle(state?: boolean): void {
    const nextState = state !== undefined ? state : !this.isOpen;
    if (this.isOpen === nextState) return;

    this.isOpen = nextState;

    if (this.chatWindow) {
      if (this.isOpen) {
        this.chatWindow.classList.add('sc-open');
        this.unreadCount = 0;
        this.updateBadge();
        setTimeout(() => this.inputField?.focus(), 150);
      } else {
        this.chatWindow.classList.remove('sc-open');
      }
    }

    if (this.launcherBtn) {
      if (this.isOpen) {
        this.launcherBtn.classList.add('sc-active');
      } else {
        this.launcherBtn.classList.remove('sc-active');
      }
    }

    this.options.onToggle?.(this.isOpen);
  }

  /**
   * Appends a message to the chat view.
   */
  addMessage(msg: WidgetMessage): void {
    if (!this.messageList) return;

    const isUser = msg.senderType === 'CONTACT' || msg.messageType === 'INCOMING';
    const msgEl = document.createElement('div');
    msgEl.className = `sc-message-row ${isUser ? 'sc-message-user' : 'sc-message-agent'}`;

    const bubble = document.createElement('div');
    bubble.className = 'sc-message-bubble';
    bubble.textContent = msg.content || '';

    const timeEl = document.createElement('div');
    timeEl.className = 'sc-message-time';
    const date = new Date(msg.createdAt);
    timeEl.textContent = !isNaN(date.getTime())
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    msgEl.appendChild(bubble);
    msgEl.appendChild(timeEl);

    this.messageList.appendChild(msgEl);
    this.scrollToBottom();

    if (!isUser && !this.isOpen) {
      this.unreadCount++;
      this.updateBadge();
    }
  }

  /**
   * Toggles the typing indicator visibility.
   */
  setTyping(isTyping: boolean): void {
    if (!this.typingIndicator) return;
    this.typingIndicator.style.display = isTyping ? 'flex' : 'none';
    if (isTyping) {
      this.scrollToBottom();
    }
  }

  /**
   * Clears all messages from view.
   */
  clearMessages(): void {
    if (this.messageList) {
      this.messageList.innerHTML = '';
      this.renderGreetingMessage();
    }
  }

  private render(): void {
    if (!this.shadow) return;

    const color = this.options.config.widgetColor || '#2563eb';
    const position = this.options.position || 'right';
    const title = this.options.config.welcomeTitle || 'Live Support';
    const tagline = this.options.config.welcomeTagline || 'How can we help you today?';
    const hideBubble = this.options.hideMessageBubble || false;

    this.shadow.innerHTML = `
      <style>
        :host {
          all: initial;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          font-size: 14px;
          line-height: 1.5;
          color: #1e293b;
          box-sizing: border-box;
          z-index: 2147483647;
          position: fixed;
          bottom: 24px;
          ${position === 'left' ? 'left: 24px;' : 'right: 24px;'}
        }

        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        /* Launcher Button */
        .sc-launcher {
          display: ${hideBubble ? 'none' : 'flex'};
          align-items: center;
          justify-content: center;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: ${color};
          color: #ffffff;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
          cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
          position: relative;
          user-select: none;
          outline: none;
          border: none;
        }

        .sc-launcher:hover {
          transform: scale(1.08);
          box-shadow: 0 14px 28px -4px rgba(0, 0, 0, 0.25);
        }

        .sc-launcher:active {
          transform: scale(0.95);
        }

        .sc-launcher svg {
          width: 28px;
          height: 28px;
          fill: currentColor;
          transition: transform 0.25s ease, opacity 0.25s ease;
        }

        .sc-launcher .sc-icon-close {
          display: none;
        }

        .sc-launcher.sc-active .sc-icon-chat {
          display: none;
        }

        .sc-launcher.sc-active .sc-icon-close {
          display: block;
        }

        /* Unread Badge */
        .sc-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          background: #ef4444;
          color: #ffffff;
          font-size: 11px;
          font-weight: 700;
          border-radius: 10px;
          min-width: 20px;
          height: 20px;
          display: none;
          align-items: center;
          justify-content: center;
          padding: 0 5px;
          border: 2px solid #ffffff;
        }

        /* Chat Window */
        .sc-window {
          position: absolute;
          bottom: 76px;
          ${position === 'left' ? 'left: 0;' : 'right: 0;'}
          width: 380px;
          max-width: calc(100vw - 32px);
          height: 600px;
          max-height: calc(100vh - 120px);
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          opacity: 0;
          transform: translateY(20px) scale(0.95);
          pointer-events: none;
          transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .sc-window.sc-open {
          opacity: 1;
          transform: translateY(0) scale(1);
          pointer-events: auto;
        }

        /* Header */
        .sc-header {
          background: ${color};
          color: #ffffff;
          padding: 18px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .sc-header-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .sc-header-title {
          font-weight: 700;
          font-size: 16px;
          letter-spacing: -0.01em;
        }

        .sc-header-tagline {
          font-size: 12px;
          opacity: 0.85;
        }

        .sc-close-btn {
          background: rgba(255, 255, 255, 0.15);
          border: none;
          color: #ffffff;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .sc-close-btn:hover {
          background: rgba(255, 255, 255, 0.25);
        }

        /* Messages Body */
        .sc-body {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: #f8fafc;
        }

        .sc-greeting-banner {
          background: #ffffff;
          border-radius: 12px;
          padding: 14px 16px;
          border: 1px solid #e2e8f0;
          color: #334155;
          font-size: 13px;
          line-height: 1.5;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        .sc-message-row {
          display: flex;
          flex-direction: column;
          max-width: 80%;
        }

        .sc-message-user {
          align-self: flex-end;
          align-items: flex-end;
        }

        .sc-message-agent {
          align-self: flex-start;
          align-items: flex-start;
        }

        .sc-message-bubble {
          padding: 10px 14px;
          border-radius: 16px;
          font-size: 14px;
          word-break: break-word;
          line-height: 1.45;
        }

        .sc-message-user .sc-message-bubble {
          background: ${color};
          color: #ffffff;
          border-bottom-right-radius: 4px;
        }

        .sc-message-agent .sc-message-bubble {
          background: #ffffff;
          color: #1e293b;
          border: 1px solid #e2e8f0;
          border-bottom-left-radius: 4px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        }

        .sc-message-time {
          font-size: 10px;
          color: #94a3b8;
          margin-top: 4px;
          padding: 0 4px;
        }

        /* Typing Animation */
        .sc-typing-row {
          display: none;
          align-items: center;
          gap: 4px;
          padding: 8px 12px;
          background: #ffffff;
          border-radius: 14px;
          width: fit-content;
          border: 1px solid #e2e8f0;
        }

        .sc-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #94a3b8;
          animation: sc-pulse 1.4s infinite ease-in-out both;
        }

        .sc-dot:nth-child(1) { animation-delay: -0.32s; }
        .sc-dot:nth-child(2) { animation-delay: -0.16s; }

        @keyframes sc-pulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }

        /* Input Area */
        .sc-footer {
          background: #ffffff;
          padding: 12px 16px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sc-input {
          flex: 1;
          border: 1px solid #cbd5e1;
          border-radius: 20px;
          padding: 8px 14px;
          font-family: inherit;
          font-size: 13px;
          outline: none;
          resize: none;
          height: 38px;
          max-height: 100px;
          line-height: 20px;
          transition: border-color 0.15s ease;
        }

        .sc-input:focus {
          border-color: ${color};
        }

        .sc-send-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: ${color};
          color: #ffffff;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.15s ease, opacity 0.15s ease;
        }

        .sc-send-btn:hover {
          transform: scale(1.05);
        }

        .sc-send-btn:active {
          transform: scale(0.95);
        }

        .sc-send-btn svg {
          width: 16px;
          height: 16px;
          fill: currentColor;
        }

        /* Responsive Mobile Styles */
        @media (max-width: 480px) {
          :host {
            bottom: 16px;
            right: 16px;
            left: 16px;
          }
          .sc-window {
            width: 100%;
            height: calc(100vh - 100px);
            max-height: 100vh;
            bottom: 70px;
            right: 0;
            left: 0;
          }
        }
      </style>

      <div class="sc-window" id="sc-chat-window">
        <div class="sc-header">
          <div class="sc-header-info">
            <span class="sc-header-title">${title}</span>
            <span class="sc-header-tagline">${tagline}</span>
          </div>
          <button class="sc-close-btn" id="sc-btn-close" aria-label="Close chat">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        <div class="sc-body" id="sc-message-list"></div>

        <div class="sc-typing-row" id="sc-typing-indicator" style="display: none;">
          <div class="sc-dot"></div>
          <div class="sc-dot"></div>
          <div class="sc-dot"></div>
        </div>

        <div class="sc-footer">
          <textarea
            class="sc-input"
            id="sc-chat-input"
            rows="1"
            placeholder="Type a message..."
          ></textarea>
          <button class="sc-send-btn" id="sc-btn-send" aria-label="Send message">
            <svg viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>

      <button class="sc-launcher" id="sc-launcher-btn" aria-label="Open chat">
        <span class="sc-badge" id="sc-unread-badge">0</span>
        <svg class="sc-icon-chat" viewBox="0 0 24 24">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
        </svg>
        <svg class="sc-icon-close" viewBox="0 0 24 24">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    `;

    this.launcherBtn = this.shadow.getElementById('sc-launcher-btn');
    this.chatWindow = this.shadow.getElementById('sc-chat-window');
    this.messageList = this.shadow.getElementById('sc-message-list');
    this.inputField = this.shadow.getElementById('sc-chat-input') as HTMLTextAreaElement;
    this.sendBtn = this.shadow.getElementById('sc-btn-send');
    this.typingIndicator = this.shadow.getElementById('sc-typing-indicator');
    this.badgeElement = this.shadow.getElementById('sc-unread-badge');

    this.renderGreetingMessage();
  }

  private renderGreetingMessage(): void {
    if (!this.messageList) return;
    const greeting = this.options.config.greetingMessage;
    if (greeting && greeting.trim() !== '') {
      const banner = document.createElement('div');
      banner.className = 'sc-greeting-banner';
      banner.textContent = greeting;
      this.messageList.appendChild(banner);
    }
  }

  private attachEventListeners(): void {
    if (!this.shadow) return;

    this.launcherBtn?.addEventListener('click', () => this.toggle());

    const closeBtn = this.shadow.getElementById('sc-btn-close');
    closeBtn?.addEventListener('click', () => this.toggle(false));

    this.sendBtn?.addEventListener('click', () => this.handleSendMessage());

    this.inputField?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });

    let typingTimeout: any = null;
    this.inputField?.addEventListener('input', () => {
      this.options.onTyping?.(true);
      if (typingTimeout) clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        this.options.onTyping?.(false);
      }, 2000);
    });
  }

  private handleSendMessage(): void {
    if (!this.inputField) return;
    const text = this.inputField.value.trim();
    if (!text) return;

    this.inputField.value = '';
    this.options.onSendMessage?.(text);
  }

  private scrollToBottom(): void {
    if (this.messageList) {
      this.messageList.scrollTop = this.messageList.scrollHeight;
    }
  }

  private updateBadge(): void {
    if (!this.badgeElement) return;
    if (this.unreadCount > 0) {
      this.badgeElement.textContent = String(this.unreadCount);
      this.badgeElement.style.display = 'flex';
    } else {
      this.badgeElement.style.display = 'none';
    }
  }
}
