// Comprehensive browser fingerprinting utilities

/**
 * Generate a simple hash from a string
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// ============================================
// WebRTC Local IP Detection
// ============================================

/**
 * Get local/private IPs via WebRTC ICE candidates
 * This can reveal the user's private network IPs even behind VPNs
 */
export async function getWebRTCLocalIPs(): Promise<{ localIPs: string[]; supported: boolean }> {
  if (!window.RTCPeerConnection) {
    return { localIPs: [], supported: false };
  }

  try {
    const localIPs: string[] = [];
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    pc.createDataChannel('');

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 2000);

      pc.onicecandidate = (event) => {
        if (!event.candidate) {
          clearTimeout(timeout);
          resolve();
          return;
        }

        const candidate = event.candidate.candidate;
        
        // Extract IPv4 addresses
        const ipv4Match = candidate.match(/(\d{1,3}\.){3}\d{1,3}/);
        if (ipv4Match && !localIPs.includes(ipv4Match[0])) {
          // Filter for private IPs only
          if (
            ipv4Match[0].startsWith('10.') ||
            ipv4Match[0].startsWith('192.168.') ||
            ipv4Match[0].startsWith('172.')
          ) {
            localIPs.push(ipv4Match[0]);
          }
        }

        // Extract IPv6 addresses (link-local fe80::)
        const ipv6Match = candidate.match(/fe80:(?::[a-f0-9]{1,4}){0,4}%[0-9a-z]+/i);
        if (ipv6Match && !localIPs.includes(ipv6Match[0])) {
          localIPs.push(ipv6Match[0]);
        }
      };
    });

    pc.close();
    return { localIPs, supported: true };
  } catch {
    return { localIPs: [], supported: true };
  }
}

// ============================================
// CSS Media Preferences Detection
// ============================================

/**
 * Detect all CSS media query preferences
 */
export function getCSSPreferences(): {
  prefersColorScheme: string;
  prefersReducedMotion: boolean;
  prefersReducedTransparency: boolean;
  prefersContrast: string;
  forcedColors: boolean;
  colorGamut: string;
  hdrSupported: boolean;
  invertedColors: boolean;
} {
  const getMediaQuery = (query: string): boolean => {
    try {
      return window.matchMedia(query).matches;
    } catch {
      return false;
    }
  };

  let colorScheme = 'no-preference';
  if (getMediaQuery('(prefers-color-scheme: dark)')) colorScheme = 'dark';
  else if (getMediaQuery('(prefers-color-scheme: light)')) colorScheme = 'light';

  let contrast = 'no-preference';
  if (getMediaQuery('(prefers-contrast: more)')) contrast = 'more';
  else if (getMediaQuery('(prefers-contrast: less)')) contrast = 'less';
  else if (getMediaQuery('(prefers-contrast: custom)')) contrast = 'custom';

  let colorGamut = 'srgb';
  if (getMediaQuery('(color-gamut: rec2020)')) colorGamut = 'rec2020';
  else if (getMediaQuery('(color-gamut: p3)')) colorGamut = 'p3';

  return {
    prefersColorScheme: colorScheme,
    prefersReducedMotion: getMediaQuery('(prefers-reduced-motion: reduce)'),
    prefersReducedTransparency: getMediaQuery('(prefers-reduced-transparency: reduce)'),
    prefersContrast: contrast,
    forcedColors: getMediaQuery('(forced-colors: active)'),
    colorGamut,
    hdrSupported: getMediaQuery('(dynamic-range: high)'),
    invertedColors: getMediaQuery('(inverted-colors: inverted)'),
  };
}

// ============================================
// Hardware Family Detection
// ============================================

/**
 * Infer device/hardware family from user agent and platform
 */
export function getHardwareFamily(): string | null {
  const ua = navigator.userAgent;
  const platform = navigator.platform;

  if (ua.includes('iPhone')) return 'iPhone';
  if (ua.includes('iPad')) return 'iPad';
  if (ua.includes('Mac')) return 'Mac';
  if (ua.includes('Android')) {
    if (ua.includes('Mobile')) return 'Android Phone';
    return 'Android Tablet';
  }
  if (platform.includes('Win')) return 'Windows PC';
  if (platform.includes('Linux')) return 'Linux PC';
  if (ua.includes('CrOS')) return 'Chromebook';

  return null;
}

// ============================================
// VPN Detection
// ============================================

/**
 * Detect potential VPN/Proxy usage via multiple signals
 */
export async function detectVPN(
  serverTimezone?: string,
  webrtcLocalIPs?: string[]
): Promise<{
  likelyUsingVPN: boolean;
  timezoneMismatch: boolean;
  webrtcLeak: boolean;
}> {
  const result = {
    likelyUsingVPN: false,
    timezoneMismatch: false,
    webrtcLeak: false,
  };

  // Check timezone mismatch
  const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (serverTimezone && serverTimezone !== clientTimezone) {
    result.timezoneMismatch = true;
    result.likelyUsingVPN = true;
  }

  // Check WebRTC leak (private IPs exposed while using VPN suggests a leak)
  if (webrtcLocalIPs && webrtcLocalIPs.length > 0) {
    result.webrtcLeak = true;
  }

  return result;
}

// ============================================
// Installed Apps Detection (Protocol Handlers)
// ============================================

/**
 * Detect installed apps via protocol handlers
 * Websites can detect what apps you have installed by testing protocols
 */
export async function detectInstalledApps(): Promise<string[]> {
  const detected: string[] = [];

  // Check for common app-injected window globals
  const win = window as Window & {
    __SPOTIFY_BRIDGE__?: unknown;
    __DISCORD_BRIDGE__?: unknown;
    __zoom_bridge__?: unknown;
  };

  if (win.__SPOTIFY_BRIDGE__) detected.push('Spotify');
  if (win.__DISCORD_BRIDGE__) detected.push('Discord');
  if (win.__zoom_bridge__) detected.push('Zoom');

  return detected;
}

// ============================================
// Browser Extension Detection
// ============================================

