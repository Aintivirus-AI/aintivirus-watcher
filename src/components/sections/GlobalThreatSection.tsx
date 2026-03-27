import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, AlertTriangle, Shield, Zap, MapPin, Newspaper, Skull, Lock } from 'lucide-react';
import { useProfileStore } from '../../store/useProfileStore';
import { DataSection, DataRow, StatusRow } from '../ui/DataSection';

// ============================================
// GLOBAL THREAT INTELLIGENCE - Inspired by World Monitor
// ============================================

// Country risk database
const COUNTRY_RISK_DATA: Record<string, {
  cyberThreat: number; privacyScore: number; surveillanceLevel: string;
  censorship: string; dataRetention: string; fiveEyes: boolean;
  knownAPTs: string[]; recentIncidents: string[];
}> = {
  'United States': {
    cyberThreat: 65, privacyScore: 45, surveillanceLevel: 'High',
    censorship: 'Low', dataRetention: 'Voluntary', fiveEyes: true,
    knownAPTs: ['Equation Group', 'Longhorn', 'Lamberts'],
    recentIncidents: ['SolarWinds breach aftermath', 'MOVEit exploitation wave', 'Healthcare sector targeting'],
  },
  'United Kingdom': {
    cyberThreat: 60, privacyScore: 50, surveillanceLevel: 'High',
    censorship: 'Low', dataRetention: 'Mandatory', fiveEyes: true,
    knownAPTs: ['GCHQ ops', 'Turla variants'],
    recentIncidents: ['Royal Mail ransomware', 'NHS supply chain attack', 'Electoral Commission breach'],
  },
  'China': {
    cyberThreat: 90, privacyScore: 15, surveillanceLevel: 'Extreme',
    censorship: 'Extreme', dataRetention: 'Mandatory + Monitoring', fiveEyes: false,
    knownAPTs: ['APT41', 'APT10', 'Hafnium', 'Volt Typhoon', 'Salt Typhoon'],
    recentIncidents: ['Telecom infrastructure compromise', 'Zero-day exploitation campaigns', 'AI-enabled phishing'],
  },
  'Russia': {
    cyberThreat: 85, privacyScore: 20, surveillanceLevel: 'Very High',
    censorship: 'High', dataRetention: 'Mandatory + SORM', fiveEyes: false,
    knownAPTs: ['APT28/Fancy Bear', 'APT29/Cozy Bear', 'Sandworm', 'Turla'],
    recentIncidents: ['Critical infrastructure attacks', 'Wiper malware campaigns', 'Election interference ops'],
  },
  'Germany': {
    cyberThreat: 45, privacyScore: 75, surveillanceLevel: 'Moderate',
    censorship: 'Low', dataRetention: 'Limited (GDPR)', fiveEyes: false,
    knownAPTs: [],
    recentIncidents: ['Ransomware on hospital systems', 'Supply chain attacks on auto industry'],
  },
  'India': {
    cyberThreat: 55, privacyScore: 35, surveillanceLevel: 'High',
    censorship: 'Moderate', dataRetention: 'Mandatory', fiveEyes: false,
    knownAPTs: ['SideWinder', 'Patchwork'],
    recentIncidents: ['AIIMS hospital breach', 'Banking trojan campaigns', 'Telecom data leaks'],
  },
  'Japan': {
    cyberThreat: 50, privacyScore: 60, surveillanceLevel: 'Moderate',
    censorship: 'Low', dataRetention: 'Limited', fiveEyes: false,
    knownAPTs: [],
    recentIncidents: ['Port system disruption', 'Defense contractor breach', 'Cryptocurrency exchange hacks'],
  },
  'Brazil': {
    cyberThreat: 60, privacyScore: 40, surveillanceLevel: 'Moderate',
    censorship: 'Low', dataRetention: 'Mandatory (Marco Civil)', fiveEyes: false,
    knownAPTs: ['Prilex'],
    recentIncidents: ['Banking malware surge', 'PIX fraud campaigns', 'Government portal breach'],
  },
  'Australia': {
    cyberThreat: 55, privacyScore: 40, surveillanceLevel: 'High',
    censorship: 'Low', dataRetention: 'Mandatory', fiveEyes: true,
    knownAPTs: [],
    recentIncidents: ['Optus data breach', 'Medibank hack', 'Port operator ransomware'],
  },
  'Canada': {
    cyberThreat: 50, privacyScore: 55, surveillanceLevel: 'Moderate',
    censorship: 'Low', dataRetention: 'Limited', fiveEyes: true,
    knownAPTs: [],
    recentIncidents: ['Indigo ransomware', 'Government contractor breach', 'Healthcare system targeting'],
  },
};

