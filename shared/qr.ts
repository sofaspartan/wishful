import { encode } from 'uqr';

/**
 * A QR code for `text` as one SVG path, one unit per module and no quiet zone.
 * Error correction is `Q` (a quarter of the code can be lost), because box labels get scuffed.
 */
export function qrPath(text: string): { size: number; path: string } {
  const { size, data } = encode(text, { ecc: 'Q', border: 0 });
  let path = '';
  data.forEach((row, y) => {
    let x = 0;
    while (x < size) {
      if (!row[x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < size && row[x]) x++;
      path += `M${start} ${y}h${x - start}v1h${start - x}z`;
    }
  });
  return { size, path };
}

/** A standalone SVG of the code with a white quiet zone `margin` modules wide. */
export function qrSvg(text: string, margin = 2): string {
  const { size, path } = qrPath(text);
  const full = size + margin * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-margin} ${-margin} ${full} ${full}" width="${full * 10}" height="${full * 10}" shape-rendering="crispEdges"><rect x="${-margin}" y="${-margin}" width="${full}" height="${full}" fill="#fff"/><path d="${path}" fill="#111"/></svg>`;
}