/**
 * Detect common browser extensions via DOM/globals
 * Extensions typically inject globals, DOM elements, or modify the page
 */
export function detectExtensions(): string[] {
  const detected: string[] = [];
  const win = window as any;

  const checks: Array<{ name: string; check: () => boolean }> = [
    // ============================================
    // PASSWORD MANAGERS (High value - indicates security awareness)
    // ============================================
    {
      name: 'LastPass',
      check: () => !!document.querySelector('[data-lastpass-root]') ||
                   !!win.__LASTPASS_EXTENSION_LOADED__ ||
                   !!document.querySelector('[id^="__lpform"]')
    },
    {
      name: '1Password',
      check: () => !!document.querySelector('[data-onepassword-extension]') ||
                   !!document.querySelector('[data-com-onepassword-version]') ||
                   !!win.OnePasswordExtension
    },
    {
      name: 'Bitwarden',
      check: () => !!document.querySelector('[data-bwautofill]') ||
                   !!document.querySelector('bitwarden-page-icon')
    },
    {
      name: 'Dashlane',
      check: () => !!document.querySelector('[data-dashlanecreated]') ||
                   !!document.querySelector('[id^="dashlane"]')
    },
    {
      name: 'NordPass',
      check: () => !!document.querySelector('[data-nordpass]') ||
                   !!document.querySelector('nordpass-root')
    },
    {
      name: 'Keeper',
      check: () => !!document.querySelector('[data-keeper]') ||
                   !!win.KeeperBrowserAgent
    },
    {
      name: 'RoboForm',
      check: () => !!document.querySelector('[data-rf-autofill]') ||
                   !!win.roboformShown
    },
    
    // ============================================
    // DEVELOPER TOOLS (Strong signal for developers)
    // ============================================
    {
      name: 'React DevTools',
      check: () => !!win.__REACT_DEVTOOLS_GLOBAL_HOOK__
    },
    {
      name: 'Vue DevTools',
      check: () => !!win.__VUE_DEVTOOLS_GLOBAL_HOOK__
    },
    {
      name: 'Redux DevTools',
      check: () => !!win.__REDUX_DEVTOOLS_EXTENSION__ ||
                   !!win.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
    },
    {
      name: 'Angular DevTools',
      check: () => !!win.ng?.probe || !!win.__ANGULAR_DEVTOOLS__
    },
    {
      name: 'Svelte DevTools',
      check: () => !!win.__svelte_devtools_inject_state
    },
    {
      name: 'jQuery',
      check: () => !!win.jQuery || !!win.$?.fn?.jquery
    },
    {
      name: 'Apollo DevTools',
      check: () => !!win.__APOLLO_DEVTOOLS_GLOBAL_HOOK__
    },
    {
      name: 'Wappalyzer',
      check: () => !!document.querySelector('[data-wappalyzer]')
    },
    {
      name: 'Web Developer',
      check: () => !!document.querySelector('[id^="webdeveloper"]')
    },
    {
      name: 'ColorZilla',
      check: () => !!win.ColorZilla || !!document.querySelector('[id^="colorzilla"]')
    },
    {
      name: 'JSON Viewer',
      check: () => !!document.querySelector('.json-formatter-container') ||
                   !!document.querySelector('.json-viewer')
    },
    
    // ============================================
    // WRITING & PRODUCTIVITY
    // ============================================
    {
      name: 'Grammarly',
      check: () => !!document.querySelector('grammarly-desktop-integration') ||
                   !!document.querySelector('[data-grammarly-shadow-root]') ||
                   !!document.querySelector('grammarly-extension') ||
                   !!win.Grammarly
    },
    {
      name: 'LanguageTool',
      check: () => !!document.querySelector('[data-lt-installed]') ||
                   !!document.querySelector('lt-highlighter')
    },
    {
      name: 'ProWritingAid',
      check: () => !!document.querySelector('[data-pwa-id]')
    },
    {
      name: 'Notion Web Clipper',
      check: () => !!document.querySelector('[data-notion-clipper]')
    },
    {
      name: 'Evernote Web Clipper',
      check: () => !!document.querySelector('#evernoteWebClipper') ||
                   !!win.EVERNOTE_CLIP
    },
    {
      name: 'Todoist',
      check: () => !!document.querySelector('[data-todoist]') ||
                   !!win.TODOIST_EXTENSION
    },
    
    // ============================================
    // SHOPPING & DEALS (Indicates shopping behavior)
    // ============================================
    {
      name: 'Honey',
      check: () => !!document.querySelector('[data-honey-container]') ||
                   !!document.querySelector('[id^="honey-"]') ||
                   !!win.__HONEY_EXTENSION__
    },
    {
      name: 'Rakuten (Ebates)',
      check: () => !!document.querySelector('[data-rakuten]') ||
                   !!document.querySelector('[id^="ebates"]')
    },
    {
      name: 'Capital One Shopping',
      check: () => !!document.querySelector('[data-wikibuy]')
    },
    {
      name: 'RetailMeNot',
      check: () => !!document.querySelector('[data-retailmenot]')
    },
    {
      name: 'Keepa',
      check: () => !!document.querySelector('[id^="keepa"]') ||
                   !!win.keepa
    },
    {
      name: 'CamelCamelCamel',
      check: () => !!document.querySelector('[id^="camelcamelcamel"]')
    },
    
    // ============================================
    // AD BLOCKERS & PRIVACY (Strong privacy signal)
    // ============================================
    {
      name: 'uBlock Origin',
      check: () => !!document.getElementById('ublock-origin') ||
                   !!win.uBlocked
    },
    {
      name: 'AdBlock',
      check: () => !!document.getElementById('adblock') ||
                   !!win.adblock
    },
    {
      name: 'AdBlock Plus',
      check: () => !!document.getElementById('adblockplus')
    },
    {
      name: 'Privacy Badger',
      check: () => !!win.PrivacyBadger
    },
    {
      name: 'Ghostery',
      check: () => !!document.querySelector('[data-ghostery]') ||
                   !!win.Ghostery
    },
    {
      name: 'HTTPS Everywhere',
      check: () => !!win.HTTPS_EVERYWHERE
    },
    {
      name: 'DuckDuckGo Privacy',
      check: () => !!document.querySelector('[data-ddg-extension]')
    },
    
    // ============================================
    // VPN EXTENSIONS
    // ============================================
    {
      name: 'NordVPN',
      check: () => !!document.querySelector('[data-nordvpn]')
    },
    {
      name: 'ExpressVPN',
      check: () => !!document.querySelector('[data-expressvpn]')
    },
    {
      name: 'Windscribe',
      check: () => !!document.querySelector('[data-windscribe]')
    },
    
    // ============================================
    // SOCIAL & COMMUNICATION
    // ============================================
    {
      name: 'Buffer',
      check: () => !!document.querySelector('[data-buffer-extension]')
    },
    {
      name: 'Pocket',
      check: () => !!document.querySelector('[data-pocket]') ||
                   !!win.PKT_EXT
    },
    {
      name: 'Save to Google Drive',
      check: () => !!document.querySelector('[data-google-drive-save]')
    },
    
    // ============================================
    // SCREENSHOT & RECORDING
    // ============================================
    {
      name: 'Loom',
      check: () => !!document.querySelector('[data-loom]') ||
                   !!win.loom
    },
    {
      name: 'Awesome Screenshot',
      check: () => !!win.awesomeScreenshot
    },
    {
      name: 'Lightshot',
      check: () => !!document.querySelector('[data-lightshot]')
    },
    
    // ============================================
    // ACCESSIBILITY
    // ============================================
    {
      name: 'Dark Reader',
      check: () => !!document.querySelector('meta[name="darkreader"]') ||
                   !!document.querySelector('.darkreader') ||
                   !!win.__darkreader__
    },
    {
      name: 'High Contrast',
      check: () => !!document.querySelector('[data-high-contrast]')
    },
    
    // ============================================
    // MISC POPULAR EXTENSIONS
    // ============================================
    {
      name: 'Google Translate',
      check: () => !!document.querySelector('#goog-gt-tt') ||
                   !!win.google?.translate
    },
    {
      name: 'Momentum',
      check: () => !!document.querySelector('[data-momentum]')
    },
    {
      name: 'Stylus/Stylish',
      check: () => !!document.querySelector('[data-stylus]') ||
                   !!win.stylish
    },
    {
      name: 'Tampermonkey/Violentmonkey',
      check: () => !!win.GM_info || !!win.GM
    },
  ];

  for (const { name, check } of checks) {
    try {
      if (check()) detected.push(name);
    } catch {
      // Ignore errors from extension detection
    }
  }

  return detected;
}

