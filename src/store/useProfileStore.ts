import { create } from 'zustand';
import { createConsoleEntry } from '../lib/consoleLogger';
import type { ConsoleEntry, LogLevel } from '../lib/consoleLogger';

// ============================================
// DATA TYPES
// ============================================

// Hardware data types
export interface HardwareData {
  gpu: string | null;
  gpuVendor: string | null;
  gpuRaw: string | null;
  cpuCores: number | null;
  ram: number | null;
  battery: {
    level: number;
    charging: boolean;
  } | null;
  screenWidth: number;
  screenHeight: number;
  windowWidth: number;
  windowHeight: number;
  pixelRatio: number;
  colorDepth: number;
  touchSupport: boolean;
  maxTouchPoints: number;
  orientation: string;
  webglVersion: string | null;
  webglExtensions: number;
}

// Network data types
export interface NetworkData {
  ip: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  isp: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  loading: boolean;
  error: string | null;
  connectionType: string | null;
  downlink: number | null;
  rtt: number | null;
  dataSaver: boolean;
  webrtcSupported: boolean;
  webrtcLocalIPs: string[];
}

// Browser data types
export interface BrowserData {
  userAgent: string;
  language: string;
  languages: string[];
  platform: string;
  vendor: string;
  cookiesEnabled: boolean;
  doNotTrack: string | null;
  globalPrivacyControl: boolean | null;
  localStorage: boolean;
  sessionStorage: boolean;
  indexedDB: boolean;
  pdfViewer: boolean;
  referrer: string;
  historyLength: number;
  // Client hints
  architecture: string | null;
  bitness: string | null;
  mobile: boolean;
  model: string | null;
  platformVersion: string | null;
  browserVersions: string | null;
}

// Fingerprint hashes
export interface FingerprintData {
  canvasHash: string | null;
  audioHash: string | null;
  webglHash: string | null;
  fontsDetected: number;
  speechVoices: number;
  voicesHash: string | null;
  mathHash: string | null;
  timingHash: string | null;
  errorHash: string | null;
  navigatorProps: number;
  windowProps: number;
  // Enhanced WASM fingerprinting
  wasmSupported: boolean;
  wasmFeatures: string[];
  wasmMaxMemory: number | null;
  wasmHash: string | null;
  wasmSimd: boolean;
  wasmThreads: boolean;
  wasmExceptions: boolean;
  wasmBulkMemory: boolean;
  wasmCpuTier: number;
  wasmBenchmarkScore: number | null;
  // Enhanced WebGPU fingerprinting
  webgpuAvailable: boolean;
  webgpuVendor: string | null;
  webgpuArchitecture: string | null;
  webgpuDevice: string | null;
  webgpuDescription: string | null;
  webgpuFallbackAdapter: boolean;
  webgpuFeatureCount: number;
  webgpuKeyFeatures: string[];
  webgpuCanvasFormat: string | null;
  webgpuComputeTiming: number | null;
  webgpuTimingPattern: string | null;
  webgpuHash: string | null;
  webgpuLimits: Record<string, number> | null;
  // Cross-browser ID
  crossBrowserId: string | null;
  crossBrowserFactors: string[];
  fingerprintId: string | null;
  fingerprintConfidence: number;
  // Extensions & Apps
  extensionsDetected: string[];
  installedApps: string[];
  hardwareFamily: string | null;
}

// Bot detection
export interface BotDetectionData {
  isAutomated: boolean;
  isHeadless: boolean;
  isVirtualMachine: boolean;
  incognitoMode: boolean;
  devToolsOpen: boolean;
  zeroMetrics: boolean;
}

// Permissions
export interface PermissionsData {
  geolocation: string;
  notifications: string;
  camera: string;
  microphone: string;
  accelerometer: string;
  gyroscope: string;
  magnetometer: string;
  clipboardRead: string;
  clipboardWrite: string;
}

// API Support
export interface APISupport {
  bluetooth: boolean;
  usb: boolean;
  midi: boolean;
  gamepads: boolean;
  webgpu: boolean;
  sharedArrayBuffer: boolean;
  serviceWorker: boolean;
  webWorker: boolean;
  webAssembly: boolean;
  webSocket: boolean;
  webRTC: boolean;
  notifications: boolean;
  pushAPI: boolean;
  paymentRequest: boolean;
  credentialsAPI: boolean;
  clipboardAPI: boolean;
}

