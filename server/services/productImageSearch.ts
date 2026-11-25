import type { UrlMetadata } from '../../shared/types';
import { HttpError } from '../http';
import { fetchUrlMetadata } from './metadata';
import { UnsafeUrlError } from './safeFetch';

export interface ProductImageCandidate {
  url: string;
  score: number;
  metadata: UrlMetadata | null;
}

export interface ProductImageSearchResult {
  configured: boolean;
  candidates: ProductImageCandidate[];
  message?: string;
  /** Best-effort label when no product pages matched (prefill title). */
  suggestedTitle?: string;
}

interface VisionPage {
  url?: string;
  score?: number;
  pageTitle?: string;
}

interface VisionWebDetection {
  pagesWithMatchingImages?: VisionPage[];
  webEntities?: { description?: string; score?: number }[];
  bestGuessLabels?: { label?: string }[];
}

interface VisionLabel {
  description?: string;
  score?: number;
}

interface VisionAnnotateResponse {
  error?: { message?: string };
  webDetection?: VisionWebDetection;
  labelAnnotations?: VisionLabel[];
}

const JUNK_HOST =
  /(?:^|\.)(?:google|gstatic|ggpht|googleapis|youtube|youtu\.be|facebook|fbcdn|instagram|cdninstagram|tiktok|pinterest|pinimg|twitter|x\.com|t\.co|reddit|redd\.it|wikipedia|wikimedia|blogspot|wordpress\.com|tumblr|imgur|flickr|unsplash|pexels|shutterstock|gettyimages|alamy)\./i;

const PRODUCT_HINT =
  /\/(?:dp|gp\/product|product|products|ip|itm|p|pd|sku|item)(?:\/|$|\?)|amazon\.|etsy\.|target\.|walmart\.|bestbuy\.|homedepot\.|wayfair\.|nordstrom\.|macys\.|ikea\.|apple\.com\/.*\/product|shopify/i;

function visionApiKey(): string | null {
  const key = process.env.GOOGLE_VISION_API_KEY?.trim();
  return key || null;
}