/**
 * Canvas fingerprint - renders text and shapes, then hashes the result
 */
export function getCanvasFingerprint(): string | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Draw text with various styles
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Fingerprint', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Canvas', 4, 17);

    // Draw some shapes
    ctx.beginPath();
    ctx.arc(50, 25, 15, 0, Math.PI * 2);
    ctx.fillStyle = '#f00';
    ctx.fill();

    // Get data URL and hash it
    const dataUrl = canvas.toDataURL();
    return simpleHash(dataUrl);
  } catch {
    return null;
  }
}

/**
 * Audio fingerprint - uses AudioContext oscillator
 */
export async function getAudioFingerprint(): Promise<string | null> {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const analyser = audioContext.createAnalyser();
    const gainNode = audioContext.createGain();
    const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);

    gainNode.gain.value = 0; // Mute
    oscillator.type = 'triangle';
    oscillator.frequency.value = 10000;

    oscillator.connect(analyser);
    analyser.connect(scriptProcessor);
    scriptProcessor.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start(0);

    return new Promise((resolve) => {
      scriptProcessor.onaudioprocess = (e) => {
        const output = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < output.length; i++) {
          sum += Math.abs(output[i]);
        }
        oscillator.disconnect();
        scriptProcessor.disconnect();
        audioContext.close();
        resolve(simpleHash(sum.toString()));
      };

      // Timeout fallback
      setTimeout(() => {
        try {
          oscillator.disconnect();
          scriptProcessor.disconnect();
          audioContext.close();
        } catch {}
        resolve(simpleHash('audio-timeout'));
      }, 500);
    });
  } catch {
    return null;
  }
}

/**
 * WebGL fingerprint - captures renderer info and parameters
 */
export function getWebGLFingerprint(): { hash: string | null; version: string | null; extensions: number } {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl || !(gl instanceof WebGLRenderingContext)) {
      return { hash: null, version: null, extensions: 0 };
    }

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const data: string[] = [];

    // Collect various WebGL parameters
    data.push(gl.getParameter(gl.VERSION) || '');
    data.push(gl.getParameter(gl.SHADING_LANGUAGE_VERSION) || '');
    data.push(gl.getParameter(gl.VENDOR) || '');
    data.push(gl.getParameter(gl.RENDERER) || '');

    if (debugInfo) {
      data.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '');
      data.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '');
    }

    // Get supported extensions
    const extensions = gl.getSupportedExtensions() || [];
    data.push(extensions.join(','));

    // Get max values
    data.push(String(gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS)));
    data.push(String(gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE)));
    data.push(String(gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS)));
    data.push(String(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)));
    data.push(String(gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)));
    data.push(String(gl.getParameter(gl.MAX_TEXTURE_SIZE)));
    data.push(String(gl.getParameter(gl.MAX_VARYING_VECTORS)));
    data.push(String(gl.getParameter(gl.MAX_VERTEX_ATTRIBS)));
    data.push(String(gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS)));
    data.push(String(gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS)));

    const version = gl.getParameter(gl.VERSION);

    return {
      hash: simpleHash(data.join('|')),
      version: version,
      extensions: extensions.length,
    };
  } catch {
    return { hash: null, version: null, extensions: 0 };
  }
}

/**
 * Detect installed fonts by measuring text width
 */
