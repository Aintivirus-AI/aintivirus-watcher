import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Phone, Globe, AtSign, MapPin, Loader2 } from 'lucide-react';
import { parsePhoneNumberFromString, getCountryCallingCode } from 'libphonenumber-js';
import type { CountryCode } from 'libphonenumber-js';
import { useProfileStore } from '../../store/useProfileStore';
import { DataSection, DataRow, StatusRow } from '../ui/DataSection';

// ============================================
// OSINT TRACKER - Inspired by GhostTrack
// All data from REAL sources: ipwho.is API,
// libphonenumber-js, and browser signal detection.
// ============================================

// Platform detection types
type DetectionMethod = 'login' | 'cookie' | 'referrer' | 'redirect' | 'favicon' | 'none';
type DetectionStatus = 'detected' | 'inferred' | 'not_detected';

interface PlatformResult {
  name: string;
  icon: string;
  status: DetectionStatus;
  method: DetectionMethod;
  detail: string;
}

// ============================================
// IP INTELLIGENCE — uses ipwho.is (same API as GhostTrack)
// Free, no key, CORS-enabled
// ============================================

interface IpWhoIsResponse {
  success: boolean;
  ip: string;
  type: string;
  continent: string;
  continent_code: string;
  country: string;
  country_code: string;
  region: string;
  region_code: string;
  city: string;
  latitude: number;
  longitude: number;
  is_eu: boolean;
  postal: string;
  calling_code: string;
  capital: string;
  borders: string;
  flag: { emoji: string };
  connection: {
    asn: number;
    org: string;
    isp: string;
    domain: string;
  };
  timezone: {
    id: string;
    abbr: string;
    is_dst: boolean;
    offset: number;
    utc: string;
    current_time: string;
  };
}

