import { beforeEach, describe, expect, it } from 'vitest';
import { searchProductFromImage, visionConfigured } from '../server/services/productImageSearch';

describe('product image search', () => {
  beforeEach(() => {
    delete process.env.GOOGLE_VISION_API_KEY;
    process.env.VISION_MOCK = '1';
  });

  it('reports configured when VISION_MOCK is on', () => {
    expect(visionConfigured()).toBe(true);
  });

  it('returns mock candidates without calling Google', async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const result = await searchProductFromImage(jpeg);
    expect(result.configured).toBe(true);
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0]?.url).toContain('example.com');
  });

  it('explains when Vision is not configured', async () => {
    delete process.env.VISION_MOCK;
    expect(visionConfigured()).toBe(false);
    const result = await searchProductFromImage(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]));
    expect(result.configured).toBe(false);
    expect(result.candidates).toEqual([]);
    expect(result.message).toMatch(/configured/i);
  });
});
