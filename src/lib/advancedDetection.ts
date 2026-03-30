// ============================================
// ADVANCED DETECTION ENGINE
// State-of-the-art techniques from CreepJS,
// FingerprintJS, MyIP, and privacytests.org
// ============================================

// ── Cloudflare Trace (TLS version, HTTP protocol, WARP, datacenter) ──

export interface CloudflareTrace {
  ip: string | null;
  tlsVersion: string | null;
  httpVersion: string | null;
  colo: string | null;        // Cloudflare datacenter code
  warp: string | null;        // WARP VPN status
  gateway: string | null;
  sni: string | null;
  loc: string | null;         // Country code
  userAgent: string | null;
}

export async function getCloudflareTrace(): Promise<CloudflareTrace> {
  const result: CloudflareTrace = {
    ip: null, tlsVersion: null, httpVersion: null, colo: null,
    warp: null, gateway: null, sni: null, loc: null, userAgent: null,
  };
  try {
    const res = await fetch('https://www.cloudflare.com/cdn-cgi/trace');
    const text = await res.text();
    const lines = text.trim().split('\n');
    for (const line of lines) {
      const [key, ...rest] = line.split('=');
      const val = rest.join('=');
      switch (key) {
        case 'ip': result.ip = val; break;
        case 'tls': result.tlsVersion = val; break;
        case 'h': result.httpVersion = val; break;
        case 'colo': result.colo = val; break;
        case 'warp': result.warp = val; break;
        case 'gateway': result.gateway = val; break;
        case 'sni': result.sni = val; break;
        case 'loc': result.loc = val; break;
        case 'uag': result.userAgent = val; break;
      }
    }
  } catch { /* CF blocked or network error */ }
  return result;
}

// ── Lie / Spoof Detection (inspired by CreepJS) ──

export interface LieDetectionResult {
  nativeFunctionTampered: boolean;
  proxyDetected: boolean;
  propertyDescriptorAnomaly: boolean;
  prototypeChainAnomaly: boolean;
  canvasLie: boolean;
  webglLie: boolean;
  audioLie: boolean;
  navigatorLie: boolean;
  screenLie: boolean;
  timezoneAnomaly: boolean;
  spoofScore: number;         // 0 = clean, 100 = heavily spoofed
  detectedTools: string[];
  details: string[];
}

