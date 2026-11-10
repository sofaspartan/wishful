import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ExternalLink, Plus, Search, Star } from 'lucide-react';
import {
  GIFT_CATEGORIES,
  GIFT_PRICE_CAPS,
  GIFT_STORE_LABELS,
  GIFT_STORES,
  amazonSearchUrl,
  type GiftProduct,
  type GiftSearchResponse,
} from '../../shared/giftIdeas';
import { errorMessage, get } from '../lib/api';
import { formatPrice } from '../lib/format';
import { useAppActions } from '../components/appActions';
import { COVER_ICON_ART } from '../components/CoverArt';
import { ItemCardSkeleton } from '../components/ItemCard';
import { ItemImage } from '../components/ItemVisuals';
import { PageSky } from '../components/PageSky';
import { SkyArt } from '../components/SkyArt';
import { Button, buttonClass } from '../components/ui/Button';
import { EmptyState } from '../components/ui/misc';

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

export default function GiftIdeas() {
  const [params, setParams] = useSearchParams();
  const { openAddItem } = useAppActions();

  const q = params.get('q')?.trim() ?? '';
  const category = q ? null : (GIFT_CATEGORIES.find((c) => c.id === params.get('cat')) ?? GIFT_CATEGORIES[0]);
  const maxParam = params.get('max');
  const maxPrice = maxParam === 'any' ? undefined : (GIFT_PRICE_CAPS.find((c) => String(c) === maxParam) ?? category?.maxPrice);
  const store = GIFT_STORES.find((s) => s === params.get('store'));
  const query = q || (category?.query ?? '');

  const [text, setText] = useState(q);
  useEffect(() => setText(q), [q]);

  const update = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    setParams(p);
  };

  const search = useInfiniteQuery({
    queryKey: ['gifts', query, maxPrice ?? null, store ?? null],
    queryFn: ({ pageParam }) => {
      const sp = new URLSearchParams({ q: query, page: String(pageParam) });
      if (maxPrice) sp.set('maxPrice', String(maxPrice));
      if (store) sp.set('store', store);
      return get<GiftSearchResponse>(`/api/gifts/search?${sp}`);
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: 10 * 60_000,
    enabled: Boolean(query),
  });

  const pages = search.data?.pages ?? [];
  const first = pages[0];
  const products = useMemo(() => {
    const seen = new Set<string>();
    return pages.flatMap((p) => p.products).filter((p) => !seen.has(p.id) && seen.add(p.id));
  }, [pages]);
  const stores = first?.stores ?? [];
  const missing = (pages[pages.length - 1]?.results ?? []).filter((r) => !r.ok).map((r) => GIFT_STORE_LABELS[r.store]);
  const amazonUrl = first?.amazonUrl ?? amazonSearchUrl(query, maxPrice);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = text.trim();
    update({ q: next || null, cat: null });
  };

  const add = (p: GiftProduct) =>
    openAddItem({
      product: {
        title: p.title.slice(0, 200),
        url: p.url,
        imageUrl: p.imageUrl,
        price: p.price,
        currency: p.currency,
        retailer: GIFT_STORE_LABELS[p.store],
        brand: p.store === 'bestbuy' ? (p.seller ?? undefined) : undefined,
      },
    });

  const amazonLink = (
    <a className={buttonClass()} href={amazonUrl} target="_blank" rel="noopener noreferrer">
      <ExternalLink size={16} aria-hidden />
      Search Amazon
    </a>
  );

  return (
    <div className="page">
      <PageSky
        eyebrow="Gift ideas"
        title="Find something they'll love"
        subtitle="Search popular stores in one place, then add anything you find to a list."
        art={<SkyArt scene="gifts" />}
      >
        <form className="sky-form" role="search" onSubmit={submit}>
          <div className="sky-form-row">
            <Search size={17} className="muted" aria-hidden />
            <input
              className="input"
              type="search"
              placeholder="Search for gifts, brands or ideas"
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label="Search for gifts"
              maxLength={100}
              enterKeyHint="search"
            />
            <Button type="submit" variant="primary" disabled={!text.trim()}>
              Search
            </Button>
          </div>
        </form>
      </PageSky>

      <nav className="gift-cats" aria-label="Gift categories">
        {GIFT_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className="gift-cat"
            aria-pressed={category?.id === c.id}
            onClick={() => {
              setText('');
              update({ q: null, cat: c.id, max: null });
            }}
          >
            <span className="gift-cat-art" aria-hidden>
              {COVER_ICON_ART[c.icon]}
            </span>
            <span className="gift-cat-label">{c.label}</span>
          </button>
        ))}
      </nav>

      <section className="section" aria-live="polite" aria-busy={search.isLoading || undefined}>
        <div className="gift-head">
          <h2 className="section-title">{q ? <>Results for “{q}”</> : `${category?.label ?? 'Gift'} ideas`}</h2>
          <div className="gift-filters">
            {stores.length > 1 && (
              <div className="filter-row" role="group" aria-label="Store">
                <button type="button" className="chip" aria-pressed={!store} onClick={() => update({ store: null })}>
                  All stores
                </button>
                {stores.map((s) => (
                  <button key={s} type="button" className="chip" aria-pressed={store === s} onClick={() => update({ store: s })}>
                    {GIFT_STORE_LABELS[s]}
                  </button>
                ))}
              </div>
            )}
            <select className="select" aria-label="Price" value={maxPrice ? String(maxPrice) : 'any'} onChange={(e) => update({ max: e.target.value })}>
              <option value="any">Any price</option>
              {GIFT_PRICE_CAPS.map((c) => (
                <option key={c} value={c}>
                  Under ${c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {search.isLoading ? (
          <div className="grid-items">
            {Array.from({ length: 8 }, (_, i) => (
              <ItemCardSkeleton key={i} />
            ))}
          </div>
        ) : search.isError ? (
          <EmptyState art={<SkyArt scene="search" />} title="Search isn't working right now" action={<Button onClick={() => void search.refetch()}>Try again</Button>}>
            {errorMessage(search.error)}
          </EmptyState>
        ) : first && stores.length === 0 ? (
          <EmptyState art={<SkyArt scene="gifts" />} title="Store search isn't switched on yet" action={amazonLink}>
            Once this site is connected to eBay, Best Buy or Etsy, their products show up here. Until then, look on Amazon and paste the link into Add item.
          </EmptyState>
        ) : products.length === 0 ? (
          <EmptyState art={<SkyArt scene="search" />} title={missing.length ? "The stores didn't answer" : 'No gifts found'} action={amazonLink}>
            {missing.length ? 'Try again in a minute, or look on Amazon instead.' : 'Try fewer or different words, a higher price limit, or look on Amazon instead.'}
          </EmptyState>
        ) : (
          <>
            {missing.length > 0 && (
              <p className="gift-note">
                {missing.join(' and ')} didn't answer just now, so {missing.length === 1 ? 'its' : 'their'} products are missing.
              </p>
            )}
            <div className="grid-items">
              {products.map((p) => (
                <GiftCard key={p.id} product={p} onAdd={() => add(p)} />
              ))}
            </div>
            <div className="gift-more">
              {search.hasNextPage && (
                <Button onClick={() => void search.fetchNextPage()} loading={search.isFetchingNextPage}>
                  Show more
                </Button>
              )}
              <p className="text-sm muted">
                Not finding it?{' '}
                <a href={amazonUrl} target="_blank" rel="noopener noreferrer">
                  See “{query}” on Amazon
                </a>
                , then paste the link into Add item.
              </p>
            </div>
          </>
        )}
      </section>
      <div style={{ height: 'var(--s-12)' }} />
    </div>
  );
}

function GiftCard({ product: p, onAdd }: { product: GiftProduct; onAdd: () => void }) {
  const storeName = GIFT_STORE_LABELS[p.store];
  return (
    <article className="item-card gift-card">
      <a className="item-card-hit" href={p.url} target="_blank" rel="noopener noreferrer" aria-label={`${p.title} on ${storeName}`} />
      <div className="item-media">
        <ItemImage src={p.imageUrl} type="product" />
      </div>
      <div className="item-overlay-tr">
        <Button size="sm" iconOnly icon={<Plus size={16} />} aria-label={`Add ${p.title} to a list`} title="Add to a list" onClick={onAdd} />
      </div>
      <div className="item-body">
        <span className="item-source truncate">
          {storeName}
          {p.seller ? ` · ${p.seller}` : ''}
        </span>
        <h3 className="item-title clamp-2">{p.title}</h3>
        <div className="item-foot">
          {p.price !== null && <span className="item-price">{formatPrice(p.price, p.currency ?? 'USD')}</span>}
          {p.rating !== null && p.reviewCount ? (
            <span className="gift-rating">
              <Star size={12} aria-hidden />
              {p.rating.toFixed(1)}
              <span className="muted">({compact.format(p.reviewCount)})</span>
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