// Media devices
export interface MediaDevicesData {
  microphones: number;
  cameras: number;
  speakers: number;
}

// Storage
export interface StorageData {
  used: number;
  quota: number;
  usagePercent: number;
}

// System preferences
export interface SystemPreferences {
  colorScheme: 'light' | 'dark' | 'no-preference';
  reducedMotion: boolean;
  reducedTransparency: boolean;
  contrast: string;
  forcedColors: boolean;
  colorGamut: string;
  hdrSupport: boolean;
  invertedColors: boolean;
}

// Media codecs
export interface MediaCodecs {
  videoCodecs: string[];
  audioCodecs: string[];
  widevineDRM: boolean;
  fairPlayDRM: boolean;
  playReadyDRM: boolean;
}

// Sensors
export interface SensorsData {
  accelerometer: boolean;
  gyroscope: boolean;
  magnetometer: boolean;
  ambientLight: boolean;
  proximity: boolean;
  linearAcceleration: boolean;
  gravity: boolean;
  orientation: boolean;
}

// JS Memory
export interface JSMemory {
  heapLimit: number | null;
  totalHeap: number | null;
  usedHeap: number | null;
}

// Chrome AI
export interface ChromeAI {
  supported: boolean;
  browserVersion: string;
  minVersionMet: boolean;
  apis: string[];
}

// Behavioral data types
export interface TypingData {
  totalKeystrokes: number;
  averageWPM: number;
  averageHoldTime: number;
  lastKeystrokeTime: number | null;
  keyInterval: number | null;
}

export interface MouseData {
  totalClicks: number;
  rageClicks: number;
  erraticMovements: number;
  averageVelocity: number;
  totalDistance: number;
  movements: number;
  idleTime: number;
  clickInterval: number | null;
  acceleration: number;
  inWindow: boolean;
}

export interface ScrollData {
  speed: number;
  maxDepth: number;
  directionChanges: number;
  scrollEvents: number;
}

export interface AttentionData {
  tabSwitches: number;
  totalHiddenTime: number;
  lastVisibilityChange: number | null;
  isVisible: boolean;
  sessionStart: number;
  firstInteraction: number | null;
  focusTime: number;
  timesWentAFK: number;
}

export interface EmotionsData {
  rageClicks: number;
  exitIntents: number;
  engagement: number;
  handedness: 'left' | 'right' | 'unknown';
  handednessConfidence: number;
}

export interface CopyPasteData {
  textSelections: number;
  lastSelected: string;
  copies: number;
  pastes: number;
  rightClicks: number;
  screenshotAttempts: number;
}

export interface BehavioralData {
  typing: TypingData;
  mouse: MouseData;
  scroll: ScrollData;
  attention: AttentionData;
  emotions: EmotionsData;
  copyPaste: CopyPasteData;
}

// Tracking detection
export interface TrackingDetection {
  adBlocker: boolean;
  doNotTrack: boolean;
  globalPrivacyControl: boolean | null;
}

// Social logins
export interface SocialLogins {
  google: boolean;
  facebook: boolean;
  twitter: boolean;
  github: boolean;
  reddit: boolean;
}

// Crypto wallets (extended)
export interface CryptoWallets {
  phantom: boolean;
  metamask: boolean;
  coinbase: boolean;
  braveWallet: boolean;
  trustWallet: boolean;
  binanceWallet: boolean;
  solflare: boolean;
  tronLink: boolean;
  hasAnyWallet: boolean;
}

// VPN/Proxy detection
export interface VPNDetection {
  likelyUsingVPN: boolean;
  timezoneMismatch: boolean;
  webrtcLeak: boolean;
}

// AI Analysis
export interface AIAnalysis {
  humanScore: number;
  fraudRisk: number;
  deviceTier: 'low-end' | 'mid-range' | 'high-end' | 'premium';
  deviceValue: string;
  deviceAge: 'new' | 'recent' | 'older' | 'legacy';
  incomeLevel: 'low' | 'medium' | 'high' | 'unknown';
  ageRange: string;
  occupation: string;
  education: string;
  workStyle: string;
  lifeSituation: string;
}

