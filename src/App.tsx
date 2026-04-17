import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ShieldCheck, Activity, User, Brain, Users, Navigation, Loader2, AlertCircle, BatteryFull, BatteryMedium, BatteryLow, BatteryCharging, Globe, X, Chrome, Eye, MapPin, Wifi, Monitor, Radio, Crosshair, Fingerprint, Cpu, Lock } from 'lucide-react';
import type { Visitor } from './hooks/useVisitors';
import { computeThreatReport, type ThreatReport, type SignalCategory } from './lib/threatModel';

// Hooks
import { useHardwareDetection } from './hooks/useHardwareDetection';
import { useNetworkInfo } from './hooks/useNetworkInfo';
import { useTypingDynamics } from './hooks/useTypingDynamics';
import { useMousePatterns } from './hooks/useMousePatterns';
import { useAttentionTracker } from './hooks/useAttentionTracker';
import { useScrollTracker } from './hooks/useScrollTracker';
import { useCopyPasteTracker } from './hooks/useCopyPasteTracker';
import { useEmotionTracker } from './hooks/useEmotionTracker';
import { useComprehensiveDetection } from './hooks/useComprehensiveDetection';
import { useVisitors } from './hooks/useVisitors';
import { useVisitorHistory } from './hooks/useVisitorHistory';

// Components
import { Globe3D } from './components/Globe/Globe3D';
import { AdAuction } from './components/AdAuction/AdAuction';
import { ChatBox } from './components/Chat/ChatBox';
import Navbar from './components/Navbar/Navbar';

// AI Analysis Sections
import {
  AIAnalysisHero,
  PersonalLifeSection,
  MentalPhysicalSection,
  LifestyleSection,
  FinancialSection,
  CreepyInsightsSection,
  UserProfileSection,
  PersonalityTraitsSection,
  InferredInterestsSection,
} from './components/sections/AIAnalysisSection';

// Detection Sections
import {
  BotDetectionSection,
  FraudRiskSection,
  TrackingDetectionSection,
  BrowserAnalysisSection,
  SocialLoginsSection,
  CryptoWalletsSection,
  VPNDetectionSection,
} from './components/sections/DetectionSections';

// Hardware Sections
import {
  CrossBrowserTrackingSection,
  BrowserInfoSection,
  ClientHintsSection,
  DisplaySection,
  HardwareSection,
  NetworkSection,
  MediaDevicesSection,
  StorageSection,
  PermissionsSection,
  APISupportSection,
  FingerprintsSection,
  SystemPreferencesSection,
  MediaCodecsSection,
  SensorsSection,
  JSMemorySection,
  WebAPISection,
  AdvancedFingerprintsSection,
  WasmFingerprintSection,
  WebGPUFingerprintSection,
  ChromeAISection,
} from './components/sections/HardwareSections';

// Behavior Sections
import {
  MouseBehaviorSection,
  ScrollBehaviorSection,
  TypingBehaviorSection,
  AttentionTrackingSection,
  YouRightNowSection,
  EmotionsSection,
  CopyPasteSection,
} from './components/sections/BehaviorSections';

// GhostTrack OSINT Sections
import {
  IPDeepAnalysisSection,
  UsernameTrackerSection,
  PhoneIntelSection,
} from './components/sections/GhostTrackSection';

// Signal Intelligence Sections (WiFi DensePose inspired)
import {
  WiFiScannerSection,
  PresenceDetectionSection,
  VitalSignsSection,
  SignalObservatorySection,
} from './components/sections/SignalIntelligenceSection';

// Advanced Detection Sections (CreepJS / FingerprintJS inspired)
import {
  CloudflareTraceSection,
  LieDetectionSection,
  DOMRectCSSSection,
  KeyboardLayoutSection,
  WebRTCLeakSection,
  HeadlessDetectionSection,
  AdvancedDisplaySection,
} from './components/sections/AdvancedDetectionSection';

// Store
import { useProfileStore } from './store/useProfileStore';

function ParticleBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Deep vignette backdrop */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(0, 240, 255, 0.04) 0%, transparent 45%), radial-gradient(ellipse at 50% 100%, rgba(191, 90, 242, 0.04) 0%, transparent 45%)',
        }}
      />

      {/* Gradient orbs - softer, more atmospheric */}
      <div
        className="absolute w-[800px] h-[800px] rounded-full opacity-[0.04]"
        style={{
          background: 'radial-gradient(circle, #00f0ff 0%, transparent 70%)',
          top: '-20%',
          left: '-10%',
          filter: 'blur(80px)',
        }}
      />
      <div
        className="absolute w-[600px] h-[600px] rounded-full opacity-[0.04]"
        style={{
          background: 'radial-gradient(circle, #bf5af2 0%, transparent 70%)',
          bottom: '-10%',
          right: '-5%',
          filter: 'blur(80px)',
        }}
      />

      {/* Grid - slightly more visible */}
      <div className="absolute inset-0 cyber-grid opacity-60" />

      {/* Hexagon pattern */}
      <div className="absolute inset-0 hexagon-bg" />

      {/* Scan line overlay - desktop only, subtle */}
      <div
        className="absolute inset-0 hidden md:block"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0, 240, 255, 0.015) 3px, rgba(0, 240, 255, 0.015) 4px)',
        }}
      />

      {/* Floating particles - CSS animation (reduced to 6) */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 rounded-full particle-float"
          style={{
            background: i % 3 === 0 ? '#00f0ff' : i % 3 === 1 ? '#bf5af2' : '#ff2d55',
            boxShadow: `0 0 6px ${i % 3 === 0 ? 'rgba(0,240,255,0.5)' : i % 3 === 1 ? 'rgba(191,90,242,0.5)' : 'rgba(255,45,85,0.5)'}`,
            left: `${10 + i * 15}%`,
            animationDelay: `${i * 3}s`,
            animationDuration: `${20 + i * 2}s`,
          }}
        />
      ))}
    </div>
  );
}


