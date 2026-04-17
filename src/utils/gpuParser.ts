/**
 * Parse WebGL UNMASKED_RENDERER_WEBGL strings into a stable, display-friendly name.
 *
 * Browsers wrap the actual GPU in vendor-specific prefixes that change across versions:
 *   - "ANGLE (Apple, Apple M2 Pro, OpenGL 4.1)"            → Apple M2 Pro
 *   - "ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11 vs_5_0 ps_5_0, D3D11)" → NVIDIA GeForce RTX 4090
 *   - "ANGLE (Intel, Intel(R) Iris(TM) Plus Graphics, OpenGL 4.1)" → Intel Iris Plus Graphics
 *   - "Apple GPU"                                          → Apple GPU
 *   - "Mali-G78 MP14"                                      → Mali-G78 MP14
 *
 * We strip the ANGLE wrapper, trim trailing API / driver noise, and collapse the
 * "Intel(R)" / "(TM)" style marks so the UI shows a stable brand-model identifier.
 */
export interface ParsedGpu {
  displayName: string;
  vendor: string | null;
}

const NOISE_SUFFIXES = [
  /\s+Direct3D[0-9]+.*$/i,
  /\s+OpenGL\s+[0-9.]+.*$/i,
  /\s+Metal.*$/i,
  /\s+Vulkan.*$/i,
  /\s+vs_\d+_\d+.*$/i,
  /\s+ps_\d+_\d+.*$/i,
  /\s+\(0x[0-9a-f]+\).*$/i,
];

function stripNoise(value: string): string {
  let out = value;
  for (const pattern of NOISE_SUFFIXES) {
    out = out.replace(pattern, '');
  }
  return out
    .replace(/\(R\)/gi, '')
    .replace(/\(TM\)/gi, '')
    .replace(/™/g, '')
    .replace(/®/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function parseGpuRenderer(raw: string | null | undefined): ParsedGpu {
  if (!raw || typeof raw !== 'string') {
    return { displayName: 'Unknown', vendor: null };
  }

  const trimmed = raw.trim();

  // ANGLE (vendor, renderer, api) wrapper
  const angleMatch = trimmed.match(/^ANGLE\s*\(([^,]+),\s*([^,]+?)(?:,\s*([^)]+))?\)$/i);
  if (angleMatch) {
    const vendor = stripNoise(angleMatch[1]);
    const renderer = stripNoise(angleMatch[2]);
    // If renderer starts with the vendor name, don't duplicate
    const displayName =
      renderer.toLowerCase().startsWith(vendor.toLowerCase())
        ? renderer
        : `${vendor} ${renderer}`.replace(/\s{2,}/g, ' ');
    return { displayName: displayName || 'Unknown', vendor };
  }

  // Plain "Apple GPU" / "Mali-G78" style — no wrapper
  const cleaned = stripNoise(trimmed);

  // Best-effort vendor guess
  let vendor: string | null = null;
  if (/apple/i.test(cleaned)) vendor = 'Apple';
  else if (/nvidia|geforce|quadro|rtx|gtx/i.test(cleaned)) vendor = 'NVIDIA';
  else if (/amd|radeon|ryzen/i.test(cleaned)) vendor = 'AMD';
  else if (/intel|iris|uhd/i.test(cleaned)) vendor = 'Intel';
  else if (/mali/i.test(cleaned)) vendor = 'ARM';
  else if (/adreno|qualcomm|snapdragon/i.test(cleaned)) vendor = 'Qualcomm';
  else if (/powervr|imagination/i.test(cleaned)) vendor = 'Imagination';

  return { displayName: cleaned || 'Unknown', vendor };
}