// Personal Life Guesses
export interface PersonalLifeGuesses {
  parent: string;
  petOwner: string;
  homeowner: string;
  carOwner: string;
  socialType: string;
}

// Mental & Physical State
export interface MentalPhysicalState {
  stressLevel: 'low' | 'medium' | 'high' | 'unknown';
  sleepSchedule: 'early' | 'normal' | 'late' | 'irregular' | 'unknown';
  fitnessLevel: 'active' | 'moderate' | 'sedentary' | 'unknown';
  healthConscious: string;
}

// Lifestyle
export interface LifestyleHabits {
  caffeine: string;
  drinksAlcohol: string;
  smokes: string;
  travel: string;
}

// Financial profile
export interface FinancialProfile {
  shoppingStyle: string;
  brandAffinity: string[];
}

// Creepy insights
export interface CreepyInsights {
  insights: string[];
}

// User profile flags
export interface UserProfileFlags {
  developer: { detected: boolean; confidence: number };
  gamer: { detected: boolean; confidence: number };
  designer: { detected: boolean; confidence: number };
  powerUser: { detected: boolean; confidence: number };
  privacyConscious: { detected: boolean; confidence: number };
  techSavvy: { detected: boolean; confidence: number };
  mobileUser: { detected: boolean; confidence: number };
  workDevice: { detected: boolean; confidence: number };
}

// Personality traits
export interface PersonalityTraits {
  cautious: boolean;
  privacyFocused: boolean;
  earlyAdopter: boolean;
}

// Inferred interests
export interface InferredInterests {
  cryptocurrency: string;
  privacy: string;
  modernWebTechnologies: string;
  gaming: string;
  design: string;
  development: string;
}

// Persona types (keeping for backward compat)
export interface Persona {
  techLevel: string;
  currentState: string;
  behavioralProfile: string;
  vibeCheck: string;
  description: string;
}

// ============================================
// STORE STATE
// ============================================

interface ProfileState {
  hardware: HardwareData;
  network: NetworkData;
  browser: BrowserData;
  fingerprints: FingerprintData;
  botDetection: BotDetectionData;
  permissions: PermissionsData;
  apiSupport: APISupport;
  mediaDevices: MediaDevicesData;
  storage: StorageData;
  systemPreferences: SystemPreferences;
  mediaCodecs: MediaCodecs;
  sensors: SensorsData;
  jsMemory: JSMemory;
  chromeAI: ChromeAI;
  behavioral: BehavioralData;
  trackingDetection: TrackingDetection;
  socialLogins: SocialLogins;
  cryptoWallets: CryptoWallets;
  vpnDetection: VPNDetection;
  aiAnalysis: AIAnalysis;
  personalLife: PersonalLifeGuesses;
  mentalPhysical: MentalPhysicalState;
  lifestyle: LifestyleHabits;
  financial: FinancialProfile;
  creepyInsights: CreepyInsights;
  userProfile: UserProfileFlags;
  personalityTraits: PersonalityTraits;
  inferredInterests: InferredInterests;
  persona: Persona | null;
  consoleEntries: ConsoleEntry[];
  isScanning: boolean;
  scanProgress: number;
  // AI Analysis extended fields
  aiProfileSummary: string | null;
  aiConfidence: number;
  aiInterests: string[];
  aiFallback: boolean;

