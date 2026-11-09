import { describe, expect, it } from 'vitest';
import { extractMetadata, looksBlocked, redirectedAway } from '../server/services/metadata';
import { withoutSiteName } from '../shared/metadata';

const ld = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`;

describe('product details from store pages', () => {
  it('takes the price and photo from ProductGroup variants', () => {
    const html = ld([
      {
        '@type': 'ProductGroup',
        name: "Air Force 1 '07",
        hasVariant: [
          { '@type': 'Product', name: 'Size 8', image: 'https://img.example.com/af1.jpg', offers: { '@type': 'Offer', price: 115, priceCurrency: 'USD' } },
        ],
      },
    ]);
    expect(extractMetadata(html, 'https://shoes.example.com/p/1')).toMatchObject({
      title: "Air Force 1 '07",
      imageUrl: 'https://img.example.com/af1.jpg',
      price: 115,
      currency: 'USD',
    });
  });

  it('reads JSON-LD wrapped in comments or with raw newlines in strings', () => {
    const html = `<script type="application/ld+json"><!--{"@type":"Product","name":"Mug","description":"Line one
line two","offers":{"price":"12.00","priceCurrency":"GBP"}}--></script>`;
    expect(extractMetadata(html, 'https://mugs.example.com/m')).toMatchObject({ title: 'Mug', description: 'Line one line two', price: 12, currency: 'GBP' });
  });

  it('reads a microdata price written as text', () => {
    const html = `<h1 itemprop="name">Graphic Tee</h1><span hidden itemProp="priceCurrency">USD</span><span itemProp="price" aria-hidden="false">$10.99</span>`;
    expect(extractMetadata(html, 'https://shop.example.com/ip/1')).toMatchObject({ title: 'Graphic Tee', price: 10.99, currency: 'USD' });
  });

  it('falls back to the page heading, Amazon-style photos and the visible price', () => {
    const html = `<html><head><title>Amazon.com: Earbuds : Electronics</title></head><body>
      <h1 id="title"><span id="productTitle">   Wireless Earbuds, Noise Cancelling   </span></h1>
      <span class="a-price a-text-price" data-a-strike="true"><span class="a-offscreen">$299.00</span></span>
      <div id="corePrice_feature_div"><span class="a-price priceToPay"><span class="a-offscreen"> </span><span aria-hidden="true"><span class="a-price-symbol">$</span><span class="a-price-whole">249<span class="a-price-decimal">.</span></span><span class="a-price-fraction">99</span></span></span></div>
      <img id="landingImage" data-old-hires="https://m.media-amazon.com/images/I/big.jpg" src="https://m.media-amazon.com/images/I/small.jpg">
      <input id="add-to-cart-button" type="submit"></body></html>`;
    expect(extractMetadata(html, 'https://www.amazon.com/dp/B0TEST')).toMatchObject({
      title: 'Wireless Earbuds, Noise Cancelling',
      imageUrl: 'https://m.media-amazon.com/images/I/big.jpg',
      price: 249.99,
    });
  });

  it('skips strike-through prices and ignores prices on pages that sell nothing', () => {
    const shop = `<h1>Lamp</h1><span class="price-was">£80.00</span><span class="product-price">£60.00</span><button>Add to basket</button>`;
    expect(extractMetadata(shop, 'https://lamps.example.com/l')).toMatchObject({ price: 60, currency: 'GBP' });
    const article = `<h1>Best lamps of the year</h1><span class="price-tag">$60</span>`;
    expect(extractMetadata(article, 'https://blog.example.com/lamps').price).toBeNull();
  });

  it('strips the store name from a <title> fallback', () => {
    expect(extractMetadata('<title>Linen Throw | Maison Lin</title>', 'https://maisonlin.example.com').title).toBe('Linen Throw');
    expect(withoutSiteName('Plain title')).toBe('Plain title');
  });
});

describe('blocked and missing pages', () => {
  it('recognises bot-protection responses', () => {
    expect(looksBlocked({ status: 403, body: '<title>Access Denied</title>' })).toBe(true);
    expect(looksBlocked({ status: 200, body: '<title>Just a moment...</title><script>window._cf_chl_opt={}</script>' })).toBe(true);
    expect(looksBlocked({ status: 200, body: '<meta http-equiv="refresh" content="5; URL=\'/p?bm-verify=abc\'"><title>&nbsp;</title>' })).toBe(true);
    expect(looksBlocked({ status: 200, body: '<title>Store</title><h1>We’re working on it.</h1>' })).toBe(true);
    expect(looksBlocked({ status: 200, body: `<title></title><script>window['istlWasHere'] = true; ${'x'.repeat(70_000)}</script>` })).toBe(true);
    expect(looksBlocked({ status: 200, body: '<title>Cozy Blanket</title><h1>Cozy Blanket</h1>' })).toBe(false);
    expect(looksBlocked({ status: 200, body: `<title>Cozy Blanket</title>${'x'.repeat(70_000)}<script>/* bm-verify */</script>` })).toBe(false);
  });

  it('spots product links that bounce to the home or search page', () => {
    expect(redirectedAway('https://shop.example.com/product/123', 'https://shop.example.com/search?keyword=productnotcarried')).toBe(true);
    expect(redirectedAway('https://shop.example.com/product/123', 'https://shop.example.com/')).toBe(true);
    expect(redirectedAway('https://a.co/d/xyz', 'https://www.amazon.com/dp/B0TEST')).toBe(false);
    expect(redirectedAway('https://shop.example.com/', 'https://shop.example.com/')).toBe(false);
  });
});
