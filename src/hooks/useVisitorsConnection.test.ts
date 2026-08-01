import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { reconnectDelay, isRateLimitPayload, useVisitors } from './useVisitors';

/**
 * A controllable WebSocket double. Real sockets never open in jsdom, so tests
 * drive the lifecycle explicitly and assert on how the hook reacts.
 */
class FakeWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;

  readyState = 0;
  sent: string[] = [];
  closed = false;

  url: string;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  receive(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.closed = true;
    this.readyState = FakeWebSocket.CLOSED;
  }

  /** Simulate the network dropping the connection. */
  drop() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }

  static get live() {
    return FakeWebSocket.instances.filter((s) => !s.closed);
  }

  static reset() {
    FakeWebSocket.instances = [];
  }
}

const visitor = (id: string) => ({
  id, geo: null, connectedAt: Date.now(), userAgent: 'test',
});

beforeEach(() => {
  FakeWebSocket.reset();
  vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('reconnectDelay', () => {
  it('grows exponentially with the attempt number', () => {
    const noJitter = () => 1; // pins the result to the top of the window
    expect(reconnectDelay(0, 1000, 30_000, noJitter)).toBe(1000);
    expect(reconnectDelay(1, 1000, 30_000, noJitter)).toBe(2000);
    expect(reconnectDelay(2, 1000, 30_000, noJitter)).toBe(4000);
  });

  it('caps so a long outage does not push retries minutes apart', () => {
    expect(reconnectDelay(20, 1000, 30_000, () => 1)).toBe(30_000);
  });

  // Without jitter, every client returns in lockstep after a server restart.
  it('spreads retries across a window rather than a fixed instant', () => {
    const low = reconnectDelay(3, 1000, 30_000, () => 0);
    const high = reconnectDelay(3, 1000, 30_000, () => 1);
    expect(low).toBeLessThan(high);
    expect(low).toBeGreaterThan(0);
  });

  it('never returns a negative or zero delay', () => {
    for (let attempt = 0; attempt < 12; attempt++) {
      expect(reconnectDelay(attempt, 1000, 30_000, () => 0)).toBeGreaterThan(0);
    }
  });
});

describe('isRateLimitPayload', () => {
  it('accepts a numeric retryAfterMs', () => {
    expect(isRateLimitPayload({ retryAfterMs: 500 })).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isRateLimitPayload({ retryAfterMs: '500' })).toBe(false);
    expect(isRateLimitPayload({})).toBe(false);
    expect(isRateLimitPayload(null)).toBe(false);
  });
});

describe('useVisitors connection lifecycle', () => {
  it('opens a socket on mount', () => {
    renderHook(() => useVisitors());
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('reports connected once the socket opens', () => {
    const { result } = renderHook(() => useVisitors());
    act(() => { FakeWebSocket.instances[0].open(); });
    expect(result.current.isConnected).toBe(true);
  });

  it('populates visitors from the welcome payload', () => {
    const { result } = renderHook(() => useVisitors());
    act(() => {
      const ws = FakeWebSocket.instances[0];
      ws.open();
      ws.receive({ type: 'welcome', payload: { visitor: visitor('me'), visitors: [visitor('me'), visitor('other')] } });
    });
    expect(result.current.currentVisitor?.id).toBe('me');
    expect(result.current.visitors).toHaveLength(2);
  });

  it('reconnects after the socket drops', () => {
    renderHook(() => useVisitors());
    act(() => { FakeWebSocket.instances[0].open(); });

    act(() => { FakeWebSocket.instances[0].drop(); });
    act(() => { vi.advanceTimersByTime(5000); });

    expect(FakeWebSocket.instances.length).toBeGreaterThan(1);
  });

  // The old implementation stopped after 5 attempts (~93s) and told the user to
  // refresh. A laptop asleep for two minutes then needed a manual reload.
  it('keeps retrying well past the old five-attempt ceiling', () => {
    renderHook(() => useVisitors());

    for (let i = 0; i < 12; i++) {
      act(() => {
        const live = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
        live.open();
        live.drop();
      });
      act(() => { vi.advanceTimersByTime(60_000); });
    }

    expect(FakeWebSocket.instances.length).toBeGreaterThan(10);
  });

  // Regression: reconnect() closed the old socket, but that socket's onclose
  // ran *after* wsRef pointed at the new one and nulled it — breaking sends and
  // spawning a duplicate connection.
  it('does not leave two live sockets when reconnect() is called', () => {
    const { result } = renderHook(() => useVisitors());
    act(() => { FakeWebSocket.instances[0].open(); });

    act(() => { result.current.reconnect(); });
    act(() => { vi.advanceTimersByTime(1000); });

    expect(FakeWebSocket.live).toHaveLength(1);
  });

  it('keeps sending working after a manual reconnect', () => {
    const { result } = renderHook(() => useVisitors());
    act(() => { FakeWebSocket.instances[0].open(); });

    act(() => { result.current.reconnect(); });
    const fresh = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
    act(() => { fresh.open(); });

    act(() => { result.current.sendChatMessage('still works'); });

    expect(fresh.sent).toHaveLength(1);
    expect(JSON.parse(fresh.sent[0]).payload.text).toBe('still works');
  });

  it('ignores messages from a superseded socket', () => {
    const { result } = renderHook(() => useVisitors());
    const stale = FakeWebSocket.instances[0];
    act(() => { stale.open(); });

    act(() => { result.current.reconnect(); });
    act(() => {
      stale.receive({ type: 'welcome', payload: { visitor: visitor('ghost'), visitors: [visitor('ghost')] } });
    });

    expect(result.current.currentVisitor).toBeNull();
  });

  it('closes the socket and stops reconnecting on unmount', () => {
    const { unmount } = renderHook(() => useVisitors());
    act(() => { FakeWebSocket.instances[0].open(); });

    unmount();
    const countAtUnmount = FakeWebSocket.instances.length;
    act(() => { vi.advanceTimersByTime(120_000); });

    expect(FakeWebSocket.instances[0].closed).toBe(true);
    expect(FakeWebSocket.instances).toHaveLength(countAtUnmount);
  });

  it('reconnects immediately when the browser comes back online', () => {
    renderHook(() => useVisitors());
    act(() => { FakeWebSocket.instances[0].open(); FakeWebSocket.instances[0].drop(); });
    const afterDrop = FakeWebSocket.instances.length;

    act(() => { window.dispatchEvent(new Event('online')); });

    expect(FakeWebSocket.instances.length).toBeGreaterThan(afterDrop);
  });
});

describe('useVisitors chat', () => {
  it('does not send an empty message', () => {
    const { result } = renderHook(() => useVisitors());
    act(() => { FakeWebSocket.instances[0].open(); });

    act(() => { result.current.sendChatMessage('   '); });

    expect(FakeWebSocket.instances[0].sent).toHaveLength(0);
  });

  it('does not send while disconnected', () => {
    const { result } = renderHook(() => useVisitors());
    act(() => { result.current.sendChatMessage('hello'); });
    expect(FakeWebSocket.instances[0].sent).toHaveLength(0);
  });

  it('appends incoming chat messages in order', () => {
    const { result } = renderHook(() => useVisitors());
    act(() => {
      const ws = FakeWebSocket.instances[0];
      ws.open();
      ws.receive({ type: 'chat_message', payload: { text: 'first', timestamp: 1 } });
      ws.receive({ type: 'chat_message', payload: { text: 'second', timestamp: 2 } });
    });

    expect(result.current.chatMessages.map((m) => m.text)).toEqual(['first', 'second']);
  });

  it('preserves punctuation exactly as the server sent it', () => {
    const { result } = renderHook(() => useVisitors());
    act(() => {
      const ws = FakeWebSocket.instances[0];
      ws.open();
      ws.receive({ type: 'chat_message', payload: { text: `it's <fine> & "quoted"`, timestamp: 1 } });
    });

    expect(result.current.chatMessages[0].text).toBe(`it's <fine> & "quoted"`);
  });

  it('surfaces a cooldown when the server throttles chat', () => {
    const { result } = renderHook(() => useVisitors());
    act(() => {
      const ws = FakeWebSocket.instances[0];
      ws.open();
      ws.receive({ type: 'chat_rate_limited', payload: { retryAfterMs: 4000 } });
    });

    expect(result.current.chatCooldownMs).toBe(4000);
  });

  it('clears the cooldown once it elapses', () => {
    const { result } = renderHook(() => useVisitors());
    act(() => {
      const ws = FakeWebSocket.instances[0];
      ws.open();
      ws.receive({ type: 'chat_rate_limited', payload: { retryAfterMs: 2000 } });
    });

    act(() => { vi.advanceTimersByTime(2100); });

    expect(result.current.chatCooldownMs).toBe(0);
  });

  it('ignores a malformed rate-limit payload', () => {
    const { result } = renderHook(() => useVisitors());
    act(() => {
      const ws = FakeWebSocket.instances[0];
      ws.open();
      ws.receive({ type: 'chat_rate_limited', payload: { retryAfterMs: 'soon' } });
    });

    expect(result.current.chatCooldownMs).toBe(0);
  });

  it('survives malformed JSON without tearing down the connection', () => {
    const { result } = renderHook(() => useVisitors());
    act(() => {
      const ws = FakeWebSocket.instances[0];
      ws.open();
      ws.onmessage?.({ data: 'not json{' });
    });

    expect(result.current.isConnected).toBe(true);
  });
});
