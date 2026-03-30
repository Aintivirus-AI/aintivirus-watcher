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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory
dotenv.config({ path: path.join(__dirname, '.env') });

// Using local heuristic analysis - no external AI API needed
console.log(`[AI] Using local heuristic analysis engine ✓`);

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean);
if (!allowedOrigins?.length) {
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

// Types (GeoLocation imported from geolocation.ts)

interface Visitor {
  id: string;
  geo: GeoLocation | null;
  connectedAt: number;
  userAgent: string;
}

interface WSMessage {
  type: 'welcome' | 'visitor_joined' | 'visitor_left' | 'visitors_list' | 'chat_message' | 'chat_history';
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

// Visitor history: in-memory primary store with optional file persistence
const MAX_HISTORY_ENTRIES = 10000;
const visitorHistory: HistoricalVisitor[] = [];
let historyFileWritable = true;

// Try multiple paths for the history file (compiled vs source)
const HISTORY_CANDIDATES = [
  path.join(__dirname, 'data', 'visitors-history.json'),
  path.join(__dirname, '..', 'data', 'visitors-history.json'),
];
const HISTORY_FILE = HISTORY_CANDIDATES.find((p) => {
  try { return fs.existsSync(path.dirname(p)); } catch { return false; }
}) ?? HISTORY_CANDIDATES[0];

// Load persisted history into memory on startup
const MAX_HISTORY_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
try {
  if (fs.existsSync(HISTORY_FILE)) {
    const stat = fs.statSync(HISTORY_FILE);
    if (stat.size > MAX_HISTORY_FILE_BYTES) {
      console.warn('[History] History file exceeds size limit, starting with empty history');
    } else {
      const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
      if (Array.isArray(data)) visitorHistory.push(...data);
      console.log(`[History] Loaded ${visitorHistory.length} entries from disk`);
    }
  }
} catch {
  console.warn('[History] Could not read history file, starting with empty history');
}

function appendVisitorHistory(entry: HistoricalVisitor): void {
  if (visitorHistory.length >= MAX_HISTORY_ENTRIES) {
    visitorHistory.shift();
  }
  visitorHistory.push(entry);

  if (!historyFileWritable) return;
  try {
    const dir = path.dirname(HISTORY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(visitorHistory));
  } catch {
    historyFileWritable = false;
    console.warn('[History] Filesystem not writable; history will be in-memory only');
  }
}

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

// Middleware: require x-api-key header matching API_SECRET env var
function requireApiKey(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const secret = process.env.API_SECRET;
  const provided = req.headers['x-api-key'];
  if (!secret || typeof provided !== 'string' || provided.length !== secret.length ||
      !crypto.timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(secret, 'utf8'))) {
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

  // Persist to history file
  if (geo) {
    appendVisitorHistory({
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
        const text = msg.payload.text.trim().slice(0, 500);
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

// Health check endpoint
app.get('/health', requireApiKey, (_req, res) => {
  res.json({ status: 'ok' });
});

// Get current visitors (REST fallback)
app.get('/visitors', requireApiKey, (_req, res) => {
  res.json({
    visitors: Array.from(visitors.values()),
  });
});

// Get all-time visitor history
app.get('/api/visitors/history', requireApiKey, (_req, res) => {
  res.json({ visitors: visitorHistory });
});

// ===========================================
// AI ANALYSIS ENDPOINT (Groq Integration)
// ===========================================

interface UserDataForAnalysis {
  hardware: {
    gpu: string | null;
    gpuVendor: string | null;
    cpuCores: number | null;
    ram: number | null;
    battery: { level: number; charging: boolean } | null;
    screenWidth: number;
    screenHeight: number;
    pixelRatio: number;
    touchSupport: boolean;
    maxTouchPoints: number;
    colorDepth: number;
    orientation: string;
  };
  network: {
    city: string | null;
    region: string | null;
    country: string | null;
    isp: string | null;
    timezone: string | null;
    connectionType: string | null;
    downlink: number | null;
    rtt: number | null;
  };
  browser: {
    userAgent: string;
    language: string;
    languages: string[];
    platform: string;
    mobile: boolean;
    historyLength: number;
    cookiesEnabled: boolean;
    vendor: string;
    referrer: string;
    pdfViewer: boolean;
    architecture: string | null;
    platformVersion: string | null;
  };
  fingerprints: {
    fontsDetected: number;
    extensionsDetected: string[];
    hardwareFamily: string | null;
    webgpuAvailable: boolean;
    wasmSupported: boolean;
    speechVoices: number;
    navigatorProps: number;
    windowProps: number;
  };
  socialLogins?: {
    hasAny: boolean;
    services: string[];
  };
  vpn?: {
    likely: boolean;
    timezoneMismatch: boolean;
    webrtcLeak: boolean;
  };
  preferences?: {
    colorScheme: string;
    reducedMotion: boolean;
    colorGamut: string;
    hdrSupport: boolean;
  };
  botDetection: {
    isAutomated: boolean;
    isHeadless: boolean;
    isVirtualMachine: boolean;
    incognitoMode: boolean;
    devToolsOpen: boolean;
  };
  behavioral: {
    typing: { totalKeystrokes: number; averageWPM: number; averageHoldTime: number };
    mouse: { totalClicks: number; rageClicks: number; erraticMovements: number; movements: number; totalDistance: number; averageVelocity: number };
    scroll: { scrollEvents: number; maxDepth: number; directionChanges: number };
    attention: { tabSwitches: number; totalHiddenTime: number; focusTime: number };
    emotions: { engagement: number; exitIntents: number; handedness?: string };
  };
  tracking: {
    adBlocker: boolean;
    doNotTrack: boolean;
    globalPrivacyControl: boolean;
  };
  crypto: {
    hasAnyWallet: boolean;
    wallets: string[];
  };
  currentTime: {
    hour: number;
    dayOfWeek: number;
    isWeekend: boolean;
    localTimezone?: string;
  };
  storage: {
    quota: number;
    used: number;
    usagePercent?: number;
  };
}

interface AIAnalysisResponse {
  success: boolean;
  analysis?: {
    humanScore: number;
    fraudRisk: number;
    deviceTier: string;
    deviceValue: string;
    ageRange: string;
    incomeLevel: string;
    occupation: string;
    education: string;
    lifeSituation: string;
    workStyle: string;
    personalLife: {
      relationshipStatus: string;
      hasChildren: string;
      livingArrangement: string;
      petOwner: string;
    };
    mentalState: {
      currentMood: string;
      stressLevel: string;
      focusLevel: string;
    };
    lifestyle: {
      sleepSchedule: string;
      workLifeBalance: string;
      techAttitude: string;
    };
    interests: string[];
    creepyInsights: string[];
    profileSummary: string;
    confidence: number;
  };
  error?: string;
  fallback?: boolean;
}

// COMPREHENSIVE LOCAL HEURISTIC ANALYSIS ENGINE
// Uses data-driven correlations and actual user signals - no speculation
function generateLocalAnalysis(data: UserDataForAnalysis): AIAnalysisResponse['analysis'] {
  const gpu = data.hardware.gpu?.toLowerCase() || '';
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  // Extension analysis - very revealing!
  const extensions = data.fingerprints.extensionsDetected || [];
  const hasDevExtensions = extensions.some(e => 
    ['React DevTools', 'Vue DevTools', 'Redux DevTools', 'Angular DevTools', 'Svelte DevTools', 'Apollo DevTools', 'Web Developer', 'JSON Viewer', 'Wappalyzer'].includes(e)
  );
  const hasPasswordManager = extensions.some(e => 
    ['LastPass', '1Password', 'Bitwarden', 'Dashlane', 'NordPass', 'Keeper', 'RoboForm'].includes(e)
  );
  const hasPremiumPasswordManager = extensions.some(e => 
    ['1Password', 'Dashlane', 'NordPass', 'Keeper'].includes(e)
  );
  const hasShoppingExtensions = extensions.some(e => 
    ['Honey', 'Rakuten (Ebates)', 'Capital One Shopping', 'RetailMeNot', 'Keepa', 'CamelCamelCamel'].includes(e)
  );
  const hasPrivacyExtensions = extensions.some(e => 
    ['uBlock Origin', 'AdBlock', 'AdBlock Plus', 'Privacy Badger', 'Ghostery', 'DuckDuckGo Privacy', 'HTTPS Everywhere'].includes(e)
  );
  const hasWritingExtensions = extensions.some(e => 
    ['Grammarly', 'LanguageTool', 'ProWritingAid'].includes(e)
  );
  const hasProductivityExtensions = extensions.some(e => 
    ['Notion Web Clipper', 'Evernote Web Clipper', 'Todoist', 'Pocket', 'Save to Google Drive'].includes(e)
  );
  const hasDarkReader = extensions.includes('Dark Reader');
  const hasVPNExtension = extensions.some(e => 
    ['NordVPN', 'ExpressVPN', 'Windscribe'].includes(e)
  );
  const hasScreenshotTools = extensions.some(e => 
    ['Loom', 'Awesome Screenshot', 'Lightshot'].includes(e)
  );
  
  // GPU tier detection
  const isHighEnd = ['rtx 4090', 'rtx 4080', 'rtx 3090', 'rtx 3080', 'rx 7900', 'm3 max', 'm3 pro', 'm2 max', 'a100', 'quadro'].some(g => gpu.includes(g));
  const isMidRange = ['rtx 4060', 'rtx 3060', 'rtx 2080', 'rtx 2070', 'gtx 1080', 'gtx 1070', 'gtx 1660', 'rx 6', 'rx 7600', 'm1', 'm2', 'm3'].some(g => gpu.includes(g));
  const isIntegrated = ['intel', 'uhd', 'hd graphics'].some(g => gpu.includes(g));
  const isAppleSilicon = ['m1', 'm2', 'm3'].some(g => gpu.includes(g));
  
  // Time analysis
  const hour = data.currentTime.hour;
  const isNightOwl = hour >= 23 || hour < 5;
  const isEarlyBird = hour >= 5 && hour < 8;
  const isWorkHours = hour >= 9 && hour < 17 && !data.currentTime.isWeekend;
  const hourStr = hour < 12 ? `${hour === 0 ? 12 : hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`;
  
  // Social login signals
  const hasGitHub = data.socialLogins?.services.includes('GitHub') || false;
  const hasFacebook = data.socialLogins?.services.includes('Facebook') || false;
  const hasReddit = data.socialLogins?.services.includes('Reddit') || false;
  const hasTwitter = data.socialLogins?.services.includes('Twitter') || false;
  const hasGoogle = data.socialLogins?.services.includes('Google') || false;
  const socialCount = data.socialLogins?.services.length || 0;
  
  // VPN signals
  const isUsingVPN = data.vpn?.likely || false;
  const hasTimezoneMismatch = data.vpn?.timezoneMismatch || false;
  
  // Referrer signals
  const referrer = data.browser.referrer?.toLowerCase() || '';
  const fromGoogle = referrer.includes('google');
  const fromReddit = referrer.includes('reddit');
  const fromTwitter = referrer.includes('twitter') || referrer.includes('x.com');
  const fromHN = referrer.includes('ycombinator') || referrer.includes('hackernews');
  const fromFacebook = referrer.includes('facebook');
  const isDirect = !data.browser.referrer;
  
  // User type signals (now including extension data!)
  const hasDevSignals = data.botDetection.devToolsOpen || 
                        data.browser.userAgent.includes('Developer') ||
                        data.browser.userAgent.includes('Canary') ||
                        hasGitHub ||
                        hasDevExtensions ||  // Developer extensions are very strong signal
                        (data.hardware.cpuCores || 0) >= 8;
  const hasCrypto = data.crypto.hasAnyWallet;
  const isPrivacyConscious = data.tracking.adBlocker || data.tracking.doNotTrack || data.tracking.globalPrivacyControl || isUsingVPN || hasPrivacyExtensions;
  const isFastTypist = data.behavioral.typing.averageWPM > 60;
  const hasRageClicks = data.behavioral.mouse.rageClicks > 0;
  const isDistracted = data.behavioral.attention.tabSwitches > 10;
  const isWriterOrProfessional = hasWritingExtensions || hasProductivityExtensions;
  const isSecurityConscious = hasPasswordManager || hasPrivacyExtensions || isPrivacyConscious;
  const isBudgetShopper = hasShoppingExtensions;
  
  // Storage & History analysis
  // IMPORTANT: navigator.storage.estimate() measures THIS WEBSITE's storage only, NOT overall browser cache
  // So storage data is only meaningful for detecting RETURNING visitors to THIS site
  const storageUsedMB = data.storage.used ? Math.round(data.storage.used / 1e6) : 0;
  const storageQuotaGB = data.storage.quota ? (data.storage.quota / 1e9).toFixed(1) : 0;
  const storagePercent = data.storage.usagePercent || 0;
  const isReturningVisitor = storageUsedMB > 0; // Has cached data from previous visits
  const isFrequentVisitor = storageUsedMB > 1; // More substantial previous engagement
  
  // History length is about the CURRENT SESSION's back/forward navigation stack, not browsing history
  const historyLength = data.browser.historyLength;
  const hasDeepSession = historyLength > 20; // Many pages navigated in current session
  const isFreshNavigation = historyLength <= 2; // Just arrived or one page back
  const isLongSession = historyLength > 50; // Very deep current session
  
  // Screen analysis
  const isProfessionalScreen = data.hardware.screenWidth >= 2560 || data.hardware.pixelRatio >= 2;
  const isBudgetScreen = data.hardware.screenWidth <= 1600 && data.hardware.screenHeight <= 900;
  const is4K = data.hardware.screenWidth >= 3840;
  
  // Preferences signals
  const isDarkMode = data.preferences?.colorScheme === 'dark';
  const hasP3 = data.preferences?.colorGamut === 'p3';
  
  // ISP analysis  
  const isp = data.network.isp?.toLowerCase() || '';
  const isDatacenter = ['amazon', 'google cloud', 'microsoft', 'digitalocean', 'cloudflare', 'vultr'].some(d => isp.includes(d));
  const isEnterpriseISP = ['enterprise', 'business', 'corporate'].some(e => isp.includes(e));
  
  // Calculate estimated device value
  let deviceValue = 400;
  if (isHighEnd) deviceValue += 1500;
  else if (isMidRange) deviceValue += 500;
  else if (isIntegrated) deviceValue += 0;
  if ((data.hardware.cpuCores || 0) >= 16) deviceValue += 600;
  else if ((data.hardware.cpuCores || 0) >= 8) deviceValue += 200;
  if ((data.hardware.ram || 0) >= 32) deviceValue += 300;
  else if ((data.hardware.ram || 0) >= 16) deviceValue += 100;
  if (is4K) deviceValue += 400;
  else if (isProfessionalScreen) deviceValue += 200;
  if (isAppleSilicon) deviceValue = Math.round(deviceValue * 1.4);
  
  // Age estimation based on signals
  let ageScore = 0;
  if (isNightOwl) ageScore += 2;
  if (hasCrypto) ageScore += 2;
  if (hasDevSignals) ageScore += 1;
  if (data.browser.languages.length > 2) ageScore += 1;
  if (isHighEnd && !gpu.includes('quadro')) ageScore += 1;
  if (isAppleSilicon) ageScore -= 1;
  if (isEarlyBird) ageScore -= 2;
  
  // Session/storage signals for age
  if (isFrequentVisitor && hasDevSignals) ageScore += 1; // Returning developer (has visited before)
  
  // Social login age signals
  if (hasFacebook && !hasTwitter && !hasReddit && !hasGitHub) {
    ageScore -= 3; // Facebook-only users tend to be older
  }
  if (hasReddit && !hasFacebook) {
    ageScore += 2; // Reddit without Facebook suggests younger
  }
  if (hasGitHub) {
    ageScore = Math.max(-1, Math.min(2, ageScore)); // Developers cluster 22-40
  }
  if (fromHN || fromReddit) {
    ageScore += 1; // Tech-savvy younger demographic
  }
  
  let ageRange: string;
  if (ageScore >= 4) ageRange = '22-28';
  else if (ageScore >= 2) ageRange = '25-32';
  else if (ageScore >= 0) ageRange = '28-38';
  else ageRange = '35-48';
  
  // Income estimation - using more signals for accuracy
  let incomeScore = 50;
  
  // Hardware signals
  if (isHighEnd) incomeScore += 25;
  else if (isMidRange) incomeScore += 10;
  else if (isIntegrated) incomeScore -= 10;
  if ((data.hardware.cpuCores || 0) >= 16) incomeScore += 15;
  else if ((data.hardware.cpuCores || 0) >= 8) incomeScore += 5;
  if (isProfessionalScreen) incomeScore += 10;
  if (isAppleSilicon) incomeScore += 10;
  if (is4K) incomeScore += 10;
  if (hasP3) incomeScore += 5; // Wide gamut = pro monitor or Mac
  
  // Network signals
  if (isEnterpriseISP) incomeScore += 20;
  
  // Developer signals (developers have above-average income)
  if (hasGitHub && hasDevSignals) incomeScore += 15;
  if (hasDevExtensions && !hasGitHub) incomeScore += 10; // Dev tools without GitHub
  
  // Extension-based income signals
  if (hasPremiumPasswordManager) incomeScore += 10; // Paying for premium security
  if (hasShoppingExtensions) incomeScore -= 5; // Deal seekers (slight negative signal)
  if (hasProductivityExtensions) incomeScore += 5; // Professional tools
  if (hasScreenshotTools) incomeScore += 5; // Work-related tools
  if (hasVPNExtension) incomeScore += 5; // Paying for VPN
  
  // Crypto signals
  if (hasCrypto && data.crypto.wallets.length >= 2) incomeScore += 10; // Multiple wallets = active investor
  else if (hasCrypto) incomeScore += 5;
  
  let incomeLevel: string;
  if (incomeScore >= 85) incomeLevel = '$150k+/year';
  else if (incomeScore >= 75) incomeLevel = '$120k-150k/year';
  else if (incomeScore >= 65) incomeLevel = '$85k-120k/year';
  else if (incomeScore >= 50) incomeLevel = '$55k-85k/year';
  else if (incomeScore >= 35) incomeLevel = '$35k-55k/year';
  else incomeLevel = '$25k-40k/year';
  
  // Occupation determination - prioritize extension data + social logins + hardware
  let occupation: string;
  
  // TIER 1: Very strong signals (definitive occupations)
  if ((hasGitHub || hasDevExtensions) && data.botDetection.devToolsOpen) {
    // DevTools open + dev extensions = active developer
    if (isAppleSilicon && isProfessionalScreen && incomeScore >= 70) {
      occupation = 'Senior Software Engineer';
    } else if (isHighEnd || (data.hardware.cpuCores || 0) >= 12) {
      occupation = 'Software Engineer';
    } else {
      occupation = 'Software Developer';
    }
  } else if (hasDevExtensions && !data.botDetection.devToolsOpen && !hasGitHub) {
    // Dev extensions but not actively coding = PM or tech-adjacent
    occupation = isWriterOrProfessional ? 'Technical Product Manager' : 'Tech professional (non-coding role)';
  } else if (hasGitHub && !data.botDetection.devToolsOpen) {
    occupation = hasWritingExtensions ? 'Technical Writer or DevRel' : 'Tech PM or Engineering Manager';
  }
  
  // TIER 2: Strong signals (likely occupations)
  else if (hasWritingExtensions && hasProductivityExtensions && !hasDevSignals) {
    // Grammarly + productivity tools without dev tools = writer/content/marketing
    occupation = isProfessionalScreen ? 'Content Strategist or Marketing Professional' : 'Writer or Content Creator';
  } else if (isAppleSilicon && isProfessionalScreen && hasP3 && !hasDevSignals) {
    // Apple Silicon + pro display without dev tools = creative
    if (hasScreenshotTools) {
      occupation = 'Designer or Creative Director';
    } else {
      occupation = 'Creative professional (design/media)';
    }
  } else if (hasDevSignals && isFastTypist) {
    occupation = 'Software Developer';
  } else if (hasDevSignals) {
    occupation = 'Tech professional (developer/IT)';
  }
  
  // TIER 3: Moderate signals
  else if (hasCrypto && data.crypto.wallets.length >= 2) {
    occupation = hasDevSignals ? 'Web3 Developer' : 'Crypto trader/DeFi professional';
  } else if (hasCrypto && isHighEnd) {
    occupation = 'Tech-savvy professional or Trader';
  } else if (hasCrypto) {
    occupation = 'Tech-forward professional';
  } else if (hasProductivityExtensions && isProfessionalScreen) {
    occupation = 'Professional (office/knowledge work)';
  } else if (hasReddit && isPrivacyConscious) {
    occupation = 'Tech-adjacent professional';
  } else if (hasDeepSession && hasProductivityExtensions) {
    occupation = 'Knowledge worker (productivity-focused)';
  }
  
  // TIER 4: Weak signals (best guess)
  else if (isWorkHours && isBudgetScreen && !hasCrypto && !hasProductivityExtensions) {
    occupation = 'Office worker or Administrative';
  } else if (isBudgetScreen && isNightOwl && !isWorkHours) {
    occupation = 'Student or Early career professional';
  } else if (isProfessionalScreen || (data.hardware.cpuCores || 0) >= 8) {
    occupation = 'Knowledge worker';
  } else {
    occupation = 'Professional (unspecified)';
  }
  
  // Stress/mood analysis
  let stressLevel: string;
  let currentMood: string;
  if (hasRageClicks && data.behavioral.mouse.erraticMovements > 10) {
    stressLevel = 'high';
    currentMood = 'Frustrated, possibly stuck on something';
  } else if (hasRageClicks || data.behavioral.mouse.erraticMovements > 5) {
    stressLevel = 'medium';
    currentMood = 'Slightly frustrated';
  } else if (isDistracted) {
    stressLevel = 'medium';
    currentMood = 'Scattered, multitasking';
  } else if (data.behavioral.attention.tabSwitches < 2 && (data.behavioral.attention.focusTime || 0) > 30000) {
    stressLevel = 'low';
    currentMood = 'Deeply focused';
  } else {
    stressLevel = 'low';
    currentMood = 'Relaxed, curious';
  }
  
  // Focus level
  let focusLevel: string;
  if (data.behavioral.attention.tabSwitches < 2) {
    focusLevel = 'Highly focused';
  } else if (data.behavioral.attention.tabSwitches < 5) {
    focusLevel = 'Moderately focused';
  } else if (data.behavioral.attention.tabSwitches < 10) {
    focusLevel = 'Scattered attention';
  } else {
    focusLevel = 'Very distracted';
  }
  
  // Living situation
  let livingArrangement: string;
  if (incomeScore >= 75 && parseInt(ageRange) >= 32) {
    livingArrangement = 'Likely homeowner or upscale renter';
  } else if (incomeScore >= 60) {
    livingArrangement = `Renting in ${data.network.city || 'urban area'}`;
  } else {
    livingArrangement = 'Renting apartment or with roommates';
  }
  
  // Build interests array based on all signals + extension data (very revealing!)
  const interests: string[] = [];
  
  // Developer signals
  if (hasGitHub || hasDevExtensions) interests.push('Software Development');
  if (hasDevSignals) interests.push('Technology');
  
  // Extension-based interests (HIGHLY accurate)
  if (hasWritingExtensions) interests.push('Writing & Content');
  if (hasProductivityExtensions) interests.push('Productivity & Organization');
  if (hasScreenshotTools) interests.push('Visual communication');
  if (hasShoppingExtensions) interests.push('Deal hunting', 'Online shopping');
  if (hasPrivacyExtensions) interests.push('Digital Privacy & Security');
  if (hasDarkReader) interests.push('Accessibility & Comfort');
  
  // Crypto & Finance
  if (hasCrypto) interests.push('Cryptocurrency', 'Web3/DeFi');
  
  // Hardware-based interests
  if (isHighEnd && (gpu.includes('rtx') || gpu.includes('rx')) && !hasDevSignals) interests.push('PC Gaming');
  if (isAppleSilicon) interests.push('Apple ecosystem');
  
  // Social signals
  if (hasReddit) interests.push('Online communities');
  if (hasTwitter) interests.push('Current events');
  if (fromHN) interests.push('Startups', 'Tech news');
  
  // Usage patterns
  if (hasProductivityExtensions) interests.push('Web applications');
  if (hasDeepSession) interests.push('Online research');
  
  // Ensure minimum
  if (interests.length < 3) interests.push('Technology', 'Internet culture');
  
  // Generate creepy insights - use ALL the data (extensions are VERY revealing)
  const creepyInsights: string[] = [];
  
  // EXTENSION-BASED INSIGHTS (most revealing and accurate!)
  if (extensions.length > 0) {
    if (hasDevExtensions) {
      const devExts = extensions.filter(e => 
        ['React DevTools', 'Vue DevTools', 'Redux DevTools', 'Angular DevTools', 'Svelte DevTools', 'Apollo DevTools'].includes(e)
      );
      if (devExts.length > 0) {
        const frameworks = devExts.map(e => e.replace(' DevTools', '')).join(', ');
        creepyInsights.push(`Your browser has ${frameworks} DevTools installed - you're definitely a developer working with ${frameworks}. We know your tech stack.`);
      }
    }
    
    if (hasPasswordManager) {
      const pwManager = extensions.find(e => 
        ['LastPass', '1Password', 'Bitwarden', 'Dashlane', 'NordPass', 'Keeper', 'RoboForm'].includes(e)
      );
      if (pwManager) {
        const isPremium = ['1Password', 'Dashlane', 'NordPass'].includes(pwManager);
        creepyInsights.push(`You use ${pwManager} for passwords${isPremium ? ' (premium service - you pay for security)' : ''}. Security-conscious, but we still know you're here.`);
      }
    }
    
    if (hasWritingExtensions) {
      const writingTool = extensions.find(e => ['Grammarly', 'LanguageTool', 'ProWritingAid'].includes(e));
      creepyInsights.push(`${writingTool} installed - you write professionally (emails, content, docs). Writing quality matters to you.`);
    }
    
    if (hasShoppingExtensions) {
      const shoppingExts = extensions.filter(e => 
        ['Honey', 'Rakuten (Ebates)', 'Capital One Shopping', 'RetailMeNot', 'Keepa'].includes(e)
      );
      creepyInsights.push(`Deal hunter detected: ${shoppingExts.join(', ')}. You comparison shop and never pay full price.`);
    }
    
    if (hasDarkReader) {
      creepyInsights.push(`Dark Reader extension - you prefer dark mode everywhere. Probably spend MANY hours in front of screens (eye strain is real).`);
    }
    
    if (hasVPNExtension) {
      const vpnExt = extensions.find(e => ['NordVPN', 'ExpressVPN', 'Windscribe'].includes(e));
      creepyInsights.push(`${vpnExt} extension detected - paying for privacy but we still identified you. The irony.`);
    }
    
    if (hasProductivityExtensions) {
      const prodExts = extensions.filter(e => 
        ['Notion Web Clipper', 'Evernote Web Clipper', 'Todoist', 'Pocket', 'Save to Google Drive'].includes(e)
      );
      creepyInsights.push(`Productivity tools: ${prodExts.join(', ')}. You save things "for later" - how's that reading list going?`);
    }
  }
  
  // Referrer/source insight - this is the most specific
  if (fromReddit) {
    creepyInsights.push(`You came here from Reddit - you're a Redditor, probably clicked a link in ${hasReddit ? 'your logged-in account' : 'a subreddit you browse'}.`);
  } else if (fromHN) {
    creepyInsights.push(`Found this via Hacker News - you're part of the tech/startup crowd. Probably a developer or founder type.`);
  } else if (fromTwitter) {
    creepyInsights.push(`Clicked through from Twitter/X - ${hasTwitter ? 'logged into your account' : 'scrolling your feed'} when you saw this.`);
  } else if (fromGoogle) {
    creepyInsights.push(`Google search brought you here - what were you searching for? We can infer a lot from the fact you searched this topic.`);
  } else if (fromFacebook) {
    creepyInsights.push(`Came from Facebook - ${hasFacebook ? 'logged in while browsing' : 'someone shared this in your feed'}.`);
  } else if (isDirect) {
    creepyInsights.push(`Direct visit (no referrer) - either you typed the URL, used a bookmark, or your browser/VPN is hiding where you came from.`);
  }
  
  // Social login insight - very revealing
  if (socialCount >= 3) {
    creepyInsights.push(`You're logged into ${socialCount} services (${data.socialLogins?.services.join(', ')}) - we can see your entire online identity map.`);
  } else if (hasGitHub && hasGoogle) {
    creepyInsights.push(`Logged into GitHub AND Google - you're definitely a developer. Probably using Chrome signed in to sync your bookmarks too.`);
  } else if (hasGitHub) {
    creepyInsights.push(`GitHub login detected - you're a developer. We could infer your public repos, contributions, and coding languages.`);
  } else if (hasFacebook && !hasTwitter && !hasReddit) {
    creepyInsights.push(`Only logged into Facebook - demographic tells us you're likely 35+. The younger crowd moved to other platforms.`);
  } else if (hasReddit) {
    creepyInsights.push(`Reddit login detected - you're part of the internet culture crowd. What subreddits are you subscribed to?`);
  }
  
  // VPN/Privacy insight
  if (isUsingVPN && hasTimezoneMismatch) {
    creepyInsights.push(`VPN detected with timezone mismatch - your browser says ${data.currentTime.localTimezone || 'one timezone'} but your IP is in ${data.network.timezone || 'another'}. ${isPrivacyConscious ? 'Privacy-conscious, but not invisible.' : 'Trying to hide your location?'}`);
  } else if (isUsingVPN) {
    creepyInsights.push(`VPN/proxy detected - you're trying to hide your real location, but ${data.vpn?.webrtcLeak ? 'WebRTC leaked your real IP' : 'we still built this profile'}.`);
  }
  
  // Time + Day + Social context
  creepyInsights.push(
    `Browsing at ${hourStr} on a ${dayNames[data.currentTime.dayOfWeek]}${data.network.city ? ` from ${data.network.city}` : ''} - ${
      isNightOwl ? (hasGitHub ? 'developer in the zone, coding late' : 'classic night owl, probably a flexible schedule or insomnia') :
      isEarlyBird ? 'early riser, either very disciplined or you never went to sleep' :
      isWorkHours ? (data.currentTime.isWeekend ? 'working on a weekend - deadline or passion project?' : 'during work hours, procrastinating at work?') :
      'evening wind-down time'
    }`
  );
  
  // Hardware insight combined with user signals
  if (isHighEnd && hasGitHub) {
    creepyInsights.push(`${data.hardware.gpu?.split(' ').slice(0, 3).join(' ')} + GitHub login = serious developer with serious hardware. This isn't your first $2k+ machine.`);
  } else if (isHighEnd) {
    creepyInsights.push(`Your ${data.hardware.gpu?.split(' ').slice(0, 3).join(' ')} cost more than many people's monthly rent - you take your computing seriously.`);
  } else if (isBudgetScreen && isIntegrated) {
    creepyInsights.push(`${data.hardware.screenWidth}x${data.hardware.screenHeight} with integrated graphics - ${isWorkHours ? 'work laptop' : 'budget machine'}, you're practical.`);
  } else {
    creepyInsights.push(`${data.hardware.cpuCores || 'Your'} CPU cores and ${data.hardware.screenWidth}x${data.hardware.screenHeight} display paint a picture of ${isProfessionalScreen ? 'someone who cares about their setup' : 'a standard user'}.`);
  }
  
  // Behavioral insight
  if (hasRageClicks) {
    creepyInsights.push(`${data.behavioral.mouse.rageClicks} rage clicks detected - something frustrated you. Bad UX? Slow loading? Or just having a day?`);
  } else if (data.behavioral.mouse.movements > 500 && data.behavioral.mouse.totalClicks < 5) {
    creepyInsights.push(`Lots of mouse movement (${data.behavioral.mouse.movements}) but few clicks (${data.behavioral.mouse.totalClicks}) - you're reading carefully, probably skeptical.`);
  } else if (isDistracted) {
    creepyInsights.push(`${data.behavioral.attention.tabSwitches} tab switches - your attention is scattered. ${isWorkHours ? 'Multitasking at work?' : "Can't focus on one thing."}`);
  }
  
  // NOTE: navigator.storage.estimate() measures storage for THIS WEBSITE only, not overall browser cache
  // So we can only make insights if the user has visited this site before and built up storage
  // For first-time visitors, storage will always be ~0 which is NOT meaningful
  
  // Only show storage insights if the site has actually stored significant data (returning visitor)
  if (isFrequentVisitor) {
    creepyInsights.push(`Returning visitor detected: ${storageUsedMB}MB cached from previous visits - we remember you.`);
  } else if (isReturningVisitor) {
    creepyInsights.push(`You've been here before - we have cached data from your previous visit(s).`);
  }
  // Don't make misleading claims about "empty cache" - it's always empty for first-time visitors to THIS site
  
  // Session navigation insight - this is about pages visited in THIS session/tab, not overall browsing history
  if (isLongSession) {
    creepyInsights.push(`Deep session: ${historyLength} navigation entries in this tab - you've been exploring for a while. ${isDistracted ? 'All those tab switches suggest scattered focus.' : 'Thorough researcher?'}`);
  } else if (hasDeepSession) {
    creepyInsights.push(`This tab has ${historyLength} navigation entries this session - actively browsing, not just a quick visit.`);
  } else if (isFreshNavigation && data.botDetection.incognitoMode) {
    creepyInsights.push(`Fresh arrival in incognito mode - private browsing detected. Hiding something?`);
  } else if (isFreshNavigation && isPrivacyConscious) {
    creepyInsights.push(`Clean slate: direct navigation + privacy tools active. You know how to stay low-profile.`);
  }
  
  // Battery insight (if laptop)
  if (data.hardware.battery) {
    if (data.hardware.battery.level < 0.15 && !data.hardware.battery.charging) {
      creepyInsights.push(`Battery at ${Math.round(data.hardware.battery.level * 100)}% and NOT charging - either you're mobile right now or you like living dangerously.`);
    } else if (data.hardware.battery.level > 0.95 && data.hardware.battery.charging) {
      creepyInsights.push(`Battery at ${Math.round(data.hardware.battery.level * 100)}% and plugged in - you're at a desk right now. ${isWorkHours ? 'Working from home or office?' : 'Your usual spot.'}`);
    } else if (!data.hardware.battery.charging && data.hardware.battery.level > 0.5) {
      creepyInsights.push(`On battery power (${Math.round(data.hardware.battery.level * 100)}%) - you're mobile or away from your desk right now.`);
    }
  } else if (!data.hardware.battery && isHighEnd) {
    // Desktop detected with high-end hardware
    creepyInsights.push(`Desktop PC (no battery) with ${data.hardware.gpu?.split(' ').slice(0, 3).join(' ')} - you have a dedicated setup, this isn't just a laptop.`);
  }
  
  // Final summary insight
  creepyInsights.push(`Based on all signals: ~${ageRange} years old, earning ${incomeLevel}, ${occupation.toLowerCase()}. ${socialCount > 0 ? `Active on ${data.socialLogins?.services.join(', ')}.` : ''} Creepy? This is what EVERY website can know.`);
  
  // Profile summary - use all the data
  const socialContext = socialCount > 0 ? `active on ${data.socialLogins?.services.join(', ')}` : 'minimal social presence';
  const sourceContext = fromReddit ? 'from Reddit' : fromHN ? 'from HN' : fromTwitter ? 'from Twitter' : fromGoogle ? 'via Google search' : '';
  const profileSummary = `${hasGitHub ? 'A software developer' : hasDevSignals ? 'A technically sophisticated user' : 'A digital citizen'} ${data.network.city ? `in ${data.network.city}` : ''}${sourceContext ? `, arrived ${sourceContext}` : ''}, ${socialContext}. ${isNightOwl ? 'Night owl' : isEarlyBird ? 'Early riser' : 'Standard hours'}. ${hasCrypto ? 'Crypto user. ' : ''}${isUsingVPN ? 'Using VPN but still identified. ' : ''}${isPrivacyConscious ? 'Privacy-conscious but fully profiled.' : 'Leaving clear digital trails.'}`;
  
  // Human score
  let humanScore = 100;
  if (data.botDetection.isAutomated) humanScore -= 40;
  if (data.botDetection.isHeadless) humanScore -= 30;
  if (data.behavioral.mouse.movements === 0 && data.behavioral.typing.totalKeystrokes === 0) humanScore -= 25;
  if (data.behavioral.mouse.totalClicks > 3) humanScore += 5;
  if (data.behavioral.mouse.movements > 100) humanScore += 5;
  humanScore = Math.max(0, Math.min(100, humanScore));
  
  // Fraud risk
  let fraudRisk = 0;
  if (data.botDetection.isAutomated) fraudRisk += 35;
  if (data.botDetection.isHeadless) fraudRisk += 30;
  if (data.botDetection.isVirtualMachine) fraudRisk += 15;
  if (isDatacenter) fraudRisk += 10;
  fraudRisk = Math.min(100, fraudRisk);

  return {
    humanScore,
    fraudRisk,
    deviceTier: isHighEnd ? 'premium' : isMidRange ? 'high-end' : isIntegrated ? 'budget' : 'mid-range',
    deviceValue: `~$${Math.round(deviceValue / 100) * 100}`,
    ageRange,
    incomeLevel,
    occupation,
    education: hasDevSignals ? 'CS degree or self-taught developer' : 
               isAppleSilicon ? 'College educated, likely creative field' : 
               'Unknown',
    lifeSituation: `${data.network.city || 'Urban'} ${livingArrangement.toLowerCase()}`,
    workStyle: isNightOwl ? 'Night owl, flexible schedule' : 
               isWorkHours ? 'Standard work hours' : 
               data.currentTime.isWeekend ? 'Weekend browsing' : 
               'Flexible schedule',
    personalLife: {
      // Relationship status - statistical inference based on age + income + time patterns
      relationshipStatus: (() => {
        const ageNum = parseInt(ageRange);
        // Night owls with high income in 25-35 range often single tech workers
        if (isNightOwl && ageNum >= 25 && ageNum < 35 && incomeScore >= 60 && hasDevSignals) {
          return 'Likely single (night owl developer pattern)';
        }
        // Weekend work + high income + 30+ suggests possible family support mode
        if (data.currentTime.isWeekend && isWorkHours && ageNum >= 30 && incomeScore >= 55) {
          return 'Possibly partnered (weekend work-from-home pattern)';
        }
        // Early bird + 30+ + good income = more likely partnered
        if (isEarlyBird && ageNum >= 30 && incomeScore >= 55) {
          return 'Likely partnered (early schedule suggests family routine)';
        }
        // Standard working hours + 35+ + stable income
        if (isWorkHours && ageNum >= 35 && incomeScore >= 50) {
          return 'Statistically likely partnered';
        }
        // Young + late night
        if (ageNum < 28 && isNightOwl) {
          return 'Likely single (young night owl)';
        }
        return ageNum >= 32 && incomeScore >= 55 ? 'Possibly partnered' : 'Unknown';
      })(),
      
      // Children - harder to determine but we can use schedule patterns
      hasChildren: (() => {
        const ageNum = parseInt(ageRange);
        // Very early morning + weekend = kids don't let you sleep in
        if (isEarlyBird && data.currentTime.isWeekend && ageNum >= 28 && ageNum <= 50) {
          return 'Possible (weekend early riser pattern common with kids)';
        }
        // Working hours on weekend = no kids keeping you busy
        if (data.currentTime.isWeekend && isWorkHours && !isEarlyBird) {
          return 'Less likely (free weekend time)';
        }
        // Late night + young = unlikely
        if (isNightOwl && ageNum < 30) {
          return 'Unlikely (young + late hours)';
        }
        // Mid-age + normal schedule + stable income
        if (ageNum >= 32 && ageNum <= 45 && incomeScore >= 55 && !isNightOwl) {
          return 'Possible (age/income suggests life stage)';
        }
        if (ageNum < 25) {
          return 'Statistically unlikely (age < 25)';
        }
        return 'Cannot determine from browser data';
      })(),
      
      livingArrangement,
      
      // Pet ownership - IMPOSSIBLE to determine from browser data alone
      // We're being honest rather than guessing
      petOwner: 'Cannot determine (no browser signal for this)',
    },
    mentalState: {
      currentMood,
      stressLevel,
      focusLevel,
    },
    lifestyle: {
      sleepSchedule: isNightOwl ? 'Night owl (active 11pm-5am)' : isEarlyBird ? 'Early bird (active 5am-8am)' : 'Standard schedule',
      workLifeBalance: (() => {
        if (data.currentTime.isWeekend && isWorkHours) {
          if (hasDevSignals) return 'Works weekends (developer crunch or passion project)';
          if (hasProductivityExtensions) return 'Works weekends (deadline or workaholic)';
          return 'Works weekends';
        }
        if (isNightOwl && hasDevSignals) return 'Flexible schedule (late-night coder)';
        if (isNightOwl && !hasDevSignals) return 'Non-traditional schedule';
        return 'Appears balanced';
      })(),
      techAttitude: (() => {
        if (hasDevExtensions && hasPrivacyExtensions && hasCrypto) return 'Expert (developer + privacy + crypto)';
        if (hasDevSignals && isPrivacyConscious) return 'Power user (tech-savvy + privacy-aware)';
        if (hasDevExtensions || hasDevSignals) return 'Power user/Developer';
        if (isPrivacyConscious && hasPasswordManager) return 'Security-conscious power user';
        if (isPrivacyConscious) return 'Privacy-conscious';
        if (hasCrypto) return 'Tech-forward (crypto user)';
        if (hasProductivityExtensions) return 'Productivity-focused';
        if (hasDarkReader) return 'Comfort-focused (uses dark mode)';
        return 'Standard user';
      })(),
    },
    interests: interests.slice(0, 6),
    creepyInsights,
    profileSummary,
    // Confidence based on number of data signals we have
    // Extensions are VERY reliable signals (binary yes/no)
    confidence: Math.min(
      35 + // Base confidence
      
      // TIER 1: Very reliable signals (extensions are definitive)
      (extensions.length > 0 ? Math.min(extensions.length * 3, 15) : 0) + // Extensions are binary facts
      (hasDevExtensions ? 10 : 0) + // Developer extensions = definitely a dev
      (hasGitHub ? 10 : 0) + // GitHub = definitely in tech
      (hasCrypto ? 8 : 0) + // Wallet detection is binary
      
      // TIER 2: Reliable signals
      (hasPasswordManager ? 5 : 0) + // Password manager is concrete
      (hasWritingExtensions ? 5 : 0) + // Writing tools are concrete
      (socialCount > 0 ? Math.min(socialCount * 3, 10) : 0) + // Social logins
      (fromReddit || fromHN || fromTwitter ? 8 : 0) + // Referrer is concrete
      
      // TIER 3: Moderately reliable signals
      (isHighEnd || isMidRange ? 5 : 0) + // Hardware signals reliable
      (isProfessionalScreen ? 3 : 0) + // Screen specs reliable
      (isPrivacyConscious ? 4 : 0) + // Privacy tools are concrete
      (isUsingVPN ? 3 : 0) + // VPN detection reliable
      
      // TIER 4: Behavioral signals (can vary)
      (data.behavioral.mouse.movements > 100 ? 3 : 0) +
      (data.behavioral.typing.totalKeystrokes > 10 ? 2 : 0) +
      (hasDeepSession ? 2 : 0) + // Deep navigation in current session
      (isReturningVisitor ? 3 : 0), // Returning visitors give us more confidence
      
      92 // Cap at 92% with strong extension data, otherwise lower
    ),
  };
}

app.post('/api/analyze', requireApiKey, async (req, res) => {
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

server.listen(PORT, () => {
  console.log(`🌍 Identity Profiler running on port ${PORT}`);
  console.log(`   Frontend: http://localhost:${PORT}${BASE_PATH}/`);
  console.log(`   WebSocket: ws://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
});
