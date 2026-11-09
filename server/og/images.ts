import { images } from '../storage';
import { sniffImageType } from '../routes/misc';
import { safeFetchBytes } from '../services/safeFetch';

/** What the PNG rasterizer can decode. WebP and AVIF photos are skipped. */
const RENDERABLE = new Set(['image/png', 'image/jpeg', 'image/gif']);
const MAX_BYTES = 4_000_000;
const UPLOAD = /^\/api\/images\/([A-Za-z0-9_-]{8,64})$/;
// Image CDNs negotiate the format from Accept; leaving out WebP/AVIF gets a JPEG or PNG back.
const HEADERS = {
  'user-agent': 'Mozilla/5.0 (compatible; WishfulPreview/1.0; +share-image)',
  accept: 'image/png,image/jpeg;q=0.9,image/gif;q=0.8,*/*;q=0.1',
};

/** An uploaded or remote image as a data URI, or null when it can't be fetched safely and quickly. */
export async function loadImage(src: string | null | undefined, timeoutMs: number): Promise<string | null> {
  if (!src) return null;
  try {
    let buf: Uint8Array;
    const upload = UPLOAD.exec(src);
    if (upload) {
      const obj = await images().get(upload[1]);
      if (!obj) return null;
      buf = new Uint8Array(obj.data);
    } else {
      const res = await safeFetchBytes(src, { timeoutMs, maxBytes: MAX_BYTES, headers: HEADERS });
      if (res.status !== 200) return null;
      buf = res.body;
    }
    const type = sniffImageType(buf);
    if (!type || !RENDERABLE.has(type)) return null;
    return `data:${type};base64,${Buffer.from(buf).toString('base64')}`;
  } catch {
    return null;
  }
}

/** Load several images in parallel, keeping the first `limit` that work, within one time budget. */
export async function loadFirstImages(srcs: Array<string | null | undefined>, limit: number, budgetMs: number): Promise<string[]> {
  const candidates = [...new Set(srcs.filter((s): s is string => Boolean(s)))].slice(0, limit * 2);
  const settled = await Promise.all(candidates.map((s) => loadImage(s, budgetMs)));
  return settled.filter((s): s is string => s !== null).slice(0, limit);
}