function BatteryBadge() {
  const battery = useProfileStore((s) => s.hardware.battery);
  if (!battery) return null;

  const pct = Math.round(battery.level * 100);
  const color = battery.charging
    ? 'text-cyber-cyan border-cyber-cyan/20'
    : pct > 50
      ? 'text-emerald-400 border-emerald-500/20'
      : pct > 20
        ? 'text-yellow-400 border-yellow-500/20'
        : 'text-rose-400 border-rose-500/20';

  const Icon = battery.charging ? BatteryCharging : pct > 50 ? BatteryFull : pct > 20 ? BatteryMedium : BatteryLow;

  return (
    <motion.div
      className={`flex items-center gap-2 bg-cyber-bg/60 backdrop-blur-xl px-3 md:px-4 py-1.5 md:py-2 rounded-full border ${color}`}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7 }}
    >
      <Icon size={10} className="md:w-3 md:h-3" />
      <span className="text-[9px] md:text-[10px] font-display font-semibold uppercase tracking-[0.15em] md:tracking-[0.2em]">
        {pct}%{battery.charging ? ' Charging' : ''}
      </span>
    </motion.div>
  );
}

function SectionTitle({ children, icon, badge }: { children: React.ReactNode; icon: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <motion.div
      className="flex items-center gap-3 mb-5"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <span className="section-accent" aria-hidden="true" />
      <span className="text-cyber-cyan/70">{icon}</span>
      <h2 className="font-display text-[12px] font-semibold uppercase tracking-[0.22em] text-white/75">
        {children}
      </h2>
      <span className="tick-rule" aria-hidden="true" />
      {badge && badge}
    </motion.div>
  );
}

function SubsectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-white/35 text-[10px] uppercase tracking-[0.28em] mb-4 font-mono">
      <span className="w-1 h-1 rounded-full bg-cyber-cyan/60" />
      {children}
    </h3>
  );
}

function LocationOverlay({ visitor, isConnected }: { visitor: Visitor | null; isConnected: boolean }) {
  return (
    <motion.div 
      className="glass-card p-3 md:p-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.2 }}
    >
      {!isConnected ? (
        <div className="flex items-center gap-3">
          <Loader2 size={14} className="text-cyber-cyan animate-spin" />
          <div>
            <span className="text-cyber-cyan font-mono text-[8px] md:text-[9px] tracking-widest uppercase">Connecting...</span>
            <p className="text-cyber-text-dim text-[10px] md:text-[11px] mt-0.5">Establishing connection</p>
          </div>
        </div>
      ) : !visitor ? (
        <div className="flex items-center gap-3">
          <Loader2 size={14} className="text-cyber-cyan animate-spin" />
          <div>
            <span className="text-cyber-cyan font-mono text-[8px] md:text-[9px] tracking-widest uppercase">Tracing Origin...</span>
            <p className="text-cyber-text-dim text-[10px] md:text-[11px] mt-0.5">Locating your connection</p>
          </div>
        </div>
      ) : !visitor.geo ? (
        <div className="flex items-center gap-3">
          <AlertCircle size={14} className="text-cyber-red" />
          <div>
            <span className="text-cyber-red font-mono text-[8px] md:text-[9px] tracking-widest uppercase">Location Unavailable</span>
            <p className="text-cyber-text-dim text-[10px] md:text-[11px] mt-0.5">Could not determine location</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5 mb-1">
            <Navigation size={10} className="text-cyber-cyan" />
            <span className="text-cyber-cyan font-mono text-[8px] md:text-[9px] tracking-widest uppercase">Traced Origin</span>
          </div>
          <div className="text-cyber-text font-display text-sm md:text-base font-semibold">
            {visitor.geo.city}, {visitor.geo.region}
          </div>
          <div className="text-cyber-text-dim text-[10px] md:text-[11px] mt-0.5">
            {visitor.geo.country} • {visitor.geo.timezone}
          </div>
          <div className="text-cyber-text-dim/60 font-mono text-[9px] mt-1">
            {visitor.geo.lat.toFixed(4)}°, {visitor.geo.lng.toFixed(4)}°
          </div>
        </>
      )}
    </motion.div>
  );
}

function CountryCounter({ historicalVisitors, visitors }: { historicalVisitors: { country: string }[]; visitors: Visitor[] }) {
  const uniqueCountries = useMemo(() => {
    const countries = new Set<string>();
    historicalVisitors.forEach((v) => { if (v.country) countries.add(v.country); });
    visitors.forEach((v) => { if (v.geo?.country) countries.add(v.geo.country); });
    return countries.size;
  }, [historicalVisitors, visitors]);

  if (uniqueCountries === 0) return null;

  return (
    <motion.div
      className="flex items-center gap-2 bg-cyber-bg/60 backdrop-blur-xl px-3 md:px-4 py-1.5 md:py-2 rounded-full border text-amber-400 border-amber-500/20"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.1 }}
    >
      <MapPin size={10} className="md:w-3 md:h-3" />
      <span className="text-[9px] md:text-[10px] font-display font-semibold uppercase tracking-[0.15em] md:tracking-[0.2em]">
        {uniqueCountries}/195 Countries
      </span>
    </motion.div>
  );
}

