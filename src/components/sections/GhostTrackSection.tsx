import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Phone, Globe, CheckCircle2, AtSign } from 'lucide-react';
import { useProfileStore } from '../../store/useProfileStore';
import { DataSection, DataRow, StatusRow } from '../ui/DataSection';

// ============================================
// OSINT TRACKER - Inspired by GhostTrack
// ============================================

// Simulated platform databases for username tracking
const PLATFORMS = [
  { name: 'Google', icon: '🔍', category: 'search' },
  { name: 'Facebook', icon: '📘', category: 'social' },
  { name: 'Instagram', icon: '📷', category: 'social' },
  { name: 'Twitter/X', icon: '🐦', category: 'social' },
  { name: 'LinkedIn', icon: '💼', category: 'professional' },
  { name: 'Reddit', icon: '🤖', category: 'social' },
  { name: 'GitHub', icon: '🐙', category: 'dev' },
  { name: 'TikTok', icon: '🎵', category: 'social' },
  { name: 'Pinterest', icon: '📌', category: 'social' },
  { name: 'Telegram', icon: '✈️', category: 'messaging' },
  { name: 'Discord', icon: '🎮', category: 'gaming' },
  { name: 'Steam', icon: '🎮', category: 'gaming' },
  { name: 'Spotify', icon: '🎧', category: 'media' },
  { name: 'YouTube', icon: '📺', category: 'media' },
  { name: 'Medium', icon: '📝', category: 'writing' },
  { name: 'Twitch', icon: '🟣', category: 'streaming' },
  { name: 'Snapchat', icon: '👻', category: 'social' },
  { name: 'WhatsApp', icon: '💬', category: 'messaging' },
  { name: 'Signal', icon: '🔒', category: 'messaging' },
  { name: 'Keybase', icon: '🔑', category: 'security' },
];

// Phone number country prefixes with metadata
const PHONE_PREFIXES: Record<string, { country: string; carrier_hint: string; risk: string }> = {
  '+1': { country: 'United States / Canada', carrier_hint: 'AT&T / Verizon / T-Mobile', risk: 'Medium' },
  '+44': { country: 'United Kingdom', carrier_hint: 'EE / Vodafone / Three', risk: 'Low' },
  '+91': { country: 'India', carrier_hint: 'Jio / Airtel / Vi', risk: 'Medium' },
  '+86': { country: 'China', carrier_hint: 'China Mobile / Unicom', risk: 'High' },
  '+81': { country: 'Japan', carrier_hint: 'NTT / SoftBank / KDDI', risk: 'Low' },
  '+49': { country: 'Germany', carrier_hint: 'Deutsche Telekom / Vodafone', risk: 'Low' },
  '+33': { country: 'France', carrier_hint: 'Orange / SFR / Bouygues', risk: 'Low' },
  '+7': { country: 'Russia', carrier_hint: 'MTS / Beeline / MegaFon', risk: 'High' },
  '+55': { country: 'Brazil', carrier_hint: 'Claro / Vivo / TIM', risk: 'Medium' },
  '+234': { country: 'Nigeria', carrier_hint: 'MTN / Glo / Airtel', risk: 'High' },
};