export function detectLies(): LieDetectionResult {
  const result: LieDetectionResult = {
    nativeFunctionTampered: false, proxyDetected: false,
    propertyDescriptorAnomaly: false, prototypeChainAnomaly: false,
    canvasLie: false, webglLie: false, audioLie: false,
    navigatorLie: false, screenLie: false, timezoneAnomaly: false,
    spoofScore: 0, detectedTools: [], details: [],
  };

  // 1. Navigator property override detection (CreepJS technique)
  try {
    // Check if common fingerprinting targets have been overridden
    const propsToCheck = ['userAgent', 'platform', 'languages', 'hardwareConcurrency'];
    for (const prop of propsToCheck) {
      const desc = Object.getOwnPropertyDescriptor(navigator, prop);
      if (desc && (desc.get || desc.set || desc.configurable)) {
        result.navigatorLie = true;
        result.details.push(`navigator.${prop} has been overridden (has custom getter/setter)`);
      }
    }

    // Check if navigator properties have own descriptors they shouldn't
    for (const prop of propsToCheck) {
      if (Object.prototype.hasOwnProperty.call(navigator, prop)) {
        const desc = Object.getOwnPropertyDescriptor(navigator, prop);
        if (desc && typeof desc.value !== 'undefined' && desc.writable === true) {
          result.navigatorLie = true;
          result.details.push(`navigator.${prop} is writable (likely spoofed)`);
        }
      }
    }
  } catch { /* ignore */ }

  // 2. Proxy detection via prototype check
  try {
    const navStr = Object.prototype.toString.call(navigator);
    if (navStr !== '[object Navigator]') {
      result.proxyDetected = true;
      result.details.push(`navigator prototype mismatch: ${navStr}`);
    }
  } catch { /* ignore */ }

  // 3. Property descriptor analysis (CreepJS technique)
  try {
    // Native functions should NOT have 'arguments' or 'caller' as own properties
    const fnChecks = [
      { fn: HTMLCanvasElement.prototype.toDataURL, name: 'canvas.toDataURL' },
      { fn: CanvasRenderingContext2D.prototype.getImageData, name: 'ctx.getImageData' },
    ];
    for (const { fn, name } of fnChecks) {
      if (fn) {
        const hasArgs = Object.getOwnPropertyDescriptor(fn, 'arguments');
        const hasCaller = Object.getOwnPropertyDescriptor(fn, 'caller');
        const hasProto = Object.getOwnPropertyDescriptor(fn, 'prototype');
        if (hasArgs || hasCaller || hasProto) {
          result.propertyDescriptorAnomaly = true;
          result.details.push(`${name} has unexpected own properties (tampered)`);
        }
      }
    }
  } catch { /* ignore */ }

  // 4. Canvas lie detection - render twice and compare
  try {
    const canvas1 = document.createElement('canvas');
    const canvas2 = document.createElement('canvas');
    canvas1.width = canvas2.width = 100;
    canvas1.height = canvas2.height = 30;
    const draw = (canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(0, 0, 100, 30);
      ctx.fillStyle = '#069';
      ctx.fillText('CreepCheck', 2, 2);
      return canvas.toDataURL();
    };
    const hash1 = draw(canvas1);
    const hash2 = draw(canvas2);
    if (hash1 !== hash2 && hash1 && hash2) {
      result.canvasLie = true;
      result.details.push('Canvas output differs between identical draws (noise injection detected)');
    }
  } catch { /* ignore */ }

  // 5. Screen dimension lie detection via matchMedia
  try {
    const reportedWidth = screen.width;
    const reportedHeight = screen.height;
    // matchMedia directly queries the display — harder to spoof than screen.*
    const mmWidth = window.matchMedia(`(device-width: ${reportedWidth}px)`).matches;
    const mmHeight = window.matchMedia(`(device-height: ${reportedHeight}px)`).matches;
    if (!mmWidth || !mmHeight) {
      result.screenLie = true;
      result.details.push(`screen dimensions (${reportedWidth}x${reportedHeight}) don't match matchMedia queries`);
    }
  } catch { /* ignore */ }

  // 6. Timezone consistency check
  try {
    const reportedTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = new Date().getTimezoneOffset();
    // Create a date in the reported timezone and check offset matches
    const now = new Date();
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: reportedTZ }));
    const localDate = new Date(now.toLocaleString('en-US'));
    const diff = Math.abs(tzDate.getTime() - localDate.getTime());
    if (diff > 60000) { // More than 1 minute difference
      result.timezoneAnomaly = true;
      result.details.push(`Timezone ${reportedTZ} doesn't match actual UTC offset (${offset} min)`);
    }
  } catch { /* ignore */ }

  // 7. WebGL lie detection - compare main thread vs worker (CreepJS)
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) {
        const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
        // SwiftShader = headless/virtual
        if (renderer && /swiftshader|software|llvmpipe/i.test(renderer)) {
          result.webglLie = true;
          result.details.push(`WebGL renderer "${renderer}" indicates software rendering (headless/VM)`);
        }
        // Check for generic renderer that might be spoofed
        if (renderer === 'Generic Renderer' || renderer === 'ANGLE' || renderer === 'Unknown') {
          result.webglLie = true;
          result.details.push(`WebGL renderer "${renderer}" is generic (possibly spoofed)`);
        }
      }
    }
  } catch { /* ignore */ }

  // 8. Detect known anti-fingerprint tools
  try {
    // CanvasBlocker (Firefox)
    if ((window as any).CanvasBlocker !== undefined) {
      result.detectedTools.push('CanvasBlocker');
    }
    // Trace (Firefox extension)
    if (document.documentElement.dataset.traceEnabled) {
      result.detectedTools.push('Trace');
    }
    // Check for common spoofing patterns
    if (navigator.userAgent.includes('Firefox') && (navigator as any).buildID === '20181001000000') {
      result.detectedTools.push('Tor Browser (or RFP mode)');
    }
    // Brave fingerprint randomization
    if ((navigator as any).brave?.isBrave) {
      detectBraveShieldsMode().then(braveMode => {
        if (braveMode) result.detectedTools.push(`Brave Shields (${braveMode})`);
      });
    }
  } catch { /* ignore */ }

  // Calculate spoof score
  const flags = [
    result.nativeFunctionTampered, result.proxyDetected,
    result.propertyDescriptorAnomaly, result.prototypeChainAnomaly,
    result.canvasLie, result.webglLie, result.audioLie,
    result.navigatorLie, result.screenLie, result.timezoneAnomaly,
  ];
  const flagCount = flags.filter(Boolean).length;
  result.spoofScore = Math.min(100, Math.round((flagCount / flags.length) * 100));
  if (result.detectedTools.length > 0) {
    result.spoofScore = Math.min(100, result.spoofScore + result.detectedTools.length * 15);
  }

  return result;
}

