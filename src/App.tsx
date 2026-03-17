import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ShieldCheck, Activity, User, Brain, Users, Navigation, Loader2, AlertCircle, BatteryFull, BatteryMedium, BatteryLow, BatteryCharging, Globe, X, Chrome, Eye, MapPin, Wifi, Monitor } from 'lucide-react';
import type { Visitor } from './hooks/useVisitors';

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
import Footer from './components/Footer/Footer';

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

// Store
import { useProfileStore } from './store/useProfileStore';

function ParticleBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Gradient orbs - static, no animation needed */}
      <div 
        className="absolute w-[800px] h-[800px] rounded-full opacity-[0.03]"
        style={{
          background: 'radial-gradient(circle, #00f0ff 0%, transparent 70%)',
          top: '-20%',
          left: '-10%',
          filter: 'blur(60px)',
        }}
      />
      <div 
        className="absolute w-[600px] h-[600px] rounded-full opacity-[0.03]"
        style={{
          background: 'radial-gradient(circle, #bf5af2 0%, transparent 70%)',
          bottom: '-10%',
          right: '-5%',
          filter: 'blur(60px)',
        }}
      />
      
      {/* Grid */}
      <div className="absolute inset-0 cyber-grid opacity-40" />
      
      {/* Hexagon pattern */}
      <div className="absolute inset-0 hexagon-bg" />
      
      {/* Floating particles - CSS animation instead of Framer Motion (reduced to 6) */}
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
      <span className="text-white/40">{icon}</span>
      <h2 className="text-[11px] font-medium uppercase tracking-wider text-white/50">{children}</h2>
      <div className="flex-1 h-px bg-white/5" />
      {badge && badge}
    </motion.div>
  );
}

function SubsectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-white/30 text-[10px] uppercase tracking-widest mb-4 font-medium">
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
        <div className="space-y-8 mb-14">
          {indicators.map((item, i) => (
            <AnimatePresence key={i}>
              {step > i && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5 }}
                  className="bg-cyber-bg-card/80 border border-white/5 rounded-xl px-6 py-6"
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

function ExtensionBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [threatCount, setThreatCount] = useState(0);
  const network = useProfileStore((s) => s.network);
  const fingerprints = useProfileStore((s) => s.fingerprints);
  const trackingDetection = useProfileStore((s) => s.trackingDetection);
  const vpn = useProfileStore((s) => s.vpnDetection);

  // Count real "threats" detected on this user
  const exposedPoints = useMemo(() => {
    const points: string[] = [];
    if (network.ip) points.push('IP address exposed');
    if (fingerprints.canvasHash) points.push('Canvas fingerprint captured');
    if (fingerprints.webglHash) points.push('WebGL fingerprint captured');
    if (fingerprints.audioHash) points.push('Audio fingerprint captured');
    if (!trackingDetection.adBlocker) points.push('No ad blocker detected');
    if (!trackingDetection.doNotTrack) points.push('Do Not Track disabled');
    if (fingerprints.crossBrowserId) points.push('Cross-browser ID generated');
    if (network.isp) points.push('ISP identified');
    if (vpn.webrtcLeak) points.push('WebRTC leak detected');
    if (fingerprints.fontsDetected > 0) points.push(`${fingerprints.fontsDetected} fonts enumerated`);
    return points;
  }, [network, fingerprints, trackingDetection, vpn]);

  // Animate the threat counter up
  useEffect(() => {
    if (exposedPoints.length === 0) return;
    const target = exposedPoints.length;
    let current = 0;
    const interval = setInterval(() => {
      current++;
      setThreatCount(current);
      if (current >= target) clearInterval(interval);
    }, 150);
    return () => clearInterval(interval);
  }, [exposedPoints.length]);

  // Cycle through exposed points as a live ticker
  const [tickerIndex, setTickerIndex] = useState(0);
  useEffect(() => {
    if (exposedPoints.length === 0) return;
    const interval = setInterval(() => {
      setTickerIndex((i) => (i + 1) % exposedPoints.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [exposedPoints.length]);

  if (dismissed) return null;

  return (
    <motion.div
      className="fixed bottom-4 right-4 z-50 w-[320px]"
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 3, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="relative overflow-hidden bg-cyber-bg-card/95 backdrop-blur-xl border border-cyber-red/30 rounded-2xl shadow-2xl shadow-cyber-red/10">
        {/* Animated top border glow */}
        <div className="absolute top-0 left-0 right-0 h-[1px]">
          <motion.div
            className="h-full bg-gradient-to-r from-transparent via-cyber-red to-transparent"
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
        </div>

        {/* Scanline effect */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,45,85,0.15) 2px, rgba(255,45,85,0.15) 4px)',
        }} />

        {/* Close button */}
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 z-10 text-white/20 hover:text-white/50 transition-colors"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>

        {/* Alert header */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <motion.div
              className="w-2 h-2 rounded-full bg-cyber-red"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className="text-cyber-red text-[9px] font-mono uppercase tracking-[0.25em] font-bold">
              Threat Report
            </span>
          </div>

          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-display font-bold text-cyber-red tabular-nums">
              {threatCount}
            </span>
            <span className="text-white/40 text-[11px] font-display">
              vulnerabilities detected on your browser
            </span>
          </div>
        </div>

        {/* Live threat ticker */}
        <div className="px-5 py-2.5 bg-cyber-red/5 border-y border-cyber-red/10">
          <AnimatePresence mode="wait">
            <motion.div
              key={tickerIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2"
            >
              <Shield size={10} className="text-cyber-red/60 shrink-0" />
              <span className="text-white/50 text-[10px] font-mono truncate">
                {exposedPoints[tickerIndex] || 'Scanning...'}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* CTA */}
        <div className="px-5 pt-3 pb-4">
          <p className="text-white/30 text-[10px] font-mono mb-3 leading-relaxed">
            The AIntivirus extension blocks fingerprinting, spoofs your identity, and keeps trackers blind.
          </p>
          <a
            href="https://chromewebstore.google.com/detail/jkpokhekaohljmphbggdpemdapgjnhli?utm_source=item-share-cb"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-center gap-2.5 w-full py-2.5 rounded-xl bg-cyber-red/10 border border-cyber-red/30 hover:bg-cyber-red/20 hover:border-cyber-red/50 hover:shadow-lg hover:shadow-cyber-red/10 transition-all text-cyber-red text-[11px] font-display font-bold uppercase tracking-[0.15em]"
          >
            <ShieldCheck size={14} className="group-hover:scale-110 transition-transform" />
            Protect Now — Add to Chrome
          </a>
        </div>
      </div>
    </motion.div>
  );
}

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
                    <SubsectionTitle>Core Fingerprints</SubsectionTitle>
                    <CrossBrowserTrackingSection />
                    <BrowserInfoSection />
                    <AdvancedFingerprintsSection />
                    <FingerprintsSection />
                  </div>

                  <div className="mb-6">
                    <SubsectionTitle>Hardware & System</SubsectionTitle>
                    <HardwareSection />
                    <DisplaySection />
                    <SensorsSection />
                    <StorageSection />
                  </div>

                  <div className="mb-6">
                    <SubsectionTitle>Network & Privacy</SubsectionTitle>
                    <NetworkSection />
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
        
        {/* Footer - at the very end, after all dashboard content */}
        <Footer />
      </div>
    </>
  );
}

export default App;