// Default for countries not in database
const DEFAULT_RISK = {
  cyberThreat: 50, privacyScore: 50, surveillanceLevel: 'Unknown',
  censorship: 'Unknown', dataRetention: 'Unknown', fiveEyes: false,
  knownAPTs: [] as string[], recentIncidents: ['Insufficient data for this region'] as string[],
};

// Simulated live threat feed
const THREAT_FEED_ITEMS = [
  { type: 'CRITICAL', source: 'CISA', message: 'Active exploitation of zero-day in enterprise VPN appliances', region: 'Global' },
  { type: 'HIGH', source: 'NCSC', message: 'Spear-phishing campaign targeting financial sector using AI-generated lures', region: 'EMEA' },
  { type: 'CRITICAL', source: 'CERT', message: 'Ransomware group deploying novel encryption targeting cloud backups', region: 'Americas' },
  { type: 'MEDIUM', source: 'FBI', message: 'Business email compromise ring netting $12M across 40 organizations', region: 'North America' },
  { type: 'HIGH', source: 'Mandiant', message: 'State-sponsored actor compromising telecom infrastructure globally', region: 'APAC' },
  { type: 'CRITICAL', source: 'ENISA', message: 'Supply chain attack via popular npm package — 15M downloads affected', region: 'Global' },
  { type: 'HIGH', source: 'CrowdStrike', message: 'New info-stealer variant bypassing EDR through kernel driver abuse', region: 'Global' },
  { type: 'MEDIUM', source: 'Recorded Future', message: 'DDoS-for-hire services targeting healthcare organizations', region: 'Europe' },
  { type: 'HIGH', source: 'Unit42', message: 'Cryptojacking campaign targeting misconfigured Kubernetes clusters', region: 'Global' },
  { type: 'CRITICAL', source: 'Secureworks', message: 'Wiper malware targeting industrial control systems in energy sector', region: 'Middle East' },
  { type: 'MEDIUM', source: 'Kaspersky', message: 'Banking trojan evolves with deepfake voice cloning for call center fraud', region: 'LATAM' },
  { type: 'HIGH', source: 'MITRE', message: 'Novel persistence technique abusing Windows CIM repository', region: 'Global' },
];

