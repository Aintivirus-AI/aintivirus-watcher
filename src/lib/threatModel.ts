/**
 * Threat model — computes *identifiability* from the profile store.
 *
 * Each signal has a published entropy in bits (how many identical visitors you'd expect
 * to share the same value). We sum the entropy of signals that were actually captured
 * in this session (independent signals), then convert the total to a percentile risk.
 *
 * Entropy numbers are drawn from public web-fingerprinting studies:
 *   - Panopticlick (EFF, 2010)
 *   - Laperdrix et al., "Beauty and the Beast: Diverting modern web browsers..." (2016)
 *   - amiunique.org dataset — canvas ~17.0, webgl ~16.0, audio ~15.0, fonts ~14.0
 *
 * Signals are capped individually (no one signal is worth more than its published
 * upper bound) and the total is capped at 33 bits (corresponding to the ~8B global
 * population = log₂(8e9) ≈ 33). This keeps the model from overclaiming uniqueness.
 */

import type {
  FingerprintData,
  NetworkData,
  HardwareData,
  BrowserData,
  TrackingDetection,
  VPNDetection,
} from '../store/useProfileStore';

export type SignalSeverity = 'low' | 'medium' | 'high' | 'critical';
export type SignalCategory = 'fingerprint' | 'network' | 'device' | 'privacy';

export interface ThreatSignal {
  id: string;
  label: string;
  category: SignalCategory;
  severity: SignalSeverity;
  bits: number;            // entropy bits contributed to identifiability
  detail?: string;         // human-readable context (e.g., "18 bits")
}

export interface ThreatReport {
  /** Bits of entropy leaked. Sum of detected signals, capped. */
  entropyBits: number;
  /** 0–100 identifiability score derived from entropyBits. */
  identifiabilityScore: number;
  /** Human label for the score. */
  riskLevel: 'minimal' | 'low' | 'moderate' | 'high' | 'extreme';
  /** One-of-N crowd estimate (2^bits); null when zero. */
  crowdSize: number | null;
  /** Sorted list of detected signals (highest bits first). */
  signals: ThreatSignal[];
  /** Per-category breakdown for UI bars. */
  byCategory: Record<SignalCategory, number>;
}

// Global cap — corresponds to ~8 billion unique web users.
const MAX_ENTROPY_BITS = 33;

interface ThreatInputs {
  fingerprints: FingerprintData;
  network: NetworkData;
  hardware: HardwareData;
  browser: BrowserData;
  tracking: TrackingDetection;
  vpn: VPNDetection;
}

/**
 * Entropy for a font list — fonts are highly identifying when enumerable.
 * Empirical: 0 fonts → 0 bits, 40+ distinct fonts → ~14 bits, asymptotic.
 */
function fontsEntropy(count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  // log2-shaped curve: bits = min(14, log₂(count + 1) × 2.2)
  const raw = Math.log2(count + 1) * 2.2;
  return Math.min(14, Math.max(0, raw));
}

