/**
 * VisitorRoom — the live layer of the watcher, as a Durable Object.
 *
 * The old Express/ws server held everything in process memory: the visitor
 * map, the chat ring buffer, the rate-limit windows, and a 10,000-entry
 * history JSON it debounced to disk. All of it died with the VM. Here the
 * same state lives in one DO: connections via the WebSocket Hibernation API
 * (each socket's visitor identity survives eviction in its attachment),
 * history and chat in SQLite storage.
 *
 * The entire geolocation stack — the MaxMind .mmdb file, the ipapi.co call,
 * the ipinfo.io fallback and the 5,000-entry geo cache — is deleted, not
 * ported: Cloudflare hands us city/region/country/lat/lng/timezone/ASN on
 * `request.cf` for free on every request.
 */
import {
  computeVisitorStats,
  recentVisitors,
  parseLimit,
  visitorsSince,
  HistoricalVisitor,
} from '../../server/stats';
import { sanitizeChatText } from '../../server/sanitize';

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

interface ChatEntry {
  text: string;
  timestamp: number;
}

const HISTORY_MAX_ENTRIES = 10_000;
const HISTORY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const CHAT_HISTORY_LIMIT = 50;
const CHAT_MAX_LENGTH = 500;
// 5 messages per rolling 10s, matching the old server's limiter.
const CHAT_WINDOW_MS = 10_000;
const CHAT_WINDOW_MAX = 5;
const HISTORY_DEFAULT_LIMIT = 500;
const HISTORY_HARD_LIMIT = 2_000;

