/**
 * `/og/*` — share images for link previews:
 *   /og/site.png                 the brand card
 *   /og/list/:token.png          a shared wishlist or collection
 *   /og/profile/:username.png    a public profile
 * Lists and profiles are looked up exactly as a logged-out visitor would see
 * them; anything a visitor couldn't open (private, friends-only, revoked) gets
 * the brand card instead, so the image never reveals more than the page.
 */
import type { ReactElement } from 'react';
import { isTopPriority } from '../../src/lib/priority';
import { assertCanOpen, buildPublicProfile, buildPublicView, resolveShareToken } from '../domain/publicView';
import { loadFirstImages, loadImage } from './images';
import { ListCard, ProfileCard, SiteCard, renderPng } from './render';

const IMAGE_BUDGET_MS = 3000;
const HOUR = 3600;

function png(body: Uint8Array, cdnSeconds: number): Response {
  return new Response(new Uint8Array(body), {
    status: 200,
    headers: {
      'content-type': 'image/png',
      'cache-control': `public, max-age=${Math.min(cdnSeconds, 600)}`,
      'netlify-cdn-cache-control': `public, max-age=${cdnSeconds}, stale-while-revalidate=${HOUR}`,
      'x-content-type-options': 'nosniff',
      // List images sit at share-token URLs; keep them out of image search like the pages themselves.
      'x-robots-tag': 'noindex',
    },
  });
}

let siteCache: { host: string; png: Uint8Array } | null = null;
async function sitePng(host: string): Promise<Uint8Array> {
  if (siteCache?.host === host) return siteCache.png;
  const body = await renderPng(<SiteCard host={host} />);
  siteCache = { host, png: body };
  return body;
}

async function listCard(token: string, host: string): Promise<ReactElement | null> {
  let view;
  try {
    const wishlist = await resolveShareToken(token);
    await assertCanOpen(wishlist, null);
    view = await buildPublicView(wishlist, null);
  } catch {
    return null;
  }
  const { wishlist: w, owner, entries } = view;
  const collection = w.kind === 'collection';
  const visible = entries.filter((e) => e.status !== 'purchased' && e.item.imageUrl);
  const ordered = w.settings.showPriorities ? [...visible.filter((e) => isTopPriority(e.priority)), ...visible.filter((e) => !isTopPriority(e.priority))] : visible;
  const [thumbs, ownerAvatar, coverPhoto] = await Promise.all([
    loadFirstImages(
      ordered.map((e) => e.item.imageUrl),
      3,
      IMAGE_BUDGET_MS,
    ),
    loadImage(owner.avatarUrl, IMAGE_BUDGET_MS),
    loadImage(w.coverImage, IMAGE_BUDGET_MS),
  ]);
  return (
    <ListCard
      title={w.title}
      kind={w.kind}
      ownerName={owner.displayName}
      ownerAvatar={ownerAvatar}
      coverArt={w.coverArt}
      coverPhoto={coverPhoto}
      occasion={w.occasion}
      eventDate={w.eventDate}
      itemCount={collection ? entries.reduce((n, e) => n + (e.item.owned?.quantity ?? 1), 0) : entries.length}
      thumbs={thumbs}
      canReserve={!collection && w.settings.allowClaims}
      host={host}
    />
  );
}

async function profileCard(username: string, host: string): Promise<ReactElement | null> {
  let view;
  try {
    view = await buildPublicProfile(username);
  } catch {
    return null;
  }
  const lists = view.wishlists.slice(0, 3);
  const [avatar, ...covers] = await Promise.all([loadImage(view.user.avatarUrl, IMAGE_BUDGET_MS), ...lists.map((l) => loadImage(l.coverImage, IMAGE_BUDGET_MS))]);
  return (
    <ProfileCard
      name={view.user.displayName}
      username={view.user.username}
      avatar={avatar}
      bio={view.user.bio}
      lists={view.wishlists.map((l, i) => ({ title: l.title, kind: l.kind, coverArt: l.coverArt, coverPhoto: covers[i] ?? null, occasion: l.occasion }))}
      host={host}
    />
  );
}

export async function handleOgRequest(req: Request): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  const url = new URL(req.url);
  const host = url.host;
  const list = /^\/og\/list\/([A-Za-z0-9_-]{20,100})\.png$/.exec(url.pathname);
  const profile = /^\/og\/profile\/([A-Za-z0-9_.-]{1,40})\.png$/.exec(url.pathname);
  if (url.pathname !== '/og/site.png' && !list && !profile) return new Response('Not found', { status: 404 });

  try {
    const card = list ? await listCard(list[1], host) : profile ? await profileCard(profile[1], host) : null;
    if (card) return png(await renderPng(card), HOUR);
    // Unknown or not-public pages get the brand card — briefly cached, in case the list is shared publicly soon.
    return png(await sitePng(host), list || profile ? 300 : 24 * HOUR);
  } catch (err) {
    console.error('share image failed', err);
    return new Response('Could not draw this image.', { status: 500 });
  }
}