  // Actions
  setHardware: (data: Partial<HardwareData>) => void;
  setNetwork: (data: Partial<NetworkData>) => void;
  setBrowser: (data: Partial<BrowserData>) => void;
  setFingerprints: (data: Partial<FingerprintData>) => void;
  setBotDetection: (data: Partial<BotDetectionData>) => void;
  setPermissions: (data: Partial<PermissionsData>) => void;
  setAPISupport: (data: Partial<APISupport>) => void;
  setMediaDevices: (data: Partial<MediaDevicesData>) => void;
  setStorage: (data: Partial<StorageData>) => void;
  setSystemPreferences: (data: Partial<SystemPreferences>) => void;
  setMediaCodecs: (data: Partial<MediaCodecs>) => void;
  setSensors: (data: Partial<SensorsData>) => void;
  setJSMemory: (data: Partial<JSMemory>) => void;
  setChromeAI: (data: Partial<ChromeAI>) => void;
  updateTyping: (data: Partial<TypingData>) => void;
  updateMouse: (data: Partial<MouseData>) => void;
  updateScroll: (data: Partial<ScrollData>) => void;
  updateAttention: (data: Partial<AttentionData>) => void;
  updateEmotions: (data: Partial<EmotionsData>) => void;
  updateCopyPaste: (data: Partial<CopyPasteData>) => void;
  setTrackingDetection: (data: Partial<TrackingDetection>) => void;
  setSocialLogins: (data: Partial<SocialLogins>) => void;
  setCryptoWallets: (data: Partial<CryptoWallets>) => void;
  setVPNDetection: (data: Partial<VPNDetection>) => void;
  setAIAnalysis: (data: Partial<AIAnalysis>) => void;
  setPersonalLife: (data: Partial<PersonalLifeGuesses>) => void;
  setMentalPhysical: (data: Partial<MentalPhysicalState>) => void;
  setLifestyle: (data: Partial<LifestyleHabits>) => void;
  setFinancial: (data: Partial<FinancialProfile>) => void;
  setCreepyInsights: (data: Partial<CreepyInsights>) => void;
  setUserProfile: (data: Partial<UserProfileFlags>) => void;
  setPersonalityTraits: (data: Partial<PersonalityTraits>) => void;
  setInferredInterests: (data: Partial<InferredInterests>) => void;
  setPersona: (persona: Persona) => void;
  addConsoleEntry: (level: LogLevel, message: string) => void;
  setScanning: (isScanning: boolean) => void;
  setScanProgress: (progress: number) => void;
}

const MAX_CONSOLE_ENTRIES = 100;