function countryName(code: string | undefined): string {
  if (!code) return 'Unknown';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export class VisitorRoom {
  private chatWindows = new Map<WebSocket, number[]>();

  constructor(
    private readonly ctx: DurableObjectState,
    private readonly env: unknown,
  ) {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        city TEXT NOT NULL,
        country TEXT NOT NULL,
        connectedAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_history_connectedAt ON history (connectedAt);
    `);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
      return this.handleConnect(request);
    }
    if (url.pathname === '/api/visitors/history') {
      return this.handleHistory(url);
    }
    if (url.pathname === '/api/visitors/stats') {
      return this.handleStats();
    }
    if (url.pathname === '/health') {
      return Response.json({
        status: 'ok',
        visitors: this.ctx.getWebSockets().length,
        historyEntries: this.historyCount(),
      });
    }
    return new Response('Not found', { status: 404 });
  }

  // ── WebSocket lifecycle ────────────────────────────────────────────────

  private async handleConnect(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    const cf = (request.cf ?? {}) as Record<string, unknown>;
    const lat = Number.parseFloat(String(cf.latitude ?? ''));
    const lng = Number.parseFloat(String(cf.longitude ?? ''));
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

    const visitor: Visitor = {
      id: crypto.randomUUID(),
      geo: hasCoords
        ? {
            ip: request.headers.get('cf-connecting-ip') ?? '',
            city: String(cf.city ?? 'Unknown'),
            region: String(cf.region ?? ''),
            country: countryName(cf.country as string | undefined),
            countryCode: String(cf.country ?? ''),
            lat,
            lng,
            timezone: String(cf.timezone ?? ''),
            isp: String(cf.asOrganization ?? ''),
          }
        : null,
      connectedAt: Date.now(),
      userAgent: request.headers.get('user-agent') ?? '',
    };

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(visitor);

    if (visitor.geo) {
      this.recordVisit(visitor.geo, visitor.connectedAt);
    }

    // Welcome the newcomer with the room as it stands, then announce them.
    const others = this.currentVisitors();
    this.send(server, 'welcome', { visitor, visitors: others });
    this.send(server, 'chat_history', { messages: await this.chatHistory() });
    this.broadcast('visitor_joined', { visitor }, server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== 'string' || raw.length > 4096) return;
    let message: { type?: string; payload?: { text?: unknown } };
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    if (message.type !== 'chat_message') return;

    const retryAfterMs = this.chatThrottle(ws);
    if (retryAfterMs > 0) {
      this.send(ws, 'chat_rate_limited', { retryAfterMs });
      return;
    }

    const text = sanitizeChatText(message.payload?.text).slice(0, CHAT_MAX_LENGTH);
    if (!text) return;

    const entry: ChatEntry = { text, timestamp: Date.now() };
    const messages = await this.chatHistory();
    messages.push(entry);
    await this.ctx.storage.put('chat', messages.slice(-CHAT_HISTORY_LIMIT));
    this.broadcast('chat_message', entry);
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.chatWindows.delete(ws);
    const visitor = ws.deserializeAttachment() as Visitor | null;
    if (visitor) this.broadcast('visitor_left', { visitor }, ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  // ── REST ───────────────────────────────────────────────────────────────

  private handleHistory(url: URL): Response {
    const limit = parseLimit(
      url.searchParams.get('limit'),
      HISTORY_DEFAULT_LIMIT,
      HISTORY_HARD_LIMIT,
    );
    const since = Number(url.searchParams.get('since') ?? '');

    const rows = this.ctx.storage.sql
      .exec<HistoricalVisitor>(
        'SELECT lat, lng, city, country, connectedAt FROM history ORDER BY connectedAt ASC',
      )
      .toArray();

    const visitors = Number.isFinite(since) && since > 0
      ? visitorsSince(rows, since)
      : recentVisitors(rows, limit);

    return Response.json({ visitors, total: rows.length });
  }

  private handleStats(): Response {
    const rows = this.ctx.storage.sql
      .exec<HistoricalVisitor>(
        'SELECT lat, lng, city, country, connectedAt FROM history',
      )
      .toArray();
    return Response.json(computeVisitorStats(rows));
  }

  // ── internals ──────────────────────────────────────────────────────────

  private currentVisitors(): Visitor[] {
    const visitors: Visitor[] = [];
    for (const ws of this.ctx.getWebSockets()) {
      const attached = ws.deserializeAttachment() as Visitor | null;
      if (attached) visitors.push(attached);
    }
    return visitors;
  }

  private recordVisit(geo: GeoLocation, connectedAt: number): void {
    const sql = this.ctx.storage.sql;
    sql.exec(
      'INSERT INTO history (lat, lng, city, country, connectedAt) VALUES (?, ?, ?, ?, ?)',
      geo.lat, geo.lng, geo.city, geo.country, connectedAt,
    );
    sql.exec('DELETE FROM history WHERE connectedAt < ?', Date.now() - HISTORY_MAX_AGE_MS);
    sql.exec(
      `DELETE FROM history WHERE id IN (
         SELECT id FROM history ORDER BY connectedAt DESC LIMIT -1 OFFSET ?
       )`,
      HISTORY_MAX_ENTRIES,
    );
  }

  private historyCount(): number {
    const row = this.ctx.storage.sql
      .exec<{ n: number }>('SELECT COUNT(*) AS n FROM history')
      .one();
    return row?.n ?? 0;
  }

  private async chatHistory(): Promise<ChatEntry[]> {
    return (await this.ctx.storage.get<ChatEntry[]>('chat')) ?? [];
  }

  /** Sliding-window throttle; returns ms to wait, 0 when clear. */
  private chatThrottle(ws: WebSocket): number {
    const now = Date.now();
    const window = (this.chatWindows.get(ws) ?? []).filter(
      (t) => now - t < CHAT_WINDOW_MS,
    );
    if (window.length >= CHAT_WINDOW_MAX) {
      this.chatWindows.set(ws, window);
      return CHAT_WINDOW_MS - (now - window[0]);
    }
    window.push(now);
    this.chatWindows.set(ws, window);
    return 0;
  }

  private send(ws: WebSocket, type: string, payload: unknown): void {
    try {
      ws.send(JSON.stringify({ type, payload }));
    } catch {
      // Socket already closing; the close handler cleans up.
    }
  }

  private broadcast(type: string, payload: unknown, except?: WebSocket): void {
    const frame = JSON.stringify({ type, payload });
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try {
        ws.send(frame);
      } catch {
        // Skip sockets mid-close.
      }
    }
  }
}
