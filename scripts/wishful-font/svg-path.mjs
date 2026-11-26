/** Minimal SVG path parser → absolute cubic/line commands for font building. */

function tokenize(d) {
  const out = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
  let m;
  while ((m = re.exec(d))) {
    if (m[1]) out.push({ type: 'cmd', v: m[1] });
    else out.push({ type: 'num', v: parseFloat(m[2]) });
  }
  return out;
}

function reflect(cx, cy, x, y) {
  return { x: 2 * cx - x, y: 2 * cy - y };
}

/**
 * @returns {{ type: string, x?: number, y?: number, x1?: number, y1?: number, x2?: number, y2?: number }[]}
 */
export function parseSvgPath(d) {
  const tokens = tokenize(d);
  const cmds = [];
  let i = 0;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let lastC = null;

  const num = () => tokens[i++].v;
  const nums = (n) => Array.from({ length: n }, () => num());

  while (i < tokens.length) {
    const t = tokens[i++];
    if (t.type !== 'cmd') throw new Error(`Expected command, got ${t.v}`);
    let cmd = t.v;
    const rel = cmd === cmd.toLowerCase();
    cmd = cmd.toUpperCase();

    const abs = (x, y) => (rel ? { x: cx + x, y: cy + y } : { x, y });

    if (cmd === 'Z') {
      cmds.push({ type: 'Z' });
      cx = sx;
      cy = sy;
      lastC = null;
      continue;
    }

    // Implicit command repetition
    const readArgs = () => {
      const args = [];
      while (i < tokens.length && tokens[i].type === 'num') args.push(num());
      return args;
    };

    const args = readArgs();
    let ai = 0;
    const take = (n) => {
      const chunk = args.slice(ai, ai + n);
      ai += n;
      return chunk;
    };

    while (ai < args.length) {
      if (cmd === 'M') {
        const [x, y] = take(2);
        const p = abs(x, y);
        cmds.push({ type: 'M', x: p.x, y: p.y });
        cx = p.x;
        cy = p.y;
        sx = cx;
        sy = cy;
        lastC = null;
        cmd = 'L'; // subsequent pairs are line-tos
      } else if (cmd === 'L') {
        const [x, y] = take(2);
        const p = abs(x, y);
        cmds.push({ type: 'L', x: p.x, y: p.y });
        cx = p.x;
        cy = p.y;
        lastC = null;
      } else if (cmd === 'H') {
        const [x] = take(1);
        const nx = rel ? cx + x : x;
        cmds.push({ type: 'L', x: nx, y: cy });
        cx = nx;
        lastC = null;
      } else if (cmd === 'V') {
        const [y] = take(1);
        const ny = rel ? cy + y : y;
        cmds.push({ type: 'L', x: cx, y: ny });
        cy = ny;
        lastC = null;
      } else if (cmd === 'C') {
        const [x1, y1, x2, y2, x, y] = take(6);
        const p1 = abs(x1, y1);
        const p2 = abs(x2, y2);
        const p = abs(x, y);
        cmds.push({ type: 'C', x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, x: p.x, y: p.y });
        lastC = { x: p2.x, y: p2.y };
        cx = p.x;
        cy = p.y;
      } else if (cmd === 'S') {
        const [x2, y2, x, y] = take(4);
        const p1 = lastC ? reflect(cx, cy, lastC.x, lastC.y) : { x: cx, y: cy };
        const p2 = abs(x2, y2);
        const p = abs(x, y);
        cmds.push({ type: 'C', x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, x: p.x, y: p.y });
        lastC = { x: p2.x, y: p2.y };
        cx = p.x;
        cy = p.y;
      } else if (cmd === 'Q') {
        const [x1, y1, x, y] = take(4);
        const p1 = abs(x1, y1);
        const p = abs(x, y);
        cmds.push({ type: 'Q', x1: p1.x, y1: p1.y, x: p.x, y: p.y });
        lastC = { x: p1.x, y: p1.y };
        cx = p.x;
        cy = p.y;
      } else if (cmd === 'T') {
        const [x, y] = take(2);
        const p1 = lastC ? reflect(cx, cy, lastC.x, lastC.y) : { x: cx, y: cy };
        const p = abs(x, y);
        cmds.push({ type: 'Q', x1: p1.x, y1: p1.y, x: p.x, y: p.y });
        lastC = { x: p1.x, y: p1.y };
        cx = p.x;
        cy = p.y;
      } else {
        throw new Error(`Unsupported SVG command: ${cmd}`);
      }
    }
  }
  return cmds;
}

export function bboxOf(cmds) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const hit = (x, y) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  for (const c of cmds) {
    if (c.type === 'M' || c.type === 'L') hit(c.x, c.y);
    else if (c.type === 'C') {
      hit(c.x1, c.y1);
      hit(c.x2, c.y2);
      hit(c.x, c.y);
    } else if (c.type === 'Q') {
      hit(c.x1, c.y1);
      hit(c.x, c.y);
    }
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function transformCmds(cmds, { scale, ox, oy, flipY }) {
  const map = (x, y) => {
    const nx = (x - ox) * scale;
    const ny = flipY ? -(y - oy) * scale : (y - oy) * scale;
    return { x: nx, y: ny };
  };
  return cmds.map((c) => {
    if (c.type === 'Z') return { type: 'Z' };
    if (c.type === 'M' || c.type === 'L') {
      const p = map(c.x, c.y);
      return { type: c.type, ...p };
    }
    if (c.type === 'C') {
      const p1 = map(c.x1, c.y1);
      const p2 = map(c.x2, c.y2);
      const p = map(c.x, c.y);
      return { type: 'C', x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, x: p.x, y: p.y };
    }
    if (c.type === 'Q') {
      const p1 = map(c.x1, c.y1);
      const p = map(c.x, c.y);
      return { type: 'Q', x1: p1.x, y1: p1.y, x: p.x, y: p.y };
    }
    return c;
  });
}