function CreepyIntroPopup({ visitor, onEnter }: { visitor: Visitor | null; onEnter: () => void }) {
  const network = useProfileStore((s) => s.network);
  const hardware = useProfileStore((s) => s.hardware);
  const browser = useProfileStore((s) => s.browser);
  const [step, setStep] = useState(0);

  const city = visitor?.geo?.city || network.city || null;
  const region = visitor?.geo?.region || network.region || null;
  const country = visitor?.geo?.country || network.country || null;

  const indicators = useMemo(() => {
    const items: { label: string; value: string; icon: React.ReactNode }[] = [];

    // 1. Location - always first
    if (city && country) {
      items.push({
        label: 'You are visiting from',
        value: `${city}${region ? `, ${region}` : ''}, ${country}`,
        icon: <MapPin size={16} className="text-cyber-red" />,
      });
    }

    // 2. Device/hardware
    const gpu = hardware.gpu;
    const cores = hardware.cpuCores;
    const screenRes = `${hardware.screenWidth}x${hardware.screenHeight}`;
    if (gpu && gpu !== 'unknown') {
      items.push({
        label: 'You are running',
        value: `${gpu} with ${cores || '?'} CPU cores at ${screenRes}`,
        icon: <Monitor size={16} className="text-cyber-purple" />,
      });
    } else if (cores) {
      items.push({
        label: 'Your device has',
        value: `${cores} CPU cores, ${screenRes} display, ${hardware.pixelRatio}x pixel density`,
        icon: <Monitor size={16} className="text-cyber-purple" />,
      });
    }

    // 3. Network/ISP
    const isp = visitor?.geo?.isp || network.isp;
    const connType = network.connectionType;
    if (isp) {
      items.push({
        label: 'Your connection reveals',
        value: `${isp}${connType ? ` via ${connType}` : ''}`,
        icon: <Wifi size={16} className="text-cyber-cyan" />,
      });
    }

    // 4. Browser
    const platform = browser.platform;
    const lang = browser.language;
    if (platform) {
      items.push({
        label: 'Your browser exposes',
        value: `${platform}, ${lang}, ${browser.languages.length} languages configured`,
        icon: <Eye size={16} className="text-amber-400" />,
      });
    }

    return items.slice(0, 3);
  }, [city, region, country, hardware, browser, visitor, network]);

  // Animate steps in
  useEffect(() => {
    if (indicators.length === 0) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    indicators.forEach((_, i) => {
      timers.push(setTimeout(() => setStep(i + 1), 800 + i * 1200));
    });
    return () => timers.forEach(clearTimeout);
  }, [indicators.length]);

  const ready = indicators.length >= 2;

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-cyber-bg/98 backdrop-blur-xl" />

      {/* Scanlines effect */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,240,255,0.1) 2px, rgba(0,240,255,0.1) 4px)',
      }} />

      <div className="relative z-10 max-w-lg w-full mx-6 px-2">
        {/* Eye icon */}
        <motion.div
          className="flex justify-center mb-12"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
        >
          <div className="w-20 h-20 rounded-full border border-cyber-red/30 flex items-center justify-center bg-cyber-red/5">
            <Eye size={34} className="text-cyber-red" />
          </div>
        </motion.div>

        <motion.p
          className="text-center text-cyber-text-dim text-xs uppercase tracking-[0.35em] font-mono mb-14"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          We already know...
        </motion.p>

        {/* Creepy indicators */}
        <div className="mb-14">
          {indicators.map((item, i) => (
            <AnimatePresence key={i}>
              {step > i && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5 }}
                  className="bg-cyber-bg-card/80 border border-white/5 rounded-xl px-6 py-6 mb-8 last:mb-0"
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-1 shrink-0">{item.icon}</div>
                    <div>
                      <p className="text-white/40 text-[10px] uppercase tracking-widest font-mono mb-2">{item.label}</p>
                      <p className="text-cyber-text text-[15px] font-display font-semibold leading-snug">{item.value}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          ))}
        </div>

        {/* CTA */}
        <AnimatePresence>
          {ready && step >= indicators.length && (
            <motion.div
              className="text-center pt-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <p className="text-cyber-text-dim text-[11px] font-mono mb-6 tracking-wider">
                ...and that's just the beginning.
              </p>
              <button
                onClick={onEnter}
                className="group relative inline-flex items-center gap-3 bg-cyber-red/10 border border-cyber-red/30 hover:bg-cyber-red/20 hover:border-cyber-red/50 transition-all px-10 py-4 rounded-xl cursor-pointer"
              >
                <Eye size={16} className="text-cyber-red" />
                <span className="text-cyber-red text-[11px] font-display font-bold uppercase tracking-[0.2em]">
                  Enter The Watcher
                </span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function McAfeeProtocolOverlay() {
  return (
    <motion.div
      className="absolute inset-0 z-30 pointer-events-none overflow-hidden rounded-2xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Scan line */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent"
          animate={{ top: ['0%', '100%'] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      {/* Glitch overlay */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,157,0.015) 3px, rgba(0,255,157,0.015) 6px)',
      }} />
    </motion.div>
  );
}

function McAfeeProtocolBanner({ active }: { active: boolean }) {
  if (!active) return null;

  const spoofedData = useMemo(() => {
    const randomHex = (len: number) => Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    return {
      ip: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      canvas: randomHex(16),
      webgl: randomHex(16),
      audio: randomHex(16),
      gpu: ['Generic Renderer', 'SwiftShader', 'ANGLE (Unknown)'][Math.floor(Math.random() * 3)],
      cores: [2, 4, 8][Math.floor(Math.random() * 3)],
      timezone: ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'][Math.floor(Math.random() * 4)],
      // Enhanced spoofed data for new sections
      wifiNetworks: 'Randomized — 0 real SSIDs leaked',
      osintResults: 'All platform checks blocked',
      presenceDetection: 'Signal noise injected — undetectable',
      vitalSigns: 'Behavioral signals scrambled',
      countryRisk: 'Location masked via VPN rotation',
    };
  }, []);

  return (
    <motion.div
      className="mb-6 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck size={14} className="text-emerald-400" />
        <span className="text-emerald-400 text-[10px] font-display font-bold uppercase tracking-widest">McAfee Protocol Active</span>
      </div>
      <p className="text-white/40 text-[10px] font-mono mb-3">
        The Watcher would see this instead of your real data:
      </p>
      <div className="space-y-1.5 font-mono text-[9px]">
        <div className="flex justify-between"><span className="text-white/25">IP</span><span className="text-emerald-400/70">{spoofedData.ip}</span></div>
        <div className="flex justify-between"><span className="text-white/25">Canvas Hash</span><span className="text-emerald-400/70">{spoofedData.canvas}</span></div>
        <div className="flex justify-between"><span className="text-white/25">WebGL Hash</span><span className="text-emerald-400/70">{spoofedData.webgl}</span></div>
        <div className="flex justify-between"><span className="text-white/25">Audio Hash</span><span className="text-emerald-400/70">{spoofedData.audio}</span></div>
        <div className="flex justify-between"><span className="text-white/25">GPU</span><span className="text-emerald-400/70">{spoofedData.gpu}</span></div>
        <div className="flex justify-between"><span className="text-white/25">CPU Cores</span><span className="text-emerald-400/70">{spoofedData.cores}</span></div>
        <div className="flex justify-between"><span className="text-white/25">Timezone</span><span className="text-emerald-400/70">{spoofedData.timezone}</span></div>
      </div>

      {/* New section protections */}
      <div className="mt-3 pt-3 border-t border-emerald-500/10 space-y-1.5 font-mono text-[9px]">
        <div className="flex items-center gap-1.5 mb-2">
          <Shield size={10} className="text-emerald-400/60" />
          <span className="text-emerald-400/60 text-[8px] uppercase tracking-widest">Enhanced Protection</span>
        </div>
        <div className="flex justify-between"><span className="text-white/25">WiFi Recon</span><span className="text-emerald-400/70">{spoofedData.wifiNetworks}</span></div>
        <div className="flex justify-between"><span className="text-white/25">OSINT Scan</span><span className="text-emerald-400/70">{spoofedData.osintResults}</span></div>
        <div className="flex justify-between"><span className="text-white/25">Presence</span><span className="text-emerald-400/70">{spoofedData.presenceDetection}</span></div>
        <div className="flex justify-between"><span className="text-white/25">Vital Signs</span><span className="text-emerald-400/70">{spoofedData.vitalSigns}</span></div>
        <div className="flex justify-between"><span className="text-white/25">Location Intel</span><span className="text-emerald-400/70">{spoofedData.countryRisk}</span></div>
      </div>

      {/* Extension CTA */}
      <div className="mt-4 pt-3 border-t border-emerald-500/10">
        <p className="text-white/30 text-[9px] font-mono mb-3">
          Want this protection for real? Get the AIntivirus browser extension.
        </p>
        <a
          href="https://chromewebstore.google.com/detail/jkpokhekaohljmphbggdpemdapgjnhli?utm_source=item-share-cb"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/40 transition-all text-emerald-400 text-[10px] font-display font-semibold uppercase tracking-widest"
        >
          <Chrome size={12} />
          Add to Chrome
        </a>
      </div>
    </motion.div>
  );
}

// Risk-level palette — each maps to a cohesive color scheme used throughout the banner.
const RISK_STYLES = {
  minimal:  { accent: '#10b981', label: 'Minimal exposure',   text: 'text-emerald-400', ring: 'stroke-emerald-400', bg: 'bg-emerald-500/5',  border: 'border-emerald-500/25' },
  low:      { accent: '#22d3ee', label: 'Low visibility',     text: 'text-cyan-400',    ring: 'stroke-cyan-400',    bg: 'bg-cyan-500/5',     border: 'border-cyan-500/25' },
  moderate: { accent: '#facc15', label: 'Moderate tracking',  text: 'text-amber-400',   ring: 'stroke-amber-400',   bg: 'bg-amber-500/5',    border: 'border-amber-500/25' },
  high:     { accent: '#fb923c', label: 'High identifiability', text: 'text-orange-400',  ring: 'stroke-orange-400',  bg: 'bg-orange-500/5',   border: 'border-orange-500/25' },
  extreme:  { accent: '#ff2d55', label: 'Near-unique profile', text: 'text-rose-400',    ring: 'stroke-rose-400',    bg: 'bg-rose-500/5',     border: 'border-rose-500/25' },
} as const;

const CATEGORY_META: Record<SignalCategory, { label: string; icon: React.ReactNode }> = {
  fingerprint: { label: 'Fingerprint', icon: <Fingerprint size={10} /> },
  network:     { label: 'Network',     icon: <Wifi size={10} /> },
  device:      { label: 'Device',      icon: <Cpu size={10} /> },
  privacy:     { label: 'Privacy',     icon: <Lock size={10} /> },
};

function formatCrowd(crowd: number | null): string {
  if (crowd == null || crowd <= 0) return '—';
  if (crowd < 1_000) return `1 in ${crowd.toLocaleString()}`;
  if (crowd < 1_000_000) return `1 in ${Math.round(crowd / 100) * 100}`;
  if (crowd < 1_000_000_000) return `1 in ${(crowd / 1_000_000).toFixed(1)}M`;
  return `1 in ${(crowd / 1_000_000_000).toFixed(1)}B`;
}

function IdentifiabilityRing({ score, color }: { score: number; color: string }) {
  const size = 62;
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={4}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: [0.4, 0, 0.2, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-bold text-[15px] tabular-nums leading-none" style={{ color }}>
          {score}
        </span>
        <span className="text-[7px] uppercase tracking-wider text-white/30 mt-0.5">score</span>
      </div>
    </div>
  );
}

function CategoryBar({ category, bits, max, colorClass }: { category: SignalCategory; bits: number; max: number; colorClass: string }) {
  const meta = CATEGORY_META[category];
  const pct = max > 0 ? Math.min(100, (bits / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-white/35 flex items-center gap-1.5 w-[78px] shrink-0 text-[9px] uppercase tracking-wider font-mono">
        {meta.icon}
        {meta.label}
      </span>
      <div className="flex-1 h-[3px] rounded-full bg-white/[0.04] overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${colorClass}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>
      <span className="text-white/40 text-[9px] font-mono tabular-nums w-[38px] text-right shrink-0">
        {bits.toFixed(1)} b
      </span>
    </div>
  );
}

function ThreatReportCard() {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const fingerprints = useProfileStore((s) => s.fingerprints);
  const network = useProfileStore((s) => s.network);
  const hardware = useProfileStore((s) => s.hardware);
  const browser = useProfileStore((s) => s.browser);
  const tracking = useProfileStore((s) => s.trackingDetection);
  const vpn = useProfileStore((s) => s.vpnDetection);

  const report: ThreatReport = useMemo(
    () => computeThreatReport({ fingerprints, network, hardware, browser, tracking, vpn }),
    [fingerprints, network, hardware, browser, tracking, vpn],
  );

  const style = RISK_STYLES[report.riskLevel];
  const topSignals = report.signals.slice(0, expanded ? report.signals.length : 3);
  const maxCategoryBits = Math.max(1, ...Object.values(report.byCategory));

  const ringFillColor = style === RISK_STYLES.minimal ? '#34d399'
    : style === RISK_STYLES.low ? '#22d3ee'
    : style === RISK_STYLES.moderate ? '#facc15'
    : style === RISK_STYLES.high ? '#fb923c'
    : '#fb7185';

  if (dismissed) return null;

  return (
    <motion.div
      className="fixed bottom-4 right-4 z-50 w-[340px] max-w-[calc(100vw-2rem)]"
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 2.5, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className={`relative overflow-hidden bg-cyber-bg-card/95 backdrop-blur-xl border ${style.border} rounded-2xl shadow-2xl`} style={{ boxShadow: `0 20px 40px rgba(0,0,0,0.5), 0 0 30px ${style.accent}15` }}>
        {/* HUD corner brackets */}
        <span className="hud-corner hud-corner-tl" aria-hidden="true" style={{ borderColor: `${style.accent}aa` }} />
        <span className="hud-corner hud-corner-tr" aria-hidden="true" style={{ borderColor: `${style.accent}aa` }} />
        <span className="hud-corner hud-corner-bl" aria-hidden="true" style={{ borderColor: `${style.accent}aa` }} />
        <span className="hud-corner hud-corner-br" aria-hidden="true" style={{ borderColor: `${style.accent}aa` }} />

        {/* Animated top scan line */}
        <div className="absolute top-0 left-0 right-0 h-px overflow-hidden">
          <motion.div
            className="h-full"
            style={{ background: `linear-gradient(90deg, transparent, ${style.accent}, transparent)` }}
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
          />
        </div>

        {/* Close */}
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 z-10 text-white/25 hover:text-white/60 transition-colors p-1 rounded-md hover:bg-white/5"
          aria-label="Dismiss threat report"
        >
          <X size={13} />
        </button>

        {/* Header */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <motion.span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: style.accent }}
              animate={{ opacity: [1, 0.35, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            />
            <span className={`${style.text} text-[9px] font-mono uppercase tracking-[0.22em] font-semibold`}>
              Threat Report
            </span>
          </div>

          <div className="flex items-center gap-4">
            <IdentifiabilityRing score={report.identifiabilityScore} color={ringFillColor} />
            <div className="flex-1 min-w-0">
              <div className={`${style.text} text-[11px] font-display font-semibold uppercase tracking-wider leading-tight`}>
                {style.label}
              </div>
              <div className="text-white/55 text-[10px] font-mono mt-1 leading-snug">
                {report.entropyBits.toFixed(1)} bits of entropy leaked
              </div>
              <div className="text-white/35 text-[9px] font-mono mt-0.5 truncate">
                ≈ {formatCrowd(report.crowdSize)} browsers
              </div>
            </div>
          </div>
        </div>

        {/* Category breakdown */}
        <div className={`px-5 py-3 ${style.bg} border-y ${style.border}`}>
          <div className="flex items-center gap-1.5 mb-2.5">
            <span className="text-white/30 text-[8px] uppercase tracking-widest font-mono">Signal Mix</span>
            <span className="flex-1 h-px bg-white/5" />
          </div>
          <div className="space-y-1.5">
            {(Object.keys(CATEGORY_META) as SignalCategory[]).map((cat) => (
              <CategoryBar
                key={cat}
                category={cat}
                bits={report.byCategory[cat]}
                max={maxCategoryBits}
                colorClass={
                  cat === 'fingerprint' ? 'bg-gradient-to-r from-rose-500/70 to-rose-400'
                  : cat === 'network' ? 'bg-gradient-to-r from-orange-500/70 to-orange-400'
                  : cat === 'device' ? 'bg-gradient-to-r from-amber-500/70 to-amber-400'
                  : 'bg-gradient-to-r from-cyan-500/70 to-cyan-400'
                }
              />
            ))}
          </div>
        </div>

        {/* Top signals */}
        <div className="px-5 pt-3 pb-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/30 text-[8px] uppercase tracking-widest font-mono">
              {expanded ? 'All Signals' : 'Top Signals'}
            </span>
            {report.signals.length > 3 && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-white/40 hover:text-white/70 text-[9px] font-mono uppercase tracking-wider transition-colors"
              >
                {expanded ? 'Collapse' : `+${report.signals.length - 3} more`}
              </button>
            )}
          </div>
          <AnimatePresence initial={false}>
            <motion.div layout className="space-y-1">
              {topSignals.map((signal) => (
                <motion.div
                  key={signal.id}
                  layout
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2 py-1"
                >
                  <span
                    className="w-1 h-1 rounded-full shrink-0"
                    style={{
                      background:
                        signal.severity === 'critical' ? '#fb7185'
                        : signal.severity === 'high' ? '#fb923c'
                        : signal.severity === 'medium' ? '#facc15'
                        : '#64748b',
                    }}
                  />
                  <span className="text-white/60 text-[10px] flex-1 truncate">
                    {signal.label}
                  </span>
                  <span className="text-white/30 text-[9px] font-mono tabular-nums shrink-0">
                    {signal.bits > 0 ? `${signal.bits.toFixed(1)}b` : '—'}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* CTA */}
        <div className="px-5 pt-3 pb-4">
          <p className="text-white/35 text-[10px] font-mono mb-3 leading-relaxed">
            AIntivirus spoofs canvas + WebGL, randomizes fonts, and masks your WebRTC IP.
          </p>
          <a
            href="https://chromewebstore.google.com/detail/jkpokhekaohljmphbggdpemdapgjnhli?utm_source=item-share-cb"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-center gap-2.5 w-full py-2.5 rounded-xl transition-all text-[11px] font-display font-bold uppercase tracking-[0.15em]"
            style={{
              background: `${style.accent}1a`,
              border: `1px solid ${style.accent}55`,
              color: style.accent,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${style.accent}2a`; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = `${style.accent}1a`; }}
          >
            <ShieldCheck size={14} className="group-hover:scale-110 transition-transform" />
            Shield Me — Add to Chrome
          </a>
        </div>
      </div>
    </motion.div>
  );
}

// Keep old name as alias so existing JSX continues to work
const ExtensionBanner = ThreatReportCard;

function App() {
  // Initialize all tracking hooks
  useHardwareDetection();
  useNetworkInfo();
  useTypingDynamics();
  useMousePatterns();
  useAttentionTracker();
  useScrollTracker();
  useCopyPasteTracker();
  useEmotionTracker();
  useComprehensiveDetection();

  // Multi-visitor tracking
  const { visitors, currentVisitor, isConnected, chatMessages, sendChatMessage } = useVisitors();

  // All-time visitor history
  const { history: historicalVisitors } = useVisitorHistory();
  const [showAllTime, setShowAllTime] = useState(false);

  // Creepy intro popup - show once per session
  const [showIntro, setShowIntro] = useState(() => !sessionStorage.getItem('watcher_entered'));

  // McAfee Protocol mode
  const [mcafeeProtocol, setMcafeeProtocol] = useState(false);

  const { addConsoleEntry } = useProfileStore();

  useEffect(() => {
    addConsoleEntry('SYSTEM', 'YourInfo analyzer initialized');
    addConsoleEntry('SYSTEM', 'Starting comprehensive fingerprint analysis...');
    addConsoleEntry('INFO', 'All data processed locally - no server transmission');
  }, []);

  const handleEnterSite = () => {
    sessionStorage.setItem('watcher_entered', '1');
    setShowIntro(false);
  };

  return (
    <>
      {/* Creepy intro popup */}
      <AnimatePresence>
        {showIntro && (
          <CreepyIntroPopup visitor={currentVisitor} onEnter={handleEnterSite} />
        )}
      </AnimatePresence>

      {/* Fixed elements */}
      <ParticleBackground />
      <Navbar />
      <ExtensionBanner />
      
      {/* Page content - starts after navbar */}
      <div>
        {/* Spacer for fixed navbar */}
        <div className="h-[70px] md:h-[85px] xl:h-[100px]" aria-hidden="true" />
        
        {/* Main dashboard */}
        <main className="px-4 md:px-6 xl:px-8 pb-4 pt-4">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-0 xl:items-stretch rounded-2xl overflow-hidden border border-cyber-glass-border/30 shadow-2xl shadow-black/20">
            {/* Left Pane: Ad Auction - Hidden on mobile, shown first on desktop */}
            <div className="hidden xl:block xl:col-span-3 xl:h-[calc(100vh-120px)] overflow-hidden border-r border-white/5">
              <AdAuction />
            </div>

            {/* Center Pane: Globe */}
            <div className="xl:col-span-6 h-[55vh] md:h-[50vh] xl:h-[calc(100vh-120px)] bg-gradient-to-b from-cyber-bg-light/5 to-transparent relative overflow-hidden">
              {/* HUD corner brackets */}
              <span className="hud-corner hud-corner-tl hud-corner-lg" aria-hidden="true" />
              <span className="hud-corner hud-corner-tr hud-corner-lg" aria-hidden="true" />
              <span className="hud-corner hud-corner-bl hud-corner-lg" aria-hidden="true" />
              <span className="hud-corner hud-corner-br hud-corner-lg" aria-hidden="true" />

              {/* Soft vignette behind globe */}
              <div className="globe-vignette" aria-hidden="true" />

              {/* Status badges */}
              <div className="absolute top-3 left-3 md:left-4 z-20 flex flex-col items-start gap-2">
                <motion.div 
                  className={`flex items-center gap-2 bg-cyber-bg/60 backdrop-blur-xl px-3 md:px-4 py-1.5 md:py-2 rounded-full border ${
                    isConnected 
                      ? 'text-emerald-400 border-emerald-500/20' 
                      : 'text-rose-400 border-rose-500/20'
                  }`}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  <span className="text-[9px] md:text-[10px] font-display font-semibold uppercase tracking-[0.15em] md:tracking-[0.2em]">
                    {isConnected ? 'Live' : 'Offline'}
                  </span>
                </motion.div>
                <motion.div 
                  className="flex items-center gap-2 text-cyber-purple bg-cyber-bg/60 backdrop-blur-xl px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-cyber-purple/20"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <Users size={10} className="md:w-3 md:h-3" />
                  <span className="text-[9px] md:text-[10px] font-display font-semibold uppercase tracking-[0.15em] md:tracking-[0.2em]">
                    {visitors.length > 1 ? `${visitors.length - 1} Others Online` : 'You are the first'}
                  </span>
                </motion.div>
                <BatteryBadge />
                <motion.button
                  onClick={() => setShowAllTime((v) => !v)}
                  className={`flex items-center gap-2 bg-cyber-bg/60 backdrop-blur-xl px-3 md:px-4 py-1.5 md:py-2 rounded-full border cursor-pointer transition-colors ${
                    showAllTime
                      ? 'text-cyber-cyan border-cyber-cyan/30'
                      : 'text-white/40 border-white/10 hover:text-white/60 hover:border-white/20'
                  }`}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 }}
                >
                  <Globe size={10} className="md:w-3 md:h-3" />
                  <span className="text-[9px] md:text-[10px] font-display font-semibold uppercase tracking-[0.15em] md:tracking-[0.2em]">
                    {showAllTime ? `All Time (${historicalVisitors.length})` : 'All Time'}
                  </span>
                </motion.button>
                {showAllTime && (
                  <CountryCounter historicalVisitors={historicalVisitors} visitors={visitors} />
                )}
                <motion.button
                  onClick={() => setMcafeeProtocol((v) => !v)}
                  className={`flex items-center gap-2 bg-cyber-bg/60 backdrop-blur-xl px-3 md:px-4 py-1.5 md:py-2 rounded-full border cursor-pointer transition-colors ${
                    mcafeeProtocol
                      ? 'text-emerald-400 border-emerald-500/30'
                      : 'text-white/40 border-white/10 hover:text-white/60 hover:border-white/20'
                  }`}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.3 }}
                >
                  {mcafeeProtocol ? <ShieldCheck size={10} className="md:w-3 md:h-3" /> : <Shield size={10} className="md:w-3 md:h-3" />}
                  <span className="text-[9px] md:text-[10px] font-display font-semibold uppercase tracking-[0.15em] md:tracking-[0.2em]">
                    McAfee Protocol
                  </span>
                </motion.button>
                <ChatBox
                  messages={chatMessages}
                  onSend={sendChatMessage}
                  isConnected={isConnected}
                />
              </div>
              
              {/* Globe container - centered with room for location overlay */}
              <div className="absolute top-[5%] left-[5%] right-[5%] bottom-[90px] md:top-[10%] md:left-[10%] md:right-[10%] md:bottom-[110px] flex items-center justify-center">
                <Globe3D 
                  visitors={visitors}
                  currentVisitorId={currentVisitor?.id ?? null}
                  historicalVisitors={historicalVisitors}
                  showAllTime={showAllTime}
                />
              </div>

              {/* Location info - positioned at bottom, inside container */}
              <div className="absolute bottom-2 md:bottom-3 left-2 md:left-4 right-2 md:right-4 z-10">
                <LocationOverlay visitor={currentVisitor} isConnected={isConnected} />
              </div>
            </div>

            {/* Right Pane: User Information */}
            <div className="xl:col-span-3 xl:h-[calc(100vh-120px)] xl:overflow-y-auto border-t xl:border-t-0 xl:border-l border-white/5 relative">
              <AnimatePresence>
                {mcafeeProtocol && <McAfeeProtocolOverlay />}
              </AnimatePresence>
              <div className={`p-4 md:p-6 ${mcafeeProtocol ? 'relative z-10' : ''}`}>
                <AnimatePresence>
                  <McAfeeProtocolBanner active={mcafeeProtocol} />
                </AnimatePresence>
                {/* Identity Profile */}
                <div className="mb-8">
                  <SectionTitle icon={<User size={14} />}>Identity Profile</SectionTitle>
                  <UserProfileSection />
                  <PersonalityTraitsSection />
                  <FraudRiskSection />
                  <BotDetectionSection />
                </div>

                {/* Behavioral Analysis */}
                <div className="mb-8">
                  <SectionTitle icon={<Activity size={14} />}>Behavioral Analysis</SectionTitle>
                  <YouRightNowSection />
                  <EmotionsSection />
                  <MouseBehaviorSection />
                  <TypingBehaviorSection />
                </div>

                {/* OSINT Intelligence - GhostTrack inspired */}
                <div className="mb-8">
                  <SectionTitle icon={<Crosshair size={14} />}>OSINT Intelligence</SectionTitle>
                  <IPDeepAnalysisSection />
                  <UsernameTrackerSection />
                  <PhoneIntelSection />
                </div>

                {/* Signal Intelligence - WiFi DensePose inspired */}
                <div className="mb-8">
                  <SectionTitle icon={<Radio size={14} />}>Signal Intelligence</SectionTitle>
                  <WiFiScannerSection />
                  <PresenceDetectionSection />
                  <VitalSignsSection />
                  <SignalObservatorySection />
                </div>

                {/* AI Summary */}
                <div className="mb-8">
                  <AIAnalysisHero />
                </div>

                {/* Deep AI Insights */}
                <div className="mb-8">
                  <SectionTitle icon={<Brain size={14} />}>Deep AI Insights</SectionTitle>
                  <PersonalLifeSection />
                  <MentalPhysicalSection />
                  <LifestyleSection />
                  <FinancialSection />
                  <CreepyInsightsSection />
                  <InferredInterestsSection />
                </div>

                {/* Technical Fingerprinting */}
                <div className="mb-8">
                  <SectionTitle
                    icon={mcafeeProtocol ? <ShieldCheck size={14} /> : <Shield size={14} />}
                    badge={mcafeeProtocol
                      ? <span className="text-[9px] font-mono text-emerald-400/70 bg-emerald-500/10 px-2 py-0.5 rounded animate-pulse">PROTECTED</span>
                      : <span className="text-[9px] font-mono text-rose-400/70 bg-rose-500/10 px-2 py-0.5 rounded">EXPOSED</span>
                    }
                  >
                    Technical Fingerprinting
                  </SectionTitle>

                  <div className="mb-6">
                    <SubsectionTitle>Spoof & Integrity Analysis</SubsectionTitle>
                    <LieDetectionSection />
                    <HeadlessDetectionSection />
                  </div>

                  <div className="mb-6">
                    <SubsectionTitle>Core Fingerprints</SubsectionTitle>
                    <CrossBrowserTrackingSection />
                    <BrowserInfoSection />
                    <AdvancedFingerprintsSection />
                    <FingerprintsSection />
                    <DOMRectCSSSection />
                  </div>

                  <div className="mb-6">
                    <SubsectionTitle>Hardware & System</SubsectionTitle>
                    <HardwareSection />
                    <DisplaySection />
                    <AdvancedDisplaySection />
                    <SensorsSection />
                    <StorageSection />
                    <KeyboardLayoutSection />
                  </div>

                  <div className="mb-6">
                    <SubsectionTitle>Network & Privacy</SubsectionTitle>
                    <CloudflareTraceSection />
                    <NetworkSection />
                    <WebRTCLeakSection />
                    <VPNDetectionSection />
                    <TrackingDetectionSection />
                    <PermissionsSection />
                  </div>

                  <div className="mb-6">
                    <SubsectionTitle>Advanced Web APIs</SubsectionTitle>
                    <WebGPUFingerprintSection />
                    <WasmFingerprintSection />
                    <ChromeAISection />
                    <WebAPISection />
                  </div>

                  <div className="mb-6">
                    <SubsectionTitle>Multimedia & Input</SubsectionTitle>
                    <MediaDevicesSection />
                    <MediaCodecsSection />
                    <JSMemorySection />
                    <ClientHintsSection />
                  </div>

                  <div className="mb-6">
                    <SubsectionTitle>Interaction Details</SubsectionTitle>
                    <ScrollBehaviorSection />
                    <AttentionTrackingSection />
                    <CopyPasteSection />
                    <BrowserAnalysisSection />
                  </div>

                  <div className="mb-6">
                    <SubsectionTitle>Account Detection</SubsectionTitle>
                    <SocialLoginsSection />
                    <CryptoWalletsSection />
                    <APISupportSection />
                    <SystemPreferencesSection />
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Mobile Ad Auction - shown only on mobile/tablet */}
          <div className="xl:hidden border-t border-cyber-glass-border/30">
            <AdAuction />
          </div>
        </main>
        
      </div>
    </>
  );
}

export default App;