async function detectBraveShieldsMode(): Promise<string | null> {
  try {
    // Brave's fingerprint protection modes can be detected by feature availability
    if (typeof (navigator as any).brave?.isBrave === 'function') {
      const isBrave = await (navigator as any).brave.isBrave();
      if (!isBrave) return null;
      // Standard mode: some APIs work; Strict: most blocked
      const hasSerial = 'serial' in navigator;
      const hasFileSystem = 'showOpenFilePicker' in window;
      if (!hasSerial && !hasFileSystem) return 'strict';
      if (hasSerial && hasFileSystem) return 'allow';
      return 'standard';
    }
  } catch { /* ignore */ }
  return null;
}

// ── DOMRect Fingerprinting (CreepJS technique) ──

export interface DOMRectFingerprint {
  hash: string;
  rects: number;
  uniqueValues: number;
}

export function getDOMRectFingerprint(): DOMRectFingerprint {
  const result: DOMRectFingerprint = { hash: '', rects: 0, uniqueValues: 0 };
  try {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.fontSize = '16px';
    container.style.lineHeight = '1';

    // Create elements with various transforms (CreepJS uses 12)
    const transforms = [
      'rotate(0.1deg)',
      'skewX(0.1deg)',
      'scale(1.0001)',
      'perspective(100px) rotateY(0.1deg)',
      'translate(0.1px, 0.1px)',
      'matrix(1, 0.001, 0, 1, 0, 0)',
      'rotate3d(1, 1, 1, 0.1deg)',
      'skewY(0.05deg)',
    ];

    const elements: HTMLDivElement[] = [];
    for (const t of transforms) {
      const el = document.createElement('div');
      el.style.transform = t;
      el.style.display = 'inline-block';
      el.textContent = 'DOMRect fingerprint test string 🦊';
      container.appendChild(el);
      elements.push(el);
    }

    document.body.appendChild(container);

    const values: number[] = [];
    for (const el of elements) {
      const rects = el.getClientRects();
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        values.push(r.x, r.y, r.width, r.height, r.top, r.right, r.bottom, r.left);
      }
      const br = el.getBoundingClientRect();
      values.push(br.x, br.y, br.width, br.height);
    }

    document.body.removeChild(container);

    result.rects = elements.length;
    result.uniqueValues = new Set(values.map(v => v.toFixed(6))).size;

    // Hash the values
    const str = values.map(v => v.toFixed(8)).join(',');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    result.hash = (hash >>> 0).toString(16).padStart(8, '0');
  } catch { /* ignore */ }
  return result;
}

