/**
 * WebSocket hook for real-time visitor tracking
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// Types
export interface GeoLocation {
  ip: string;
  city: string;
  region: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  timezone: string;
  isp: string;
}

export interface Visitor {
  id: string;
  geo: GeoLocation | null;
  connectedAt: number;
  userAgent: string;
}

export interface ChatMessage {
  text: string;
  timestamp: number;
}

interface WSMessage {
  type: 'welcome' | 'visitor_joined' | 'visitor_left' | 'visitors_list' | 'chat_message' | 'chat_history' | 'chat_rate_limited';
  payload: unknown;
}

interface WelcomePayload {
  visitor: Visitor;
  visitors: Visitor[];
}

interface VisitorEventPayload {
  visitor: Visitor;
}

interface UseVisitorsReturn {
  visitors: Visitor[];
  currentVisitor: Visitor | null;
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;
  chatMessages: ChatMessage[];
  sendChatMessage: (text: string) => void;
  /** Set while the server is throttling this connection's chat. */
  chatCooldownMs: number;
}

export function isRateLimitPayload(p: unknown): p is { retryAfterMs: number } {
  return (
    typeof p === 'object' && p !== null && 'retryAfterMs' in p &&
    typeof (p as { retryAfterMs: number }).retryAfterMs === 'number'
  );
}

/**
 * Backoff with full jitter.
 *
 * Without jitter every client reconnects on the same schedule, so a server
 * restart brings the whole room back in synchronised waves. Randomising inside
 * the window spreads them out. The delay is capped so a long outage doesn't
 * push retries hours apart.
 */
export function reconnectDelay(
  attempt: number,
  baseMs = RECONNECT_DELAY,
  maxMs = MAX_RECONNECT_DELAY,
  random: () => number = Math.random,
): number {
  const exponential = Math.min(baseMs * Math.pow(2, attempt), maxMs);
  return Math.round(exponential / 2 + random() * (exponential / 2));
}

// Runtime type guards for WebSocket payload shapes
export function isWelcomePayload(p: unknown): p is WelcomePayload {
  return (
    typeof p === 'object' && p !== null &&
    'visitor' in p && typeof (p as WelcomePayload).visitor === 'object' &&
    'visitors' in p && Array.isArray((p as WelcomePayload).visitors)
  );
}

export function isVisitorEventPayload(p: unknown): p is VisitorEventPayload {
  return typeof p === 'object' && p !== null && 'visitor' in p && typeof (p as VisitorEventPayload).visitor === 'object';
}

export function isVisitorsListPayload(p: unknown): p is { visitors: Visitor[] } {
  return typeof p === 'object' && p !== null && 'visitors' in p && Array.isArray((p as { visitors: Visitor[] }).visitors);
}

export function isChatHistoryPayload(p: unknown): p is { messages: ChatMessage[] } {
  return typeof p === 'object' && p !== null && 'messages' in p && Array.isArray((p as { messages: ChatMessage[] }).messages);
}

export function isChatMessagePayload(p: unknown): p is ChatMessage {
  return typeof p === 'object' && p !== null && 'text' in p && typeof (p as ChatMessage).text === 'string';
}

// Dynamically determine WebSocket URL based on current host
const getWebSocketUrl = () => {
  // Allow explicit override via env variable
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  
  // In development, connect to local server
  if (import.meta.env.DEV) {
    return 'ws://localhost:3001';
  }
  
  // Check for API base URL and derive WS URL from it
  if (import.meta.env.VITE_API_URL) {
    const apiUrl = import.meta.env.VITE_API_URL;
    return apiUrl.replace(/^http/, 'ws').replace(/\/api\/?$/, '');
  }
  
  // In production, auto-detect based on current page URL
  // WebSocket should use the same base path as the app (root)
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const basePath = '/'; // Match the vite base path
  
  return `${protocol}//${host}${basePath}`;
};

const WS_URL = getWebSocketUrl();
const RECONNECT_DELAY = 1000;
// Cap the backoff instead of giving up. The old code stopped after 5 attempts
// (~93s) and showed "please refresh the page" forever, so a laptop asleep for
// two minutes required a manual reload to reconnect.
const MAX_RECONNECT_DELAY = 30_000;