function generateFakeResults(query: string, type: 'username' | 'phone' | 'ip') {
  const seed = query.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = (i: number) => ((seed * 9301 + 49297 + i * 233) % 233280) / 233280;

  if (type === 'username') {
    return PLATFORMS.map((p, i) => ({
      platform: p.name,
      icon: p.icon,
      category: p.category,
      found: rng(i) > 0.45,
      profileUrl: `https://${p.name.toLowerCase().replace(/[^a-z]/g, '')}.com/${query}`,
      lastSeen: rng(i + 100) > 0.5 ? `${Math.floor(rng(i + 200) * 30) + 1}d ago` : 'Unknown',
      confidence: Math.floor(rng(i + 300) * 40 + 60),
    }));
  }

  if (type === 'phone') {
    const prefix = Object.keys(PHONE_PREFIXES).find(p => query.startsWith(p)) || '+1';
    const info = PHONE_PREFIXES[prefix] || PHONE_PREFIXES['+1'];
    return {
      prefix,
      ...info,
      lineType: rng(0) > 0.6 ? 'Mobile' : rng(1) > 0.5 ? 'VoIP' : 'Landline',
      registered: rng(2) > 0.3,
      spamReports: Math.floor(rng(3) * 15),
      portingHistory: Math.floor(rng(4) * 3),
      simSwapRisk: rng(5) > 0.7 ? 'High' : rng(6) > 0.4 ? 'Medium' : 'Low',
    };
  }

  // IP type
  return {
    asn: `AS${Math.floor(rng(0) * 60000 + 1000)}`,
    org: ['Cloudflare Inc.', 'Amazon Technologies', 'Google LLC', 'Microsoft Corp', 'DigitalOcean'][Math.floor(rng(1) * 5)],
    tor: rng(2) > 0.9,
    proxy: rng(3) > 0.8,
    hosting: rng(4) > 0.6,
    abuseScore: Math.floor(rng(5) * 100),
    openPorts: [80, 443, 22, 8080, 3389, 25].filter((_, i) => rng(i + 10) > 0.5),
    blacklisted: rng(6) > 0.75,
    reverseHostnames: Math.floor(rng(7) * 5),
  };
}

// IP Deep Analysis component
export function IPDeepAnalysisSection() {
  const network = useProfileStore((s) => s.network);
  const vpn = useProfileStore((s) => s.vpnDetection);

  const ipAnalysis = useMemo(() => {
    if (!network.ip) return null;
    return generateFakeResults(network.ip, 'ip') as ReturnType<typeof generateFakeResults> & {
      asn: string; org: string; tor: boolean; proxy: boolean; hosting: boolean;
      abuseScore: number; openPorts: number[]; blacklisted: boolean; reverseHostnames: number;
    };
  }, [network.ip]);

  if (!ipAnalysis || !network.ip) return null;

  const threatLevel = (ipAnalysis as any).abuseScore > 70 ? 'HIGH' : (ipAnalysis as any).abuseScore > 30 ? 'MEDIUM' : 'LOW';
  const threatColor = threatLevel === 'HIGH' ? 'text-rose-400' : threatLevel === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400';

  return (
    <DataSection
      title="IP Intelligence"
      icon={<Globe size={14} />}
      badge={
        <span className={`text-[9px] font-mono ${threatColor} bg-white/5 px-2 py-0.5 rounded`}>
          THREAT: {threatLevel}
        </span>
      }
    >
      <DataRow label="IP Address" value={network.ip} valueColor="text-cyber-cyan" />
      <DataRow label="ASN" value={(ipAnalysis as any).asn} />
      <DataRow label="Organization" value={(ipAnalysis as any).org} />
      <DataRow label="ISP" value={network.isp} />
      <DataRow label="City" value={`${network.city}, ${network.region}`} />
      <DataRow label="Country" value={network.country} />
      <DataRow label="Coordinates" value={network.latitude && network.longitude ? `${network.latitude.toFixed(4)}, ${network.longitude.toFixed(4)}` : null} />
      <StatusRow label="Tor Exit Node" detected={(ipAnalysis as any).tor} alertOnDetect />
      <StatusRow label="Known Proxy" detected={(ipAnalysis as any).proxy || vpn.likelyUsingVPN} alertOnDetect />
      <StatusRow label="Hosting/DC" detected={(ipAnalysis as any).hosting} alertOnDetect />
      <StatusRow label="Blacklisted" detected={(ipAnalysis as any).blacklisted} alertOnDetect />
      <DataRow label="Abuse Score" value={`${(ipAnalysis as any).abuseScore}/100`} valueColor={(ipAnalysis as any).abuseScore > 50 ? 'text-rose-400' : 'text-emerald-400'} />
      <DataRow label="Open Ports" value={(ipAnalysis as any).openPorts.length > 0 ? (ipAnalysis as any).openPorts.join(', ') : 'None detected'} />
      <DataRow label="Reverse DNS" value={`${(ipAnalysis as any).reverseHostnames} hostname(s)`} />
    </DataSection>
  );
}