// ── CSS System Colors Fingerprint (CreepJS technique) ──

export interface CSSSystemFingerprint {
  colorHash: string;
  colorsProbed: number;
  systemFonts: string[];
}

export function getCSSSystemFingerprint(): CSSSystemFingerprint {
  const result: CSSSystemFingerprint = { colorHash: '', colorsProbed: 0, systemFonts: [] };
  try {
    // Probe CSS system colors — these differ per OS/theme/browser
    const systemColors = [
      'ActiveBorder', 'ActiveCaption', 'AppWorkspace', 'Background',
      'ButtonFace', 'ButtonHighlight', 'ButtonShadow', 'ButtonText',
      'CaptionText', 'GrayText', 'Highlight', 'HighlightText',
      'InactiveBorder', 'InactiveCaption', 'InactiveCaptionText',
      'InfoBackground', 'InfoText', 'Menu', 'MenuText',
      'Scrollbar', 'ThreeDDarkShadow', 'ThreeDFace', 'ThreeDHighlight',
      'ThreeDLightShadow', 'ThreeDShadow', 'Window', 'WindowFrame',
      'WindowText', 'Canvas', 'CanvasText', 'LinkText', 'VisitedText',
      'AccentColor', 'AccentColorText', 'Field', 'FieldText',
      'Mark', 'MarkText', 'SelectedItem', 'SelectedItemText',
    ];

    const el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.left = '-9999px';
    document.body.appendChild(el);

    const colorValues: string[] = [];
    for (const color of systemColors) {
      el.style.color = color;
      const computed = getComputedStyle(el).color;
      colorValues.push(`${color}:${computed}`);
    }

    document.body.removeChild(el);
    result.colorsProbed = colorValues.length;

    // Hash
    const str = colorValues.join('|');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    result.colorHash = (hash >>> 0).toString(16).padStart(8, '0');

    // System fonts (CreepJS)
    const fontKeywords = ['caption', 'icon', 'menu', 'message-box', 'small-caption', 'status-bar'];
    const fontEl = document.createElement('div');
    fontEl.style.position = 'absolute';
    fontEl.style.left = '-9999px';
    document.body.appendChild(fontEl);
    for (const kw of fontKeywords) {
      fontEl.style.font = kw;
      const computed = getComputedStyle(fontEl);
      result.systemFonts.push(`${kw}: ${computed.fontFamily} ${computed.fontSize}`);
    }
    document.body.removeChild(fontEl);
  } catch { /* ignore */ }
  return result;
}

// ── Keyboard Layout Detection ──

export interface KeyboardLayout {
  layout: string | null;
  layoutMap: Record<string, string>;
  detectionMethod: 'api' | 'unavailable';
}

export async function getKeyboardLayout(): Promise<KeyboardLayout> {
  const result: KeyboardLayout = { layout: null, layoutMap: {}, detectionMethod: 'unavailable' };
  try {
    if ('keyboard' in navigator && 'getLayoutMap' in (navigator as any).keyboard) {
      const layoutMap = await (navigator as any).keyboard.getLayoutMap();
      const entries: Record<string, string> = {};
      layoutMap.forEach((value: string, key: string) => {
        entries[key] = value;
      });
      result.layoutMap = entries;
      result.detectionMethod = 'api';

      // Infer layout from key mappings
      if (entries['KeyQ'] === 'a' && entries['KeyA'] === 'q') result.layout = 'AZERTY (French)';
      else if (entries['KeyQ'] === 'q' && entries['KeyW'] === 'w') result.layout = 'QWERTY';
      else if (entries['KeyQ'] === "'" && entries['Comma'] === 'w') result.layout = 'Dvorak';
      else if (entries['KeyZ'] === 'y' && entries['KeyY'] === 'z') result.layout = 'QWERTZ (German)';
      else if (entries['KeyQ']) result.layout = `Custom (Q=${entries['KeyQ']})`;
    }
  } catch { /* API not available or permission denied */ }
  return result;
}

