/**
 * Build Wishful Display from logo SVG paths + style-matched soft glyphs.
 *
 *   node scripts/build-wishful-font.mjs
 *
 * Writes public/fonts/WishfulDisplay.ttf and .woff2
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import { compress } from 'wawoff2';
import { LOGO_SVG_PATHS } from './wishful-font/logo-paths.mjs';
import { parseSvgPath, bboxOf, transformCmds } from './wishful-font/svg-path.mjs';
import { softGlyphPath } from './wishful-font/soft-glyphs.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'fonts');

const UPM = 1000;
const ASCENDER = 880;
const DESCENDER = -220;
const SIDE_BEARING = 40;

/** Shared baseline for logo letters: bottom of W / l sit near 0. */
const LOGO_BASELINE_Y = 474; // approx bottom of wordmark letters
const LOGO_CAP_Y = 213; // approx top of W bowls / tall forms
const LOGO_SCALE = 720 / (LOGO_BASELINE_Y - LOGO_CAP_Y); // map logo height → ~720

function cmdsToPath(cmds) {
  const p = new opentype.Path();
  for (const c of cmds) {
    if (c.type === 'M') p.moveTo(c.x, c.y);
    else if (c.type === 'L') p.lineTo(c.x, c.y);
    else if (c.type === 'C') p.curveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y);
    else if (c.type === 'Q') p.quadTo(c.x1, c.y1, c.x, c.y);
    else if (c.type === 'Z') p.close();
  }
  return p;
}

function normalizeLogoPath(svgD) {
  const cmds = parseSvgPath(svgD);
  const box = bboxOf(cmds);
  // Place so baseline (LOGO_BASELINE_Y) → 0, flip Y, scale
  const transformed = transformCmds(cmds, {
    scale: LOGO_SCALE,
    ox: box.minX,
    oy: LOGO_BASELINE_Y,
    flipY: true,
  });
  // Shift so glyph sits with SIDE_BEARING on the left
  const tbox = bboxOf(transformed);
  const dx = SIDE_BEARING - tbox.minX;
  const shifted = transformed.map((c) => {
    if (c.type === 'Z') return c;
    if (c.type === 'C') {
      return {
        ...c,
        x1: c.x1 + dx,
        x2: c.x2 + dx,
        x: c.x + dx,
      };
    }
    if (c.type === 'Q') {
      return { ...c, x1: c.x1 + dx, x: c.x + dx };
    }
    return { ...c, x: c.x + dx };
  });
  const finalBox = bboxOf(shifted);
  const advance = Math.round(finalBox.maxX + SIDE_BEARING);
  return { path: cmdsToPath(shifted), advance, box: finalBox };
}

function makeGlyph(name, unicode, path, advanceWidth) {
  return new opentype.Glyph({
    name,
    unicode,
    advanceWidth,
    path,
  });
}

function notdefGlyph() {
  const p = new opentype.Path();
  // soft empty box
  p.moveTo(80, 80);
  p.lineTo(420, 80);
  p.lineTo(420, 720);
  p.lineTo(80, 720);
  p.close();
  p.moveTo(140, 140);
  p.lineTo(140, 660);
  p.lineTo(360, 660);
  p.lineTo(360, 140);
  p.close();
  return makeGlyph('.notdef', undefined, p, 500);
}

const glyphs = [notdefGlyph()];
const seen = new Set();

function addChar(ch, path, advance) {
  const code = ch.codePointAt(0);
  if (seen.has(code)) return;
  seen.add(code);
  const name = ch === ' ' ? 'space' : ch === '*' ? 'asterisk' : `uni${code.toString(16).toUpperCase().padStart(4, '0')}`;
  glyphs.push(makeGlyph(name, code, path, advance));
}

// Exact logo letters
for (const [ch, d] of Object.entries(LOGO_SVG_PATHS)) {
  const { path: gp, advance } = normalizeLogoPath(d);
  addChar(ch, gp, advance);
  // Dual-case: same shape for uppercase when logo letter is lowercase (and vice versa for W)
  if (ch !== '*') {
    const other = ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase();
    if (other !== ch) {
      // Clone path for the other case
      const clone = new opentype.Path();
      clone.commands = gp.commands.map((c) => ({ ...c }));
      addChar(other, clone, advance);
    }
  }
}

// Soft style-matched glyphs for remaining characters
const EXTRA =
  'AaBbCcDdEeGgJjKkMmNnOoPpQqRrTtVvXxYyZz0123456789.,\'"-!?&:;()/ ' +
  '\u2019\u201c\u201d';

for (const ch of EXTRA) {
  const code = ch.codePointAt(0);
  if (seen.has(code)) continue;
  const built = softGlyphPath(ch);
  if (!built) continue;
  addChar(ch, built.path, built.advance);
  // Mirror case if applicable
  if (/[a-z]/i.test(ch)) {
    const other = ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase();
    if (!seen.has(other.codePointAt(0))) {
      const clone = new opentype.Path();
      clone.commands = built.path.commands.map((c) => ({ ...c }));
      addChar(other, clone, built.advance);
    }
  }
}

// Sort by unicode (opentype prefers .notdef first)
glyphs.sort((a, b) => {
  if (a.name === '.notdef') return -1;
  if (b.name === '.notdef') return 1;
  return (a.unicode ?? 0) - (b.unicode ?? 0);
});

const font = new opentype.Font({
  familyName: 'Wishful Display',
  styleName: 'Regular',
  unitsPerEm: UPM,
  ascender: ASCENDER,
  descender: DESCENDER,
  glyphs,
});

await fs.mkdir(outDir, { recursive: true });
const ttfPath = path.join(outDir, 'WishfulDisplay.ttf');
const woff2Path = path.join(outDir, 'WishfulDisplay.woff2');
const ogTtfPath = path.join(root, 'server', 'og', 'fonts', 'WishfulDisplay.ttf');

const ttfBuffer = Buffer.from(font.toArrayBuffer());
await fs.writeFile(ttfPath, ttfBuffer);
await fs.mkdir(path.dirname(ogTtfPath), { recursive: true });
await fs.writeFile(ogTtfPath, ttfBuffer);
const woff2Buffer = Buffer.from(await compress(ttfBuffer));
await fs.writeFile(woff2Path, woff2Buffer);

console.log(`Wrote ${path.relative(root, ttfPath)} (${Math.round(ttfBuffer.length / 1024)} KB)`);
console.log(`Wrote ${path.relative(root, woff2Path)} (${Math.round(woff2Buffer.length / 1024)} KB)`);
console.log(`Wrote ${path.relative(root, ogTtfPath)}`);
console.log(`Glyphs: ${glyphs.length}`);