// Username OSINT Scanner
export function UsernameTrackerSection() {
  const socialLogins = useProfileStore((s) => s.socialLogins);
  const network = useProfileStore((s) => s.network);
  const hardware = useProfileStore((s) => s.hardware);
  const browser = useProfileStore((s) => s.browser);
  const [scanning, setScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [results, setResults] = useState<any[]>([]);

  // Build a unique seed from multiple signals so results vary per visitor
  const scanSeed = useMemo(() => {
    const parts = [
      network.ip || '',
      hardware.gpu || '',
      browser.userAgent || '',
      String(hardware.cpuCores || 0),
      String(hardware.screenWidth || 0),
      network.isp || '',
      network.city || '',
    ];
    return parts.join('|').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  }, [network.ip, hardware.gpu, browser.userAgent, hardware.cpuCores, hardware.screenWidth, network.isp, network.city]);

  // Derive detected logins for display
  const detectedLogins = useMemo(() => {
    const logins: string[] = [];
    if (socialLogins.google) logins.push('Google');
    if (socialLogins.github) logins.push('GitHub');
    if (socialLogins.twitter) logins.push('Twitter/X');
    if (socialLogins.facebook) logins.push('Facebook');
    if (socialLogins.reddit) logins.push('Reddit');
    return logins;
  }, [socialLogins]);

  // Auto-scan on mount (wait for network data to populate seed)
  useEffect(() => {
    if (scanComplete || scanning) return;
    const timer = setTimeout(() => {
      setScanning(true);
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 8 + 2;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setScanning(false);
          setScanComplete(true);

          // Generate results using the multi-signal seed
          // Use a better RNG that produces varied results
          const rng = (i: number) => {
            const x = Math.sin(scanSeed * 0.001 + i * 127.1) * 43758.5453;
            return x - Math.floor(x);
          };

          const platformResults = PLATFORMS.map((p, i) => {
            // Social logins that match a platform are always "found"
            const isDetectedLogin = detectedLogins.some(
              (l) => p.name.toLowerCase().includes(l.toLowerCase()) || l.toLowerCase().includes(p.name.toLowerCase().replace('/x', ''))
            );
            // Otherwise use RNG — aim for ~50-70% hit rate
            const found = isDetectedLogin || rng(i) > 0.35;
            return {
              platform: p.name,
              icon: p.icon,
              category: p.category,
              found,
              profileUrl: `https://${p.name.toLowerCase().replace(/[^a-z]/g, '')}.com/user`,
              lastSeen: found ? (rng(i + 100) > 0.4 ? `${Math.floor(rng(i + 200) * 28) + 1}d ago` : 'Recent') : 'Unknown',
              confidence: found ? Math.floor(rng(i + 300) * 30 + 65) : 0,
            };
          });

          setResults(platformResults);
        }
        setScanProgress(Math.min(progress, 100));
      }, 200);
      return () => clearInterval(interval);
    }, 2500);
    return () => clearTimeout(timer);
  }, [scanSeed, detectedLogins, scanComplete, scanning]);

  const foundCount = results.filter((r: any) => r.found).length;
  const categories = useMemo(() => {
    const cats: Record<string, number> = {};
    results.filter((r: any) => r.found).forEach((r: any) => {
      cats[r.category] = (cats[r.category] || 0) + 1;
    });
    return cats;
  }, [results]);

  return (
    <DataSection
      title="Username OSINT"
      icon={<AtSign size={14} />}
      badge={
        scanComplete ? (
          <span className="text-[9px] font-mono text-cyber-cyan bg-cyan-500/10 px-2 py-0.5 rounded">
            {foundCount}/{PLATFORMS.length} FOUND
          </span>
        ) : scanning ? (
          <span className="text-[9px] font-mono text-amber-400 animate-pulse">SCANNING...</span>
        ) : null
      }
    >
      {scanning && (
        <div className="mb-3">
          <div className="flex justify-between text-[9px] font-mono text-white/40 mb-1">
            <span>Scanning {PLATFORMS.length} platforms...</span>
            <span>{Math.floor(scanProgress)}%</span>
          </div>
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-cyber-cyan rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${scanProgress}%` }}
            />
          </div>
        </div>
      )}

      {scanComplete && (
        <>
          {/* Category summary */}
          <div className="flex flex-wrap gap-1.5 mb-3 pb-3 border-b border-white/5">
            {Object.entries(categories).map(([cat, count]) => (
              <span key={cat} className="text-[9px] font-mono px-2 py-0.5 rounded bg-white/5 text-white/50">
                {cat}: {count}
              </span>
            ))}
          </div>

          {/* Results list */}
          <div className="space-y-0">
            {results.map((r: any, i: number) => (
              <motion.div
                key={r.platform}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px]">{r.icon}</span>
                  <span className={`text-[11px] ${r.found ? 'text-white/70' : 'text-white/25'}`}>{r.platform}</span>
                </div>
                <div className="flex items-center gap-2">
                  {r.found ? (
                    <>
                      <span className="text-[9px] font-mono text-white/30">{r.lastSeen}</span>
                      <span className="text-[9px] font-mono text-emerald-400/70">{r.confidence}%</span>
                      <CheckCircle2 size={10} className="text-emerald-400/70" />
                    </>
                  ) : (
                    <span className="text-[9px] font-mono text-white/20">Not found</span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {!scanning && !scanComplete && (
        <div className="text-center py-4">
          <Search size={16} className="text-white/20 mx-auto mb-2" />
          <p className="text-white/30 text-[10px] font-mono">Initializing OSINT scan...</p>
        </div>
      )}
    </DataSection>
  );
}

// Phone Number Intelligence (simulated from detected country)
export function PhoneIntelSection() {
  const network = useProfileStore((s) => s.network);

  const phonePrefix = useMemo(() => {
    const countryToPrefix: Record<string, string> = {
      'United States': '+1', 'Canada': '+1', 'United Kingdom': '+44',
      'India': '+91', 'China': '+86', 'Japan': '+81', 'Germany': '+49',
      'France': '+33', 'Russia': '+7', 'Brazil': '+55', 'Nigeria': '+234',
    };
    return countryToPrefix[network.country || ''] || '+1';
  }, [network.country]);

  const phoneData = useMemo(() => {
    if (!network.country) return null;
    const fakeNumber = `${phonePrefix}${Math.floor(Math.random() * 9000000000 + 1000000000)}`;
    return generateFakeResults(fakeNumber, 'phone') as any;
  }, [network.country, phonePrefix]);

  if (!phoneData) return null;

  return (
    <DataSection
      title="Telecom Intelligence"
      icon={<Phone size={14} />}
      badge={
        <span className={`text-[9px] font-mono px-2 py-0.5 rounded ${
          phoneData.risk === 'High' ? 'text-rose-400 bg-rose-500/10' :
          phoneData.risk === 'Medium' ? 'text-amber-400 bg-amber-500/10' :
          'text-emerald-400 bg-emerald-500/10'
        }`}>
          RISK: {phoneData.risk}
        </span>
      }
    >
      <DataRow label="Country Prefix" value={phoneData.prefix} />
      <DataRow label="Country" value={phoneData.country} />
      <DataRow label="Likely Carriers" value={phoneData.carrier_hint} />
      <DataRow label="Line Type" value={phoneData.lineType} />
      <StatusRow label="Number Active" detected={phoneData.registered} />
      <DataRow label="Spam Reports" value={phoneData.spamReports} valueColor={phoneData.spamReports > 5 ? 'text-rose-400' : 'text-white/80'} />
      <DataRow label="Porting History" value={`${phoneData.portingHistory} time(s)`} />
      <DataRow label="SIM Swap Risk" value={phoneData.simSwapRisk} valueColor={
        phoneData.simSwapRisk === 'High' ? 'text-rose-400' :
        phoneData.simSwapRisk === 'Medium' ? 'text-amber-400' : 'text-emerald-400'
      } />
    </DataSection>
  );
}

// Combined GhostTrack Section (all three)
export function GhostTrackOSINTSection() {
  return (
    <>
      <IPDeepAnalysisSection />
      <UsernameTrackerSection />
      <PhoneIntelSection />
    </>
  );
}