// ── Enhanced WebRTC Leak Detection with Full ICE/SDP Parsing ──

export interface WebRTCLeakData {
  localIPs: string[];
  publicIPs: string[];
  ipv6Addresses: string[];
  candidateTypes: string[];
  stunServers: string[];
  sdpFingerprint: {
    audioCodecs: string[];
    videoCodecs: string[];
    rtpExtensions: number;
    mediaLines: number;
  } | null;
}

export async function getWebRTCLeakData(): Promise<WebRTCLeakData> {
  const result: WebRTCLeakData = {
    localIPs: [], publicIPs: [], ipv6Addresses: [],
    candidateTypes: [], stunServers: [],
    sdpFingerprint: null,
  };

  if (!window.RTCPeerConnection) return result;

  let pcRef: RTCPeerConnection | null = null;
  try {
    const stunServers = [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
    ];
    result.stunServers = stunServers;

    const pc = new RTCPeerConnection({
      iceServers: stunServers.map(urls => ({ urls })),
    });
    pcRef = pc;

    pc.createDataChannel('leak-test');

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Parse SDP for codec/extension info
    if (offer.sdp) {
      const sdp = offer.sdp;
      const audioCodecs: string[] = [];
      const videoCodecs: string[] = [];
      let rtpExtensions = 0;
      let mediaLines = 0;

      const lines = sdp.split('\r\n');
      for (const line of lines) {
        if (line.startsWith('m=')) mediaLines++;
        if (line.startsWith('a=rtpmap:')) {
          const codec = line.split(' ')[1]?.split('/')[0];
          if (codec) {
            if (line.includes('audio') || sdp.indexOf(line) > sdp.indexOf('m=audio')) {
              if (!audioCodecs.includes(codec)) audioCodecs.push(codec);
            } else {
              if (!videoCodecs.includes(codec)) videoCodecs.push(codec);
            }
          }
        }
        if (line.startsWith('a=extmap:')) rtpExtensions++;
      }

      result.sdpFingerprint = { audioCodecs, videoCodecs, rtpExtensions, mediaLines };
    }

    // Gather ICE candidates
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 5000);
      const seen = new Set<string>();

      pc.onicecandidate = (event) => {
        if (!event.candidate) {
          clearTimeout(timeout);
          resolve();
          return;
        }

        const candidate = event.candidate.candidate;
        if (!candidate) return;

        // Extract candidate type
        const typeMatch = candidate.match(/typ (\w+)/);
        if (typeMatch && !result.candidateTypes.includes(typeMatch[1])) {
          result.candidateTypes.push(typeMatch[1]);
        }

        // Extract IP addresses
        const ipv4Regex = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g;
        const ipv6Regex = /([0-9a-fA-F]{1,4}(:[0-9a-fA-F]{1,4}){7})/g;

        let match;
        while ((match = ipv4Regex.exec(candidate)) !== null) {
          const ip = match[1];
          if (seen.has(ip)) continue;
          seen.add(ip);

          if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
            if (!result.localIPs.includes(ip)) result.localIPs.push(ip);
          } else if (ip !== '0.0.0.0') {
            if (!result.publicIPs.includes(ip)) result.publicIPs.push(ip);
          }
        }

        while ((match = ipv6Regex.exec(candidate)) !== null) {
          if (!result.ipv6Addresses.includes(match[1])) {
            result.ipv6Addresses.push(match[1]);
          }
        }
      };
    });

  } catch { /* WebRTC not available or blocked */ } finally {
    if (pcRef) pcRef.close();
  }

  return result;
}

// ── Enhanced Headless / Bot Detection (CreepJS 19+ signals) ──

export interface HeadlessDetection {
  signals: { name: string; suspicious: boolean; detail: string }[];
  score: number; // 0 = definitely human, 100 = definitely bot
}

