/**
 * Tests for advancedDetection.ts fixes:
 *   - WebRTC pcRef.close() always called via finally block
 *   - Dead UNMASKED_VENDOR_WEBGL call removed
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('getWebRTCLeakData - RTCPeerConnection cleanup', () => {
  it('calls pcRef.close() even when createOffer throws', async () => {
    const closeMock = vi.fn();
    const pcMock = {
      createDataChannel: vi.fn(),
      createOffer: vi.fn().mockRejectedValue(new Error('WebRTC offer failed')),
      setLocalDescription: vi.fn(),
      onicecandidate: null,
      close: closeMock,
    };

    vi.stubGlobal('RTCPeerConnection', function () { return pcMock; });

    const { getWebRTCLeakData } = await import('./advancedDetection');
    await getWebRTCLeakData();

    expect(closeMock).toHaveBeenCalled();
  });

  it('calls pcRef.close() on successful completion', async () => {
    const closeMock = vi.fn();
    let iceHandler: ((e: { candidate: null }) => void) | null = null;
    const pcMock = {
      createDataChannel: vi.fn(),
      createOffer: vi.fn().mockResolvedValue({ sdp: '' }),
      setLocalDescription: vi.fn().mockResolvedValue(undefined),
      set onicecandidate(fn: ((e: { candidate: null }) => void) | null) { iceHandler = fn; },
      get onicecandidate(): ((e: { candidate: null }) => void) | null { return iceHandler; },
      close: closeMock,
    };

    vi.stubGlobal('RTCPeerConnection', function () { return pcMock; });

    const { getWebRTCLeakData } = await import('./advancedDetection');
    const resultPromise = getWebRTCLeakData();

    // Resolve the ICE gathering immediately
    await new Promise(r => setTimeout(r, 10));
    pcMock.onicecandidate?.({ candidate: null });

    await resultPromise;

    expect(closeMock).toHaveBeenCalled();
  });

  it('returns empty result when RTCPeerConnection is unavailable', async () => {
    vi.stubGlobal('RTCPeerConnection', undefined);

    const { getWebRTCLeakData } = await import('./advancedDetection');
    const result = await getWebRTCLeakData();

    expect(result.localIPs).toEqual([]);
    expect(result.publicIPs).toEqual([]);
  });
});