export function detectFonts(): number {
  const baseFonts = ['monospace', 'sans-serif', 'serif'];
  const testFonts = [
    'Arial', 'Arial Black', 'Arial Narrow', 'Arial Rounded MT Bold',
    'Bookman Old Style', 'Bradley Hand ITC', 'Century', 'Century Gothic',
    'Comic Sans MS', 'Courier', 'Courier New', 'Georgia', 'Gentium',
    'Impact', 'King', 'Lucida Console', 'Lalit', 'Modena', 'Monotype Corsiva',
    'Papyrus', 'Tahoma', 'TeX', 'Times', 'Times New Roman', 'Trebuchet MS',
    'Verdana', 'Verona', 'Roboto', 'Open Sans', 'Segoe UI', 'Consolas',
    'Monaco', 'Fira Code', 'JetBrains Mono', 'Source Code Pro', 'Menlo',
    'SF Pro', 'SF Mono', 'Helvetica', 'Helvetica Neue'
  ];

  const testString = 'mmmmmmmmmmlli';
  const testSize = '72px';
  
  const h = document.getElementsByTagName('body')[0];
  const s = document.createElement('span');
  s.style.fontSize = testSize;
  s.textContent = testString;
  s.style.position = 'absolute';
  s.style.left = '-9999px';
  s.style.visibility = 'hidden';
  
  const baseMeasurements: { [key: string]: number } = {};
  
  for (const baseFont of baseFonts) {
    s.style.fontFamily = baseFont;
    h.appendChild(s);
    baseMeasurements[baseFont] = s.offsetWidth;
    h.removeChild(s);
  }
  
  let detected = 0;
  
  for (const font of testFonts) {
    let detected_font = false;
    for (const baseFont of baseFonts) {
      s.style.fontFamily = `'${font}', ${baseFont}`;
      h.appendChild(s);
      const matched = s.offsetWidth !== baseMeasurements[baseFont];
      h.removeChild(s);
      if (matched) {
        detected_font = true;
        break;
      }
    }
    if (detected_font) detected++;
  }
  
  return detected;
}

/**
 * Get speech synthesis voices fingerprint
 */
export function getSpeechVoicesFingerprint(): Promise<{ count: number; hash: string | null }> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve({ count: 0, hash: null });
      return;
    }

    const getVoices = () => {
      const voices = speechSynthesis.getVoices();
      if (voices.length === 0) {
        resolve({ count: 0, hash: null });
        return;
      }
      const voiceData = voices.map(v => `${v.name}|${v.lang}|${v.localService}`).join(',');
      resolve({
        count: voices.length,
        hash: simpleHash(voiceData),
      });
    };

    // Try immediately
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      getVoices();
      return;
    }

    // Wait for voices to load
    speechSynthesis.onvoiceschanged = getVoices;
    
    // Timeout
    setTimeout(() => {
      speechSynthesis.onvoiceschanged = null;
      getVoices();
    }, 1000);
  });
}

/**
 * Math fingerprint - some browsers return slightly different results
 */
export function getMathFingerprint(): string {
  const mathData = [
    Math.tan(-1e300),
    Math.sin(1),
    Math.cos(1),
    Math.atan2(1, 2),
    Math.pow(Math.PI, -100),
    Math.acos(0.123456789),
    Math.acosh(1e10),
    Math.asinh(1),
    Math.atanh(0.5),
    Math.cbrt(100),
    Math.cosh(1),
    Math.expm1(1),
    Math.log1p(10),
    Math.sinh(1),
    Math.tanh(1),
  ];
  return simpleHash(mathData.join('|'));
}

/**
 * Timing fingerprint - measure execution times
 */
export function getTimingFingerprint(): string {
  const iterations = 10000;
  const timings: number[] = [];

  // Math operations timing
  const start1 = performance.now();
  for (let i = 0; i < iterations; i++) {
    Math.sqrt(i);
  }
  timings.push(performance.now() - start1);

  // String operations timing
  const start2 = performance.now();
  for (let i = 0; i < iterations; i++) {
    'test'.charCodeAt(0);
  }
  timings.push(performance.now() - start2);

  // Array operations timing
  const start3 = performance.now();
  const arr: number[] = [];
  for (let i = 0; i < 1000; i++) {
    arr.push(i);
  }
  timings.push(performance.now() - start3);

  // Normalize and hash (round to reduce variance)
  const normalized = timings.map(t => Math.round(t * 10));
  return simpleHash(normalized.join('|'));
}

/**
 * Error fingerprint - different browsers have different error messages
 */
export function getErrorFingerprint(): string {
  const errors: string[] = [];

  try {
    // @ts-ignore - intentional error
    null.toString();
  } catch (e: any) {
    errors.push(e.message || '');
  }

  try {
    // @ts-ignore - intentional error
    undefined.x;
  } catch (e: any) {
    errors.push(e.message || '');
  }

  try {
    JSON.parse('{invalid');
  } catch (e: any) {
    errors.push(e.message || '');
  }

  return simpleHash(errors.join('|'));
}

/**
 * Count navigator properties
 */
export function countNavigatorProps(): number {
  let count = 0;
  for (const _key in navigator) {
    count++;
  }
  return count;
}

/**
 * Count window properties
 */
export function countWindowProps(): number {
  let count = 0;
  for (const _key in window) {
    count++;
  }
  return count;
}

/**
 * Detect video codecs support
 */
export function detectVideoCodecs(): string[] {
  const video = document.createElement('video');
  const codecs: string[] = [];
  
  const codecTests = [
    { name: 'H.264', type: 'video/mp4; codecs="avc1.42E01E"' },
    { name: 'H.264 Main', type: 'video/mp4; codecs="avc1.4D401E"' },
    { name: 'H.264 High', type: 'video/mp4; codecs="avc1.64001E"' },
    { name: 'H.265/HEVC', type: 'video/mp4; codecs="hev1.1.6.L93.B0"' },
    { name: 'VP8', type: 'video/webm; codecs="vp8"' },
    { name: 'VP9', type: 'video/webm; codecs="vp9"' },
    { name: 'AV1', type: 'video/mp4; codecs="av01.0.05M.08"' },
    { name: 'Theora', type: 'video/ogg; codecs="theora"' },
  ];

  for (const codec of codecTests) {
    if (video.canPlayType(codec.type)) {
      codecs.push(codec.name);
    }
  }

  return codecs;
}

