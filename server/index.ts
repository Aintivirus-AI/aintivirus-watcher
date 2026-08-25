/**
 * WebSocket server for real-time visitor tracking
 * With Groq AI integration for intelligent user profiling
 */

import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getGeolocation, type GeoLocation } from './geolocation.js';
import { sanitizeChatText } from './sanitize.js';
import { RateLimiter } from './rate-limit.js';
import { HistoryStore } from './history-store.js';
import { computeVisitorStats, recentVisitors, visitorsSince, parseLimit } from './stats.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory
dotenv.config({ path: path.join(__dirname, '.env') });

// Using local heuristic analysis - no external AI API needed
console.log(`[AI] Using local heuristic analysis engine ✓`);

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean);
if (!allowedOrigins?.length) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[CORS] FATAL: ALLOWED_ORIGINS must be set in production. Set it to a comma-separated list of allowed origins. Exiting.');
    process.exit(1);
  }
  console.warn('[CORS] WARNING: ALLOWED_ORIGINS is not set. Cross-origin requests will be blocked.');
}
app.use(cors({ origin: allowedOrigins?.length ? allowedOrigins : false, credentials: false }));
app.use((_req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
});

app.use(express.json());

// Serve static frontend files at root
// tsx mode: __dirname = server/ -> ../dist
// compiled mode: __dirname = server/dist/ -> ../../dist
const BASE_PATH = '/';
const distPath = [
  path.join(__dirname, '../dist'),
  path.join(__dirname, '../../dist'),
].find(p => fs.existsSync(path.join(p, 'index.html'))) || path.join(__dirname, '../dist');
app.use(BASE_PATH, express.static(distPath));

const server = createServer(app);
const wss = new WebSocketServer({ server });

// Maximum concurrent WebSocket connections to prevent DoS
const MAX_CONNECTIONS = 5000;

// Chat text is sanitised (control chars, bidi overrides, invisibles) but NOT
// HTML-escaped: it travels as JSON and the React client escapes text nodes on
// render. Escaping here too turned every apostrophe into `&#x27;` on screen.
// See server/sanitize.ts.

// Shared sliding-window limiters. The chat one matters most: every accepted
// message is broadcast to every client, so an unlimited sender amplifies
// against the whole room.
const analyzeLimiter = new RateLimiter(10, 60_000);
const historyLimiter = new RateLimiter(60, 60_000);
const chatLimiter = new RateLimiter(5, 10_000);

function makeHttpLimiter(limiter: RateLimiter) {
  return function limit(req: express.Request, res: express.Response, next: express.NextFunction): void {
    const result = limiter.check(getClientIp(req));
    if (!result.allowed) {
      res.setHeader('Retry-After', Math.ceil(result.retryAfterMs / 1000));
      res.status(429).json({ error: 'Too many requests' });
      return;
    }
    next();
  };
}
const analyzeRateLimiter = makeHttpLimiter(analyzeLimiter);
const historyRateLimiter = makeHttpLimiter(historyLimiter);

// Buckets are keyed by IP/connection and would otherwise accumulate forever.
const limiterSweep = setInterval(() => {
  analyzeLimiter.sweep();
  historyLimiter.sweep();
  chatLimiter.sweep();
}, 5 * 60_000);
limiterSweep.unref?.();

// Types (GeoLocation imported from geolocation.ts)

interface Visitor {
  id: string;
  geo: GeoLocation | null;
  connectedAt: number;
  userAgent: string;
}

interface WSMessage {
  type: 'welcome' | 'visitor_joined' | 'visitor_left' | 'visitors_list' | 'chat_message' | 'chat_history' | 'chat_rate_limited';
  payload: unknown;
}

interface HistoricalVisitor {
  lat: number;
  lng: number;
  city: string;
  country: string;
  connectedAt: number;
}

interface ChatMessage {
  text: string;
  timestamp: number;
}

// Store visitors in memory
const visitors = new Map<string, Visitor>();
const wsToId = new Map<WebSocket, string>();
const wsAlive = new Map<WebSocket, boolean>();