export function IPDeepAnalysisSection() {
  const network = useProfileStore((s) => s.network);
  const vpn = useProfileStore((s) => s.vpnDetection);
  const [ipData, setIpData] = useState<IpWhoIsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!network.ip) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    // GhostTrack uses: http://ipwho.is/{ip}
    fetch(`https://ipwho.is/${network.ip}`)
      .then((res) => res.json())
      .then((data: IpWhoIsResponse) => {
        if (cancelled) return;
        if (data.success === false) {
          setError('IP lookup failed');
        } else {
          setIpData(data);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to reach ipwho.is');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [network.ip]);

  if (!network.ip) return null;

  if (loading) {
    return (
      <DataSection title="IP Intelligence" icon={<Globe size={14} />}>
        <div className="flex items-center gap-2 py-3">
          <Loader2 size={12} className="text-cyber-cyan animate-spin" />
          <span className="text-[10px] font-mono text-white/40">Querying ipwho.is for {network.ip}...</span>
        </div>
      </DataSection>
    );
  }

  if (error || !ipData) {
    return (
      <DataSection title="IP Intelligence" icon={<Globe size={14} />}>
        <DataRow label="IP Address" value={network.ip} valueColor="text-cyber-cyan" />
        <DataRow label="Status" value={error || 'No data'} valueColor="text-rose-400" />
        <DataRow label="ISP" value={network.isp} />
        <DataRow label="City" value={network.city} />
        <DataRow label="Country" value={network.country} />
      </DataSection>
    );
  }

  const mapsUrl = `https://www.google.com/maps/@${ipData.latitude},${ipData.longitude},8z`;

  return (
    <DataSection
      title="IP Intelligence"
      icon={<Globe size={14} />}
      badge={
        <span className="text-[9px] font-mono text-cyber-cyan bg-cyan-500/10 px-2 py-0.5 rounded">
          ipwho.is
        </span>
      }
    >
      <DataRow label="IP Address" value={ipData.ip} valueColor="text-cyber-cyan" />
      <DataRow label="Type" value={ipData.type} />
      <DataRow label="Continent" value={`${ipData.continent} (${ipData.continent_code})`} />
      <DataRow label="Country" value={`${ipData.flag?.emoji || ''} ${ipData.country} (${ipData.country_code})`} />
      <DataRow label="Region" value={`${ipData.region} (${ipData.region_code})`} />
      <DataRow label="City" value={ipData.city} />
      <DataRow label="Postal Code" value={ipData.postal || '—'} />
      <DataRow label="Coordinates" value={`${ipData.latitude.toFixed(4)}, ${ipData.longitude.toFixed(4)}`} />
      <DataRow label="EU Member" value={ipData.is_eu ? 'Yes' : 'No'} />
      <DataRow label="Calling Code" value={ipData.calling_code ? `+${ipData.calling_code}` : '—'} />
      <DataRow label="Capital" value={ipData.capital || '—'} />
      <DataRow label="Borders" value={ipData.borders || 'None / Island' } />
      <div className="py-2 border-b border-white/[0.03]">
        <span className="text-[9px] font-mono text-white/25 uppercase tracking-wider">Connection</span>
      </div>
      <DataRow label="ASN" value={ipData.connection?.asn ? `AS${ipData.connection.asn}` : '—'} />
      <DataRow label="Organization" value={ipData.connection?.org || '—'} />
      <DataRow label="ISP" value={ipData.connection?.isp || '—'} />
      <DataRow label="Domain" value={ipData.connection?.domain || '—'} />
      <div className="py-2 border-b border-white/[0.03]">
        <span className="text-[9px] font-mono text-white/25 uppercase tracking-wider">Timezone</span>
      </div>
      <DataRow label="Timezone" value={ipData.timezone?.id || '—'} />
      <DataRow label="Abbreviation" value={ipData.timezone?.abbr || '—'} />
      <DataRow label="UTC Offset" value={ipData.timezone?.utc || '—'} />
      <DataRow label="DST Active" value={ipData.timezone?.is_dst ? 'Yes' : 'No'} />
      <DataRow label="Current Time" value={ipData.timezone?.current_time || '—'} />
      <div className="py-2 border-b border-white/[0.03]">
        <span className="text-[9px] font-mono text-white/25 uppercase tracking-wider">Privacy</span>
      </div>
      <StatusRow label="VPN/Proxy Detected" detected={vpn.likelyUsingVPN} alertOnDetect />
      <StatusRow label="Timezone Mismatch" detected={vpn.timezoneMismatch} alertOnDetect />
      <StatusRow label="WebRTC Leak" detected={vpn.webrtcLeak} alertOnDetect />

      {/* Google Maps link — same as GhostTrack */}
      <div className="mt-3 pt-3 border-t border-white/5">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-[10px] font-mono text-cyber-cyan/70 hover:text-cyber-cyan transition-colors"
        >
          <MapPin size={10} />
          View on Google Maps
        </a>
      </div>
    </DataSection>
  );
}

// ============================================
// PHONE NUMBER INTELLIGENCE — uses libphonenumber-js
// Same library as GhostTrack (Python phonenumbers → JS port)
// User inputs their phone number, parsed entirely offline.
// ============================================

export function PhoneIntelSection() {
  const [phoneInput, setPhoneInput] = useState('');
  const [parsed, setParsed] = useState<{
    valid: boolean;
    possible: boolean;
    country: string | null;
    countryCode: string | null;
    callingCode: string | null;
    nationalNumber: string | null;
    international: string | null;
    uri: string | null;
    numberType: string | null;
  } | null>(null);

  const handleLookup = () => {
    const input = phoneInput.trim();
    if (!input) return;

    try {
      // parsePhoneNumberFromString handles numbers without + prefix
      // by using a default country. Try with 'US' as default (like GhostTrack uses 'ID')
      const phone = parsePhoneNumberFromString(input, 'US');

      if (!phone) {
        setParsed({
          valid: false, possible: false,
          country: null, countryCode: null, callingCode: null,
          nationalNumber: input, international: null, uri: null, numberType: null,
        });
        return;
      }

      const cc = phone.country;
      let callingCode: string | null = null;
      if (cc) {
        try {
          callingCode = '+' + getCountryCallingCode(cc as CountryCode);
        } catch { /* ignore */ }
      }

      const pType = phone.getType?.();
      const typeMap: Record<string, string> = {
        'MOBILE': 'Mobile',
        'FIXED_LINE': 'Fixed Line',
        'FIXED_LINE_OR_MOBILE': 'Fixed Line or Mobile',
        'TOLL_FREE': 'Toll-Free',
        'PREMIUM_RATE': 'Premium Rate',
        'SHARED_COST': 'Shared Cost',
        'VOIP': 'VoIP',
        'PERSONAL_NUMBER': 'Personal Number',
        'PAGER': 'Pager',
        'UAN': 'Universal Access Number',
      };

      setParsed({
        valid: phone.isValid(),
        possible: phone.isPossible(),
        country: cc ? new Intl.DisplayNames(['en'], { type: 'region' }).of(cc) || cc : null,
        countryCode: cc || null,
        callingCode,
        nationalNumber: phone.nationalNumber || null,
        international: phone.formatInternational?.() || null,
        uri: phone.getURI?.() || null,
        numberType: pType ? (typeMap[pType] || pType) : null,
      });
    } catch {
      setParsed({
        valid: false, possible: false,
        country: null, countryCode: null, callingCode: null,
        nationalNumber: input, international: null, uri: null, numberType: null,
      });
    }
  };

  return (
    <DataSection
      title="Phone Intelligence"
      icon={<Phone size={14} />}
      badge={
        <span className="text-[9px] font-mono text-white/30 bg-white/5 px-2 py-0.5 rounded">
          libphonenumber
        </span>
      }
    >
      <div className="mb-3 pb-3 border-b border-white/5">
        <p className="text-[9px] font-mono text-white/30 leading-relaxed mb-3">
          Enter a phone number (with country code, e.g. +1 555 123 4567). Parsed entirely offline using Google's libphonenumber — no data is sent anywhere.
        </p>
        <div className="flex gap-2">
          <input
            type="tel"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
            placeholder="+1 555 123 4567"
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[11px] font-mono text-white/80 placeholder:text-white/20 focus:outline-none focus:border-cyber-cyan/30"
          />
          <button
            onClick={handleLookup}
            className="px-4 py-2 bg-cyber-cyan/10 border border-cyber-cyan/20 rounded-lg text-[10px] font-mono text-cyber-cyan hover:bg-cyber-cyan/20 transition-colors cursor-pointer"
          >
            Trace
          </button>
        </div>
      </div>

      {parsed && (
        <>
          <StatusRow label="Valid Number" detected={parsed.valid} />
          <StatusRow label="Possible Number" detected={parsed.possible} />
          <DataRow label="Country" value={parsed.country ? `${parsed.country} (${parsed.countryCode})` : 'Unknown'} />
          <DataRow label="Calling Code" value={parsed.callingCode} />
          <DataRow label="National Number" value={parsed.nationalNumber} />
          <DataRow label="International Format" value={parsed.international} />
          <DataRow label="Number Type" value={parsed.numberType || 'Unknown'} />
          <DataRow label="URI" value={parsed.uri} />

          {!parsed.valid && (
            <div className="mt-2 pt-2 border-t border-white/5">
              <p className="text-[9px] font-mono text-rose-400/60 leading-relaxed">
                This number does not appear to be a valid phone number. Make sure to include the country code (e.g. +1 for US, +44 for UK).
              </p>
            </div>
          )}
        </>
      )}

      {!parsed && (
        <div className="text-center py-3">
          <Phone size={16} className="text-white/15 mx-auto mb-2" />
          <p className="text-white/25 text-[10px] font-mono">Enter a phone number above to analyze</p>
        </div>
      )}
    </DataSection>
  );
}

// ============================================
// ACCOUNT DETECTION — uses real browser signals
// Social login SDKs, crypto wallet providers,
// referrer, localStorage/sessionStorage, extensions
// ============================================

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

          // Social Login Detections
          if (socialLogins.google) detected.push({ name: 'Google', icon: '🔍', status: 'detected', method: 'login', detail: 'Active session detected via SDK/storage signals' });
          if (socialLogins.facebook) detected.push({ name: 'Facebook', icon: '📘', status: 'detected', method: 'login', detail: 'FB SDK or auth tokens found in storage' });
          if (socialLogins.twitter) detected.push({ name: 'Twitter/X', icon: '🐦', status: 'detected', method: 'login', detail: 'Twitter widget SDK or auth state detected' });
          if (socialLogins.github) detected.push({ name: 'GitHub', icon: '🐙', status: 'detected', method: 'login', detail: 'GitHub auth tokens or Octokit SDK found' });
          if (socialLogins.reddit) detected.push({ name: 'Reddit', icon: '🤖', status: 'detected', method: 'login', detail: 'Reddit session markers found in storage' });

          // Crypto Wallet Detections
          if (cryptoWallets.metamask) detected.push({ name: 'MetaMask', icon: '🦊', status: 'detected', method: 'login', detail: 'window.ethereum injected by MetaMask extension' });
          if (cryptoWallets.phantom) detected.push({ name: 'Phantom', icon: '👻', status: 'detected', method: 'login', detail: 'window.phantom.solana provider detected' });
          if (cryptoWallets.coinbase) detected.push({ name: 'Coinbase Wallet', icon: '🔵', status: 'detected', method: 'login', detail: 'Coinbase Wallet provider injected' });
          if (cryptoWallets.braveWallet) detected.push({ name: 'Brave Wallet', icon: '🦁', status: 'detected', method: 'login', detail: 'Brave native wallet detected via isBraveWallet' });
          if (cryptoWallets.trustWallet) detected.push({ name: 'Trust Wallet', icon: '🛡️', status: 'detected', method: 'login', detail: 'Trust Wallet provider injected' });
          if (cryptoWallets.solflare) detected.push({ name: 'Solflare', icon: '☀️', status: 'detected', method: 'login', detail: 'Solflare wallet provider detected' });

          // Referrer-based Detections
          if (referrer.includes('youtube.com')) detected.push({ name: 'YouTube', icon: '📺', status: 'detected', method: 'referrer', detail: `Referrer: ${document.referrer}` });
          if (referrer.includes('instagram.com')) detected.push({ name: 'Instagram', icon: '📷', status: 'detected', method: 'referrer', detail: `Referrer: ${document.referrer}` });
          if (referrer.includes('linkedin.com')) detected.push({ name: 'LinkedIn', icon: '💼', status: 'detected', method: 'referrer', detail: `Referrer: ${document.referrer}` });
          if (referrer.includes('tiktok.com')) detected.push({ name: 'TikTok', icon: '🎵', status: 'detected', method: 'referrer', detail: `Referrer: ${document.referrer}` });
          if (referrer.includes('discord.com') || referrer.includes('discord.gg')) detected.push({ name: 'Discord', icon: '🎮', status: 'detected', method: 'referrer', detail: `Referrer: ${document.referrer}` });
          if (referrer.includes('telegram.org') || referrer.includes('t.me')) detected.push({ name: 'Telegram', icon: '✈️', status: 'detected', method: 'referrer', detail: `Referrer: ${document.referrer}` });

          // Extension-based Detections
          const extensions = fingerprints.extensionsDetected || [];
          const extStr = extensions.join(' ').toLowerCase();
          if (extStr.includes('lastpass') || extStr.includes('1password') || extStr.includes('bitwarden')) {
            detected.push({ name: 'Password Manager', icon: '🔐', status: 'detected', method: 'login', detail: `Extension detected: ${extensions.filter(e => /lastpass|1password|bitwarden/i.test(e)).join(', ')}` });
          }

          // Browser-inferred Signals
          const ua = browser.userAgent.toLowerCase();
          if (ua.includes('brave')) detected.push({ name: 'Brave Browser', icon: '🦁', status: 'inferred', method: 'none', detail: 'User-Agent contains Brave identifier' });
          if (apiSupport.gamepads && hardware.gpu && /nvidia|radeon|geforce|rtx|gtx/i.test(hardware.gpu)) {
            if (!detected.some(d => d.name === 'Discord')) {
              detected.push({ name: 'Gaming Platform', icon: '🎮', status: 'inferred', method: 'none', detail: `Gaming GPU (${hardware.gpu}) + Gamepad API → likely Steam/Discord user` });
            }
          }
          if (apiSupport.midi) detected.push({ name: 'Music Platform', icon: '🎵', status: 'inferred', method: 'none', detail: 'MIDI API supported → likely uses music production/streaming services' });

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
            <motion.div className="h-full bg-cyber-cyan rounded-full" initial={{ width: 0 }} animate={{ width: `${scanProgress}%` }} />
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
          <div className="flex flex-wrap gap-1.5 mb-3 pb-3 border-b border-white/5">
            {detectedCount > 0 && <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400/70">{detectedCount} confirmed</span>}
            {inferredCount > 0 && <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400/70">{inferredCount} inferred</span>}
          </div>
          <div className="space-y-0">
            {results.map((r, i) => (
              <motion.div key={`${r.name}-${i}`} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="py-2.5 border-b border-white/[0.03] last:border-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px]">{r.icon}</span>
                    <span className="text-[11px] text-white/80 font-medium">{r.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${r.status === 'detected' ? 'bg-emerald-500/10 text-emerald-400/80' : 'bg-amber-500/10 text-amber-400/80'}`}>
                      {r.status === 'detected' ? 'CONFIRMED' : 'INFERRED'}
                    </span>
                    {r.method !== 'none' && <span className="text-[8px] font-mono text-white/20">via {r.method}</span>}
                  </div>
                </div>
                <p className="text-[9px] font-mono text-white/30 pl-[26px] leading-relaxed">{r.detail}</p>
              </motion.div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-white/5">
            <p className="text-[9px] font-mono text-white/20 leading-relaxed">
              Detection methods: social SDK globals, localStorage/sessionStorage keys, document.referrer, injected wallet providers, browser extension artifacts. No external API calls.
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

// Combined GhostTrack Section
export function GhostTrackOSINTSection() {
  return (
    <>
      <IPDeepAnalysisSection />
      <UsernameTrackerSection />
      <PhoneIntelSection />
    </>
  );
}
