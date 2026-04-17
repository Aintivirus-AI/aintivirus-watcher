import { describe, it, expect } from 'vitest';
import { parseGpuRenderer } from './gpuParser';

describe('parseGpuRenderer', () => {
  it('returns Unknown for null/undefined/empty', () => {
    expect(parseGpuRenderer(null)).toEqual({ displayName: 'Unknown', vendor: null });
    expect(parseGpuRenderer(undefined)).toEqual({ displayName: 'Unknown', vendor: null });
    expect(parseGpuRenderer('')).toEqual({ displayName: 'Unknown', vendor: null });
  });

  it('extracts Apple Silicon from ANGLE wrapper', () => {
    const result = parseGpuRenderer('ANGLE (Apple, Apple M2 Pro, OpenGL 4.1)');
    expect(result.vendor).toBe('Apple');
    expect(result.displayName).toBe('Apple M2 Pro');
  });

  it('extracts NVIDIA RTX from ANGLE wrapper with trailing noise', () => {
    const result = parseGpuRenderer(
      'ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11 vs_5_0 ps_5_0, D3D11)'
    );
    expect(result.vendor).toBe('NVIDIA');
    // Direct3D11 + vs/ps noise should be stripped
    expect(result.displayName).toBe('NVIDIA GeForce RTX 4090');
  });

  it('strips Intel (R) / (TM) marks', () => {
    const result = parseGpuRenderer(
      'ANGLE (Intel, Intel(R) Iris(TM) Plus Graphics, OpenGL 4.1)'
    );
    expect(result.vendor).toBe('Intel');
    expect(result.displayName).toBe('Intel Iris Plus Graphics');
  });

  it('handles plain Apple GPU (iOS style)', () => {
    const result = parseGpuRenderer('Apple GPU');
    expect(result.vendor).toBe('Apple');
    expect(result.displayName).toBe('Apple GPU');
  });

  it('identifies ARM Mali', () => {
    const result = parseGpuRenderer('Mali-G78 MP14');
    expect(result.vendor).toBe('ARM');
    expect(result.displayName).toBe('Mali-G78 MP14');
  });

  it('identifies Qualcomm Adreno', () => {
    const result = parseGpuRenderer('Adreno (TM) 740');
    expect(result.vendor).toBe('Qualcomm');
    expect(result.displayName).toBe('Adreno 740');
  });

  it('identifies AMD Radeon', () => {
    const result = parseGpuRenderer('AMD Radeon Pro 5500M OpenGL Engine');
    expect(result.vendor).toBe('AMD');
    expect(result.displayName).toContain('Radeon');
  });

  it('does not duplicate vendor if renderer already includes it', () => {
    // If renderer field starts with vendor, we don't double it up
    const result = parseGpuRenderer('ANGLE (Apple, Apple M1 Max, Metal)');
    expect(result.displayName).toBe('Apple M1 Max');
  });

  it('returns Unknown vendor for exotic renderer strings', () => {
    const result = parseGpuRenderer('SwiftShader Renderer');
    expect(result.vendor).toBe(null);
    expect(result.displayName).toBe('SwiftShader Renderer');
  });

  it('ignores trademark symbols', () => {
    const result = parseGpuRenderer('NVIDIA GeForce™ GTX 1060');
    expect(result.displayName).toBe('NVIDIA GeForce GTX 1060');
    expect(result.vendor).toBe('NVIDIA');
  });
});