/**
 * Detect audio codecs support
 */
export function detectAudioCodecs(): string[] {
  const audio = document.createElement('audio');
  const codecs: string[] = [];
  
  const codecTests = [
    { name: 'AAC', type: 'audio/mp4; codecs="mp4a.40.2"' },
    { name: 'MP3', type: 'audio/mpeg' },
    { name: 'Opus', type: 'audio/ogg; codecs="opus"' },
    { name: 'Vorbis', type: 'audio/ogg; codecs="vorbis"' },
    { name: 'FLAC', type: 'audio/flac' },
    { name: 'WAV', type: 'audio/wav' },
    { name: 'AC-3', type: 'audio/ac3' },
  ];

  for (const codec of codecTests) {
    if (audio.canPlayType(codec.type)) {
      codecs.push(codec.name);
    }
  }

  return codecs;
}

/**
 * Detect DRM support
 */
export async function detectDRM(): Promise<{ widevine: boolean; fairplay: boolean; playready: boolean }> {
  const result = { widevine: false, fairplay: false, playready: false };

  if (!navigator.requestMediaKeySystemAccess) {
    return result;
  }

  const config = [{
    initDataTypes: ['cenc'],
    videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }],
  }];

  try {
    await navigator.requestMediaKeySystemAccess('com.widevine.alpha', config);
    result.widevine = true;
  } catch {}

  try {
    await navigator.requestMediaKeySystemAccess('com.apple.fps.1_0', config);
    result.fairplay = true;
  } catch {}

  try {
    await navigator.requestMediaKeySystemAccess('com.microsoft.playready', config);
    result.playready = true;
  } catch {}

  return result;
}

/**
 * Get WebAssembly fingerprint
 */
export function getWasmFingerprint(): { features: string[]; maxMemory: number | null; hash: string | null } {
  if (typeof WebAssembly === 'undefined') {
    return { features: [], maxMemory: null, hash: null };
  }

  const features: string[] = [];
  
  // Check various WASM features
  if ('instantiateStreaming' in WebAssembly) features.push('Streaming Compilation');
  if ('compileStreaming' in WebAssembly) features.push('Streaming Compile');
  if ('validate' in WebAssembly) features.push('Validation');
  
  // Feature detection via feature-detect APIs
  try {
    // @ts-ignore
    if (WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,10,9,1,7,0,18,0,11,0,11]))) {
      features.push('Tail Call');
    }
  } catch {}

  try {
    // Bulk memory operations
    // @ts-ignore
    if (WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,5,3,1,0,1,10,14,1,12,0,65,0,65,0,65,0,252,10,0,0,11]))) {
      features.push('Bulk Memory');
    }
  } catch {}

  // Try to detect max memory
  let maxMemory: number | null = null;
  try {
    new WebAssembly.Memory({ initial: 1, maximum: 65536 });
    maxMemory = 65536 * 64 / 1024; // Convert to MB
  } catch {
    try {
      new WebAssembly.Memory({ initial: 1, maximum: 32768 });
      maxMemory = 32768 * 64 / 1024;
    } catch {
      maxMemory = 256;
    }
  }

  const hash = simpleHash(features.join('|') + maxMemory);

  return { features, maxMemory, hash };
}

/**
 * Get WebGPU fingerprint
 */
export async function getWebGPUFingerprint(): Promise<{
  available: boolean;
  vendor: string | null;
  architecture: string | null;
  device: string | null;
  fallbackAdapter: boolean;
  featureCount: number;
  keyFeatures: string[];
  canvasFormat: string | null;
  computeTiming: number | null;
  timingPattern: string | null;
  hash: string | null;
}> {
  const result = {
    available: false,
    vendor: null as string | null,
    architecture: null as string | null,
    device: null as string | null,
    fallbackAdapter: false,
    featureCount: 0,
    keyFeatures: [] as string[],
    canvasFormat: null as string | null,
    computeTiming: null as number | null,
    timingPattern: null as string | null,
    hash: null as string | null,
  };

  if (!('gpu' in navigator)) {
    return result;
  }

  try {
    // @ts-ignore
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return result;

    result.available = true;
    // @ts-ignore - isFallbackAdapter may not be in types
    result.fallbackAdapter = adapter.isFallbackAdapter || false;

    // Get adapter info
    // @ts-ignore
    const info = await adapter.requestAdapterInfo?.();
    if (info) {
      result.vendor = info.vendor || null;
      result.architecture = info.architecture || null;
      result.device = info.device || null;
    }

    // Get features
    const features = [...adapter.features];
    result.featureCount = features.length;
    result.keyFeatures = features.slice(0, 10);

    // Get preferred canvas format
    // @ts-ignore
    result.canvasFormat = navigator.gpu.getPreferredCanvasFormat?.() || null;

    // Simple compute timing test
    try {
      const device = await adapter.requestDevice();
      const start = performance.now();
      
      // Create a simple compute shader
      const module = device.createShaderModule({
        code: `@compute @workgroup_size(64) fn main() {}`
      });
      
      const pipeline = device.createComputePipeline({
        layout: 'auto',
        compute: { module, entryPoint: 'main' }
      });

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.dispatchWorkgroups(1);
      pass.end();
      
      device.queue.submit([encoder.finish()]);
      await device.queue.onSubmittedWorkDone();
      
      result.computeTiming = performance.now() - start;
      result.timingPattern = simpleHash(Math.round(result.computeTiming * 100).toString());
      
      device.destroy();
    } catch {}

    // Generate hash
    const hashData = [
      result.vendor,
      result.architecture,
      result.featureCount,
      result.canvasFormat,
      result.timingPattern,
    ].filter(Boolean).join('|');
    
    result.hash = simpleHash(hashData);

  } catch {}

  return result;
}

/**
 * Detect if running in headless browser
 */
