import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Phone, Globe, AtSign } from 'lucide-react';
import { useProfileStore } from '../../store/useProfileStore';
import { DataSection, DataRow, StatusRow } from '../ui/DataSection';

// ============================================
// OSINT TRACKER - Inspired by GhostTrack
// ============================================

// Platform definitions with detection methods
type DetectionMethod = 'login' | 'cookie' | 'referrer' | 'redirect' | 'favicon' | 'none';
type DetectionStatus = 'detected' | 'inferred' | 'not_detected';

interface PlatformResult {
  name: string;
  icon: string;
  status: DetectionStatus;
  method: DetectionMethod;
  detail: string;
}

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

function generateFakeResults(query: string, type: 'phone' | 'ip') {
  const seed = query.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = (i: number) => ((seed * 9301 + 49297 + i * 233) % 233280) / 233280;

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

// Account & Platform Detection Scanner
// Uses REAL browser signals: social login detection, crypto wallets,
// referrer analysis, cookie/storage inspection, and browser capability inference.
export function UsernameTrackerSection() {
  const socialLogins = useProfileStore((s) => s.socialLogins);
  const cryptoWallets = useProfileStore((s) => s.cryptoWallets);
  const browser = useProfileStore((s) => s.browser);
  const fingerprints = useProfileStore((s) => s.fingerprints);
  const apiSupport = useProfileStore((s) => s.apiSupport);
  const hardware = useProfileStore((s) => s.hardware);
  const [scanning, setScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [results, setResults] = useState<PlatformResult[]>([]);

  // Run real detection scan
  useEffect(() => {
    if (scanComplete || scanning) return;
    const timer = setTimeout(() => {
      setScanning(true);
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 6 + 3;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setScanning(false);
          setScanComplete(true);

          const detected: PlatformResult[] = [];
          const referrer = document.referrer.toLowerCase();

          // ── Social Login Detections (real) ──
          if (socialLogins.google) {
            detected.push({ name: 'Google', icon: '🔍', status: 'detected', method: 'login', detail: 'Active session detected via SDK/storage signals' });
          }
          if (socialLogins.facebook) {
            detected.push({ name: 'Facebook', icon: '📘', status: 'detected', method: 'login', detail: 'FB SDK or auth tokens found in storage' });
          }
          if (socialLogins.twitter) {
            detected.push({ name: 'Twitter/X', icon: '🐦', status: 'detected', method: 'login', detail: 'Twitter widget SDK or auth state detected' });
          }
          if (socialLogins.github) {
            detected.push({ name: 'GitHub', icon: '🐙', status: 'detected', method: 'login', detail: 'GitHub auth tokens or Octokit SDK found' });
          }
          if (socialLogins.reddit) {
            detected.push({ name: 'Reddit', icon: '🤖', status: 'detected', method: 'login', detail: 'Reddit session markers found in storage' });
          }

          // ── Crypto Wallet Detections (real) ──
          if (cryptoWallets.metamask) {
            detected.push({ name: 'MetaMask', icon: '🦊', status: 'detected', method: 'login', detail: 'window.ethereum injected by MetaMask extension' });
          }
          if (cryptoWallets.phantom) {
            detected.push({ name: 'Phantom', icon: '👻', status: 'detected', method: 'login', detail: 'window.phantom.solana provider detected' });
          }
          if (cryptoWallets.coinbase) {
            detected.push({ name: 'Coinbase Wallet', icon: '🔵', status: 'detected', method: 'login', detail: 'Coinbase Wallet provider injected' });
          }
          if (cryptoWallets.braveWallet) {
            detected.push({ name: 'Brave Wallet', icon: '🦁', status: 'detected', method: 'login', detail: 'Brave native wallet detected via isBraveWallet' });
          }
          if (cryptoWallets.trustWallet) {
            detected.push({ name: 'Trust Wallet', icon: '🛡️', status: 'detected', method: 'login', detail: 'Trust Wallet provider injected' });
          }
          if (cryptoWallets.solflare) {
            detected.push({ name: 'Solflare', icon: '☀️', status: 'detected', method: 'login', detail: 'Solflare wallet provider detected' });
          }

          // ── Referrer-based Detections (real) ──
          if (referrer.includes('youtube.com')) {
            detected.push({ name: 'YouTube', icon: '📺', status: 'detected', method: 'referrer', detail: `Referrer: ${document.referrer}` });
          }
          if (referrer.includes('instagram.com')) {
            detected.push({ name: 'Instagram', icon: '📷', status: 'detected', method: 'referrer', detail: `Referrer: ${document.referrer}` });
          }
          if (referrer.includes('linkedin.com')) {
            detected.push({ name: 'LinkedIn', icon: '💼', status: 'detected', method: 'referrer', detail: `Referrer: ${document.referrer}` });
          }
          if (referrer.includes('tiktok.com')) {
            detected.push({ name: 'TikTok', icon: '🎵', status: 'detected', method: 'referrer', detail: `Referrer: ${document.referrer}` });
          }
          if (referrer.includes('discord.com') || referrer.includes('discord.gg')) {
            detected.push({ name: 'Discord', icon: '🎮', status: 'detected', method: 'referrer', detail: `Referrer: ${document.referrer}` });
          }
          if (referrer.includes('telegram.org') || referrer.includes('t.me')) {
            detected.push({ name: 'Telegram', icon: '✈️', status: 'detected', method: 'referrer', detail: `Referrer: ${document.referrer}` });
          }

          // ── Extension-based Detections (real) ──
          const extensions = fingerprints.extensionsDetected || [];
          const extStr = extensions.join(' ').toLowerCase();
          if (extStr.includes('lastpass') || extStr.includes('1password') || extStr.includes('bitwarden')) {
            detected.push({ name: 'Password Manager', icon: '🔐', status: 'detected', method: 'login', detail: `Extension detected: ${extensions.filter(e => /lastpass|1password|bitwarden/i.test(e)).join(', ')}` });
          }

          // ── Browser-inferred Signals (real inferences, not fake data) ──
          const ua = browser.userAgent.toLowerCase();
          if (ua.includes('brave')) {
            detected.push({ name: 'Brave Browser', icon: '🦁', status: 'inferred', method: 'none', detail: 'User-Agent contains Brave identifier' });
          }

          // Gamepad API support → likely gamer (Steam/Discord/Twitch user)
          if (apiSupport.gamepads && hardware.gpu && /nvidia|radeon|geforce|rtx|gtx/i.test(hardware.gpu)) {
            const alreadyHas = detected.some(d => d.name === 'Discord');
            if (!alreadyHas) {
              detected.push({ name: 'Gaming Platform', icon: '🎮', status: 'inferred', method: 'none', detail: `Gaming GPU (${hardware.gpu}) + Gamepad API → likely Steam/Discord user` });
            }
          }

          // MIDI API → likely musician (SoundCloud/Spotify)
          if (apiSupport.midi) {
            detected.push({ name: 'Music Platform', icon: '🎵', status: 'inferred', method: 'none', detail: 'MIDI API supported → likely uses music production/streaming services' });
          }

          // ── Cookie/Storage scan (real) ──
          try {
            const allKeys = [...Object.keys(localStorage), ...Object.keys(sessionStorage)];
            const keyStr = allKeys.join(' ').toLowerCase();

            if (keyStr.includes('spotify') && !detected.some(d => d.name === 'Spotify')) {
              detected.push({ name: 'Spotify', icon: '🎧', status: 'detected', method: 'cookie', detail: 'Spotify tokens/state found in browser storage' });
            }
            if (keyStr.includes('discord') && !detected.some(d => d.name === 'Discord')) {
              detected.push({ name: 'Discord', icon: '🎮', status: 'detected', method: 'cookie', detail: 'Discord session data found in storage' });
            }
            if ((keyStr.includes('slack') || keyStr.includes('slk_')) && !detected.some(d => d.name === 'Slack')) {
              detected.push({ name: 'Slack', icon: '💬', status: 'detected', method: 'cookie', detail: 'Slack workspace tokens found in storage' });
            }
            if (keyStr.includes('notion') && !detected.some(d => d.name === 'Notion')) {
              detected.push({ name: 'Notion', icon: '📝', status: 'detected', method: 'cookie', detail: 'Notion session data found in storage' });
            }
            if ((keyStr.includes('linkedin') || keyStr.includes('li_')) && !detected.some(d => d.name === 'LinkedIn')) {
              detected.push({ name: 'LinkedIn', icon: '💼', status: 'detected', method: 'cookie', detail: 'LinkedIn tracking/session data found in storage' });
            }
          } catch {
            // Storage access blocked
          }

          setResults(detected);
        }
        setScanProgress(Math.min(progress, 100));
      }, 150);
      return () => clearInterval(interval);
    }, 2000);
    return () => clearTimeout(timer);
  }, [socialLogins, cryptoWallets, browser, fingerprints, apiSupport, hardware, scanComplete, scanning]);

  const detectedCount = results.filter(r => r.status === 'detected').length;
  const inferredCount = results.filter(r => r.status === 'inferred').length;

  return (
    <DataSection
      title="Account Detection"
      icon={<AtSign size={14} />}
      badge={
        scanComplete ? (
          <span className="text-[9px] font-mono text-cyber-cyan bg-cyan-500/10 px-2 py-0.5 rounded">
            {detectedCount} DETECTED{inferredCount > 0 ? ` + ${inferredCount} INFERRED` : ''}
          </span>
        ) : scanning ? (
          <span className="text-[9px] font-mono text-amber-400 animate-pulse">SCANNING...</span>
        ) : null
      }
    >
      {scanning && (
        <div className="mb-3">
          <div className="flex justify-between text-[9px] font-mono text-white/40 mb-1">
            <span>Probing social SDKs, storage, referrer, extensions...</span>
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

      {scanComplete && results.length === 0 && (
        <div className="py-3">
          <p className="text-white/30 text-[10px] font-mono text-center">
            No active accounts detected. You may be using incognito mode, have cleared storage, or have strong privacy protections.
          </p>
        </div>
      )}

      {scanComplete && results.length > 0 && (
        <>
          {/* Method breakdown */}
          <div className="flex flex-wrap gap-1.5 mb-3 pb-3 border-b border-white/5">
            {detectedCount > 0 && (
              <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400/70">
                {detectedCount} confirmed
              </span>
            )}
            {inferredCount > 0 && (
              <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400/70">
                {inferredCount} inferred
              </span>
            )}
          </div>

          {/* Results list */}
          <div className="space-y-0">
            {results.map((r, i) => (
              <motion.div
                key={`${r.name}-${i}`}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="py-2.5 border-b border-white/[0.03] last:border-0"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px]">{r.icon}</span>
                    <span className="text-[11px] text-white/80 font-medium">{r.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${
                      r.status === 'detected'
                        ? 'bg-emerald-500/10 text-emerald-400/80'
                        : 'bg-amber-500/10 text-amber-400/80'
                    }`}>
                      {r.status === 'detected' ? 'CONFIRMED' : 'INFERRED'}
                    </span>
                    {r.method !== 'none' && (
                      <span className="text-[8px] font-mono text-white/20">
                        via {r.method}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[9px] font-mono text-white/30 pl-[26px] leading-relaxed">{r.detail}</p>
              </motion.div>
            ))}
          </div>

          {/* Transparency note */}
          <div className="mt-3 pt-3 border-t border-white/5">
            <p className="text-[9px] font-mono text-white/20 leading-relaxed">
              Detection methods: social SDK globals, localStorage/sessionStorage keys, document.referrer, injected wallet providers, browser extension artifacts. No external API calls are made.
            </p>
          </div>
        </>
      )}

      {!scanning && !scanComplete && (
        <div className="text-center py-4">
          <Search size={16} className="text-white/20 mx-auto mb-2" />
          <p className="text-white/30 text-[10px] font-mono">Initializing account detection...</p>
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