// Chat message buffer (in-memory, last 50)
const MAX_CHAT_MESSAGES = 50;
const chatMessages: ChatMessage[] = [];

// Visitor history — persistence is debounced + atomic (see history-store.ts).
// This used to do a synchronous full-array JSON write inside the connection
// handler, i.e. up to a megabyte re-serialised and fsynced on the event loop
// for every single visitor that connected.
const MAX_HISTORY_ENTRIES = 10000;

const HISTORY_CANDIDATES = [
  path.join(__dirname, 'data', 'visitors-history.json'),
  path.join(__dirname, '..', 'data', 'visitors-history.json'),
];
const HISTORY_FILE = HISTORY_CANDIDATES.find((p) => {
  try { return fs.existsSync(path.dirname(p)); } catch { return false; }
}) ?? HISTORY_CANDIDATES[0];

const historyStore = new HistoryStore({
  file: HISTORY_FILE,
  maxEntries: MAX_HISTORY_ENTRIES,
  retentionMs: 30 * 24 * 60 * 60 * 1000,
});
console.log(`[History] Loaded ${historyStore.load()} entries from disk`);

// Heartbeat interval to detect dead connections
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

// Generate unique ID
function generateId(): string {
  return `v_${crypto.randomUUID()}`;
}

// Minimal interface accepted by getClientIp — satisfied by both express.Request and IncomingMessage
interface RequestLike {
  headers: { [key: string]: string | string[] | undefined };
  socket: { remoteAddress?: string };
}

