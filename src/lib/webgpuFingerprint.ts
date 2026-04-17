/**
 * WebGPU Fingerprinting Module
 * Collects GPU-specific information using the WebGPU API for browser fingerprinting
 */

import { simpleHash } from './fingerprinting';

/**
 * WebGPU adapter information
 */
export interface WebGPUAdapterInfo {
  vendor: string;
  architecture: string;
  device: string;
  description: string;
  isFallbackAdapter: boolean;
}

/**
 * WebGPU device limits (30+ values)
 */
export interface WebGPULimits {
  maxTextureDimension1D: number;
  maxTextureDimension2D: number;
  maxTextureDimension3D: number;
  maxTextureArrayLayers: number;
  maxBindGroups: number;
  maxBindingsPerBindGroup: number;
  maxSampledTexturesPerShaderStage: number;
  maxSamplersPerShaderStage: number;
  maxStorageBuffersPerShaderStage: number;
  maxStorageTexturesPerShaderStage: number;
  maxUniformBuffersPerShaderStage: number;
  maxUniformBufferBindingSize: number;
  maxStorageBufferBindingSize: number;
  maxVertexBuffers: number;
  maxBufferSize: number;
  maxVertexAttributes: number;
  maxVertexBufferArrayStride: number;
  maxComputeWorkgroupStorageSize: number;
  maxComputeInvocationsPerWorkgroup: number;
  maxComputeWorkgroupSizeX: number;
  maxComputeWorkgroupSizeY: number;
  maxComputeWorkgroupSizeZ: number;
  maxComputeWorkgroupsPerDimension: number;
}

/**
 * Compute timing fingerprint
 */
export interface ComputeTimingFingerprint {
  avgExecutionTime: number;
  patternHash: string;
  iterations: number;
}

/**
 * Complete WebGPU fingerprint
 */
export interface WebGPUFingerprint {
  available: boolean;
  adapterInfo: WebGPUAdapterInfo | null;
  features: string[];
  limits: WebGPULimits | null;
  preferredCanvasFormat: string | null;
  computeTimingFingerprint: ComputeTimingFingerprint | null;
  fingerprintHash: string;
}

// Type declarations for WebGPU
interface GPU {
  requestAdapter(options?: { powerPreference?: 'low-power' | 'high-performance' }): Promise<GPUAdapter | null>;
  getPreferredCanvasFormat(): string;
}

interface GPUAdapter {
  readonly info?: {
    vendor?: string;
    architecture?: string;
    device?: string;
    description?: string;
  };
  readonly features: Set<string>;
  readonly limits: Record<string, number>;
  readonly isFallbackAdapter?: boolean;
  requestDevice(): Promise<GPUDevice>;
}

interface GPUDevice {
  readonly queue: GPUQueue;
  createShaderModule(descriptor: { code: string }): GPUShaderModule;
  createComputePipeline(descriptor: {
    layout: 'auto';
    compute: { module: GPUShaderModule; entryPoint: string };
  }): GPUComputePipeline;
  createCommandEncoder(): GPUCommandEncoder;
  destroy(): void;
}

interface GPUQueue {
  submit(commandBuffers: GPUCommandBuffer[]): void;
  onSubmittedWorkDone(): Promise<void>;
}

interface GPUShaderModule {}
interface GPUComputePipeline {}
interface GPUCommandBuffer {}

interface GPUCommandEncoder {
  beginComputePass(): GPUComputePassEncoder;
  finish(): GPUCommandBuffer;
}

interface GPUComputePassEncoder {
  setPipeline(pipeline: GPUComputePipeline): void;
  dispatchWorkgroups(x: number): void;
  end(): void;
}

type NavigatorGPU = Navigator & {
  gpu?: GPU;
};

/**
 * Check if WebGPU is available
 */
function isWebGPUAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

/**
 * Get WebGPU adapter info
 */
async function getAdapterInfo(): Promise<WebGPUAdapterInfo | null> {
  try {
    const nav = navigator as NavigatorGPU;
    if (!nav.gpu) return null;

    let adapter = await nav.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) {
      adapter = await nav.gpu.requestAdapter();
    }
    if (!adapter) return null;

    const info = adapter.info;

    return {
      vendor: info?.vendor || 'unknown',
      architecture: info?.architecture || 'unknown',
      device: info?.device || 'unknown',
      description: info?.description || 'unknown',
      isFallbackAdapter: (adapter as any).isFallbackAdapter || false,
    };
  } catch {
    return null;
  }
}

/**
 * Get WebGPU features
 */
async function getFeatures(): Promise<string[]> {
  try {
    const nav = navigator as NavigatorGPU;
    if (!nav.gpu) return [];

    const adapter = await nav.gpu.requestAdapter();
    if (!adapter) return [];

    return Array.from(adapter.features).sort();
  } catch {
    return [];
  }
}

/**
 * Get WebGPU limits
 */
