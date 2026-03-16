import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Activity, User, Brain, Users, Navigation, Loader2, AlertCircle, BatteryFull, BatteryMedium, BatteryLow, BatteryCharging, Globe, X, Chrome } from 'lucide-react';
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

function ExtensionBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <motion.div
      className="fixed bottom-4 right-4 z-50 max-w-[280px]"
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ delay: 2, duration: 0.4 }}
    >
      <div className="relative bg-cyber-bg-card/95 backdrop-blur-xl border border-cyber-cyan/20 rounded-xl p-4 shadow-lg shadow-cyber-cyan/5">
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-2 right-2 text-white/30 hover:text-white/60 transition-colors"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/20 flex items-center justify-center">
            <Chrome size={18} className="text-cyber-cyan" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-display font-semibold text-cyber-text uppercase tracking-wide leading-tight">
              Protect Your Privacy
            </p>
            <p className="text-[10px] text-cyber-text-dim mt-1 leading-relaxed">
              Get our browser extension to block trackers like the ones shown here.
            </p>
          </div>
        </div>
        <a
          href="https://chromewebstore.google.com/detail/jkpokhekaohljmphbggdpemdapgjnhli?utm_source=item-share-cb"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/20 hover:bg-cyber-cyan/20 hover:border-cyber-cyan/40 transition-all text-cyber-cyan text-[10px] font-display font-semibold uppercase tracking-widest"
        >
          <Chrome size={12} />
          Add to Chrome
        </a>
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

  const { addConsoleEntry } = useProfileStore();

  useEffect(() => {
    addConsoleEntry('SYSTEM', 'YourInfo analyzer initialized');
    addConsoleEntry('SYSTEM', 'Starting comprehensive fingerprint analysis...');
    addConsoleEntry('INFO', 'All data processed locally - no server transmission');
  }, []);

  return (
    <>
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
            <div className="xl:col-span-3 xl:h-[calc(100vh-120px)] xl:overflow-y-auto border-t xl:border-t-0 xl:border-l border-white/5">
              <div className="p-4 md:p-6">
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
                    icon={<Shield size={14} />}
                    badge={<span className="text-[9px] font-mono text-rose-400/70 bg-rose-500/10 px-2 py-0.5 rounded">EXPOSED</span>}
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