export function detectHeadless(): boolean {
  const indicators: boolean[] = [];

  // Check navigator.webdriver
  indicators.push(!!(navigator as any).webdriver);

  // Check for phantom properties
  indicators.push(!!(window as any).__nightmare);
  indicators.push(!!(window as any)._phantom);
  indicators.push(!!(window as any).phantom);
  indicators.push(!!(window as any).callPhantom);

  // Check for selenium
  indicators.push(!!(window as any)._selenium);
  indicators.push(!!(window as any)._Selenium_IDE_Recorder);
  indicators.push(!!document.getElementsByClassName('selenium-test').length);

  // Check for puppeteer/playwright
  indicators.push(!!(window as any).__puppeteer_evaluation_script__);
  indicators.push(!!(navigator as any).webdriver);

  // Check window dimensions (headless often has specific sizes)
  indicators.push(window.outerWidth === 0 || window.outerHeight === 0);

  // Check plugins
  indicators.push(navigator.plugins.length === 0);

  // Check languages
  indicators.push(navigator.languages.length === 0);

  // Chrome headless specific
  indicators.push(/HeadlessChrome/.test(navigator.userAgent));

  return indicators.filter(Boolean).length >= 2;
}

/**
 * Detect if running in automation
 */
export function detectAutomation(): boolean {
  const signs: boolean[] = [];

  // webdriver flag
  signs.push(!!(navigator as any).webdriver);

  // Common automation properties
  signs.push(!!(window as any).domAutomation);
  signs.push(!!(window as any).domAutomationController);

  // Cdc_ properties (Chromedriver)
  for (const key in window) {
    if (key.match(/^cdc_/)) {
      signs.push(true);
      break;
    }
  }

  // Check document properties
  signs.push(!!(document as any).$cdc_asdjflasutopfhvcZLmcfl_);
  signs.push(!!(document as any).$chrome_asyncScriptInfo);

  return signs.filter(Boolean).length >= 1;
}

/**
 * Detect Virtual Machine
 */
export function detectVM(): boolean {
  const indicators: boolean[] = [];

  // Check GPU for VM strings
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        if (renderer) {
          const vmKeywords = ['VMware', 'VirtualBox', 'Parallels', 'Hyper-V', 'QEMU', 'Virtual'];
          indicators.push(vmKeywords.some(kw => renderer.toLowerCase().includes(kw.toLowerCase())));
        }
      }
    }
  } catch {}

  // Note: Screen resolution checks (800x600, 1024x768, etc.) aren't reliable alone for VM detection

  // Check for very low hardware specs
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) {
    indicators.push(true);
  }

  return indicators.filter(Boolean).length >= 1;
}

/**
 * Detect ad blocker
 */
export async function detectAdBlocker(): Promise<boolean> {
  // Method 1: Try to load a fake ad
  const testAd = document.createElement('div');
  testAd.textContent = '\u00a0';
  testAd.className = 'adsbox ad-banner pub_300x250 pub_300x250m pub_728x90 text-ad textAd text_ad text_ads text-ads text-ad-links';
  testAd.style.cssText = 'width: 1px !important; height: 1px !important; position: absolute !important; left: -10000px !important; top: -1000px !important;';
  
  document.body.appendChild(testAd);
  
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const blocked = testAd.offsetHeight === 0 || 
                  testAd.offsetParent === null || 
                  getComputedStyle(testAd).display === 'none';
  
  document.body.removeChild(testAd);

  return blocked;
}

/**
 * Detect incognito mode (various heuristics)
 */
export async function detectIncognito(): Promise<boolean> {
  // Method 1: Storage quota (Chrome)
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const { quota } = await navigator.storage.estimate();
      // In incognito, quota is usually much smaller
      if (quota && quota < 120000000) {
        return true;
      }
    } catch {}
  }

  // Method 2: FileSystem API (older Chrome)
  try {
    // @ts-ignore
    if (window.webkitRequestFileSystem) {
      return new Promise((resolve) => {
        // @ts-ignore
        window.webkitRequestFileSystem(
          // @ts-ignore
          window.TEMPORARY,
          100,
          () => resolve(false),
          () => resolve(true)
        );
      });
    }
  } catch {}

  // Method 3: IndexedDB (Firefox)
  try {
    const db = indexedDB.open('test');
    db.onerror = () => true;
  } catch {
    return true;
  }

  return false;
}

/**
 * Detect DevTools open
 */
export function detectDevTools(): boolean {
  const threshold = 160;
  
  // Method 1: Window size difference
  const widthThreshold = window.outerWidth - window.innerWidth > threshold;
  const heightThreshold = window.outerHeight - window.innerHeight > threshold;
  
  if (widthThreshold || heightThreshold) {
    return true;
  }

  // Method 2: Firebug detection
  if ((window as any).Firebug && (window as any).Firebug.chrome && (window as any).Firebug.chrome.isInitialized) {
    return true;
  }

  return false;
}

/**
 * Detect social login status and online presence
 * Uses multiple detection methods including:
 * - Window globals injected by social SDKs
 * - DOM elements added by social widgets
 * - Referrer analysis
 * - localStorage patterns from OAuth flows
 * 
 * NOTE: Third-party cookie detection doesn't work due to browser security.
 * We rely on signals that ARE accessible cross-origin.
 */