async function getLimits(): Promise<WebGPULimits | null> {
  try {
    const nav = navigator as NavigatorGPU;
    if (!nav.gpu) return null;

    const adapter = await nav.gpu.requestAdapter();
    if (!adapter) return null;

    const limits = adapter.limits;

    return {
      maxTextureDimension1D: limits.maxTextureDimension1D || 0,
      maxTextureDimension2D: limits.maxTextureDimension2D || 0,
      maxTextureDimension3D: limits.maxTextureDimension3D || 0,
      maxTextureArrayLayers: limits.maxTextureArrayLayers || 0,
      maxBindGroups: limits.maxBindGroups || 0,
      maxBindingsPerBindGroup: limits.maxBindingsPerBindGroup || 0,
      maxSampledTexturesPerShaderStage: limits.maxSampledTexturesPerShaderStage || 0,
      maxSamplersPerShaderStage: limits.maxSamplersPerShaderStage || 0,
      maxStorageBuffersPerShaderStage: limits.maxStorageBuffersPerShaderStage || 0,
      maxStorageTexturesPerShaderStage: limits.maxStorageTexturesPerShaderStage || 0,
      maxUniformBuffersPerShaderStage: limits.maxUniformBuffersPerShaderStage || 0,
      maxUniformBufferBindingSize: limits.maxUniformBufferBindingSize || 0,
      maxStorageBufferBindingSize: limits.maxStorageBufferBindingSize || 0,
      maxVertexBuffers: limits.maxVertexBuffers || 0,
      maxBufferSize: limits.maxBufferSize || 0,
      maxVertexAttributes: limits.maxVertexAttributes || 0,
      maxVertexBufferArrayStride: limits.maxVertexBufferArrayStride || 0,
      maxComputeWorkgroupStorageSize: limits.maxComputeWorkgroupStorageSize || 0,
      maxComputeInvocationsPerWorkgroup: limits.maxComputeInvocationsPerWorkgroup || 0,
      maxComputeWorkgroupSizeX: limits.maxComputeWorkgroupSizeX || 0,
      maxComputeWorkgroupSizeY: limits.maxComputeWorkgroupSizeY || 0,
      maxComputeWorkgroupSizeZ: limits.maxComputeWorkgroupSizeZ || 0,
      maxComputeWorkgroupsPerDimension: limits.maxComputeWorkgroupsPerDimension || 0,
    };
  } catch {
    return null;
  }
}

/**
 * Get preferred canvas format
 */
function getPreferredCanvasFormat(): string | null {
  try {
    const nav = navigator as NavigatorGPU;
    if (!nav.gpu) return null;
    return nav.gpu.getPreferredCanvasFormat();
  } catch {
    return null;
  }
}

/**
 * Get compute timing fingerprint
 */
async function getComputeTimingFingerprint(): Promise<ComputeTimingFingerprint | null> {
  try {
    const nav = navigator as NavigatorGPU;
    if (!nav.gpu) return null;

    const adapter = await nav.gpu.requestAdapter();
    if (!adapter) return null;

    const device = await adapter.requestDevice();
    if (!device) return null;

    const shaderModule = device.createShaderModule({
      code: `@compute @workgroup_size(64) fn main() {}`
    });

    const pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: { module: shaderModule, entryPoint: 'main' }
    });

    const iterations = 5;
    const executionTimes: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.dispatchWorkgroups(16);
      pass.end();

      device.queue.submit([encoder.finish()]);
      await device.queue.onSubmittedWorkDone();

      executionTimes.push(performance.now() - start);
    }

    device.destroy();

    const avgExecutionTime = executionTimes.reduce((a, b) => a + b, 0) / iterations;
    const patternHash = simpleHash(executionTimes.map(t => Math.round(t * 100)).join('|'));

    return {
      avgExecutionTime: Math.round(avgExecutionTime * 1000) / 1000,
      patternHash,
      iterations,
    };
  } catch {
    return null;
  }
}

/**
 * Generate fingerprint hash
 */
function generateFingerprintHash(
  adapterInfo: WebGPUAdapterInfo | null,
  features: string[],
  limits: WebGPULimits | null,
  preferredFormat: string | null,
  computeTiming: ComputeTimingFingerprint | null
): string {
  const components: string[] = [];

  if (adapterInfo) {
    components.push(`vendor:${adapterInfo.vendor}`);
    components.push(`arch:${adapterInfo.architecture}`);
    components.push(`device:${adapterInfo.device}`);
  }

  components.push(`features:${features.join(',')}`);

  if (limits) {
    const limitValues = Object.entries(limits)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('|');
    components.push(`limits:${limitValues}`);
  }

  if (preferredFormat) {
    components.push(`format:${preferredFormat}`);
  }

  if (computeTiming) {
    components.push(`timing:${computeTiming.patternHash}`);
  }

  return simpleHash(components.join('||'));
}

/**
 * Get complete WebGPU fingerprint
 */
// Sentinels for non-success outcomes — pass through the same hash function so the
// UI sees a consistently-shaped hex hash rather than a bare literal, while the
// underlying string still signals *why* fingerprinting could not proceed.
const UNAVAILABLE_HASH = simpleHash('webgpu-unavailable');
const ERROR_HASH = simpleHash('webgpu-error');

export async function getWebGPUFingerprint(): Promise<WebGPUFingerprint> {
  if (!isWebGPUAvailable()) {
    return {
      available: false,
      adapterInfo: null,
      features: [],
      limits: null,
      preferredCanvasFormat: null,
      computeTimingFingerprint: null,
      fingerprintHash: UNAVAILABLE_HASH,
    };
  }

  try {
    const [adapterInfo, features, limits, preferredCanvasFormat] = await Promise.all([
      getAdapterInfo(),
      getFeatures(),
      getLimits(),
      Promise.resolve(getPreferredCanvasFormat()),
    ]);

    let computeTimingFingerprint: ComputeTimingFingerprint | null = null;
    try {
      computeTimingFingerprint = await getComputeTimingFingerprint();
    } catch {
      // Compute shader timing may fail
    }

    const fingerprintHash = generateFingerprintHash(
      adapterInfo,
      features,
      limits,
      preferredCanvasFormat,
      computeTimingFingerprint
    );

    return {
      available: true,
      adapterInfo,
      features,
      limits,
      preferredCanvasFormat,
      computeTimingFingerprint,
      fingerprintHash,
    };
  } catch {
    return {
      available: false,
      adapterInfo: null,
      features: [],
      limits: null,
      preferredCanvasFormat: null,
      computeTimingFingerprint: null,
      fingerprintHash: ERROR_HASH,
    };
  }
}
