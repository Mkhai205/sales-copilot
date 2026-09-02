import { io, Socket } from 'socket.io-client';
import {
  RealtimeConnectedPayload,
  RealtimeRoomOperationResult,
} from '../../../src/modules/realtime/realtime.types';
import { WsClientEvent } from '@sales-copilot/shared-contracts';

export interface TestWebSocketClientOptions {
  wsUrl: string;
  token: string;
  defaultTimeout?: number;
}

export interface ReceivedEventEntry<T = any> {
  event: string;
  payload: T;
  timestamp: Date;
}

/**
 * Robust WebSocket test client wrapper around socket.io-client for E2E tests.
 * Captures all incoming socket events via onAny, supports Catch-Before-Wait
 * pattern in waitForEvent() to prevent race conditions, and handles clean disconnection.
 */
export class TestWebSocketClient {
  private socket: Socket | null = null;
  private readonly receivedEvents: ReceivedEventEntry[] = [];
  private readonly pendingListeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor(private readonly options: TestWebSocketClientOptions) {}

  /**
   * Connects to the Realtime Gateway with JWT authentication
   * and waits for the 'connected' handshake event.
   */
  public async connect(): Promise<RealtimeConnectedPayload> {
    const timeout = this.options.defaultTimeout ?? 10000;

    return new Promise<RealtimeConnectedPayload>((resolve, reject) => {
      let isSettled = false;

      this.socket = io(this.options.wsUrl, {
        auth: { token: this.options.token },
        transports: ['websocket'],
        reconnection: false,
        autoConnect: false,
        timeout,
      });

      const timer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          this.disconnect();
          reject(new Error(`WebSocket connection timed out after ${timeout}ms`));
        }
      }, timeout);

      // Global capture of all incoming socket events
      this.socket.onAny((event: string, ...args: any[]) => {
        const payload = args.length === 1 ? args[0] : args;
        const entry: ReceivedEventEntry = {
          event,
          payload,
          timestamp: new Date(),
        };
        this.receivedEvents.push(entry);

        // If this is the generic 'event' envelope with inner event name, also index inner event
        if (event === 'event' && payload && typeof payload === 'object' && 'event' in payload) {
          const innerPayload = (payload as any).data ?? payload;
          this.receivedEvents.push({
            event: (payload as any).event,
            payload: innerPayload,
            timestamp: new Date(),
          });
        }

        this.notifyPendingListeners(event, payload);
      });