export function detectHeadlessAdvanced(): HeadlessDetection {
  const signals: { name: string; suspicious: boolean; detail: string }[] = [];

  // 1. navigator.webdriver
  const webdriver = (navigator as any).webdriver;
  signals.push({
    name: 'navigator.webdriver',
    suspicious: !!webdriver,
    detail: webdriver ? 'true (automation detected)' : 'false',
  });

  // 2. Chrome object on Blink engines
  const isChromium = /Chrome|Chromium|Edg|Brave|Opera|Vivaldi/i.test(navigator.userAgent);
  if (isChromium) {
    signals.push({
      name: 'chrome object',
      suspicious: !(window as any).chrome,
      detail: (window as any).chrome ? 'Present' : 'Missing (expected in Chromium)',
    });
  }

  // 3. Plugins/mimeTypes emptiness
  signals.push({
    name: 'navigator.plugins',
    suspicious: navigator.plugins.length === 0 && isChromium,
    detail: `${navigator.plugins.length} plugins`,
  });

  // 4. Screen dimensions matching available (no taskbar)
  const noTaskbar = screen.width === screen.availWidth && screen.height === screen.availHeight;
  signals.push({
    name: 'Screen vs Available',
    suspicious: noTaskbar,
    detail: noTaskbar ? 'Identical (no taskbar/dock — headless?)' : `Taskbar: ${screen.height - screen.availHeight}px`,
  });

  // 5. Language consistency
  const hasLanguages = navigator.languages && navigator.languages.length > 0;
  signals.push({
    name: 'navigator.languages',
    suspicious: !hasLanguages,
    detail: hasLanguages ? `${navigator.languages.length} languages: ${navigator.languages.slice(0, 3).join(', ')}` : 'Empty (suspicious)',
  });

  // 6. Notification permission state (headless often lacks this)
  try {
    const notifPerm = Notification.permission;
    signals.push({
      name: 'Notification API',
      suspicious: false,
      detail: `Permission: ${notifPerm}`,
    });
  } catch {
    signals.push({
      name: 'Notification API',
      suspicious: true,
      detail: 'Not available (headless indicator)',
    });
  }

  // 7. Connection/RTT (headless often has no network info)
  const conn = (navigator as any).connection;
  signals.push({
    name: 'Network Information',
    suspicious: !conn,
    detail: conn ? `${conn.effectiveType || 'unknown'}, ${conn.rtt || '?'}ms RTT` : 'Not available',
  });

  // 8. Touch support anomaly (claiming touch on desktop UA)
  const claimsDesktop = !(/Mobile|Android|iPhone|iPad/i.test(navigator.userAgent));
  const hasTouch = navigator.maxTouchPoints > 0;
  signals.push({
    name: 'Touch consistency',
    suspicious: claimsDesktop && hasTouch && navigator.maxTouchPoints > 5,
    detail: `${navigator.maxTouchPoints} touch points, ${claimsDesktop ? 'desktop' : 'mobile'} UA`,
  });

  // 9. Performance.now precision (Tor/privacy browsers reduce this)
  const t1 = performance.now();
  const t2 = performance.now();
  const precision = t2 - t1;
  const reducedPrecision = precision === 0 || (t1 % 1 === 0 && t2 % 1 === 0);
  signals.push({
    name: 'Timer precision',
    suspicious: reducedPrecision,
    detail: reducedPrecision ? `Reduced (${precision}ms — privacy mode?)` : `Full precision (${precision.toFixed(4)}ms)`,
  });

  // 10. Window outer vs inner dimensions (headless often identical)
  const outerMatch = window.outerWidth === window.innerWidth && window.outerHeight === window.innerHeight;
  signals.push({
    name: 'Window outer vs inner',
    suspicious: outerMatch,
    detail: outerMatch ? 'Identical (no browser chrome — headless?)' : `Chrome: ${window.outerWidth - window.innerWidth}px x ${window.outerHeight - window.innerHeight}px`,
  });

  // 11. Permission API consistency
  try {
    if (navigator.permissions) {
      signals.push({
        name: 'Permissions API',
        suspicious: false,
        detail: 'Available',
      });
    }
  } catch {
    signals.push({
      name: 'Permissions API',
      suspicious: true,
      detail: 'Blocked or unavailable',
    });
  }

  // 12. devtools detection (window size discrepancy)
  const devToolsLikely = window.outerWidth - window.innerWidth > 160 || window.outerHeight - window.innerHeight > 200;
  signals.push({
    name: 'DevTools indicator',
    suspicious: false, // Not suspicious, just informational
    detail: devToolsLikely ? 'Likely open (large chrome offset)' : 'Not detected',
  });

  // Score
  const suspiciousCount = signals.filter(s => s.suspicious).length;
  const score = Math.min(100, Math.round((suspiciousCount / signals.length) * 100));

  return { signals, score };
}

