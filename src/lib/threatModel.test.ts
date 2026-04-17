import { describe, it, expect } from 'vitest';
import { computeThreatReport } from './threatModel';

// Minimal shape factories — only set the fields we care about; others default.
function blankInput(): Parameters<typeof computeThreatReport>[0] {
  return {
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
      wasmSupported: false,
      wasmFeatures: [],
      wasmMaxMemory: null,
      wasmHash: null,
      wasmSimd: false,
      wasmThreads: false,
      wasmExceptions: false,
      wasmBulkMemory: false,
      wasmCpuTier: 0,
      wasmBenchmarkScore: null,
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
      crossBrowserId: null,
      crossBrowserFactors: [],
      fingerprintId: null,
      fingerprintConfidence: 0,
      extensionsDetected: [],
      installedApps: [],
      hardwareFamily: null,
    },
    network: {
      ip: null, city: null, region: null, country: null, countryCode: null,
      isp: null, latitude: null, longitude: null, timezone: null,
      loading: false, error: null, connectionType: null, downlink: null,
      rtt: null, dataSaver: false, webrtcSupported: false, webrtcLocalIPs: [],
    } as Parameters<typeof computeThreatReport>[0]['network'],
    hardware: {
      gpu: null, gpuVendor: null, gpuRaw: null, cpuCores: null, ram: null,
      battery: null, screenWidth: 0, screenHeight: 0, windowWidth: 0, windowHeight: 0,
      pixelRatio: 1, colorDepth: 24, touchSupport: false, maxTouchPoints: 0,
      orientation: 'unknown', webglVersion: null, webglExtensions: 0,
    },
    browser: {
      userAgent: '', language: '', languages: [], platform: '', vendor: '',
      cookiesEnabled: false, doNotTrack: null, globalPrivacyControl: null,
      localStorage: false, sessionStorage: false, indexedDB: false,
      pdfViewer: false, referrer: '', historyLength: 0,
      architecture: null, bitness: null, mobile: false, model: null,
      platformVersion: null, browserVersions: null,
    },
    // Default to "protected" so blank input is truly zero-signal; individual tests
    // flip these to exercise the posture signals.
    tracking: {
      adBlocker: true,
      doNotTrack: true,
      globalPrivacyControl: null,
    },
    vpn: {
      likelyUsingVPN: false,
      timezoneMismatch: false,
      webrtcLeak: false,
    },
  };
}

describe('computeThreatReport — empty input', () => {
  it('returns minimal risk with zero entropy when nothing is detected', () => {
    const report = computeThreatReport(blankInput());
    expect(report.entropyBits).toBe(0);
    expect(report.identifiabilityScore).toBe(0);
    expect(report.riskLevel).toBe('minimal');
    expect(report.crowdSize).toBeNull();
    expect(report.signals).toHaveLength(0);
  });
});

describe('computeThreatReport — canvas fingerprint captured', () => {
  it('adds ~17 bits of entropy and flags as critical', () => {
    const input = blankInput();
    input.fingerprints.canvasHash = 'abcd1234';
    const report = computeThreatReport(input);
    expect(report.entropyBits).toBeCloseTo(17.0, 1);
    expect(report.signals[0].id).toBe('canvas');
    expect(report.signals[0].severity).toBe('critical');
  });
});

describe('computeThreatReport — combined fingerprints', () => {
  it('sums entropy from independent signals', () => {
    const input = blankInput();
    input.fingerprints.canvasHash = 'a';    // 17.0
    input.fingerprints.webglHash = 'b';     // 15.5
    input.fingerprints.audioHash = 'c';     // 15.0
    const report = computeThreatReport(input);
    // Capped at MAX_ENTROPY_BITS = 33 (from 47.5 raw)
    expect(report.entropyBits).toBe(33);
    expect(report.riskLevel).toBe('extreme');
    expect(report.identifiabilityScore).toBeGreaterThanOrEqual(95);
  });
});

describe('computeThreatReport — font entropy', () => {
  it('returns 0 bits for 0 fonts', () => {
    const report = computeThreatReport(blankInput());
    expect(report.signals.find((s) => s.id === 'fonts')).toBeUndefined();
  });

  it('gives small entropy for low font count', () => {
    const input = blankInput();
    input.fingerprints.fontsDetected = 5;
    const report = computeThreatReport(input);
    const fonts = report.signals.find((s) => s.id === 'fonts');
    expect(fonts).toBeDefined();
    // log2(6) * 2.2 ≈ 5.69 bits — meaningful but not critical
    expect(fonts!.bits).toBeGreaterThan(4);
    expect(fonts!.bits).toBeLessThan(7);
  });

  it('caps font entropy at 14 bits for massive font lists', () => {
    const input = blankInput();
    input.fingerprints.fontsDetected = 500;
    const report = computeThreatReport(input);
    const fonts = report.signals.find((s) => s.id === 'fonts');
    expect(fonts!.bits).toBe(14);
  });
});