export function detectSocialLogins(): { google: boolean; facebook: boolean; twitter: boolean; github: boolean; reddit: boolean } {
  const result = {
    google: false,
    facebook: false,
    twitter: false,
    github: false,
    reddit: false,
  };

  const win = window as Window & {
    // Google
    gapi?: { auth2?: unknown };
    google?: { accounts?: unknown };
    googlefc?: unknown;
    __GOOGLE_RECAPTCHA_CLIENT?: boolean;
    // Facebook  
    FB?: { api?: unknown };
    fbAsyncInit?: unknown;
    // Twitter
    twttr?: unknown;
    __twttr?: unknown;
    // GitHub
    Octokit?: unknown;
  };

  // ============================================
  // METHOD 1: Check for social SDK globals
  // These get injected when users have social widgets/login on visited pages
  // ============================================
  
  // Google - gapi (Google API) or new Google Identity Services
  if (win.gapi?.auth2 || win.google?.accounts || win.googlefc) {
    result.google = true;
  }
  
  // Facebook SDK
  if (win.FB?.api || win.fbAsyncInit) {
    result.facebook = true;
  }
  
  // Twitter widgets
  if (win.twttr || win.__twttr) {
    result.twitter = true;
  }
  
  // GitHub (Octokit library)
  if (win.Octokit) {
    result.github = true;
  }

  // ============================================
  // METHOD 2: Check referrer for social platforms
  // If user came from a social site, they're likely logged in there
  // ============================================
  const referrer = document.referrer.toLowerCase();
  
  if (referrer.includes('google.com') || referrer.includes('youtube.com') || referrer.includes('accounts.google')) {
    result.google = true;
  }
  if (referrer.includes('facebook.com') || referrer.includes('fb.com') || referrer.includes('messenger.com')) {
    result.facebook = true;
  }
  if (referrer.includes('twitter.com') || referrer.includes('x.com') || referrer.includes('t.co')) {
    result.twitter = true;
  }
  if (referrer.includes('github.com') || referrer.includes('githubusercontent.com')) {
    result.github = true;
  }
  if (referrer.includes('reddit.com') || referrer.includes('redd.it')) {
    result.reddit = true;
  }

  // ============================================
  // METHOD 3: Check for social login buttons/iframes
  // Many sites have "Login with Google/Facebook" that inject elements
  // ============================================
  try {
    // Google Sign-In elements
    if (document.querySelector('[data-client_id*="googleusercontent.com"]') ||
        document.querySelector('.g_id_signin') ||
        document.querySelector('#g_a11y_announcement') ||
        document.querySelector('iframe[src*="accounts.google.com"]')) {
      result.google = true;
    }
    
    // Facebook Login elements
    if (document.querySelector('.fb-login-button') ||
        document.querySelector('[data-appid]') ||
        document.querySelector('iframe[src*="facebook.com/plugins"]')) {
      result.facebook = true;
    }
    
    // Twitter embed elements  
    if (document.querySelector('.twitter-share-button') ||
        document.querySelector('iframe[src*="platform.twitter.com"]')) {
      result.twitter = true;
    }
    
    // GitHub elements
    if (document.querySelector('[href*="github.com/login"]') ||
        document.querySelector('.github-button')) {
      result.github = true;
    }
  } catch {}

  // ============================================
  // METHOD 4: IndexedDB database names
  // Some OAuth flows store data in IndexedDB
  // ============================================
  if (typeof indexedDB !== 'undefined' && indexedDB.databases) {
    indexedDB.databases().then(databases => {
      for (const db of databases) {
        const name = (db.name || '').toLowerCase();
        if (name.includes('firebase') || name.includes('google')) {
          result.google = true;
        }
      }
    }).catch((e: unknown) => { console.debug('[fingerprint] indexedDB.databases error', e); });
  }

  return result;
}

/**
 * Detect crypto wallets (extended detection)
 */
export function detectCryptoWallets(): {
  phantom: boolean;
  metamask: boolean;
  coinbase: boolean;
  braveWallet: boolean;
  trustWallet: boolean;
  binanceWallet: boolean;
  solflare: boolean;
  tronLink: boolean;
  hasAnyWallet: boolean;
} {
  const win = window as Window & {
    ethereum?: { isMetaMask?: boolean; isCoinbaseWallet?: boolean; isBraveWallet?: boolean };
    solana?: { isPhantom?: boolean };
    phantom?: { solana?: unknown };
    coinbaseWalletExtension?: unknown;
    trustwallet?: unknown;
    BinanceChain?: unknown;
    solflare?: unknown;
    tronWeb?: unknown;
    tronLink?: unknown;
  };

  const result = {
    phantom: !!(win.phantom?.solana || win.solana?.isPhantom),
    metamask: !!win.ethereum?.isMetaMask,
    coinbase: !!(win.ethereum?.isCoinbaseWallet || win.coinbaseWalletExtension),
    braveWallet: !!win.ethereum?.isBraveWallet,
    trustWallet: !!win.trustwallet,
    binanceWallet: !!win.BinanceChain,
    solflare: !!win.solflare,
    tronLink: !!(win.tronWeb || win.tronLink),
    hasAnyWallet: false,
  };

  result.hasAnyWallet = Object.values(result).some(v => v === true);

  return result;
}

/**
 * Generate a cross-browser fingerprint ID
 * Uses only hardware/system characteristics that stay same across browsers
 */
