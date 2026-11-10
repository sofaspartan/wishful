/**
 * Titles, descriptions and share images for link previews. Crawlers don't run
 * JavaScript, so these are written into the HTML before it's served: by the
 * edge function in production (netlify/edge-functions/share-meta.ts) and by the
 * Vite dev server locally.
 *
 * No imports on purpose — the edge function runs on Deno, which resolves files
 * differently from the rest of the app. Page data comes from the public API
 * fetched without cookies, so a preview never shows more than a logged-out
 * visitor would see.
 */

export interface MetaBrand {
  name: string;
  tagline: string;
  description: string;
}

export interface PageMeta {
  /** The browser tab title. */
  title: string;
  /** The headline in link previews. */
  shareTitle: string;
  description: string;
  image: string;
  imageAlt: string;
  url: string;
}

/** Fetch a public API path as a logged-out visitor; null when it isn't available. */
export type GetJson = (apiPath: string) => Promise<unknown | null>;

interface ListView {
  wishlist: { kind: string; title: string; description: string; updatedAt: string; settings: { allowClaims: boolean } };
  owner: { displayName: string };
  recipients?: Array<{ name: string }>;
  entries: Array<{ item?: { imageUrl?: string | null; updatedAt?: string } }>;
}

interface ProfileView {
  user: { username: string; displayName: string; bio: string };
  wishlists: Array<{ updatedAt: string }>;
}

const STATIC_PAGES: Record<string, { title: string; description?: string }> = {
  '/login': { title: 'Sign in' },
  '/register': { title: 'Create your free account' },
  '/forgot-password': { title: 'Reset your password' },
  '/privacy': { title: 'Privacy policy' },
  '/extension': { title: 'Browser extension', description: 'Save products from any store to your wishlists in one click with the browser extension.' },
};

function firstName(name: string): string {
  return name.split(' ')[0] || name;
}

function possessive(name: string): string {
  const first = firstName(name);
  return first.endsWith('s') ? `${first}’` : `${first}’s`;
}

/** "Ava & Leo’s", like `possessiveNames` in constants. */
function possessiveNames(names: string[]): string {
  const joined = names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}` : (names[0] ?? '');
  return joined.endsWith('s') ? `${joined}’` : `${joined}’s`;
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** A short fingerprint so a changed list gets a fresh image URL (previews cache images by URL). */
function version(parts: Array<string | null | undefined>): string {
  let h = 0x811c9dc5;
  for (const ch of parts.join('|')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

function isListView(v: unknown): v is ListView {
  return Boolean(v && typeof v === 'object' && 'wishlist' in v && 'owner' in v && 'entries' in v);
}

function isProfileView(v: unknown): v is ProfileView {
  return Boolean(v && typeof v === 'object' && 'user' in v && 'wishlists' in v);
}

export async function pageMeta(pathname: string, origin: string, brand: MetaBrand, getJson: GetJson): Promise<PageMeta> {
  const home = `${brand.name} — ${brand.tagline.replace(/\.$/, '')}`;
  const base: PageMeta = {
    title: home,
    shareTitle: home,
    description: brand.description,
    image: `${origin}/og/site.png`,
    imageAlt: `${brand.name}: ${brand.tagline}`,
    url: `${origin}${pathname}`,
  };

  const list = /^\/s\/([A-Za-z0-9_-]{20,100})\/?$/.exec(pathname);
  if (list) {
    const view = await getJson(`/api/public/lists/${list[1]}`);
    if (!isListView(view)) return { ...base, title: `Shared list · ${brand.name}`, shareTitle: `A list shared on ${brand.name}`, description: 'Open the link to see it.' };
    const { wishlist: w, entries } = view;
    const whose = possessiveNames(view.recipients?.length ? view.recipients.map((r) => r.name) : [firstName(view.owner.displayName)]);
    const collection = w.kind === 'collection';
    const n = entries.length;
    const kind = collection ? 'collection' : 'wishlist';
    const fallback = collection
      ? `${whose} collection of ${n} ${n === 1 ? 'thing' : 'things'} on ${brand.name}.`
      : `${n} ${n === 1 ? 'item' : 'items'} on ${whose} wishlist.${w.settings.allowClaims ? ' Reserve a gift so nobody doubles up — no account needed.' : ''}`;
    const v = version([w.title, w.updatedAt, String(n), ...entries.map((e) => `${e.item?.imageUrl ?? ''}${e.item?.updatedAt ?? ''}`)]);
    return {
      ...base,
      title: `${w.title} · ${brand.name}`,
      shareTitle: `${w.title} — ${whose} ${kind}`,
      description: clip(w.description || fallback, 200),
      image: `${origin}/og/list/${list[1]}.png?v=${v}`,
      imageAlt: `${w.title}, ${whose} ${kind} on ${brand.name}`,
    };
  }

  const profile = /^\/u\/([A-Za-z0-9_.-]{1,40})\/?$/.exec(pathname);
  if (profile) {
    const view = await getJson(`/api/public/users/${profile[1]}`);
    if (!isProfileView(view)) return base;
    const { user, wishlists } = view;
    const v = version([user.displayName, user.bio, ...wishlists.map((w) => w.updatedAt)]);
    return {
      ...base,
      title: `${user.displayName} · ${brand.name}`,
      shareTitle: `${user.displayName} (@${user.username}) on ${brand.name}`,
      description: clip(user.bio || `${possessive(user.displayName)} public wishlists on ${brand.name}.`, 200),
      image: `${origin}/og/profile/${user.username}.png?v=${v}`,
      imageAlt: `${user.displayName} on ${brand.name}`,
    };
  }

  const page = STATIC_PAGES[pathname.replace(/\/$/, '')];
  if (page) return { ...base, title: `${page.title} · ${brand.name}`, shareTitle: `${page.title} · ${brand.name}`, description: page.description ?? base.description };
  return base;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Swap the page's title and description and add Open Graph / Twitter card tags. */
export function injectMeta(html: string, meta: PageMeta, siteName: string): string {
  const tag = (attr: 'name' | 'property', key: string, value: string) => `<meta ${attr}="${key}" content="${escapeHtml(value)}" />`;
  const tags = [
    tag('property', 'og:type', 'website'),
    tag('property', 'og:site_name', siteName),
    tag('property', 'og:title', meta.shareTitle),
    tag('property', 'og:description', meta.description),
    tag('property', 'og:url', meta.url),
    tag('property', 'og:image', meta.image),
    tag('property', 'og:image:type', 'image/png'),
    tag('property', 'og:image:width', '1200'),
    tag('property', 'og:image:height', '630'),
    tag('property', 'og:image:alt', meta.imageAlt),
    tag('name', 'twitter:card', 'summary_large_image'),
    tag('name', 'twitter:title', meta.shareTitle),
    tag('name', 'twitter:description', meta.description),
    tag('name', 'twitter:image', meta.image),
    tag('name', 'twitter:image:alt', meta.imageAlt),
  ].join('\n    ');
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(meta.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, tag('name', 'description', meta.description))
    .replace('</head>', `  ${tags}\n  </head>`);
}