/** True when Vision credentials are present (Lens recognition can run). */
export function visionConfigured(): boolean {
  return Boolean(visionApiKey()) || process.env.VISION_MOCK === '1';
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function pageScore(page: VisionPage): number {
  const base = page.score ?? 0;
  const url = page.url ?? '';
  let boost = 0;
  if (PRODUCT_HINT.test(url)) boost += 0.35;
  if (page.pageTitle && /\$|€|£|\bUSD\b|\bCAD\b|\bbuy\b|\bshop\b/i.test(page.pageTitle)) boost += 0.1;
  if (JUNK_HOST.test(hostOf(url))) boost -= 0.5;
  return base + boost;
}

function rankPages(pages: VisionPage[]): VisionPage[] {
  const seen = new Set<string>();
  return [...pages]
    .filter((p) => typeof p.url === 'string' && /^https?:\/\//i.test(p.url!))
    .filter((p) => {
      const host = hostOf(p.url!);
      if (!host || JUNK_HOST.test(host)) return false;
      const key = p.url!.replace(/#.*$/, '').replace(/\/$/, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => pageScore(b) - pageScore(a))
    .slice(0, 8);
}

function suggestedFromDetection(web: VisionWebDetection, labels: VisionLabel[]): string | undefined {
  const guess = web.bestGuessLabels?.map((g) => g.label?.trim()).find(Boolean);
  if (guess) return guess;
  const entity = [...(web.webEntities ?? [])]
    .filter((e) => e.description?.trim() && (e.score ?? 0) >= 0.4)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]?.description?.trim();
  if (entity) return entity;
  const label = [...labels]
    .filter((l) => l.description?.trim() && (l.score ?? 0) >= 0.7)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]?.description?.trim();
  return label || undefined;
}

async function annotateImage(imageBytes: Uint8Array): Promise<{ web: VisionWebDetection; labels: VisionLabel[] }> {
  if (process.env.VISION_MOCK === '1') {
    return {
      web: {
        pagesWithMatchingImages: [
          { url: 'https://example.com/mock-product', score: 0.9, pageTitle: 'Mock product — $42' },
        ],
        bestGuessLabels: [{ label: 'ceramic mug' }],
        webEntities: [{ description: 'Mug', score: 0.85 }],
      },
      labels: [{ description: 'Mug', score: 0.95 }],
    };
  }
  const key = visionApiKey();
  if (!key) {
    throw new HttpError(503, 'Lens isn’t configured yet. You can still add the photo and fill in details.', 'vision_not_configured');
  }
  const body = {
    requests: [
      {
        image: { content: Buffer.from(imageBytes).toString('base64') },
        features: [
          { type: 'WEB_DETECTION', maxResults: 15 },
          { type: 'LABEL_DETECTION', maxResults: 8 },
        ],
      },
    ],
  };
  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as {
    error?: { message?: string; status?: string };
    responses?: VisionAnnotateResponse[];
  } | null;
  if (!res.ok) {
    const msg = data?.error?.message ?? `Vision API error (${res.status})`;
    if (res.status === 429 || /quota|rate/i.test(msg)) {
      throw new HttpError(429, 'Lens is temporarily unavailable (quota). Try again later, or add details manually.', 'vision_quota');
    }
    throw new HttpError(502, msg, 'vision_failed');
  }
  const response = data?.responses?.[0];
  if (response?.error?.message) {
    throw new HttpError(502, response.error.message, 'vision_failed');
  }
  return {
    web: response?.webDetection ?? {},
    labels: response?.labelAnnotations ?? [],
  };
}

/**
 * Run Google Cloud Vision Web Detection (+ labels) on an image, rank matching
 * product pages, and hydrate a shortlist via the existing metadata fetcher.
 */
export async function searchProductFromImage(imageBytes: Uint8Array): Promise<ProductImageSearchResult> {
  if (!visionConfigured()) {
    return {
      configured: false,
      candidates: [],
      message: 'Lens isn’t configured. Add a Google Cloud Vision API key, or add the photo and fill in details yourself.',
    };
  }

  // Local / CI mock — no Google call, no outbound page fetch.
  if (process.env.VISION_MOCK === '1') {
    void imageBytes;
    return {
      configured: true,
      suggestedTitle: 'ceramic mug',
      candidates: [
        {
          url: 'https://example.com/mock-product',
          score: 0.9,
          metadata: {
            extracted: true,
            url: 'https://example.com/mock-product',
            title: 'Mock product',
            description: 'Vision mock candidate',
            imageUrl: null,
            price: null,
            currency: null,
            retailer: 'Example',
            brand: '',
          },
        },
      ],
    };
  }

  const { web, labels } = await annotateImage(imageBytes);
  const suggestedTitle = suggestedFromDetection(web, labels);
  const pages = rankPages(web.pagesWithMatchingImages ?? []);
  if (!pages.length) {
    return {
      configured: true,
      candidates: [],
      suggestedTitle,
      message: suggestedTitle
        ? `We saw something like “${suggestedTitle}” but couldn’t find a product page. Add the details yourself.`
        : 'No matching product pages found. Add the details yourself.',
    };
  }

  const hydrated = await Promise.all(
    pages.slice(0, 5).map(async (page) => {
      try {
        const metadata = await fetchUrlMetadata(page.url!);
        return { url: page.url!, score: pageScore(page), metadata } satisfies ProductImageCandidate;
      } catch (err) {
        if (err instanceof UnsafeUrlError) return null;
        return {
          url: page.url!,
          score: pageScore(page),
          metadata: {
            extracted: false,
            url: page.url!,
            title: page.pageTitle ?? '',
            description: '',
            imageUrl: null,
            price: null,
            currency: null,
            retailer: '',
            brand: '',
            message: err instanceof Error ? err.message : 'Couldn’t read this page.',
          },
        } satisfies ProductImageCandidate;
      }
    }),
  );

  const candidates = hydrated
    .filter((c): c is ProductImageCandidate => Boolean(c))
    .sort((a, b) => {
      const aGood = a.metadata?.extracted && a.metadata.title ? 1 : 0;
      const bGood = b.metadata?.extracted && b.metadata.title ? 1 : 0;
      if (bGood !== aGood) return bGood - aGood;
      return b.score - a.score;
    });

  return {
    configured: true,
    candidates,
    suggestedTitle,
    message: candidates.length
      ? undefined
      : suggestedTitle
        ? `We saw “${suggestedTitle}” but couldn’t pull product pages. Add the details yourself.`
        : 'Found pages, but couldn’t pull product details. Add them yourself.',
  };
}