export function generateCrossBrowserId(): { id: string; factors: string[] } {
  const factors: string[] = [];
  const components: string[] = [];

  // Screen characteristics (same across browsers)
  components.push(`${window.screen.width}x${window.screen.height}`);
  factors.push(`Screen: ${window.screen.width}x${window.screen.height}`);

  components.push(`${window.screen.colorDepth}`);
  factors.push(`Color Depth: ${window.screen.colorDepth}-bit`);

  components.push(`${window.devicePixelRatio}`);
  factors.push(`Pixel Ratio: ${window.devicePixelRatio}x`);

  // Hardware (same across browsers)
  components.push(`${navigator.hardwareConcurrency}`);
  factors.push(`CPU Cores: ${navigator.hardwareConcurrency}`);

  const deviceMem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (deviceMem) {
    components.push(`${deviceMem}`);
    factors.push(`RAM: ${deviceMem}GB`);
  }

  // Timezone (same across browsers)
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  components.push(tz);
  factors.push(`Timezone: ${tz}`);

  // Language (usually same)
  components.push(navigator.language);
  factors.push(`Language: ${navigator.language}`);

  // Platform (same across browsers)
  components.push(navigator.platform);
  factors.push(`Platform: ${navigator.platform}`);

  // Max touch points (same hardware)
  components.push(`${navigator.maxTouchPoints}`);
  factors.push(`Touch Points: ${navigator.maxTouchPoints}`);

  // Create hash
  const componentString = components.join('|');
  let hash = 0;
  for (let i = 0; i < componentString.length; i++) {
    const char = componentString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  return {
    id: `xb_${Math.abs(hash).toString(16).padStart(8, '0')}`,
    factors,
  };
}

/**
 * Generate unique fingerprint ID from multiple sources
 */
export function generateFingerprintId(clientInfo: Record<string, unknown>): { id: string; confidence: number } {
  const components = [
    clientInfo.screenWidth,
    clientInfo.screenHeight,
    clientInfo.screenColorDepth,
    clientInfo.devicePixelRatio,
    clientInfo.hardwareConcurrency,
    clientInfo.platform,
    clientInfo.timezone,
    clientInfo.language,
    clientInfo.webglRenderer,
    clientInfo.webglVendor,
    clientInfo.canvasFingerprint,
    clientInfo.audioFingerprint,
    clientInfo.fontsDetected,
    clientInfo.mathFingerprint,
    clientInfo.errorFingerprint,
  ];

  const componentString = components.map((c) => String(c ?? '')).join('|');
  let hash = 0;
  for (let i = 0; i < componentString.length; i++) {
    const char = componentString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  const id = Math.abs(hash).toString(16).padStart(8, '0');

  // Calculate confidence based on how many components we have
  const validComponents = components.filter((c) => c !== null && c !== undefined && c !== '').length;
  const confidence = Math.round((validComponents / components.length) * 100);

  return { id: `fp_${id}`, confidence };
}

/**
 * Check all permissions
 */
export async function checkPermissions(): Promise<{
  geolocation: string;
  notifications: string;
  camera: string;
  microphone: string;
  accelerometer: string;
  gyroscope: string;
  magnetometer: string;
  clipboardRead: string;
  clipboardWrite: string;
}> {
  const result: any = {
    geolocation: 'prompt',
    notifications: 'prompt',
    camera: 'prompt',
    microphone: 'prompt',
    accelerometer: 'prompt',
    gyroscope: 'prompt',
    magnetometer: 'prompt',
    clipboardRead: 'prompt',
    clipboardWrite: 'prompt',
  };

  if (!navigator.permissions) {
    return result;
  }

  const permissionNames = [
    'geolocation',
    'notifications',
    'camera',
    'microphone',
    'accelerometer',
    'gyroscope',
    'magnetometer',
    'clipboard-read',
    'clipboard-write',
  ];

  for (const name of permissionNames) {
    try {
      const perm = await navigator.permissions.query({ name: name as PermissionName });
      const key = name.replace('-', '') as keyof typeof result;
      result[key] = perm.state;
    } catch {
      // Permission not supported
    }
  }

  return result;
}

/**
 * Get media devices count
 */
export async function getMediaDevices(): Promise<{ microphones: number; cameras: number; speakers: number }> {
  const result = { microphones: 0, cameras: 0, speakers: 0 };

  if (!navigator.mediaDevices?.enumerateDevices) {
    return result;
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    for (const device of devices) {
      if (device.kind === 'audioinput') result.microphones++;
      if (device.kind === 'videoinput') result.cameras++;
      if (device.kind === 'audiooutput') result.speakers++;
    }
  } catch {}

  return result;
}

/**
 * Get storage quota
 */
export async function getStorageQuota(): Promise<{ used: number; quota: number; usagePercent: number }> {
  const result = { used: 0, quota: 0, usagePercent: 0 };

  if (!navigator.storage?.estimate) {
    return result;
  }

  try {
    const { usage, quota } = await navigator.storage.estimate();
    result.used = usage || 0;
    result.quota = quota || 0;
    result.usagePercent = quota ? (usage || 0) / quota * 100 : 0;
  } catch {}

  return result;
}

/**
 * Get JS memory info (Chrome only)
 */
export function getJSMemory(): { heapLimit: number | null; totalHeap: number | null; usedHeap: number | null } {
  const result = { heapLimit: null as number | null, totalHeap: null as number | null, usedHeap: null as number | null };
  
  const memory = (performance as any).memory;
  if (memory) {
    result.heapLimit = memory.jsHeapSizeLimit;
    result.totalHeap = memory.totalJSHeapSize;
    result.usedHeap = memory.usedJSHeapSize;
  }

  return result;
}

/**
 * Get client hints (if available)
 */
export async function getClientHints(): Promise<{
  architecture: string | null;
  bitness: string | null;
  mobile: boolean;
  model: string | null;
  platformVersion: string | null;
  browserVersions: string | null;
}> {
  const result = {
    architecture: null as string | null,
    bitness: null as string | null,
    mobile: false,
    model: null as string | null,
    platformVersion: null as string | null,
    browserVersions: null as string | null,
  };

  // @ts-ignore
  if (!navigator.userAgentData) {
    return result;
  }

  try {
    // @ts-ignore
    const uaData = navigator.userAgentData;
    result.mobile = uaData.mobile || false;

    // @ts-ignore
    const highEntropy = await uaData.getHighEntropyValues([
      'architecture',
      'bitness',
      'model',
      'platformVersion',
      'fullVersionList',
    ]);

    result.architecture = highEntropy.architecture || null;
    result.bitness = highEntropy.bitness || null;
    result.model = highEntropy.model || null;
    result.platformVersion = highEntropy.platformVersion || null;
    
    if (highEntropy.fullVersionList) {
      result.browserVersions = highEntropy.fullVersionList
        .map((b: any) => `${b.brand} ${b.version}`)
        .join(', ');
    }
  } catch {}

  return result;
}

/**
 * Detect Chrome built-in AI
 */
export async function detectChromeAI(): Promise<{ supported: boolean; apis: string[] }> {
  const result = { supported: false, apis: [] as string[] };

  // Check for various Chrome AI APIs
  // @ts-ignore
  if (window.ai) {
    result.supported = true;
    result.apis.push('window.ai');
  }

  // @ts-ignore
  if (window.translation) {
    result.apis.push('Translation API');
  }

  // @ts-ignore
  if (navigator.ml) {
    result.apis.push('Navigator ML');
  }

  return result;
}
