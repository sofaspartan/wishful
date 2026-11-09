import { describe, expect, it } from 'vitest';
import { parseBulkText, titleFromUrl } from '../src/lib/bulkText';

describe('bulk paste parsing', () => {
  it('splits links and plain names, strips bullets and trailing punctuation, and drops duplicates', () => {
    const lines = parseBulkText(`
- https://shop.example.com/products/desk-lamp
2. Pottery class for two
Check these out: https://a.example.com/x, https://b.example.com/y.
www.example.org/cozy-sweater
https://shop.example.com/products/desk-lamp
javascript:alert(1)
    `);
    expect(lines).toEqual([
      { url: 'https://shop.example.com/products/desk-lamp' },
      { title: 'Pottery class for two' },
      { url: 'https://a.example.com/x' },
      { url: 'https://b.example.com/y' },
      { url: 'https://www.example.org/cozy-sweater' },
      { title: 'javascript:alert(1)' },
    ]);
  });

  it('makes a readable stand-in name from a link', () => {
    expect(titleFromUrl('https://www.example.com/cozy-wool-sweater/p/12345678')).toBe('Cozy wool sweater');
    expect(titleFromUrl('https://www.amazon.com/Sony-WH-1000XM5-Headphones/dp/B09XS7JWHH')).toBe('Sony wh headphones');
    expect(titleFromUrl('https://shop.example.com/')).toBe('Item from shop.example.com');
  });
});
