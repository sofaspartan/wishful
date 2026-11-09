import type { UrlMetadata } from '../../shared/types';
import { extractMetadata, retailerFromUrl } from '../../shared/metadata';
import { safeFetch, UnsafeUrlError } from './safeFetch';

export { decodeEntities, extractMetadata, retailerFromUrl } from '../../shared/metadata';

/** Fetch a URL and extract metadata. Never throws for remote failures — returns `extracted: false`. */
export async function fetchUrlMetadata(url: string): Promise<UrlMetadata> {
  const fallback: UrlMetadata = {
    extracted: false,
    url,
    title: '',
    description: '',
    imageUrl: null,
    price: null,
    currency: null,
    retailer: retailerFromUrl(url),
    brand: '',
  };
  try {
    const res = await safeFetch(url);
    if (res.status >= 400) {
      return { ...fallback, message: `The site responded with an error (${res.status}). You can fill in the details yourself.` };
    }
    if (!/html|xml/i.test(res.contentType)) {
      return { ...fallback, message: "That link isn't a web page we can read. Add the details manually." };
    }
    const data = extractMetadata(res.body, res.url);
    const extracted = Boolean(data.title || data.imageUrl);
    return {
      ...data,
      extracted,
      message: extracted ? undefined : "We couldn't read details from that page. You can fill them in below.",
    };
  } catch (err) {
    if (err instanceof UnsafeUrlError) throw err;
    return { ...fallback, message: "We couldn't reach that page — some stores block previews. Add the details below." };
  }
}
