/**
 * Rasterize brand marks into PWA / favicon / extension PNGs.
 *
 * - App / Home Screen: cloud + W (brand/app-icon.svg)
 * - Favicon + Chrome toolbar: W+ on blue, no cloud (brand/glyph-icon.svg)
 *
 * Run: node scripts/generate-icons.mjs
 */
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cloud = await fs.readFile(path.join(root, 'brand/app-icon.svg'));
const maskable = await fs.readFile(path.join(root, 'brand/app-icon-maskable.svg'));
const glyph = await fs.readFile(path.join(root, 'brand/glyph-icon.svg'));

async function png(svg, size, out) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'transparent',
  });
  const buf = resvg.render().asPng();
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, buf);
  console.log(`wrote ${path.relative(root, out)} (${size}×${size})`);
}

const targets = [
  // Chrome extension toolbar — glyph for clarity at small sizes
  [glyph, 16, 'extension/public/icons/icon-16.png'],
  [glyph, 32, 'extension/public/icons/icon-32.png'],
  [glyph, 48, 'extension/public/icons/icon-48.png'],
  [glyph, 128, 'extension/public/icons/icon-128.png'],
  // Add to Home Screen / PWA — full cloud mark
  [cloud, 180, 'public/apple-touch-icon.png'],
  [cloud, 192, 'public/icon-192.png'],
  [cloud, 512, 'public/icon-512.png'],
  [maskable, 512, 'public/icon-512-maskable.png'],
];

for (const [svg, size, rel] of targets) {
  await png(svg, size, path.join(root, rel));
}

await fs.copyFile(path.join(root, 'brand/glyph-icon.svg'), path.join(root, 'extension/icon.svg'));
console.log('synced extension/icon.svg (glyph)');