      this.socket.once('connected', (payload: RealtimeConnectedPayload) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          resolve(payload);
        }
      });

      this.socket.once('connect_error', (err: Error) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          this.disconnect();
          reject(err);
        }
      });

      this.socket.once('error', (err: any) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          this.disconnect();
          const message =
            typeof err === 'object' && err !== null ? err.message || err.code : String(err);
          reject(new Error(message || 'Realtime socket connection error'));
        }
      });

      this.socket.connect();
    });
  }

  /**
   * Joins a workspace room (workspace_{workspaceId}) to receive tenant broadcasts.
   */
  public async joinWorkspace(workspaceId: string): Promise<RealtimeRoomOperationResult> {
    if (!this.socket?.connected) {
      throw new Error('Socket is not connected');
    }

    const timeout = this.options.defaultTimeout ?? 10000;

    return new Promise<RealtimeRoomOperationResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timed out after ${timeout}ms joining workspace ${workspaceId}`));
      }, timeout);

      this.socket!.emit(
        WsClientEvent.JOIN_WORKSPACE,
        { workspaceId },
        (res: RealtimeRoomOperationResult) => {
          clearTimeout(timer);
          if (res?.error || res?.success === false) {
            reject(new Error(res.error?.message || 'Failed to join workspace room'));
          } else {
            resolve(res);
          }
        },
      );
    });
  }

  /**
   * Joins a conversation room (conversation_{conversationId}).
   */
  public async joinConversation(
    conversationId: string,
    workspaceId: string,
  ): Promise<RealtimeRoomOperationResult> {
    if (!this.socket?.connected) {
      throw new Error('Socket is not connected');
    }

    const timeout = this.options.defaultTimeout ?? 10000;

    return new Promise<RealtimeRoomOperationResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timed out after ${timeout}ms joining conversation ${conversationId}`));
      }, timeout);

      this.socket!.emit(
        WsClientEvent.JOIN_CONVERSATION,
        { conversationId, workspaceId },
        (res: RealtimeRoomOperationResult) => {
          clearTimeout(timer);
          if (res?.error || res?.success === false) {
            reject(new Error(res.error?.message || 'Failed to join conversation room'));
          } else {
            resolve(res);
          }
        },
      );
    });
  }

  /**
   * Waits for a specific event with optional predicate and timeout.
   * Checks the history buffer first (Catch-Before-Wait) to prevent race conditions.
   */
  public async waitForEvent<T = any>(
    eventName: string,
    timeoutMs?: number,
    predicate?: (data: T) => boolean,
  ): Promise<T> {
    const timeout = timeoutMs ?? this.options.defaultTimeout ?? 10000;

    // 1. Check if matching event was already received in buffer
    for (const entry of this.receivedEvents) {
      if (entry.event === eventName) {
        const candidate = entry.payload as T;
        if (!predicate || this.matchesPredicate(candidate, predicate)) {
          return candidate;
        }
      }
    }

    // 2. Wait for incoming event
    return new Promise<T>((resolve, reject) => {
      let listener: ((data: T) => void) | null = null;

      const timer = setTimeout(() => {
        if (listener) {
          this.removePendingListener(eventName, listener);
        }
        const receivedSummary = this.receivedEvents.map(e => e.event).join(', ');
        reject(
          new Error(
            `Timed out after ${timeout}ms waiting for event "${eventName}". Events received so far: [${receivedSummary}]`,
          ),
        );
      }, timeout);

      listener = (data: T) => {
        if (!predicate || this.matchesPredicate(data, predicate)) {
          clearTimeout(timer);
          if (listener) {
            this.removePendingListener(eventName, listener);
          }
          resolve(data);
        }
      };

      this.addPendingListener(eventName, listener);
    });
  }

  /**
   * Returns all events captured by this client.
   */
  public getReceivedEvents(eventName?: string): ReceivedEventEntry[] {
    if (!eventName) {
      return [...this.receivedEvents];
    }
    return this.receivedEvents.filter(e => e.event === eventName);
  }

  /**
   * Clears all recorded events from the buffer.
   */
  public clearReceivedEvents(): void {
    this.receivedEvents.length = 0;
  }

  /**
   * Checks if socket is currently connected.
   */
  public isConnected(): boolean {
    return Boolean(this.socket?.connected);
  }

  /**
   * Gets the underlying socket.io Socket instance.
   */
  public getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Gracefully disconnects and removes all event listeners without leaks.
   */
  public async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.removeAllListeners();
      if (this.socket.connected) {
        this.socket.disconnect();
      }
      this.socket = null;
    }
    this.pendingListeners.clear();
  }

  // --- Internal helpers ---

  private matchesPredicate<T>(data: T, predicate: (d: T) => boolean): boolean {
    try {
      if (predicate(data)) {
        return true;
      }
      // Also check inner .data if available
      if (data && typeof data === 'object' && 'data' in data) {
        return predicate((data as any).data);
      }
      return false;
    } catch {
      return false;
    }
  }

  private addPendingListener(eventName: string, listener: (data: any) => void): void {
    if (!this.pendingListeners.has(eventName)) {
      this.pendingListeners.set(eventName, new Set());
    }
    this.pendingListeners.get(eventName)!.add(listener);
  }

  private removePendingListener(eventName: string, listener: (data: any) => void): void {
    const set = this.pendingListeners.get(eventName);
    if (set) {
      set.delete(listener);
      if (set.size === 0) {
        this.pendingListeners.delete(eventName);
      }
    }
  }

  private notifyPendingListeners(event: string, payload: any): void {
    // Notify direct event listeners
    const listeners = this.pendingListeners.get(event);
    if (listeners) {
      for (const listener of Array.from(listeners)) {
        listener(payload);
      }
    }

    // If generic 'event' envelope with inner event name, also notify inner listeners
    if (event === 'event' && payload && typeof payload === 'object' && 'event' in payload) {
      const innerEvent = (payload as any).event;
      const innerListeners = this.pendingListeners.get(innerEvent);
      if (innerListeners) {
        const innerPayload = (payload as any).data ?? payload;
        for (const listener of Array.from(innerListeners)) {
          listener(innerPayload);
        }
      }
    }
  }
}

/**
 * Factory helper for creating TestWebSocketClient instances.
 */
export function createTestWebSocketClient(
  options: TestWebSocketClientOptions,
): TestWebSocketClient {
  return new TestWebSocketClient(options);
}