export function computeThreatReport(input: ThreatInputs): ThreatReport {
  const { fingerprints, network, hardware, browser, tracking, vpn } = input;
  const signals: ThreatSignal[] = [];

  // ---- Fingerprint category (independent hashes, high entropy) ----
  if (fingerprints.canvasHash) {
    signals.push({
      id: 'canvas',
      label: 'Canvas fingerprint',
      category: 'fingerprint',
      severity: 'critical',
      bits: 17.0,
      detail: 'Your GPU + font rendering produces a near-unique hash',
    });
  }
  if (fingerprints.webglHash) {
    signals.push({
      id: 'webgl',
      label: 'WebGL fingerprint',
      category: 'fingerprint',
      severity: 'critical',
      bits: 15.5,
      detail: 'GPU parameters + shader compilation',
    });
  }
  if (fingerprints.audioHash) {
    signals.push({
      id: 'audio',
      label: 'Audio fingerprint',
      category: 'fingerprint',
      severity: 'high',
      bits: 15.0,
      detail: 'Floating-point audio stack produces stable hash',
    });
  }
  if (fingerprints.fontsDetected > 0) {
    const fb = fontsEntropy(fingerprints.fontsDetected);
    if (fb > 0.5) {
      signals.push({
        id: 'fonts',
        label: `${fingerprints.fontsDetected} fonts enumerated`,
        category: 'fingerprint',
        severity: fb > 10 ? 'high' : 'medium',
        bits: Math.round(fb * 10) / 10,
        detail: 'Installed font list narrows your profile',
      });
    }
  }
  if (fingerprints.wasmHash) {
    signals.push({
      id: 'wasm',
      label: 'WASM fingerprint',
      category: 'fingerprint',
      severity: 'medium',
      bits: 4.0,
      detail: 'WebAssembly feature set + compile timing',
    });
  }
  if (fingerprints.webgpuHash && fingerprints.webgpuAvailable) {
    signals.push({
      id: 'webgpu',
      label: 'WebGPU adapter',
      category: 'fingerprint',
      severity: 'high',
      bits: 8.0,
      detail: 'GPU adapter info is newly exposed and highly identifying',
    });
  }

  // ---- Network category ----
  if (network.ip) {
    signals.push({
      id: 'ip',
      label: 'Public IP exposed',
      category: 'network',
      severity: 'high',
      bits: 10.0, // shared among household/ISP subnet so not full 20 bits
      detail: network.ip,
    });
  }
  if (network.isp) {
    signals.push({
      id: 'isp',
      label: 'ISP identified',
      category: 'network',
      severity: 'low',
      bits: 3.0,
      detail: network.isp,
    });
  }
  if (vpn.webrtcLeak) {
    signals.push({
      id: 'webrtc',
      label: 'WebRTC leak detected',
      category: 'network',
      severity: 'critical',
      bits: 12.0,
      detail: 'Your local IP is reachable via browser stun probes',
    });
  }

  // ---- Device category (lower entropy, but adds up) ----
  if (hardware.gpu && hardware.gpu !== 'Unknown') {
    signals.push({
      id: 'gpu',
      label: 'GPU model',
      category: 'device',
      severity: 'medium',
      bits: 4.0,
      detail: hardware.gpu,
    });
  }
  if (hardware.cpuCores != null) {
    signals.push({
      id: 'cpu',
      label: 'CPU core count',
      category: 'device',
      severity: 'low',
      bits: 2.0,
      detail: `${hardware.cpuCores} cores`,
    });
  }
  if (hardware.ram != null) {
    signals.push({
      id: 'ram',
      label: 'RAM disclosed',
      category: 'device',
      severity: 'low',
      bits: 2.0,
      detail: `${hardware.ram} GB`,
    });
  }
  if (hardware.screenWidth && hardware.screenHeight) {
    signals.push({
      id: 'screen',
      label: 'Screen resolution',
      category: 'device',
      severity: 'medium',
      bits: 4.5,
      detail: `${hardware.screenWidth}×${hardware.screenHeight} @${hardware.pixelRatio}x`,
    });
  }

  // ---- Privacy category (posture signals) ----
  // Note: User-agent + languages always leak — worth flagging even though low-bit.
  if (browser.userAgent) {
    signals.push({
      id: 'ua',
      label: 'User-Agent disclosed',
      category: 'privacy',
      severity: 'medium',
      bits: 9.0,
      detail: 'Browser + OS + version',
    });
  }
  if (browser.languages && browser.languages.length > 0) {
    signals.push({
      id: 'lang',
      label: 'Languages disclosed',
      category: 'privacy',
      severity: 'low',
      bits: browser.languages.length > 1 ? 6.0 : 3.0,
      detail: browser.languages.slice(0, 3).join(', '),
    });
  }
  if (tracking && !tracking.adBlocker) {
    signals.push({
      id: 'noadblock',
      label: 'No ad blocker',
      category: 'privacy',
      severity: 'medium',
      bits: 0,       // doesn't leak identity but does affect threat posture
      detail: 'Third-party trackers can run freely',
    });
  }
  if (tracking && !tracking.doNotTrack) {
    signals.push({
      id: 'dnt',
      label: 'Do-Not-Track off',
      category: 'privacy',
      severity: 'low',
      bits: 0,
      detail: 'No tracking-opt-out signal sent',
    });
  }
  if (fingerprints.crossBrowserId) {
    signals.push({
      id: 'xbid',
      label: 'Cross-browser ID',
      category: 'privacy',
      severity: 'critical',
      bits: 3.0, // already partially captured by individual signals
      detail: 'Re-identifiable across browsers',
    });
  }

  // ---- Sum + cap ----
  const rawBits = signals.reduce((acc, s) => acc + s.bits, 0);
  const entropyBits = Math.min(rawBits, MAX_ENTROPY_BITS);

  // Convert to 0–100 score. Heuristic mapping:
  //   0 bits   → 0  (no data leaked)
  //   10 bits  → 30 (narrow crowd, still blend in)
  //   20 bits  → 65 (few matches worldwide)
  //   33+ bits → 98 (effectively unique)
  const identifiabilityScore = Math.round((entropyBits / MAX_ENTROPY_BITS) * 100);

  const riskLevel: ThreatReport['riskLevel'] =
    entropyBits >= 28 ? 'extreme' :
    entropyBits >= 20 ? 'high' :
    entropyBits >= 12 ? 'moderate' :
    entropyBits >= 5 ? 'low' : 'minimal';

  const crowdSize = entropyBits > 0 ? Math.round(Math.pow(2, entropyBits)) : null;

  const byCategory: Record<SignalCategory, number> = {
    fingerprint: 0,
    network: 0,
    device: 0,
    privacy: 0,
  };
  for (const s of signals) {
    byCategory[s.category] += s.bits;
  }

  // Sort by bits descending for UI display
  signals.sort((a, b) => b.bits - a.bits || severityRank(b.severity) - severityRank(a.severity));

  return {
    entropyBits: Math.round(entropyBits * 10) / 10,
    identifiabilityScore,
    riskLevel,
    crowdSize,
    signals,
    byCategory,
  };
}

function severityRank(s: SignalSeverity): number {
  switch (s) {
    case 'critical': return 3;
    case 'high': return 2;
    case 'medium': return 1;
    case 'low': return 0;
  }
}