export function useVisitors(): UseVisitorsReturn {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [currentVisitor, setCurrentVisitor] = useState<Visitor | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatCooldownMs, setChatCooldownMs] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cooldownTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set on unmount so a late close event can't schedule a reconnect for a
  // component that no longer exists.
  const disposed = useRef(false);

  const connect = useCallback(() => {
    if (disposed.current) return;

    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }

    // Detach handlers before closing the previous socket. Without this, the
    // old socket's `onclose` fired *after* wsRef pointed at the new socket and
    // set wsRef.current = null — killing the live connection's send path and
    // scheduling a duplicate reconnect.
    const previous = wsRef.current;
    if (previous) {
      previous.onopen = null;
      previous.onmessage = null;
      previous.onclose = null;
      previous.onerror = null;
      try { previous.close(); } catch { /* already closing */ }
      wsRef.current = null;
    }

    let ws: WebSocket;
    try {
      ws = new WebSocket(WS_URL);
    } catch (err) {
      console.error('[Visitors] Failed to connect:', err);
      setError('Failed to connect to server');
      scheduleReconnect();
      return;
    }

    wsRef.current = ws;

    // Every handler below checks it is still the current socket, so a stale
    // connection can never mutate state belonging to a newer one.
    const isCurrent = () => wsRef.current === ws;

    ws.onopen = () => {
      if (!isCurrent()) return;
      setIsConnected(true);
      setError(null);
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      if (!isCurrent()) return;
      try {
        const message: WSMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'welcome': {
            if (!isWelcomePayload(message.payload)) break;
            const payload = message.payload;
            setCurrentVisitor(payload.visitor);
            setVisitors(payload.visitors);
            break;
          }

          case 'visitor_joined': {
            if (!isVisitorEventPayload(message.payload)) break;
            const payload = message.payload;
            setVisitors((prev) =>
              prev.some((v) => v.id === payload.visitor.id) ? prev : [...prev, payload.visitor]);
            break;
          }

          case 'visitor_left': {
            if (!isVisitorEventPayload(message.payload)) break;
            const payload = message.payload;
            setVisitors((prev) => prev.filter((v) => v.id !== payload.visitor.id));
            break;
          }

          case 'visitors_list': {
            if (!isVisitorsListPayload(message.payload)) break;
            setVisitors(message.payload.visitors);
            break;
          }

          case 'chat_history': {
            if (!isChatHistoryPayload(message.payload)) break;
            setChatMessages(message.payload.messages);
            break;
          }

          case 'chat_message': {
            if (!isChatMessagePayload(message.payload)) break;
            setChatMessages((prev) => [...prev, message.payload as ChatMessage]);
            break;
          }

          case 'chat_rate_limited': {
            if (!isRateLimitPayload(message.payload)) break;
            const { retryAfterMs } = message.payload;
            setChatCooldownMs(retryAfterMs);
            if (cooldownTimeout.current) clearTimeout(cooldownTimeout.current);
            cooldownTimeout.current = setTimeout(() => setChatCooldownMs(0), retryAfterMs);
            break;
          }
        }
      } catch (err) {
        console.error('[Visitors] Failed to parse message:', err);
      }
    };

    ws.onclose = () => {
      if (!isCurrent()) return;
      wsRef.current = null;
      setIsConnected(false);
      scheduleReconnect();
    };

    ws.onerror = () => {
      if (!isCurrent()) return;
      // `onclose` always follows, which is where reconnection is handled.
      setError('Connection error');
    };
    // scheduleReconnect is stable (defined via ref below) so this stays valid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kept in a ref so `connect` and the event listeners share one implementation
  // without re-creating the callback chain on every render.
  const connectRef = useRef(connect);
  connectRef.current = connect;

  function scheduleReconnect(): void {
    if (disposed.current || reconnectTimeout.current) return;

    const delay = reconnectDelay(reconnectAttempts.current);
    reconnectAttempts.current++;

    // Retry indefinitely with a capped, jittered delay rather than giving up.
    // Surface a message only once it's been failing long enough to matter.
    if (reconnectAttempts.current >= 4) {
      setError('Reconnecting…');
    }

    reconnectTimeout.current = setTimeout(() => {
      reconnectTimeout.current = null;
      connectRef.current();
    }, delay);
  }

  const reconnect = useCallback(() => {
    reconnectAttempts.current = 0;
    setError(null);
    connectRef.current();
  }, []);

  const sendChatMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'chat_message', payload: { text: trimmed.slice(0, 500) } }));
  }, []);

  useEffect(() => {
    disposed.current = false;
    connectRef.current();

    // Reconnect promptly on the events that actually indicate recovery, rather
    // than waiting out a backoff the user is sitting through.
    const onOnline = () => {
      reconnectAttempts.current = 0;
      connectRef.current();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && wsRef.current === null) {
        reconnectAttempts.current = 0;
        connectRef.current();
      }
    };

    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      disposed.current = true;
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);

      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (cooldownTimeout.current) clearTimeout(cooldownTimeout.current);

      const ws = wsRef.current;
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        ws.onerror = null;
        try { ws.close(); } catch { /* already closing */ }
        wsRef.current = null;
      }
    };
  }, []);

  return {
    visitors,
    currentVisitor,
    isConnected,
    error,
    reconnect,
    chatMessages,
    sendChatMessage,
    chatCooldownMs,
  };
}