export const useProfileStore = create<ProfileState>((set) => ({
  hardware: {
    gpu: null,
    gpuVendor: null,
    gpuRaw: null,
    cpuCores: null,
    ram: null,
    battery: null,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    pixelRatio: window.devicePixelRatio,
    colorDepth: window.screen.colorDepth,
    touchSupport: 'ontouchstart' in window,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    orientation: screen.orientation?.type || 'unknown',
    webglVersion: null,
    webglExtensions: 0,
  },

  network: {
    ip: null,
    city: null,
    region: null,
    country: null,
    countryCode: null,
    isp: null,
    latitude: null,
    longitude: null,
    timezone: null,
    loading: true,
    error: null,
    connectionType: null,
    downlink: null,
    rtt: null,
    dataSaver: false,
    webrtcSupported: !!window.RTCPeerConnection,
    webrtcLocalIPs: [],
  },

  browser: {
    userAgent: navigator.userAgent,
    language: navigator.language,
    languages: [...navigator.languages],
    platform: navigator.platform,
    vendor: navigator.vendor,
    cookiesEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack,
    globalPrivacyControl: (navigator as any).globalPrivacyControl ?? null,
    localStorage: !!window.localStorage,
    sessionStorage: !!window.sessionStorage,
    indexedDB: !!window.indexedDB,
    pdfViewer: navigator.pdfViewerEnabled ?? false,
    referrer: document.referrer || 'Direct',
    historyLength: window.history.length,
    architecture: null,
    bitness: null,
    mobile: /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent),
    model: null,
    platformVersion: null,
    browserVersions: null,
  },

  fingerprints: {
    canvasHash: null,
    audioHash: null,
    webglHash: null,
    fontsDetected: 0,
    speechVoices: 0,
    voicesHash: null,
    mathHash: null,
    timingHash: null,
    errorHash: null,
    navigatorProps: 0,
    windowProps: 0,
    // Enhanced WASM
    wasmSupported: typeof WebAssembly !== 'undefined',
    wasmFeatures: [],
    wasmMaxMemory: null,
    wasmHash: null,
    wasmSimd: false,
    wasmThreads: false,
    wasmExceptions: false,
    wasmBulkMemory: false,
    wasmCpuTier: 0,
    wasmBenchmarkScore: null,
    // Enhanced WebGPU
    webgpuAvailable: false,
    webgpuVendor: null,
    webgpuArchitecture: null,
    webgpuDevice: null,
    webgpuDescription: null,
    webgpuFallbackAdapter: false,
    webgpuFeatureCount: 0,
    webgpuKeyFeatures: [],
    webgpuCanvasFormat: null,
    webgpuComputeTiming: null,
    webgpuTimingPattern: null,
    webgpuHash: null,
    webgpuLimits: null,
    // Cross-browser ID
    crossBrowserId: null,
    crossBrowserFactors: [],
    fingerprintId: null,
    fingerprintConfidence: 0,
    // Extensions & Apps
    extensionsDetected: [],
    installedApps: [],
    hardwareFamily: null,
  },

  botDetection: {
    isAutomated: false,
    isHeadless: false,
    isVirtualMachine: false,
    incognitoMode: false,
    devToolsOpen: false,
    zeroMetrics: true,
  },

  permissions: {
    geolocation: 'prompt',
    notifications: 'prompt',
    camera: 'prompt',
    microphone: 'prompt',
    accelerometer: 'prompt',
    gyroscope: 'prompt',
    magnetometer: 'prompt',
    clipboardRead: 'prompt',
    clipboardWrite: 'prompt',
  },

  apiSupport: {
    bluetooth: 'bluetooth' in navigator,
    usb: 'usb' in navigator,
    midi: 'requestMIDIAccess' in navigator,
    gamepads: 'getGamepads' in navigator,
    webgpu: 'gpu' in navigator,
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
    serviceWorker: 'serviceWorker' in navigator,
    webWorker: typeof Worker !== 'undefined',
    webAssembly: typeof WebAssembly !== 'undefined',
    webSocket: typeof WebSocket !== 'undefined',
    webRTC: !!window.RTCPeerConnection,
    notifications: 'Notification' in window,
    pushAPI: 'PushManager' in window,
    paymentRequest: 'PaymentRequest' in window,
    credentialsAPI: 'credentials' in navigator,
    clipboardAPI: 'clipboard' in navigator,
  },

  mediaDevices: {
    microphones: 0,
    cameras: 0,
    speakers: 0,
  },

  storage: {
    used: 0,
    quota: 0,
    usagePercent: 0,
  },

  systemPreferences: {
    colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 
                 window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'no-preference',
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    reducedTransparency: window.matchMedia('(prefers-reduced-transparency: reduce)').matches,
    contrast: window.matchMedia('(prefers-contrast: more)').matches ? 'more' :
              window.matchMedia('(prefers-contrast: less)').matches ? 'less' : 'no-preference',
    forcedColors: window.matchMedia('(forced-colors: active)').matches,
    colorGamut: window.matchMedia('(color-gamut: p3)').matches ? 'p3' :
                window.matchMedia('(color-gamut: rec2020)').matches ? 'rec2020' : 'srgb',
    hdrSupport: window.matchMedia('(dynamic-range: high)').matches,
    invertedColors: window.matchMedia('(inverted-colors: inverted)').matches,
  },

  mediaCodecs: {
    videoCodecs: [],
    audioCodecs: [],
    widevineDRM: false,
    fairPlayDRM: false,
    playReadyDRM: false,
  },

  sensors: {
    accelerometer: 'Accelerometer' in window,
    gyroscope: 'Gyroscope' in window,
    magnetometer: 'Magnetometer' in window,
    ambientLight: 'AmbientLightSensor' in window,
    proximity: 'ProximitySensor' in window,
    linearAcceleration: 'LinearAccelerationSensor' in window,
    gravity: 'GravitySensor' in window,
    orientation: 'AbsoluteOrientationSensor' in window,
  },

  jsMemory: {
    heapLimit: null,
    totalHeap: null,
    usedHeap: null,
  },

  chromeAI: {
    supported: false,
    browserVersion: '',
    minVersionMet: false,
    apis: [],
  },

  behavioral: {
    typing: {
      totalKeystrokes: 0,
      averageWPM: 0,
      averageHoldTime: 0,
      lastKeystrokeTime: null,
      keyInterval: null,
    },
    mouse: {
      totalClicks: 0,
      rageClicks: 0,
      erraticMovements: 0,
      averageVelocity: 0,
      totalDistance: 0,
      movements: 0,
      idleTime: 0,
      clickInterval: null,
      acceleration: 0,
      inWindow: true,
    },
    scroll: {
      speed: 0,
      maxDepth: 0,
      directionChanges: 0,
      scrollEvents: 0,
    },
    attention: {
      tabSwitches: 0,
      totalHiddenTime: 0,
      lastVisibilityChange: null,
      isVisible: true,
      sessionStart: Date.now(),
      firstInteraction: null,
      focusTime: 0,
      timesWentAFK: 0,
    },
    emotions: {
      rageClicks: 0,
      exitIntents: 0,
      engagement: 50,
      handedness: 'unknown',
      handednessConfidence: 0,
    },
    copyPaste: {
      textSelections: 0,
      lastSelected: '',
      copies: 0,
      pastes: 0,
      rightClicks: 0,
      screenshotAttempts: 0,
    },
  },

  trackingDetection: {
    adBlocker: false,
    doNotTrack: navigator.doNotTrack === '1',
    globalPrivacyControl: (navigator as any).globalPrivacyControl ?? null,
  },

  socialLogins: {
    google: false,
    facebook: false,
    twitter: false,
    github: false,
    reddit: false,
  },

  cryptoWallets: {
    phantom: false,
    metamask: false,
    coinbase: false,
    braveWallet: false,
    trustWallet: false,
    binanceWallet: false,
    solflare: false,
    tronLink: false,
    hasAnyWallet: false,
  },

  vpnDetection: {
    likelyUsingVPN: false,
    timezoneMismatch: false,
    webrtcLeak: false,
  },

  aiAnalysis: {
    humanScore: 50,
    fraudRisk: 25,
    deviceTier: 'mid-range',
    deviceValue: '$600-$1,200',
    deviceAge: 'recent',
    incomeLevel: 'medium',
    ageRange: '25-40',
    occupation: 'Unknown',
    education: 'unknown',
    workStyle: 'unknown',
    lifeSituation: 'Unknown',
  },

  personalLife: {
    parent: 'Unknown',
    petOwner: 'Unknown',
    homeowner: 'Unknown',
    carOwner: 'Unknown',
    socialType: 'unknown',
  },

  mentalPhysical: {
    stressLevel: 'unknown',
    sleepSchedule: 'unknown',
    fitnessLevel: 'unknown',
    healthConscious: 'Unknown',
  },

  lifestyle: {
    caffeine: 'unknown',
    drinksAlcohol: 'Unknown',
    smokes: 'Unknown',
    travel: 'unknown',
  },

  financial: {
    shoppingStyle: 'unknown',
    brandAffinity: [],
  },

  creepyInsights: {
    insights: [],
  },

  userProfile: {
    developer: { detected: false, confidence: 0 },
    gamer: { detected: false, confidence: 0 },
    designer: { detected: false, confidence: 0 },
    powerUser: { detected: false, confidence: 0 },
    privacyConscious: { detected: false, confidence: 0 },
    techSavvy: { detected: false, confidence: 0 },
    mobileUser: { detected: false, confidence: 0 },
    workDevice: { detected: false, confidence: 0 },
  },

  personalityTraits: {
    cautious: false,
    privacyFocused: false,
    earlyAdopter: false,
  },

  inferredInterests: {
    cryptocurrency: 'Unknown',
    privacy: 'Unknown',
    modernWebTechnologies: 'Unknown',
    gaming: 'Unknown',
    design: 'Unknown',
    development: 'Unknown',
  },

  persona: null,
  consoleEntries: [],
  isScanning: true,
  scanProgress: 0,
  // AI Analysis extended fields
  aiProfileSummary: null,
  aiConfidence: 0,
  aiInterests: [],
  aiFallback: false,

  // ACTIONS
  setHardware: (data) =>
    set((state) => ({
      hardware: { ...state.hardware, ...data },
    })),

  setNetwork: (data) =>
    set((state) => ({
      network: { ...state.network, ...data },
    })),

  setBrowser: (data) =>
    set((state) => ({
      browser: { ...state.browser, ...data },
    })),

  setFingerprints: (data) =>
    set((state) => ({
      fingerprints: { ...state.fingerprints, ...data },
    })),

  setBotDetection: (data) =>
    set((state) => ({
      botDetection: { ...state.botDetection, ...data },
    })),

  setPermissions: (data) =>
    set((state) => ({
      permissions: { ...state.permissions, ...data },
    })),

  setAPISupport: (data) =>
    set((state) => ({
      apiSupport: { ...state.apiSupport, ...data },
    })),

  setMediaDevices: (data) =>
    set((state) => ({
      mediaDevices: { ...state.mediaDevices, ...data },
    })),

  setStorage: (data) =>
    set((state) => ({
      storage: { ...state.storage, ...data },
    })),

  setSystemPreferences: (data) =>
    set((state) => ({
      systemPreferences: { ...state.systemPreferences, ...data },
    })),

  setMediaCodecs: (data) =>
    set((state) => ({
      mediaCodecs: { ...state.mediaCodecs, ...data },
    })),

  setSensors: (data) =>
    set((state) => ({
      sensors: { ...state.sensors, ...data },
    })),

  setJSMemory: (data) =>
    set((state) => ({
      jsMemory: { ...state.jsMemory, ...data },
    })),

  setChromeAI: (data) =>
    set((state) => ({
      chromeAI: { ...state.chromeAI, ...data },
    })),

  updateTyping: (data) =>
    set((state) => ({
      behavioral: {
        ...state.behavioral,
        typing: { ...state.behavioral.typing, ...data },
      },
    })),

  updateMouse: (data) =>
    set((state) => ({
      behavioral: {
        ...state.behavioral,
        mouse: { ...state.behavioral.mouse, ...data },
      },
    })),

  updateScroll: (data) =>
    set((state) => ({
      behavioral: {
        ...state.behavioral,
        scroll: { ...state.behavioral.scroll, ...data },
      },
    })),

  updateAttention: (data) =>
    set((state) => ({
      behavioral: {
        ...state.behavioral,
        attention: { ...state.behavioral.attention, ...data },
      },
    })),

  updateEmotions: (data) =>
    set((state) => ({
      behavioral: {
        ...state.behavioral,
        emotions: { ...state.behavioral.emotions, ...data },
      },
    })),

  updateCopyPaste: (data) =>
    set((state) => ({
      behavioral: {
        ...state.behavioral,
        copyPaste: { ...state.behavioral.copyPaste, ...data },
      },
    })),

  setTrackingDetection: (data) =>
    set((state) => ({
      trackingDetection: { ...state.trackingDetection, ...data },
    })),

  setSocialLogins: (data) =>
    set((state) => ({
      socialLogins: { ...state.socialLogins, ...data },
    })),

  setCryptoWallets: (data) =>
    set((state) => ({
      cryptoWallets: { ...state.cryptoWallets, ...data },
    })),

  setVPNDetection: (data) =>
    set((state) => ({
      vpnDetection: { ...state.vpnDetection, ...data },
    })),

  setAIAnalysis: (data) =>
    set((state) => ({
      aiAnalysis: { ...state.aiAnalysis, ...data },
    })),

  setPersonalLife: (data) =>
    set((state) => ({
      personalLife: { ...state.personalLife, ...data },
    })),

  setMentalPhysical: (data) =>
    set((state) => ({
      mentalPhysical: { ...state.mentalPhysical, ...data },
    })),

  setLifestyle: (data) =>
    set((state) => ({
      lifestyle: { ...state.lifestyle, ...data },
    })),

  setFinancial: (data) =>
    set((state) => ({
      financial: { ...state.financial, ...data },
    })),

  setCreepyInsights: (data) =>
    set((state) => ({
      creepyInsights: { ...state.creepyInsights, ...data },
    })),

  setUserProfile: (data) =>
    set((state) => ({
      userProfile: { ...state.userProfile, ...data },
    })),

  setPersonalityTraits: (data) =>
    set((state) => ({
      personalityTraits: { ...state.personalityTraits, ...data },
    })),

  setInferredInterests: (data) =>
    set((state) => ({
      inferredInterests: { ...state.inferredInterests, ...data },
    })),

  setPersona: (persona) => set({ persona }),

  addConsoleEntry: (level, message) =>
    set((state) => {
      const newEntry = createConsoleEntry(level, message);
      const entries = [...state.consoleEntries, newEntry];
      if (entries.length > MAX_CONSOLE_ENTRIES) {
        entries.shift();
      }
      return { consoleEntries: entries };
    }),

  setScanning: (isScanning) => set({ isScanning }),
  setScanProgress: (progress) => set({ scanProgress: progress }),
}));
