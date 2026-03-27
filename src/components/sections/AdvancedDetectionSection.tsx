import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, AlertTriangle, Fingerprint, Monitor, Keyboard, Radio, Scan, Wifi } from 'lucide-react';
import { DataSection, DataRow, StatusRow } from '../ui/DataSection';
import {
  getCloudflareTrace,
  detectLies,
  getDOMRectFingerprint,
  getCSSSystemFingerprint,
  getKeyboardLayout,
  getWebRTCLeakData,
  detectHeadlessAdvanced,
  getAdvancedDisplayInfo,
  type CloudflareTrace,
  type LieDetectionResult,
  type DOMRectFingerprint,
  type CSSSystemFingerprint,
  type KeyboardLayout,
  type WebRTCLeakData,
  type HeadlessDetection,
  type AdvancedDisplayInfo,
} from '../../lib/advancedDetection';

// ============================================
// CLOUDFLARE TRACE SECTION
// ============================================

export function CloudflareTraceSection() {
  const [trace, setTrace] = useState<CloudflareTrace | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCloudflareTrace().then((data) => {
      setTrace(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <DataSection title="TLS & Protocol" icon={<Radio size={14} />}>
        <div className="py-3 text-center">
          <span className="text-[10px] font-mono text-white/40 animate-pulse">Querying Cloudflare trace...</span>
        </div>
      </DataSection>
    );
  }

  if (!trace || !trace.tlsVersion) return null;

  return (
    <DataSection
      title="TLS & Protocol"
      icon={<Radio size={14} />}
      badge={
        <span className="text-[9px] font-mono text-violet-400/70 bg-violet-500/10 px-2 py-0.5 rounded">
          CF TRACE
        </span>
      }
    >
      <DataRow label="TLS Version" value={trace.tlsVersion} valueColor={trace.tlsVersion === 'TLSv1.3' ? 'text-emerald-400' : 'text-amber-400'} />
      <DataRow label="HTTP Protocol" value={trace.httpVersion ? `HTTP/${trace.httpVersion}` : null} valueColor={trace.httpVersion === '2' || trace.httpVersion === '3' ? 'text-emerald-400' : 'text-white/80'} />
      <DataRow label="CF Datacenter" value={trace.colo} />
      <DataRow label="Country (CF)" value={trace.loc} />
      <DataRow label="WARP VPN" value={trace.warp === 'on' ? 'Active' : trace.warp === 'off' ? 'Inactive' : trace.warp} valueColor={trace.warp === 'on' ? 'text-amber-400' : 'text-white/80'} />
      <DataRow label="Gateway" value={trace.gateway === 'on' ? 'Active' : 'Inactive'} />
      <DataRow label="SNI" value={trace.sni === 'on' ? 'Encrypted' : trace.sni || '—'} />
    </DataSection>
  );
}

// ============================================
// LIE / SPOOF DETECTION SECTION
// ============================================

export function LieDetectionSection() {
  const [lies, setLies] = useState<LieDetectionResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Small delay to let the page settle
    const timer = setTimeout(() => {
      const result = detectLies();
      setLies(result);
      setLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <DataSection title="Spoof Detection" icon={<Shield size={14} />}>
        <div className="py-3 text-center">
          <span className="text-[10px] font-mono text-white/40 animate-pulse">Analyzing API integrity...</span>
        </div>
      </DataSection>
    );
  }

  if (!lies) return null;

  const scoreColor = lies.spoofScore > 50 ? 'text-rose-400' : lies.spoofScore > 20 ? 'text-amber-400' : 'text-emerald-400';
  const scoreLabel = lies.spoofScore > 50 ? 'HEAVILY SPOOFED' : lies.spoofScore > 20 ? 'SOME TAMPERING' : 'CLEAN';

  return (
    <DataSection
      title="Spoof Detection"
      icon={<Shield size={14} />}
      badge={
        <span className={`text-[9px] font-mono ${scoreColor} bg-white/5 px-2 py-0.5 rounded`}>
          {scoreLabel}
        </span>
      }
    >
      <div className="mb-3 pb-3 border-b border-white/5">
        <p className="text-[9px] font-mono text-white/30 leading-relaxed">
          Tests whether browser APIs have been tampered with by anti-fingerprint extensions, privacy tools, or automation frameworks. Techniques from CreepJS.
        </p>
      </div>

      <DataRow label="Spoof Score" value={`${lies.spoofScore}/100`} valueColor={scoreColor} />
      <StatusRow label="Navigator Tampered" detected={lies.navigatorLie} alertOnDetect />
      <StatusRow label="Canvas Noise Injected" detected={lies.canvasLie} alertOnDetect />
      <StatusRow label="WebGL Spoofed" detected={lies.webglLie} alertOnDetect />
      <StatusRow label="Screen Dimensions Faked" detected={lies.screenLie} alertOnDetect />
      <StatusRow label="Proxy Wrapper Detected" detected={lies.proxyDetected} alertOnDetect />
      <StatusRow label="Property Descriptor Anomaly" detected={lies.propertyDescriptorAnomaly} alertOnDetect />
      <StatusRow label="Timezone Inconsistency" detected={lies.timezoneAnomaly} alertOnDetect />

      {lies.detectedTools.length > 0 && (
        <div className="mt-2 pt-2 border-t border-white/5">
          <span className="text-[9px] font-mono text-white/25 uppercase tracking-wider">Detected Tools</span>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {lies.detectedTools.map((tool, i) => (
              <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/70 border border-amber-500/10">
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}

      {lies.details.length > 0 && (
        <div className="mt-2 pt-2 border-t border-white/5">
          <span className="text-[9px] font-mono text-white/25 uppercase tracking-wider">Evidence</span>
          <div className="mt-1.5 space-y-1">
            {lies.details.map((detail, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertTriangle size={9} className="text-amber-400/50 mt-0.5 shrink-0" />
                <span className="text-[9px] font-mono text-white/40 leading-relaxed">{detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </DataSection>
  );
}

// ============================================
// DOMRECT & CSS SYSTEM FINGERPRINT SECTION
// ============================================

export function DOMRectCSSSection() {
  const [domRect, setDOMRect] = useState<DOMRectFingerprint | null>(null);
  const [cssSystem, setCSSSystem] = useState<CSSSystemFingerprint | null>(null);

  useEffect(() => {
    setTimeout(() => {
      setDOMRect(getDOMRectFingerprint());
      setCSSSystem(getCSSSystemFingerprint());
    }, 500);
  }, []);

  if (!domRect && !cssSystem) return null;

  return (
    <DataSection
      title="DOMRect & CSS System"
      icon={<Fingerprint size={14} />}
      badge={
        <span className="text-[9px] font-mono text-cyan-400/70 bg-cyan-500/10 px-2 py-0.5 rounded">
          FINGERPRINT
        </span>
      }
    >
      {domRect && (
        <>
          <DataRow label="DOMRect Hash" value={domRect.hash} valueColor="text-cyber-cyan" />
          <DataRow label="Rects Measured" value={domRect.rects} />
          <DataRow label="Unique Values" value={domRect.uniqueValues} />
        </>
      )}
      {cssSystem && (
        <>
          <DataRow label="CSS Color Hash" value={cssSystem.colorHash} valueColor="text-cyber-cyan" />
          <DataRow label="System Colors Probed" value={cssSystem.colorsProbed} />
          {cssSystem.systemFonts.length > 0 && (
            <div className="mt-2 pt-2 border-t border-white/5">
              <span className="text-[9px] font-mono text-white/25 uppercase tracking-wider">System Fonts</span>
              <div className="mt-1.5 space-y-1">
                {cssSystem.systemFonts.map((f, i) => (
                  <div key={i} className="text-[9px] font-mono text-white/35 leading-relaxed">{f}</div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </DataSection>
  );
}

// ============================================
// KEYBOARD LAYOUT SECTION
// ============================================

export function KeyboardLayoutSection() {
  const [layout, setLayout] = useState<KeyboardLayout | null>(null);

  useEffect(() => {
    getKeyboardLayout().then(setLayout);
  }, []);

  if (!layout || layout.detectionMethod === 'unavailable') return null;

  const keyCount = Object.keys(layout.layoutMap).length;

  return (
    <DataSection
      title="Keyboard Layout"
      icon={<Keyboard size={14} />}
      badge={
        layout.layout ? (
          <span className="text-[9px] font-mono text-emerald-400/70 bg-emerald-500/10 px-2 py-0.5 rounded">
            {layout.layout}
          </span>
        ) : null
      }
    >
      <DataRow label="Detected Layout" value={layout.layout || 'Unknown'} />
      <DataRow label="Detection Method" value={layout.detectionMethod === 'api' ? 'Keyboard API' : 'KeyboardEvent fallback'} />
      <DataRow label="Keys Mapped" value={keyCount} />
      {keyCount > 0 && (
        <div className="mt-2 pt-2 border-t border-white/5">
          <span className="text-[9px] font-mono text-white/25 uppercase tracking-wider">Key Mappings (sample)</span>
          <div className="mt-1.5 grid grid-cols-3 gap-x-3 gap-y-1">
            {Object.entries(layout.layoutMap).slice(0, 12).map(([code, value]) => (
              <div key={code} className="text-[9px] font-mono text-white/35">
                <span className="text-white/20">{code.replace('Key', '')}</span> → <span className="text-cyber-cyan/70">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </DataSection>
  );
}

// ============================================
// ENHANCED WEBRTC LEAK SECTION
// ============================================

export function WebRTCLeakSection() {
  const [leak, setLeak] = useState<WebRTCLeakData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getWebRTCLeakData().then((data) => {
      setLeak(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <DataSection title="WebRTC Deep Scan" icon={<Wifi size={14} />}>
        <div className="py-3 text-center">
          <span className="text-[10px] font-mono text-white/40 animate-pulse">Gathering ICE candidates...</span>
        </div>
      </DataSection>
    );
  }

  if (!leak) return null;
  const hasLeak = leak.localIPs.length > 0 || leak.publicIPs.length > 0;

  return (
    <DataSection
      title="WebRTC Deep Scan"
      icon={<Wifi size={14} />}
      badge={
        hasLeak ? (
          <span className="text-[9px] font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded animate-pulse">
            LEAK DETECTED
          </span>
        ) : (
          <span className="text-[9px] font-mono text-emerald-400/70 bg-emerald-500/10 px-2 py-0.5 rounded">
            NO LEAK
          </span>
        )
      }
    >
      {leak.localIPs.length > 0 && (
        <>
          <div className="py-1">
            <span className="text-[9px] font-mono text-rose-400/60 uppercase tracking-wider">Local IPs Leaked</span>
          </div>
          {leak.localIPs.map((ip) => (
            <DataRow key={ip} label="Private IP" value={ip} valueColor="text-rose-400" />
          ))}
        </>
      )}

      {leak.publicIPs.length > 0 && (
        <>
          <div className="py-1">
            <span className="text-[9px] font-mono text-amber-400/60 uppercase tracking-wider">Public IPs via STUN</span>
          </div>
          {leak.publicIPs.map((ip) => (
            <DataRow key={ip} label="Public IP" value={ip} valueColor="text-amber-400" />
          ))}
        </>
      )}

      {leak.ipv6Addresses.length > 0 && (
        <>
          <div className="py-1">
            <span className="text-[9px] font-mono text-violet-400/60 uppercase tracking-wider">IPv6 Addresses</span>
          </div>
          {leak.ipv6Addresses.map((ip) => (
            <DataRow key={ip} label="IPv6" value={ip} valueColor="text-violet-400" />
          ))}
        </>
      )}

      <DataRow label="Candidate Types" value={leak.candidateTypes.join(', ') || 'None'} />
      <DataRow label="STUN Servers" value={leak.stunServers.length.toString()} />

      {leak.sdpFingerprint && (
        <div className="mt-2 pt-2 border-t border-white/5">
          <span className="text-[9px] font-mono text-white/25 uppercase tracking-wider">SDP Fingerprint</span>
          <DataRow label="Media Lines" value={leak.sdpFingerprint.mediaLines} />
          <DataRow label="RTP Extensions" value={leak.sdpFingerprint.rtpExtensions} />
          <DataRow label="Audio Codecs" value={leak.sdpFingerprint.audioCodecs.join(', ') || 'None'} />
          <DataRow label="Video Codecs" value={leak.sdpFingerprint.videoCodecs.join(', ') || 'None'} />
        </div>
      )}
    </DataSection>
  );
}

// ============================================
// ENHANCED BOT / HEADLESS DETECTION SECTION
// ============================================

export function HeadlessDetectionSection() {
  const [detection, setDetection] = useState<HeadlessDetection | null>(null);

  useEffect(() => {
    setTimeout(() => {
      setDetection(detectHeadlessAdvanced());
    }, 1000);
  }, []);

  if (!detection) return null;

  const scoreColor = detection.score > 50 ? 'text-rose-400' : detection.score > 20 ? 'text-amber-400' : 'text-emerald-400';
  const label = detection.score > 50 ? 'LIKELY BOT' : detection.score > 20 ? 'SUSPICIOUS' : 'HUMAN';

  return (
    <DataSection
      title="Headless / Bot Detection"
      icon={<Scan size={14} />}
      badge={
        <span className={`text-[9px] font-mono ${scoreColor} bg-white/5 px-2 py-0.5 rounded`}>
          {label}
        </span>
      }
    >
      <DataRow label="Bot Score" value={`${detection.score}/100`} valueColor={scoreColor} />
      <div className="mt-2 space-y-0">
        {detection.signals.map((s, i) => (
          <motion.div
            key={s.name}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.suspicious ? 'bg-rose-400' : 'bg-emerald-400/50'}`} />
              <span className="text-[10px] text-white/60 truncate">{s.name}</span>
            </div>
            <span className={`text-[9px] font-mono ml-2 shrink-0 ${s.suspicious ? 'text-rose-400/70' : 'text-white/35'}`}>
              {s.detail}
            </span>
          </motion.div>
        ))}
      </div>
    </DataSection>
  );
}

// ============================================
// ADVANCED DISPLAY SECTION
// ============================================

export function AdvancedDisplaySection() {
  const [display, setDisplay] = useState<AdvancedDisplayInfo | null>(null);

  useEffect(() => {
    setDisplay(getAdvancedDisplayInfo());
  }, []);

  if (!display) return null;

  return (
    <DataSection
      title="Advanced Display"
      icon={<Monitor size={14} />}
      badge={
        <span className="text-[9px] font-mono text-white/40 bg-white/5 px-2 py-0.5 rounded">
          {display.colorGamut}
        </span>
      }
    >
      <DataRow label="Color Gamut" value={display.colorGamut} valueColor={display.colorGamut === 'Display P3' ? 'text-emerald-400' : 'text-white/80'} />
      <StatusRow label="HDR Support" detected={display.hdr} />
      <DataRow label="Color Scheme" value={display.colorScheme} />
      <DataRow label="Contrast Preference" value={display.contrastPreference} />
      <StatusRow label="Forced Colors" detected={display.forcedColors} alertOnDetect />
      <StatusRow label="Inverted Colors" detected={display.invertedColors} />
      <StatusRow label="Reduced Motion" detected={display.reducedMotion} />
      <StatusRow label="Reduced Transparency" detected={display.reducedTransparency} />
      <StatusRow label="Monochrome Display" detected={display.monochrome} />
      <DataRow label="Display Mode" value={display.displayMode} />
      <DataRow label="Primary Pointer" value={display.pointer} />
      <DataRow label="Hover Support" value={display.hover} />
      <DataRow label="Any Pointer" value={display.anyPointer} />
      <DataRow label="Any Hover" value={display.anyHover} />
      <DataRow label="Orientation" value={display.orientation} />
      <DataRow label="Aspect Ratio" value={display.aspectRatio} />
      <DataRow label="Taskbar Height" value={`${display.taskbarHeight}px`} />
      <DataRow label="Taskbar Width" value={`${display.taskbarWidth}px`} />
      <DataRow label="Available Top" value={`${display.availTop}px`} />
      <DataRow label="Available Left" value={`${display.availLeft}px`} />
    </DataSection>
  );
}