// Get IP from request — only trusts X-Forwarded-For when TRUST_PROXY=1 is set,
// to prevent clients from spoofing their IP via the header.
function getClientIp(req: RequestLike): string {
  if (process.env.TRUST_PROXY === '1') {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Constant-time string comparison.
 *
 * Comparing lengths first (as this did) short-circuits before the timing-safe
 * compare and leaks the secret's length. Hashing both sides to a fixed 32
 * bytes makes the comparison genuinely constant-time for any input.
 */
function timingSafeStringEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hb = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}

// Middleware: require x-api-key header matching API_SECRET env var
function requireApiKey(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const secret = process.env.API_SECRET;
  const provided = req.headers['x-api-key'];
  if (!secret || typeof provided !== 'string' || !timingSafeStringEqual(provided, secret)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

// Broadcast to all clients except sender
function broadcast(message: WSMessage, excludeWs?: WebSocket): void {
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// Send to specific client
function send(ws: WebSocket, message: WSMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// Helper to clean up a visitor connection
function cleanupVisitor(ws: WebSocket, reason: string = 'disconnected'): void {
  const id = wsToId.get(ws);
  if (id) {
    const visitor = visitors.get(id);
    visitors.delete(id);
    wsToId.delete(ws);
    wsAlive.delete(ws);
    chatLimiter.forget(id);

    if (visitor) {
      broadcast({
        type: 'visitor_left',
        payload: { visitor },
      });
    }

    console.log(`[${id}] ${reason}. Total visitors: ${visitors.size}`);
  } else {
    // Clean up maps even if visitor wasn't found
    wsToId.delete(ws);
    wsAlive.delete(ws);
  }
}

// WebSocket connection handler
wss.on('connection', async (ws, req) => {
  // Enforce connection cap to prevent memory exhaustion DoS
  if (wss.clients.size > MAX_CONNECTIONS) {
    ws.terminate();
    return;
  }

  const visitorId = generateId();
  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'Unknown';

  if (process.env.NODE_ENV !== 'production') console.log(`[${visitorId}] Connected from ${ip}`);

  // Mark connection as alive
  wsAlive.set(ws, true);

  // Handle pong responses
  ws.on('pong', () => {
    wsAlive.set(ws, true);
  });

  // Get geolocation
  const geo = await getGeolocation(ip);

  // Create visitor
  const visitor: Visitor = {
    id: visitorId,
    geo,
    connectedAt: Date.now(),
    userAgent,
  };

  // Store visitor
  visitors.set(visitorId, visitor);
  wsToId.set(ws, visitorId);

  // Persist to history (async, debounced)
  if (geo) {
    historyStore.append({
      lat: geo.lat,
      lng: geo.lng,
      city: geo.city || 'Unknown',
      country: geo.country || 'Unknown',
      connectedAt: Date.now(),
    });
  }

  // Send welcome message with visitor info and current visitors list
  send(ws, {
    type: 'welcome',
    payload: {
      visitor,
      visitors: Array.from(visitors.values()),
    },
  });

  // Send chat history
  if (chatMessages.length > 0) {
    send(ws, {
      type: 'chat_history',
      payload: { messages: chatMessages },
    });
  }

  // Broadcast new visitor to others
  broadcast(
    {
      type: 'visitor_joined',
      payload: { visitor },
    },
    ws
  );

  if (process.env.NODE_ENV !== 'production') console.log(`[${visitorId}] Location: ${geo?.city}, ${geo?.country} (${geo?.lat}, ${geo?.lng})`);
  if (process.env.NODE_ENV !== 'production') console.log(`Total visitors: ${visitors.size}`);

  // Handle incoming messages (chat)
  const MAX_WS_MESSAGE_BYTES = 4 * 1024; // 4 KB
  ws.on('message', (raw) => {
    try {
      if (Buffer.byteLength(raw as Buffer) > MAX_WS_MESSAGE_BYTES) {
        return; // drop oversized messages silently
      }
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'chat_message' && typeof msg.payload?.text === 'string') {
        // Rate limit per connection BEFORE doing any broadcast work — an
        // accepted message fans out to every connected client.
        const verdict = chatLimiter.check(visitorId);
        if (!verdict.allowed) {
          send(ws, {
            type: 'chat_rate_limited',
            payload: { retryAfterMs: verdict.retryAfterMs },
          });
          return;
        }
        const text = sanitizeChatText(msg.payload.text);
        if (!text) return;
        const chatMsg: ChatMessage = { text, timestamp: Date.now() };
        chatMessages.push(chatMsg);
        if (chatMessages.length > MAX_CHAT_MESSAGES) {
          chatMessages.shift();
        }
        // Broadcast to ALL clients (including sender so they get the server timestamp)
        const outMsg: WSMessage = { type: 'chat_message', payload: chatMsg };
        const data = JSON.stringify(outMsg);
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(data);
          }
        });
      }
    } catch {
      // ignore malformed messages
    }
  });

  // Handle disconnect
  ws.on('close', () => {
    cleanupVisitor(ws, 'Disconnected');
  });

  // Handle errors - also cleanup on error
  ws.on('error', (error) => {
    console.error(`WebSocket error for ${visitorId}:`, error);
    cleanupVisitor(ws, 'Error - connection terminated');
  });
});

// Heartbeat interval to detect and remove dead connections
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (wsAlive.get(ws) === false) {
      // Connection didn't respond to last ping, terminate it
      cleanupVisitor(ws, 'Heartbeat timeout - connection dead');
      return ws.terminate();
    }

    // Mark as not alive, will be set back to true on pong
    wsAlive.set(ws, false);
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

// Clean up heartbeat on server close
wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// Liveness probe. Deliberately unauthenticated: this is what uptime monitors,
// the load balancer and railway.json's healthcheckPath hit. Requiring an API
// key here meant every probe got a 401 and the service always looked down.
// It exposes no visitor data — only whether the process is serving.
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    connections: visitors.size,
    historyEntries: historyStore.size,
    historyPersisted: historyStore.isWritable,
    timestamp: Date.now(),
  });
});

// Get current visitors (REST fallback) — still authenticated, this is PII.
app.get('/visitors', requireApiKey, (_req, res) => {
  res.json({
    visitors: Array.from(visitors.values()),
  });
});

