import { describe, expect, it } from 'vitest';
import { readDetails, type PageSnapshot } from '../extension/src/scrape';

const base = 'https://shop.example.com';

describe('extension page reading', () => {
  it('prefers structured product data and keeps the page photos', () => {
    const snap: PageSnapshot = {
      url: `${base}/products/tree-runner`,
      title: 'Tree Runner — Navy | Cloudwalk Shoes',
      html: `<head><title>Tree Runner — Navy | Cloudwalk Shoes</title>
        <meta property="og:site_name" content="Cloudwalk"><meta property="og:image" content="/img/main.png"></head>
        <script type="application/ld+json">{"@type":"Product","name":"Men's Tree Runner","brand":{"name":"Cloudwalk"},
        "image":["/img/main.png"],"offers":{"price":"98.00","priceCurrency":"USD"}}</script>`,
      images: [`${base}/img/main.png`, `${base}/img/side.png`],
      priceText: '$98.00',
    };
    expect(readDetails(snap)).toMatchObject({
      title: "Men's Tree Runner",
      retailer: 'Cloudwalk',
      brand: 'Cloudwalk',
      price: 98,
      currency: 'USD',
      images: [`${base}/img/main.png`, `${base}/img/side.png`],
    });
  });

  it('falls back to the visible price and trims the store name from the title', () => {
    const snap: PageSnapshot = {
      url: `${base}/linen-throw`,
      title: 'Linen throw blanket – Maison Lin',
      html: '<head><title>Linen throw blanket – Maison Lin</title></head>',
      images: [`${base}/throw.png`],
      priceText: '€ 79,90',
    };
    expect(readDetails(snap)).toMatchObject({ title: 'Linen throw blanket', price: 79.9, currency: 'EUR', retailer: 'Example' });
  });

  it('keeps titles that only look like they have a separator', () => {
    const snap: PageSnapshot = { url: `${base}/x`, title: 'T-shirt', html: '<head><title>T-shirt</title></head>', images: [], priceText: '' };
    expect(readDetails(snap)).toMatchObject({ title: 'T-shirt', price: null, currency: null, images: [] });
  });
});
