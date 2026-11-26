import { beforeEach, describe, expect, it } from 'vitest';
import { extractTextFromImage, titleFromOcrText, visionConfigured } from '../server/services/imageOcr';

describe('image OCR', () => {
  beforeEach(() => {
    delete process.env.GOOGLE_VISION_API_KEY;
    process.env.VISION_MOCK = '1';
  });

  it('reports configured when VISION_MOCK is on', () => {
    expect(visionConfigured()).toBe(true);
  });

  it('returns mock text without calling Google', async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const result = await extractTextFromImage(jpeg);
    expect(result.configured).toBe(true);
    expect(result.text).toMatch(/mug/i);
    expect(result.suggestedTitle).toMatch(/mug|wishful|ceramic/i);
  });

  it('explains when Vision is not configured', async () => {
    delete process.env.VISION_MOCK;
    expect(visionConfigured()).toBe(false);
    const result = await extractTextFromImage(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]));
    expect(result.configured).toBe(false);
    expect(result.text).toBe('');
    expect(result.message).toMatch(/configured|Text scan/i);
  });

  it('picks the first useful line as a title', () => {
    expect(titleFromOcrText('Acme Widget\nMade in USA\n$12')).toBe('Acme Widget');
    expect(titleFromOcrText('')).toBeUndefined();
  });
});
