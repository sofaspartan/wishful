/**
 * Style-matched Wishful display glyphs (non-logo letters).
 * Soft filled blobs: thick stems, rounded bowls, slight organic bounce.
 * Coordinates are font units (Y-up), UPM 1000, baseline 0, cap ~720, x-height ~500.
 */
import opentype from 'opentype.js';

const Path = opentype.Path;

/** Rounded capsule from (x1,y1) to (x2,y2) with radius r. */
function capsule(path, x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const ax = x1 + nx * r;
  const ay = y1 + ny * r;
  const bx = x1 - nx * r;
  const by = y1 - ny * r;
  const cx = x2 - nx * r;
  const cy = y2 - ny * r;
  const dx2 = x2 + nx * r;
  const dy2 = y2 + ny * r;
  path.moveTo(ax, ay);
  path.lineTo(dx2, dy2);
  // end cap
  path.curveTo(dx2 + (x2 - dx2) * 1.3, dy2 + (y2 - dy2) * 1.3, cx + (x2 - cx) * 1.3, cy + (y2 - cy) * 1.3, cx, cy);
  path.lineTo(bx, by);
  // start cap
  path.curveTo(bx + (x1 - bx) * 1.3, by + (y1 - by) * 1.3, ax + (x1 - ax) * 1.3, ay + (y1 - ay) * 1.3, ax, ay);
  path.close();
}

/** Soft filled oval. */
function oval(path, cx, cy, rx, ry) {
  const k = 0.5522847498;
  path.moveTo(cx, cy - ry);
  path.curveTo(cx + k * rx, cy - ry, cx + rx, cy - k * ry, cx + rx, cy);
  path.curveTo(cx + rx, cy + k * ry, cx + k * rx, cy + ry, cx, cy + ry);
  path.curveTo(cx - k * rx, cy + ry, cx - rx, cy + k * ry, cx - rx, cy);
  path.curveTo(cx - rx, cy - k * ry, cx - k * rx, cy - ry, cx, cy - ry);
  path.close();
}

/** Soft ring (outer oval minus inner) via even-odd. */
function ring(path, cx, cy, rx, ry, t) {
  oval(path, cx, cy, rx, ry);
  // reverse inner for even-odd
  const k = 0.5522847498;
  const irx = rx - t;
  const iry = ry - t;
  path.moveTo(cx, cy - iry);
  path.curveTo(cx - k * irx, cy - iry, cx - irx, cy - k * iry, cx - irx, cy);
  path.curveTo(cx - irx, cy + k * iry, cx - k * irx, cy + iry, cx, cy + iry);
  path.curveTo(cx + k * irx, cy + iry, cx + irx, cy + k * iry, cx + irx, cy);
  path.curveTo(cx + irx, cy - k * iry, cx + k * irx, cy - iry, cx, cy - iry);
  path.close();
}

function roundRect(path, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  path.moveTo(x + rr, y);
  path.lineTo(x + w - rr, y);
  path.curveTo(x + w, y, x + w, y, x + w, y + rr);
  path.lineTo(x + w, y + h - rr);
  path.curveTo(x + w, y + h, x + w, y + h, x + w - rr, y + h);
  path.lineTo(x + rr, y + h);
  path.curveTo(x, y + h, x, y + h, x, y + h - rr);
  path.lineTo(x, y + rr);
  path.curveTo(x, y, x, y, x + rr, y);
  path.close();
}

const STEM = 118;
const SIDE = 48;

function advanceFor(width) {
  return Math.round(width + SIDE * 2);
}

