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

function visionApiKey(): string | null {
  const key = process.env.GOOGLE_VISION_API_KEY?.trim();
  return key || null;
}

/** True when Vision credentials are present (photo recognition can run). */
export function visionConfigured(): boolean {
  return Boolean(visionApiKey()) || process.env.VISION_MOCK === '1';
}

function rankPages(pages: VisionPage[]): VisionPage[] {
  return [...pages]
    .filter((p) => typeof p.url === 'string' && /^https?:\/\//i.test(p.url!))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 6);
}

async function annotateWebDetection(imageBytes: Uint8Array): Promise<VisionWebDetection> {
  if (process.env.VISION_MOCK === '1') {
    return {
      pagesWithMatchingImages: [
        { url: 'https://example.com/mock-product', score: 0.9, pageTitle: 'Mock product' },
      ],
      bestGuessLabels: [{ label: 'product' }],
    };
  }
  const key = visionApiKey();
  if (!key) {
    throw new HttpError(503, 'Photo recognition isn’t configured yet. You can still add the photo and fill in details.', 'vision_not_configured');
  }
  const body = {
    requests: [
      {
        image: { content: Buffer.from(imageBytes).toString('base64') },
        features: [{ type: 'WEB_DETECTION', maxResults: 10 }],
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
    responses?: { error?: { message?: string }; webDetection?: VisionWebDetection }[];
  } | null;
  if (!res.ok) {
    const msg = data?.error?.message ?? `Vision API error (${res.status})`;
    if (res.status === 429 || /quota|rate/i.test(msg)) {
      throw new HttpError(429, 'Photo recognition is temporarily unavailable (quota). Try again later, or add details manually.', 'vision_quota');
    }
    throw new HttpError(502, msg, 'vision_failed');
  }
  const response = data?.responses?.[0];
  if (response?.error?.message) {
    throw new HttpError(502, response.error.message, 'vision_failed');
  }
  return response?.webDetection ?? {};
}

/**
 * Run Google Cloud Vision Web Detection on an image, rank matching product
 * pages, and hydrate a shortlist via the existing metadata fetcher.
 */
export async function searchProductFromImage(imageBytes: Uint8Array): Promise<ProductImageSearchResult> {
  if (!visionConfigured()) {
    return {
      configured: false,
      candidates: [],
      message: 'Photo recognition isn’t configured. Add the photo and fill in the details yourself.',
    };
  }

  // Local / CI mock — no Google call, no outbound page fetch.
  if (process.env.VISION_MOCK === '1') {
    void imageBytes;
    return {
      configured: true,
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

  const detection = await annotateWebDetection(imageBytes);
  const pages = rankPages(detection.pagesWithMatchingImages ?? []);
  if (!pages.length) {
    const guess = detection.bestGuessLabels?.[0]?.label;
    return {
      configured: true,
      candidates: [],
      message: guess
        ? `We saw something like “${guess}” but couldn’t find a product page. Add the details yourself.`
        : 'No matching product pages found. Add the details yourself.',
    };
  }

  const candidates: ProductImageCandidate[] = [];
  for (const page of pages.slice(0, 4)) {
    try {
      const metadata = await fetchUrlMetadata(page.url!);
      candidates.push({ url: page.url!, score: page.score ?? 0, metadata });
    } catch (err) {
      if (err instanceof UnsafeUrlError) continue;
      candidates.push({
        url: page.url!,
        score: page.score ?? 0,
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
      });
    }
  }

  return {
    configured: true,
    candidates,
    message: candidates.length
      ? undefined
      : 'Found pages, but couldn’t pull product details. Add them yourself.',
  };
}