// Visitor history for the client-side map.
//
// This used to return the entire history — up to 10,000 entries, unbounded and
// unrated, on every page load. It now serves a bounded slice: `?limit=` (capped)
// and optional `?since=` for incremental polling.
const HISTORY_DEFAULT_LIMIT = 500;
const HISTORY_MAX_LIMIT = 5000;

app.get('/api/visitors/history', historyRateLimiter, (req, res) => {
  const all = historyStore.all();
  const limit = parseLimit(req.query.limit, HISTORY_DEFAULT_LIMIT, HISTORY_MAX_LIMIT);

  const sinceRaw = Number.parseInt(String(req.query.since ?? ''), 10);
  const scoped = Number.isFinite(sinceRaw) && sinceRaw > 0 ? visitorsSince(all, sinceRaw) : all;

  const slice = recentVisitors(scoped, limit);
  res.json({
    visitors: slice,
    total: all.length,
    returned: slice.length,
    truncated: slice.length < scoped.length,
  });
});

// Aggregate stats over the visitor history. Cheap for clients that want
// counters rather than every coordinate.
app.get('/api/visitors/stats', historyRateLimiter, (_req, res) => {
  res.json(computeVisitorStats(historyStore.all()));
});

// ===========================================
// AI ANALYSIS ENDPOINT (Groq Integration)
// ===========================================

import {
  UserDataForAnalysis,
  AIAnalysisResponse,
  generateLocalAnalysis,
} from './analysis';


app.post('/api/analyze', analyzeRateLimiter, requireApiKey, async (req, res) => {
  try {
    const userData: UserDataForAnalysis = req.body;

    if (
      !userData ||
      typeof userData !== 'object' ||
      !userData.hardware ||
      !userData.network ||
      !userData.browser ||
      !userData.fingerprints ||
      !userData.behavioral ||
      !userData.botDetection
    ) {
      return res.status(400).json({ success: false, error: 'Invalid request data' });
    }

    if (process.env.NODE_ENV !== 'production') console.log(`[AI] Analysis request from ${userData.network.city || 'unknown'}, ${userData.network.country || 'unknown'}`);

    // Use local heuristic analysis (more accurate than LLM speculation)
    const startTime = Date.now();
    const analysis = generateLocalAnalysis(userData);
    const elapsed = Date.now() - startTime;
    
    if (process.env.NODE_ENV !== 'production') console.log(`[AI] ✅ Local analysis complete (${elapsed}ms, confidence: ${analysis?.confidence || 0}%)`);
    
    return res.json({ 
      success: true, 
      analysis,
      fallback: false // This is the primary system now
    });

  } catch (error) {
    console.error('[AI] Analysis error:', error);
    return res.status(500).json({ success: false, error: 'Analysis failed' });
  }
});

// SPA catch-all - serve index.html for all routes
app.get('*', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api') || req.path === '/health' || req.path === '/visitors') {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3001;

/**
 * Graceful shutdown. History writes are debounced, so a plain SIGTERM could
 * drop the last few visits; flush synchronously on the way out and stop
 * accepting new work first.
 */
let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Server] ${signal} received, shutting down`);

  clearInterval(heartbeatInterval);
  clearInterval(limiterSweep);
  historyStore.dispose();
  historyStore.flushSync();

  for (const client of wss.clients) {
    try { client.close(1001, 'Server shutting down'); } catch { /* already gone */ }
  }

  server.close(() => process.exit(0));
  // Don't hang forever on a stuck connection.
  setTimeout(() => process.exit(0), 5000).unref?.();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(PORT, () => {
  console.log(`🌍 Identity Profiler running on port ${PORT}`);
  console.log(`   Frontend: http://localhost:${PORT}${BASE_PATH}/`);
  console.log(`   WebSocket: ws://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`[Proxy] Trust proxy: ${process.env.TRUST_PROXY === '1' ? 'enabled (X-Forwarded-For trusted — deploy behind Nginx/Cloudflare/Railway)' : 'disabled (direct socket IP used)'}`);
});
