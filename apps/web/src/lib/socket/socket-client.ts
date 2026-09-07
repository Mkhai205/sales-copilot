import { io, Socket } from 'socket.io-client';
import { getSocketTokenAction } from '@/features/auth/actions';

export function getWsBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // Local dev: direct cross-origin access to backend
    if (host === 'localhost' || host === '127.0.0.1') {
      return (
        process.env.NEXT_PUBLIC_WS_URL ||
        process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v1\/?$/, '') ||
        'http://localhost:8000'
      );
    }
    // Production / tunnel: same-origin via nginx reverse proxy
    return window.location.origin;
  }
  return (
    process.env.NEXT_PUBLIC_WS_URL ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v1\/?$/, '') ||
    'http://localhost:8000'
  );
}

export const WS_BASE_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v1\/?$/, '') ||
  'http://localhost:8000';

export const REALTIME_NAMESPACE = '/realtime';

let socketInstance: Socket | null = null;

export function getSocketClient(): Socket {
  if (socketInstance) {
    return socketInstance;
  }

  const socketUrl = `${getWsBaseUrl().replace(/\/$/, '')}${REALTIME_NAMESPACE}`;

  socketInstance = io(socketUrl, {
    transports: ['websocket'],
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    withCredentials: true,
    auth: cb => {
      getSocketTokenAction()
        .then(token => {
          cb({ token: token || '' });
        })
        .catch(() => {
          cb({ token: '' });
        });
    },
  });

  return socketInstance;
}

export function disconnectSocketClient(): void {
  if (socketInstance) {
    socketInstance.removeAllListeners();
    socketInstance.disconnect();
    socketInstance = null;
  }
}