/** Build a Path + advance for a character. Returns null if not defined here (logo letters). */
export function softGlyphPath(ch) {
  const path = new Path();
  const c = ch.toLowerCase();
  let advance = 560;

  switch (c) {
    case 'a': {
      // triangle-ish blob with crossbar
      oval(path, 280, 220, 200, 200);
      // cut counter with reverse oval (even-odd)
      oval(path, 280, 250, 78, 90);
      // reverse winding for hole — redraw CW
      path.commands[path.commands.length - 5]; // noop keep evenodd via second oval reverse
      // Better: draw A as outer + bar
      path.commands.length = 0;
      // Left leg
      capsule(path, 120, 40, 220, 700, STEM * 0.48);
      // Right leg
      capsule(path, 440, 40, 340, 700, STEM * 0.48);
      // Apex blob
      oval(path, 280, 680, 90, 70);
      // Crossbar
      roundRect(path, 160, 280, 240, STEM * 0.72, 40);
      advance = 560;
      break;
    }
    case 'b': {
      capsule(path, 140, 40, 140, 720, STEM * 0.5);
      oval(path, 140, 700, STEM * 0.55, STEM * 0.55);
      oval(path, 290, 420, 170, 200);
      oval(path, 290, 420, 70, 95); // counter — need even-odd; draw reverse
      // Fix counter: use ring for bowls
      path.commands.length = 0;
      capsule(path, 150, 40, 150, 720, STEM * 0.48);
      oval(path, 150, 700, 70, 70);
      ring(path, 310, 280, 175, 195, 95);
      ring(path, 300, 520, 160, 170, 90);
      advance = 560;
      break;
    }
    case 'c': {
      ring(path, 300, 360, 230, 280, 115);
      // open right with a cut — approximate by not closing right: draw arc blob instead
      path.commands.length = 0;
      // C as thick open oval using two capsules + top/bottom blobs
      capsule(path, 380, 560, 180, 660, STEM * 0.45);
      capsule(path, 160, 560, 120, 360, STEM * 0.48);
      capsule(path, 120, 360, 160, 160, STEM * 0.48);
      capsule(path, 180, 100, 380, 160, STEM * 0.45);
      oval(path, 380, 580, 70, 70);
      oval(path, 380, 140, 70, 70);
      oval(path, 130, 360, 80, 100);
      advance = 560;
      break;
    }
    case 'd': {
      capsule(path, 420, 40, 420, 720, STEM * 0.48);
      oval(path, 420, 700, 70, 70);
      ring(path, 260, 360, 190, 260, 100);
      advance = 580;
      break;
    }
    case 'e': {
      ring(path, 300, 360, 220, 270, 110);
      path.commands.length = 0;
      capsule(path, 380, 560, 180, 650, STEM * 0.42);
      capsule(path, 160, 560, 120, 360, STEM * 0.48);
      capsule(path, 120, 360, 160, 160, STEM * 0.48);
      capsule(path, 180, 110, 400, 160, STEM * 0.42);
      oval(path, 380, 580, 65, 65);
      oval(path, 400, 140, 65, 65);
      oval(path, 130, 360, 75, 95);
      roundRect(path, 140, 320, 280, STEM * 0.65, 36);
      advance = 560;
      break;
    }
    case 'g': {
      ring(path, 290, 400, 195, 240, 100);
      capsule(path, 430, 40, 430, 480, STEM * 0.45);
      oval(path, 430, 80, 70, 70);
      // ear
      oval(path, 430, 560, 80, 90);
      roundRect(path, 280, 60, 180, STEM * 0.6, 34);
      advance = 580;
      break;
    }
    case 'j': {
      capsule(path, 220, 200, 220, 620, STEM * 0.45);
      oval(path, 220, 700, 72, 72); // dot
      // curved foot
      capsule(path, 220, 200, 100, 80, STEM * 0.45);
      oval(path, 90, 80, 70, 70);
      advance = 380;
      break;
    }
    case 'k': {
      capsule(path, 150, 40, 150, 720, STEM * 0.48);
      oval(path, 150, 700, 70, 70);
      capsule(path, 180, 360, 420, 680, STEM * 0.42);
      capsule(path, 200, 340, 440, 60, STEM * 0.42);
      oval(path, 430, 680, 65, 65);
      oval(path, 450, 60, 65, 65);
      advance = 560;
      break;
    }
    case 'm': {
      capsule(path, 120, 40, 120, 620, STEM * 0.42);
      capsule(path, 320, 40, 320, 520, STEM * 0.4);
      capsule(path, 520, 40, 520, 620, STEM * 0.42);
      capsule(path, 120, 560, 320, 620, STEM * 0.4);
      capsule(path, 320, 560, 520, 620, STEM * 0.4);
      oval(path, 120, 620, 65, 65);
      oval(path, 320, 620, 65, 65);
      oval(path, 520, 620, 65, 65);
      advance = 700;
      break;
    }
    case 'n': {
      capsule(path, 140, 40, 140, 620, STEM * 0.45);
      capsule(path, 400, 40, 400, 520, STEM * 0.45);
      capsule(path, 140, 540, 400, 600, STEM * 0.42);
      oval(path, 140, 620, 68, 68);
      oval(path, 400, 580, 68, 68);
      advance = 560;
      break;
    }
    case 'o': {
      ring(path, 300, 360, 230, 280, 115);
      advance = 600;
      break;
    }
    case 'p': {
      capsule(path, 150, -120, 150, 620, STEM * 0.48);
      oval(path, 150, 600, 70, 70);
      ring(path, 310, 420, 175, 190, 95);
      advance = 560;
      break;
    }
    case 'q': {
      capsule(path, 430, -120, 430, 620, STEM * 0.48);
      oval(path, 430, 600, 70, 70);
      ring(path, 270, 420, 175, 190, 95);
      advance = 560;
      break;
    }
    case 'r': {
      capsule(path, 150, 40, 150, 620, STEM * 0.48);
      oval(path, 150, 600, 68, 68);
      ring(path, 300, 480, 155, 150, 88);
      capsule(path, 260, 340, 430, 60, STEM * 0.42);
      oval(path, 440, 60, 65, 65);
      advance = 540;
      break;
    }
    case 't': {
      capsule(path, 260, 40, 260, 620, STEM * 0.48);
      roundRect(path, 80, 560, 360, STEM * 0.7, 40);
      oval(path, 260, 80, 70, 70);
      advance = 500;
      break;
    }
    case 'v': {
      capsule(path, 100, 680, 280, 60, STEM * 0.45);
      capsule(path, 460, 680, 280, 60, STEM * 0.45);
      oval(path, 100, 680, 65, 65);
      oval(path, 460, 680, 65, 65);
      oval(path, 280, 60, 75, 70);
      advance = 560;
      break;
    }
    case 'x': {
      capsule(path, 100, 60, 440, 680, STEM * 0.42);
      capsule(path, 440, 60, 100, 680, STEM * 0.42);
      oval(path, 100, 60, 60, 60);
      oval(path, 440, 60, 60, 60);
      oval(path, 100, 680, 60, 60);
      oval(path, 440, 680, 60, 60);
      advance = 540;
      break;
    }
    case 'y': {
      capsule(path, 100, 680, 280, 300, STEM * 0.42);
      capsule(path, 460, 680, 280, 300, STEM * 0.42);
      capsule(path, 280, 300, 280, -40, STEM * 0.42);
      oval(path, 100, 680, 60, 60);
      oval(path, 460, 680, 60, 60);
      oval(path, 280, -20, 70, 70);
      advance = 560;
      break;
    }
    case 'z': {
      roundRect(path, 90, 600, 380, STEM * 0.7, 40);
      roundRect(path, 90, 60, 380, STEM * 0.7, 40);
      capsule(path, 430, 620, 130, 100, STEM * 0.42);
      advance = 560;
      break;
    }
    // Digits
    case '0': {
      ring(path, 280, 360, 200, 300, 105);
      advance = 560;
      break;
    }
    case '1': {
      capsule(path, 280, 60, 280, 680, STEM * 0.5);
      capsule(path, 180, 580, 280, 680, STEM * 0.4);
      oval(path, 280, 700, 70, 70);
      roundRect(path, 160, 40, 240, STEM * 0.55, 32);
      advance = 480;
      break;
    }
    case '2': {
      // top bowl + diagonal + base
      capsule(path, 120, 520, 280, 680, STEM * 0.42);
      capsule(path, 280, 680, 420, 560, STEM * 0.42);
      capsule(path, 420, 560, 160, 120, STEM * 0.45);
      roundRect(path, 100, 50, 360, STEM * 0.7, 40);
      oval(path, 120, 520, 60, 60);
      oval(path, 420, 560, 60, 60);
      advance = 560;
      break;
    }
    case '3': {
      ring(path, 300, 520, 160, 150, 88);
      ring(path, 300, 220, 170, 170, 90);
      path.commands.length = 0;
      capsule(path, 140, 600, 320, 680, STEM * 0.4);
      capsule(path, 320, 680, 420, 560, STEM * 0.4);
      capsule(path, 420, 560, 280, 400, STEM * 0.4);
      capsule(path, 280, 400, 420, 260, STEM * 0.4);
      capsule(path, 420, 260, 300, 80, STEM * 0.4);
      capsule(path, 300, 80, 140, 140, STEM * 0.4);
      oval(path, 140, 600, 55, 55);
      oval(path, 140, 140, 55, 55);
      oval(path, 280, 400, 55, 55);
      advance = 540;
      break;
    }
    case '4': {
      capsule(path, 360, 40, 360, 680, STEM * 0.48);
      capsule(path, 120, 280, 360, 680, STEM * 0.42);
      roundRect(path, 100, 240, 360, STEM * 0.65, 36);
      oval(path, 360, 700, 65, 65);
      oval(path, 120, 280, 60, 60);
      advance = 540;
      break;
    }
    case '5': {
      roundRect(path, 140, 600, 300, STEM * 0.65, 36);
      capsule(path, 160, 620, 160, 400, STEM * 0.42);
      capsule(path, 160, 400, 360, 420, STEM * 0.4);
      capsule(path, 360, 420, 400, 220, STEM * 0.42);
      capsule(path, 400, 220, 280, 70, STEM * 0.42);
      capsule(path, 280, 70, 140, 140, STEM * 0.4);
      oval(path, 400, 220, 55, 55);
      oval(path, 140, 140, 55, 55);
      advance = 540;
      break;
    }
    case '6': {
      ring(path, 300, 260, 175, 185, 95);
      capsule(path, 180, 400, 320, 680, STEM * 0.45);
      oval(path, 340, 680, 65, 65);
      advance = 560;
      break;
    }
    case '7': {
      roundRect(path, 100, 600, 380, STEM * 0.7, 40);
      capsule(path, 420, 620, 200, 60, STEM * 0.48);
      oval(path, 200, 60, 70, 70);
      advance = 540;
      break;
    }
    case '8': {
      ring(path, 300, 520, 160, 155, 88);
      ring(path, 300, 230, 175, 180, 95);
      advance = 560;
      break;
    }
    case '9': {
      ring(path, 300, 480, 175, 185, 95);
      capsule(path, 420, 360, 280, 60, STEM * 0.45);
      oval(path, 260, 60, 65, 65);
      advance = 560;
      break;
    }
    // Punctuation
    case '.': {
      oval(path, 120, 80, 55, 55);
      advance = 240;
      break;
    }
    case ',': {
      oval(path, 120, 80, 50, 50);
      capsule(path, 120, 60, 70, -40, 40);
      advance = 240;
      break;
    }
    case "'":
    case '\u2019': {
      oval(path, 100, 620, 45, 70);
      advance = 220;
      break;
    }
    case '-': {
      roundRect(path, 60, 320, 280, STEM * 0.55, 32);
      advance = 400;
      break;
    }
    case '!': {
      capsule(path, 120, 200, 120, 680, STEM * 0.45);
      oval(path, 120, 700, 65, 65);
      oval(path, 120, 80, 60, 60);
      advance = 300;
      break;
    }
    case '?': {
      capsule(path, 120, 480, 260, 680, STEM * 0.4);
      capsule(path, 260, 680, 380, 560, STEM * 0.4);
      capsule(path, 380, 560, 280, 400, STEM * 0.4);
      capsule(path, 280, 400, 220, 280, STEM * 0.38);
      oval(path, 120, 480, 55, 55);
      oval(path, 220, 80, 60, 60);
      advance = 500;
      break;
    }
    case '&': {
      ring(path, 240, 480, 140, 150, 80);
      ring(path, 260, 240, 160, 170, 85);
      capsule(path, 320, 360, 460, 100, STEM * 0.38);
      oval(path, 470, 90, 55, 55);
      advance = 580;
      break;
    }
    case '"':
    case '\u201c':
    case '\u201d': {
      oval(path, 90, 620, 40, 65);
      oval(path, 200, 620, 40, 65);
      advance = 340;
      break;
    }
    case ':': {
      oval(path, 120, 480, 55, 55);
      oval(path, 120, 160, 55, 55);
      advance = 280;
      break;
    }
    case ';': {
      oval(path, 120, 480, 55, 55);
      oval(path, 120, 160, 50, 50);
      capsule(path, 120, 140, 70, 40, 38);
      advance = 280;
      break;
    }
    case '/': {
      capsule(path, 80, 40, 360, 700, STEM * 0.38);
      advance = 440;
      break;
    }
    case '(': {
      capsule(path, 220, 40, 120, 360, STEM * 0.4);
      capsule(path, 120, 360, 220, 700, STEM * 0.4);
      oval(path, 220, 40, 55, 55);
      oval(path, 220, 700, 55, 55);
      advance = 340;
      break;
    }
    case ')': {
      capsule(path, 100, 40, 200, 360, STEM * 0.4);
      capsule(path, 200, 360, 100, 700, STEM * 0.4);
      oval(path, 100, 40, 55, 55);
      oval(path, 100, 700, 55, 55);
      advance = 340;
      break;
    }
    case ' ':
      return { path: new Path(), advance: 280 };
    default:
      return null;
  }

  return { path, advance: advanceFor(advance - SIDE * 2) };
}

/** Characters drawn by softGlyphPath (lowercase keys; uppercase aliases share shapes). */
export const SOFT_CHARS =
  'abcdefghjkmnopqrtuvwxyz0123456789.,\'-!?&":;/() '.split('').concat(['\u2019', '\u201c', '\u201d']);
