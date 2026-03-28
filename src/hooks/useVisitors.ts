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
  type: 'welcome' | 'visitor_joined' | 'visitor_left' | 'visitors_list' | 'chat_message' | 'chat_history';
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
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

export function useVisitors(): UseVisitorsReturn {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [currentVisitor, setCurrentVisitor] = useState<Visitor | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      console.log(`[Visitors] Connecting to ${WS_URL}...`);
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[Visitors] Connected');
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          
          switch (message.type) {
            case 'welcome': {
              if (!isWelcomePayload(message.payload)) break;
              const payload = message.payload;
              setCurrentVisitor(payload.visitor);
              setVisitors(payload.visitors);
              console.log(`[Visitors] Welcome! You are ${payload.visitor.id}. ${payload.visitors.length} visitors online.`);
              break;
            }

            case 'visitor_joined': {
              if (!isVisitorEventPayload(message.payload)) break;
              const payload = message.payload;
              setVisitors((prev) => {
                // Avoid duplicates
                if (prev.find((v) => v.id === payload.visitor.id)) {
                  return prev;
                }
                return [...prev, payload.visitor];
              });
              console.log(`[Visitors] ${payload.visitor.id} joined from ${payload.visitor.geo?.city || 'Unknown'}`);
              break;
            }

            case 'visitor_left': {
              if (!isVisitorEventPayload(message.payload)) break;
              const payload = message.payload;
              setVisitors((prev) => prev.filter((v) => v.id !== payload.visitor.id));
              console.log(`[Visitors] ${payload.visitor.id} left`);
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
          }
        } catch (err) {
          console.error('[Visitors] Failed to parse message:', err);
        }
      };

      ws.onclose = () => {
        console.log('[Visitors] Disconnected');
        setIsConnected(false);
        wsRef.current = null;

        // Auto-reconnect with exponential backoff
        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttempts.current);
          reconnectAttempts.current++;
          console.log(`[Visitors] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
          
          reconnectTimeout.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          setError('Connection lost. Please refresh the page.');
        }
      };

      ws.onerror = (event) => {
        console.error('[Visitors] WebSocket error:', event);
        setError('Connection error');
      };
    } catch (err) {
      console.error('[Visitors] Failed to connect:', err);
      setError('Failed to connect to server');
    }
  }, []);

  const reconnect = useCallback(() => {
    reconnectAttempts.current = 0;
    setError(null);
    connect();
  }, [connect]);

  const sendChatMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'chat_message', payload: { text: trimmed } }));
  }, []);

  // Connect on mount
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    visitors,
    currentVisitor,
    isConnected,
    error,
    reconnect,
    chatMessages,
    sendChatMessage,
  };
}