// Country Risk Intelligence Section
export function CountryRiskSection() {
  const network = useProfileStore((s) => s.network);
  const country = network.country || 'Unknown';
  const riskData = COUNTRY_RISK_DATA[country] || DEFAULT_RISK;

  const overallRisk = Math.round((riskData.cyberThreat + (100 - riskData.privacyScore)) / 2);
  const riskLevel = overallRisk > 70 ? 'CRITICAL' : overallRisk > 50 ? 'ELEVATED' : overallRisk > 30 ? 'MODERATE' : 'LOW';
  const riskColor = overallRisk > 70 ? 'text-rose-400' : overallRisk > 50 ? 'text-amber-400' : overallRisk > 30 ? 'text-cyan-400' : 'text-emerald-400';

  return (
    <DataSection
      title="Country Intelligence"
      icon={<MapPin size={14} />}
      badge={
        <span className={`text-[9px] font-mono ${riskColor} bg-white/5 px-2 py-0.5 rounded`}>
          {riskLevel}
        </span>
      }
    >
      <div className="mb-3 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-white/80 text-sm font-display font-semibold">{country}</span>
          {riskData.fiveEyes && (
            <span className="text-[8px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
              FIVE EYES
            </span>
          )}
        </div>

        {/* Risk gauge */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-2 rounded-lg bg-white/[0.02] text-center">
            <span className={`font-mono text-lg font-bold ${riskData.cyberThreat > 60 ? 'text-rose-400' : riskData.cyberThreat > 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {riskData.cyberThreat}
            </span>
            <span className="text-white/30 text-[8px] uppercase block mt-0.5">Cyber Threat</span>
          </div>
          <div className="p-2 rounded-lg bg-white/[0.02] text-center">
            <span className={`font-mono text-lg font-bold ${riskData.privacyScore < 40 ? 'text-rose-400' : riskData.privacyScore < 60 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {riskData.privacyScore}
            </span>
            <span className="text-white/30 text-[8px] uppercase block mt-0.5">Privacy Score</span>
          </div>
        </div>
      </div>

      <DataRow label="Surveillance Level" value={riskData.surveillanceLevel} valueColor={
        riskData.surveillanceLevel === 'Extreme' ? 'text-rose-400' :
        riskData.surveillanceLevel === 'Very High' || riskData.surveillanceLevel === 'High' ? 'text-amber-400' :
        'text-white/80'
      } />
      <DataRow label="Censorship" value={riskData.censorship} valueColor={
        riskData.censorship === 'Extreme' ? 'text-rose-400' :
        riskData.censorship === 'High' ? 'text-amber-400' : 'text-white/80'
      } />
      <DataRow label="Data Retention" value={riskData.dataRetention} />
      <StatusRow label="Five Eyes Alliance" detected={riskData.fiveEyes} alertOnDetect />

      {riskData.knownAPTs.length > 0 && (
        <div className="mt-2 pt-2 border-t border-white/5">
          <span className="text-[9px] font-mono text-white/25 uppercase tracking-wider">Known APT Groups</span>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {riskData.knownAPTs.map((apt, i) => (
              <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400/70 border border-rose-500/10">
                {apt}
              </span>
            ))}
          </div>
        </div>
      )}

      {riskData.recentIncidents.length > 0 && (
        <div className="mt-3 pt-2 border-t border-white/5">
          <span className="text-[9px] font-mono text-white/25 uppercase tracking-wider">Recent Incidents</span>
          <div className="mt-1.5 space-y-1.5">
            {riskData.recentIncidents.map((incident, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertTriangle size={9} className="text-amber-400/50 mt-0.5 shrink-0" />
                <span className="text-[10px] text-white/50 leading-relaxed">{incident}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </DataSection>
  );
}

// Live Threat Feed
export function ThreatFeedSection() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [feedItems] = useState(THREAT_FEED_ITEMS);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % feedItems.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [feedItems.length]);

  const typeColorMap: Record<string, string> = {
    'CRITICAL': 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    'HIGH': 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    'MEDIUM': 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    'LOW': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  };

  return (
    <DataSection
      title="Live Threat Feed"
      icon={<Newspaper size={14} />}
      badge={
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
          <span className="text-[9px] font-mono text-rose-400/70">LIVE</span>
        </div>
      }
    >
      {/* Current threat highlight */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="mb-3 pb-3 border-b border-white/5"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border ${typeColorMap[feedItems[currentIndex].type]}`}>
              {feedItems[currentIndex].type}
            </span>
            <span className="text-[8px] font-mono text-white/30">{feedItems[currentIndex].source}</span>
            <span className="text-[8px] font-mono text-white/20 ml-auto">{feedItems[currentIndex].region}</span>
          </div>
          <p className="text-[11px] text-white/70 leading-relaxed">
            {feedItems[currentIndex].message}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Feed history */}
      <div className="space-y-0">
        {feedItems.slice(0, 6).map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: i === currentIndex % 6 ? 1 : 0.5, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`flex items-start gap-2 py-2 border-b border-white/[0.03] last:border-0 ${i === currentIndex % 6 ? '' : ''}`}
          >
            <span className={`text-[7px] font-mono font-bold px-1 py-0.5 rounded shrink-0 mt-0.5 ${typeColorMap[item.type]}`}>
              {item.type.charAt(0)}
            </span>
            <span className="text-[10px] text-white/40 truncate">{item.message}</span>
          </motion.div>
        ))}
      </div>
    </DataSection>
  );
}

// Network Threat Assessment
export function NetworkThreatSection() {
  const network = useProfileStore((s) => s.network);
  const fingerprints = useProfileStore((s) => s.fingerprints);
  const tracking = useProfileStore((s) => s.trackingDetection);
  const vpn = useProfileStore((s) => s.vpnDetection);
  // Calculate exposure score
  const exposureScore = useMemo(() => {
    let score = 0;
    if (network.ip) score += 15;
    if (fingerprints.canvasHash) score += 10;
    if (fingerprints.webglHash) score += 10;
    if (fingerprints.audioHash) score += 10;
    if (fingerprints.crossBrowserId) score += 15;
    if (!tracking.adBlocker) score += 10;
    if (!tracking.doNotTrack) score += 5;
    if (vpn.webrtcLeak) score += 15;
    if (!vpn.likelyUsingVPN) score += 10;
    return Math.min(100, score);
  }, [network, fingerprints, tracking, vpn]);

  const [animatedScore, setAnimatedScore] = useState(0);
  useEffect(() => {
    let current = 0;
    const interval = setInterval(() => {
      current += 2;
      if (current >= exposureScore) {
        setAnimatedScore(exposureScore);
        clearInterval(interval);
      } else {
        setAnimatedScore(current);
      }
    }, 30);
    return () => clearInterval(interval);
  }, [exposureScore]);

  return (
    <DataSection
      title="Exposure Assessment"
      icon={<Shield size={14} />}
      badge={
        <span className={`text-[9px] font-mono px-2 py-0.5 rounded ${
          exposureScore > 70 ? 'text-rose-400 bg-rose-500/10' :
          exposureScore > 40 ? 'text-amber-400 bg-amber-500/10' :
          'text-emerald-400 bg-emerald-500/10'
        }`}>
          {exposureScore}/100
        </span>
      }
    >
      {/* Exposure meter */}
      <div className="mb-3 pb-3 border-b border-white/5">
        <div className="flex justify-between text-[9px] font-mono text-white/30 mb-1">
          <span>Digital Exposure</span>
          <span>{animatedScore}%</span>
        </div>
        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: exposureScore > 70
                ? 'linear-gradient(to right, #f87171, #ef4444)'
                : exposureScore > 40
                  ? 'linear-gradient(to right, #facc15, #f59e0b)'
                  : 'linear-gradient(to right, #4ade80, #22c55e)',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${animatedScore}%` }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Threat vectors */}
      <div className="space-y-0">
        <StatusRow label="IP Exposed" detected={!!network.ip} alertOnDetect />
        <StatusRow label="Canvas Tracked" detected={!!fingerprints.canvasHash} alertOnDetect />
        <StatusRow label="WebGL Tracked" detected={!!fingerprints.webglHash} alertOnDetect />
        <StatusRow label="Audio Tracked" detected={!!fingerprints.audioHash} alertOnDetect />
        <StatusRow label="Cross-Browser ID" detected={!!fingerprints.crossBrowserId} alertOnDetect />
        <StatusRow label="Ad Blocker Active" detected={tracking.adBlocker} />
        <StatusRow label="DNT Enabled" detected={tracking.doNotTrack} />
        <StatusRow label="VPN Active" detected={vpn.likelyUsingVPN} />
        <StatusRow label="WebRTC Leak" detected={vpn.webrtcLeak} alertOnDetect />
      </div>
    </DataSection>
  );
}

// Global Threat Map Stats (summary for globe area)
export function GlobalThreatStatsSection() {
  const [stats, setStats] = useState({
    activeCampaigns: 0,
    countriesAffected: 0,
    breachesThisMonth: 0,
    ransomwareIncidents: 0,
  });

  useEffect(() => {
    // Animate stats in
    const targets = { activeCampaigns: 847, countriesAffected: 142, breachesThisMonth: 2341, ransomwareIncidents: 156 };
    const duration = 2000;
    const steps = 50;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      const progress = Math.min(step / steps, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setStats({
        activeCampaigns: Math.floor(targets.activeCampaigns * eased),
        countriesAffected: Math.floor(targets.countriesAffected * eased),
        breachesThisMonth: Math.floor(targets.breachesThisMonth * eased),
        ransomwareIncidents: Math.floor(targets.ransomwareIncidents * eased),
      });
      if (step >= steps) clearInterval(interval);
    }, duration / steps);

    return () => clearInterval(interval);
  }, []);

  return (
    <DataSection
      title="Global Threat Overview"
      icon={<Globe size={14} />}
      badge={
        <span className="text-[9px] font-mono text-rose-400/70 bg-rose-500/10 px-2 py-0.5 rounded animate-pulse">
          REAL-TIME
        </span>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-lg bg-white/[0.02] text-center">
          <Skull size={14} className="text-rose-400/70 mx-auto mb-1" />
          <span className="text-rose-400 font-mono text-base font-bold">{stats.activeCampaigns.toLocaleString()}</span>
          <span className="text-white/30 text-[8px] uppercase block mt-0.5">Active Campaigns</span>
        </div>
        <div className="p-3 rounded-lg bg-white/[0.02] text-center">
          <Globe size={14} className="text-amber-400/70 mx-auto mb-1" />
          <span className="text-amber-400 font-mono text-base font-bold">{stats.countriesAffected}</span>
          <span className="text-white/30 text-[8px] uppercase block mt-0.5">Countries Affected</span>
        </div>
        <div className="p-3 rounded-lg bg-white/[0.02] text-center">
          <Lock size={14} className="text-violet-400/70 mx-auto mb-1" />
          <span className="text-violet-400 font-mono text-base font-bold">{stats.breachesThisMonth.toLocaleString()}</span>
          <span className="text-white/30 text-[8px] uppercase block mt-0.5">Breaches (Mar)</span>
        </div>
        <div className="p-3 rounded-lg bg-white/[0.02] text-center">
          <Zap size={14} className="text-cyan-400/70 mx-auto mb-1" />
          <span className="text-cyan-400 font-mono text-base font-bold">{stats.ransomwareIncidents}</span>
          <span className="text-white/30 text-[8px] uppercase block mt-0.5">Ransomware</span>
        </div>
      </div>
    </DataSection>
  );
}

// Combined Global Threat Intelligence Section
export function GlobalThreatIntelligenceSection() {
  return (
    <>
      <GlobalThreatStatsSection />
      <CountryRiskSection />
      <ThreatFeedSection />
      <NetworkThreatSection />
    </>
  );
}
