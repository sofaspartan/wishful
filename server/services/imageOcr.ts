import { HttpError } from '../http';

export interface ImageOcrResult {
  configured: boolean;
  /** Full recognized text (may be empty). */
  text: string;
  /** First useful line for the item title. */
  suggestedTitle?: string;
  message?: string;
}

function visionApiKey(): string | null {
  const key = process.env.GOOGLE_VISION_API_KEY?.trim();
  return key || null;
}

/** True when Vision credentials are present (OCR can run). */
export function visionConfigured(): boolean {
  return Boolean(visionApiKey()) || process.env.VISION_MOCK === '1';
}

/** Pick a short title from OCR lines — first meaty line, trimmed. */
export function titleFromOcrText(text: string): string | undefined {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const line =
    lines.find((l) => l.length >= 3 && /[A-Za-z]/.test(l)) ??
    lines.find((l) => l.length >= 2) ??
    null;
  if (!line) return undefined;
  return line.length > 120 ? `${line.slice(0, 117).trimEnd()}…` : line;
}

async function annotateText(imageBytes: Uint8Array): Promise<string> {
  if (process.env.VISION_MOCK === '1') {
    return 'Wishful Ceramic Mug\nHandmade in Brooklyn\nDishwasher safe';
  }
  const key = visionApiKey();
  if (!key) {
    throw new HttpError(503, 'Text scan isn’t configured yet. You can still add the photo and fill in details.', 'vision_not_configured');
  }
  const body = {
    requests: [
      {
        image: { content: Buffer.from(imageBytes).toString('base64') },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
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
    responses?: Array<{
      error?: { message?: string };
      fullTextAnnotation?: { text?: string };
      textAnnotations?: Array<{ description?: string }>;
    }>;
  } | null;
  if (!res.ok) {
    const msg = data?.error?.message ?? `Vision API error (${res.status})`;
    if (res.status === 429 || /quota|rate/i.test(msg)) {
      throw new HttpError(429, 'Text scan is temporarily unavailable (quota). Try again later, or add details manually.', 'vision_quota');
    }
    if (res.status === 403 || /permission denied|ACCESS_DENIED|PERMISSION_DENIED/i.test(msg)) {
      throw new HttpError(
        502,
        'Text scan can’t use this Google Cloud key yet — enable Cloud Vision API (and billing) on the same project as the key, then try again.',
        'vision_forbidden',
      );
    }
    throw new HttpError(502, msg, 'vision_failed');
  }
  const response = data?.responses?.[0];
  if (response?.error?.message) {
    throw new HttpError(502, response.error.message, 'vision_failed');
  }
  const full = response?.fullTextAnnotation?.text?.trim();
  if (full) return full;
  const first = response?.textAnnotations?.[0]?.description?.trim();
  return first ?? '';
}

/** Run Google Cloud Vision OCR on an image and suggest a title from the text. */
export async function extractTextFromImage(imageBytes: Uint8Array): Promise<ImageOcrResult> {
  if (!visionConfigured()) {
    return {
      configured: false,
      text: '',
      message: 'Text scan isn’t configured. Add a Google Cloud Vision API key, or add the photo and fill in details yourself.',
    };
  }

  const text = (await annotateText(imageBytes)).trim();
  if (!text) {
    return {
      configured: true,
      text: '',
      message: 'No text found in that photo. Try a clearer shot of the label, or fill in the details yourself.',
    };
  }

  const suggestedTitle = titleFromOcrText(text);
  return {
    configured: true,
    text,
    suggestedTitle,
    message: suggestedTitle ? `Found “${suggestedTitle}” on the photo.` : 'Pulled text from the photo — check the details.',
  };
}