describe('computeThreatReport — risk level buckets', () => {
  it('minimal < 5 bits', () => {
    const input = blankInput();
    input.hardware.cpuCores = 8; // 2 bits
    const report = computeThreatReport(input);
    expect(report.riskLevel).toBe('minimal');
  });

  it('low for 5–11 bits', () => {
    const input = blankInput();
    input.network.ip = '1.2.3.4'; // 10 bits
    const report = computeThreatReport(input);
    expect(report.riskLevel).toBe('low');
  });

  it('moderate for 12–19 bits', () => {
    const input = blankInput();
    input.network.ip = '1.2.3.4';        // 10
    input.hardware.gpu = 'Apple M2';     // 4 → 14 total (in 12–19 band)
    const report = computeThreatReport(input);
    expect(report.riskLevel).toBe('moderate');
  });

  it('high for 20–27 bits', () => {
    const input = blankInput();
    input.fingerprints.canvasHash = 'a';  // 17
    input.network.ip = '1.2.3.4';          // 10 → 27
    const report = computeThreatReport(input);
    expect(report.riskLevel).toBe('high');
  });

  it('extreme for ≥28 bits', () => {
    const input = blankInput();
    input.fingerprints.canvasHash = 'a';   // 17
    input.fingerprints.webglHash = 'b';     // 15.5 → 32.5 → capped 33
    const report = computeThreatReport(input);
    expect(report.riskLevel).toBe('extreme');
  });
});

describe('computeThreatReport — category breakdown', () => {
  it('partitions bits by category', () => {
    const input = blankInput();
    input.fingerprints.canvasHash = 'a';   // fingerprint +17
    input.network.ip = '1.2.3.4';          // network +10
    input.hardware.gpu = 'Apple M2 Pro';   // device +4
    input.browser.userAgent = 'Mozilla';   // privacy +9
    const report = computeThreatReport(input);
    expect(report.byCategory.fingerprint).toBeCloseTo(17, 1);
    expect(report.byCategory.network).toBeCloseTo(10, 1);
    expect(report.byCategory.device).toBeCloseTo(4, 1);
    expect(report.byCategory.privacy).toBeCloseTo(9, 1);
  });
});

describe('computeThreatReport — signals sorted by bits', () => {
  it('places highest-entropy signals first', () => {
    const input = blankInput();
    input.fingerprints.canvasHash = 'a';  // 17
    input.hardware.cpuCores = 8;          // 2
    input.fingerprints.webglHash = 'b';   // 15.5
    const report = computeThreatReport(input);
    expect(report.signals[0].id).toBe('canvas');
    expect(report.signals[1].id).toBe('webgl');
    // cpu is lowest bits in this setup (2); assert it sorts to the end
    const cpuIndex = report.signals.findIndex((s) => s.id === 'cpu');
    expect(cpuIndex).toBe(report.signals.length - 1);
  });
});

describe('computeThreatReport — crowd size', () => {
  it('computes 2^bits as crowd estimate', () => {
    const input = blankInput();
    input.fingerprints.canvasHash = 'a';  // 17 bits → 2^17 = 131072
    const report = computeThreatReport(input);
    expect(report.crowdSize).toBeGreaterThanOrEqual(130_000);
    expect(report.crowdSize).toBeLessThanOrEqual(132_000);
  });

  it('returns null when entropy is zero', () => {
    expect(computeThreatReport(blankInput()).crowdSize).toBeNull();
  });
});

describe('computeThreatReport — privacy posture', () => {
  it('flags missing ad blocker with zero bits but medium severity', () => {
    const input = blankInput();
    input.tracking.adBlocker = false; // default already, but explicit
    const report = computeThreatReport(input);
    const noadblock = report.signals.find((s) => s.id === 'noadblock');
    expect(noadblock).toBeDefined();
    expect(noadblock!.bits).toBe(0);
    expect(noadblock!.severity).toBe('medium');
  });

  it('flags WebRTC leak as critical with 12 bits', () => {
    const input = blankInput();
    input.vpn.webrtcLeak = true;
    const report = computeThreatReport(input);
    const webrtc = report.signals.find((s) => s.id === 'webrtc');
    expect(webrtc!.severity).toBe('critical');
    expect(webrtc!.bits).toBe(12);
  });
});