// ── Advanced Display Fingerprinting ──

export interface AdvancedDisplayInfo {
  colorGamut: string;
  hdr: boolean;
  forcedColors: boolean;
  invertedColors: boolean;
  reducedMotion: boolean;
  reducedTransparency: boolean;
  contrastPreference: string;
  displayMode: string;
  colorScheme: string;
  monochrome: boolean;
  pointer: string;
  hover: string;
  anyPointer: string;
  anyHover: string;
  taskbarHeight: number;
  taskbarWidth: number;
  availTop: number;
  availLeft: number;
  orientation: string;
  aspectRatio: string;
}

export function getAdvancedDisplayInfo(): AdvancedDisplayInfo {
  const mm = (query: string) => window.matchMedia(query).matches;

  const taskbarHeight = screen.height - screen.availHeight;
  const taskbarWidth = screen.width - screen.availWidth;

  return {
    colorGamut: mm('(color-gamut: rec2020)') ? 'Rec. 2020' :
                mm('(color-gamut: p3)') ? 'Display P3' :
                mm('(color-gamut: srgb)') ? 'sRGB' : 'Unknown',
    hdr: mm('(dynamic-range: high)'),
    forcedColors: mm('(forced-colors: active)'),
    invertedColors: mm('(inverted-colors: inverted)'),
    reducedMotion: mm('(prefers-reduced-motion: reduce)'),
    reducedTransparency: mm('(prefers-reduced-transparency: reduce)'),
    contrastPreference: mm('(prefers-contrast: more)') ? 'More' :
                        mm('(prefers-contrast: less)') ? 'Less' :
                        mm('(prefers-contrast: custom)') ? 'Custom' : 'No preference',
    displayMode: mm('(display-mode: fullscreen)') ? 'Fullscreen' :
                 mm('(display-mode: standalone)') ? 'Standalone (PWA)' :
                 mm('(display-mode: minimal-ui)') ? 'Minimal UI' : 'Browser',
    colorScheme: mm('(prefers-color-scheme: dark)') ? 'Dark' :
                 mm('(prefers-color-scheme: light)') ? 'Light' : 'No preference',
    monochrome: mm('(monochrome)'),
    pointer: mm('(pointer: fine)') ? 'Fine (mouse)' :
             mm('(pointer: coarse)') ? 'Coarse (touch)' : 'None',
    hover: mm('(hover: hover)') ? 'Yes' : 'No',
    anyPointer: mm('(any-pointer: fine)') ? 'Fine' :
                mm('(any-pointer: coarse)') ? 'Coarse' : 'None',
    anyHover: mm('(any-hover: hover)') ? 'Yes' : 'No',
    taskbarHeight,
    taskbarWidth,
    availTop: (screen as any).availTop || 0,
    availLeft: (screen as any).availLeft || 0,
    orientation: screen.orientation?.type || 'unknown',
    aspectRatio: `${(screen.width / screen.height).toFixed(2)}:1`,
  };
}
