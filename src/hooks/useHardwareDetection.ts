import { useEffect } from 'react';
import { useProfileStore } from '../store/useProfileStore';
import { parseGpuRenderer } from '../utils/gpuParser';

interface BatteryManager extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
}

declare global {
  interface Navigator {
    getBattery?: () => Promise<BatteryManager>;
    deviceMemory?: number;
  }
}

// navigator.deviceMemory is quantized to these buckets per W3C spec.
// Anything else is reported but treated as suspect.
const DEVICE_MEMORY_BUCKETS = new Set([0.25, 0.5, 1, 2, 4, 8]);

export function useHardwareDetection() {
  const { setHardware, addConsoleEntry } = useProfileStore();

  useEffect(() => {
    let cancelled = false;
    let battery: BatteryManager | null = null;
    let onLevelChange: (() => void) | null = null;
    let onChargingChange: (() => void) | null = null;

    const detectHardware = async () => {
      addConsoleEntry('SCAN', 'Initiating hardware fingerprint scan...');

      // Detect GPU via WebGL — prefer UNMASKED, fall back to plain RENDERER
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

        if (gl && gl instanceof WebGLRenderingContext) {
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          let rawRenderer: string | null = null;
          let rawVendor: string | null = null;

          if (debugInfo) {
            rawVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) ?? null;
            rawRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) ?? null;
          }
          if (!rawRenderer) {
            rawRenderer = gl.getParameter(gl.RENDERER) ?? null;
            rawVendor = rawVendor ?? (gl.getParameter(gl.VENDOR) ?? null);
          }

          if (rawRenderer) {
            const parsed = parseGpuRenderer(rawRenderer);
            setHardware({
              gpu: parsed.displayName,
              gpuVendor: parsed.vendor ?? rawVendor,
              gpuRaw: rawRenderer,
            });
            addConsoleEntry('DATA', `GPU Detected: ${parsed.displayName}`);
          }
        }
      } catch {
        addConsoleEntry('ALERT', 'WebGL detection failed');
      }

      // Detect CPU cores — only set if the browser actually reports it
      if (typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency > 0) {
        setHardware({ cpuCores: navigator.hardwareConcurrency });
        addConsoleEntry('DATA', `CPU Cores: ${navigator.hardwareConcurrency}`);
      } else {
        addConsoleEntry('INFO', 'CPU core count not reported by browser');
      }

      // Detect RAM (navigator.deviceMemory — Chromium only, quantized per spec)
      if (typeof navigator.deviceMemory === 'number') {
        const ram = navigator.deviceMemory;
        if (!DEVICE_MEMORY_BUCKETS.has(ram)) {
          addConsoleEntry('INFO', `deviceMemory=${ram}GB is outside spec buckets {0.25, 0.5, 1, 2, 4, 8}`);
        }
        setHardware({ ram });
        addConsoleEntry('DATA', `Device Memory: ${ram}GB (spec min)`);
      } else {
        addConsoleEntry('INFO', 'RAM detection not supported in this browser');
      }

      // Detect Battery — async, may reject/resolve after unmount
      if (navigator.getBattery) {
        try {
          battery = await navigator.getBattery();
          if (cancelled || !battery) return;

          const snapshot = () => ({
            level: battery!.level,
            charging: battery!.charging,
          });

          setHardware({ battery: snapshot() });
          addConsoleEntry('DATA', `Battery: ${Math.round(battery.level * 100)}% ${battery.charging ? '(charging)' : ''}`);

          onLevelChange = () => setHardware({ battery: snapshot() });
          onChargingChange = () => {
            setHardware({ battery: snapshot() });
            addConsoleEntry('SYSTEM', `Charging status changed: ${battery!.charging ? 'Plugged in' : 'Unplugged'}`);
          };

          battery.addEventListener('levelchange', onLevelChange);
          battery.addEventListener('chargingchange', onChargingChange);
        } catch {
          addConsoleEntry('INFO', 'Battery API not available');
        }
      }

      // Screen / touch — use maxTouchPoints as primary, ontouchstart as fallback
      setHardware({
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        pixelRatio: window.devicePixelRatio,
        touchSupport: (navigator.maxTouchPoints ?? 0) > 0 || 'ontouchstart' in window,
      });
      addConsoleEntry('DATA', `Display: ${window.screen.width}x${window.screen.height} @${window.devicePixelRatio}x`);

      addConsoleEntry('SYSTEM', 'Hardware scan complete');
    };

    detectHardware();

    return () => {
      cancelled = true;
      if (battery) {
        if (onLevelChange) battery.removeEventListener('levelchange', onLevelChange);
        if (onChargingChange) battery.removeEventListener('chargingchange', onChargingChange);
      }
    };
  }, [setHardware, addConsoleEntry]);
}
