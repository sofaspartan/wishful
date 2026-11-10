# Wishful — Development Guide

> Everything you want, all in one place.

Wishful is a wishlist, personal collection and gift-registry platform. Users save
products, experiences, ideas and gift cards into a single collection, organise them
into wishlists, and share those lists with friends and family who can reserve gifts
without an account — while Surprise Mode keeps the owner in the dark.

---

## 1. Architecture

```
Browser (React SPA)  ──fetch /api/*──▶  Netlify Function "api" (one router)  ──▶  Netlify Blobs
        │                                         │                                (JSON documents
        │  static files from /dist (CDN)          ├─ services (auth, email, SSRF-safe fetch…)   + images)
        │                                         └─ domain (wishlists, items, claims, public view)
        ▼
 Netlify CDN  ◀── scheduled function "daily" (occasion reminders, cleanup)
```

* **Frontend** – a Vite + React single-page app served statically from Netlify's CDN.
  All data comes from the API; `localStorage` is only used for UI preferences
  (view mode, sort), visitor claim tokens (so anonymous gift-givers can manage their
  reservation), and a "recently opened links" list.
* **API** – a single Netlify Function (`netlify/functions/api.ts`) mounted at
  `/api/*`. It delegates to a tiny framework-free router (`server/http.ts`,
  `server/app.ts`). The same `handleRequest()` runs inside the Vite dev server, so
  `npm run dev` gives you the full stack with no extra tooling.
* **Storage** – Netlify Blobs (site-wide stores, strong consistency) behind a small
  driver interface (`server/storage`). Drivers: `netlify` (production), `fs`
  (local dev, `./.data`), `memory` (tests).
* **Concurrency** – every read-modify-write uses ETag-conditional writes with retry
  (`atomicUpdate`). Uniqueness (email, username) uses create-only writes
  (`onlyIfNew`). Reservations for one wishlist live in a single document, so two
  people reserving the same item at once resolve to exactly one winner.
* **Scheduled jobs** – `netlify/functions/daily.ts` runs once a day: sends upcoming
  occasion reminders and sweeps expired sessions, reset tokens and rate-limit windows.

### Why this stack

* Free-tier friendly: Netlify static hosting + Functions + Blobs + scheduled
  functions; no separate database server to pay for or manage.
* Deploys straight from GitHub; zero infrastructure configuration.
* One language (TypeScript) and one set of validation schemas (Zod) shared by client
  and server.

## 2. Tech stack

| Layer | Choice |
| --- | --- |
| UI | React 19, React Router 7, TanStack Query 5, lucide-react icons, dnd-kit (drag & drop) |
| Styling | Hand-written CSS with design tokens (`src/styles`) — flat, minimal "bento" tiles (`.bento` / `.tile`); Inter variable font for UI text, Fraunces (soft build, `'SOFT' 100` for rounded marshmallowy serifs) for the logo and `.display` headings — both self-hosted via Fontsource |
| Build | Vite 8, TypeScript 7 (strict) |
| API | Netlify Functions v2 (Web `Request`/`Response`), Node 22 |
| Data | Netlify Blobs (`@netlify/blobs`) |
| Validation | Zod 4 (`shared/schemas.ts`) |
| Email | Resend HTTP API (optional) |
| Tests | Vitest (API-level integration tests against the in-memory driver) |

## 3. Project layout

```
shared/            Types, constants and Zod schemas used by both client and server
server/
  app.ts           Request entry: CSRF check, routing, error handling
  http.ts          Router, JSON helpers, cookies, HttpError
  storage/         Blob drivers (netlify | fs | memory) + atomic update helpers
  services/        auth, email, rate limiting, notifications, SSRF-safe fetch, metadata
  domain/          wishlists, items, claims (reservations & group gifts), public view
  routes/          auth/account, wishlists, items, public (visitor), misc (images, metadata…)
  jobs.ts          Daily scheduled work
netlify/functions/ api.ts (HTTP), daily.ts (scheduled)
src/
  config/brand.ts  Product name, tagline and colours (configurable branding)
  lib/             API client, queries, formatting, image upload, claim tokens
  components/      UI primitives (ui/), layout, modals, cards, dialogs
  pages/           Route components (lazy-loaded)
  styles/          tokens.css, components.css, layout.css
extension/         Chrome / Edge extension (Manifest V3) — see section 9
tests/             Vitest suites + helpers
```

## 4. Data model (Netlify Blobs)

Each collection is a site-wide Blobs store of the same name. Documents are JSON.

| Store | Key | Contents |
| --- | --- | --- |
| `users` | userId | Profile, scrypt password hash, preferences, `sessionsValidAfter` |
| `email-index` | sha256(lowercased email) | `{ userId }` — unique email constraint |
| `username-index` | username | `{ userId }` — unique username constraint |
| `user-index` | userId | `{ wishlistIds (ordered), itemIds, sharedWishlistIds, imageIds }` |
| `sessions` | sha256(session token) | `{ userId, expiresAt, createdAt }` |
| `wishlists` | wishlistId | List (`kind: wishlist \| collection`) incl. ordered `entries`, `collaborators`, `pendingInvites`, settings |
| `items` | itemId | Universal item (type, title, price, metadata…, `wishlistIds`, optional `owned` details) |
| `claims` | wishlistId | `{ claims: {entryId → claim}, pledges: {entryId → pledge[]} }` |
| `shares` | share token | `{ wishlistId, revokedAt }` |
| `resets` | sha256(reset token) | Password reset token (1 hour) |
| `invites` | sha256(email) | Pending collaborator invitations for not-yet-registered emails |
| `notifications` | userId | Latest 100 in-app notifications |
| `ratelimits` | bucket:key | Fixed-window counters |
| `friendships` | `{userIdA}.{userIdB}` (ids sorted) | `{ users, requesterId, status: pending \| accepted, createdAt, acceptedAt }` — the source of truth for friendship checks |
| `friend-index` | userId | `{ ids }` of everyone the user has a friendship record with (listing only) |
| `images` | imageId | Uploaded image bytes + content type metadata |
| `extension-tokens` | userId | `{ tokens: [{ id, secretHash, label, createdAt, lastUsedAt }] }` — connected browsers (max 10), secrets stored as SHA-256 only |
| `integrations` | userId | `{ brickfolio?, playshelf? }`. Brickfolio: site + sheet CSV links. Playshelf: profile id + username. Each also holds the two mirrored list ids, last sync result and error |
| `integration-cache` | sha256(site URL) | Brickfolio `sets.csv` catalog (with ETag/Last-Modified), sets found through the site's Brickset proxy, and when unknown sets were last looked up |

**Relationships**

* User 1─* Wishlist (owner); Wishlist *─* User via `collaborators` (viewer/editor).
* User *─* User via `friendships` (one record per pair, pending or accepted).
* Item belongs to one owner; Item *─* Wishlist through **entries**
  (`WishlistEntry { id, itemId, priority, customNotes, groupGift, groupGiftNote }`) —
  so priority, notes and ordering are per list, while item details are shared.
* **Collections** are lists with `kind: 'collection'` (fixed at creation; records
  without `kind` are wishlists). They chronicle things the owner already has: the
  API forces Surprise Mode, occasion, date, claims and group gifts off, and refuses
  reservations and pledges with `403 collection`.   Items carry optional
  `owned { acquiredOn, acquiredVia, pricePaid, condition, quantity, rating, review }`
  (`rating` 1–5 or null; `review` up to 3,000 characters), set
  automatically when an item lands in a collection. `POST /api/items/bulk` creates up
  to 25 items in one request and files them on the same lists (one write per item,
  one per list). `POST /api/items/:id/got-it`
  files an item in an existing or new (private) collection and can take it off the
  wishlist it came from.
* A list's cover is either `coverImage` (an uploaded or https photo) or
  `coverArt { icon, backdrop }`, an illustrated graphic picked from the fixed
  `COVER_ICONS` / `COVER_BACKDROPS` enums in `shared/types.ts`. Only the names
  are stored; the artwork lives in `src/components/CoverArt.tsx`. Records without
  `coverArt` read as `null`. An optional `coverArt.frame { shape, fill, color }`
  controls how the icon sits in the list header and full-size covers (floating, rounded tile, circle or cloud;
  solid or see-through; a `#rrggbb` colour). Without it the header uses a frosted
  white rounded tile.
  New lists created without `coverArt` or `coverImage` get `defaultCoverArt(kind)`
  from `shared/constants.ts`; sending `coverArt: null` opts out.
* Claims and pledges reference an **entry**, never an item, and store whether
  Surprise Mode was on at the time (`surprise: true`), so turning Surprise Mode off
  later never reveals gifts reserved during it.
* **Synced items** (Brickfolio, Playshelf) carry `source { provider, key, gallery, … }` and live on
  lists that carry `link { provider, tab }`. The source owns them: the API answers
  `409 synced_item` to edits of synced fields, deletes, Got it, moves and membership
  changes on linked lists. Private notes and price paid / date / condition / how
  you got it stay editable and survive syncs. Both providers share one engine
  (`server/integrations/mirror.ts`: locking, staleness, rate limits, add / update /
  move / remove, membership and priorities); each provider only downloads and maps.
* **Playshelf** (`server/integrations/playshelf.ts`, `playshelfData.ts`) reads
  Playshelf's Supabase REST API (`profiles`, `game_library`, `wishlist`) with the
  project's public anon key, so Playshelf's row-level security decides what's
  visible: only profiles with Library Visibility on. Games are keyed by RAWG id; the
  platform becomes the category; status (Playing / Completed / Backlog / Dropped),
  "Favorite" for pinned games, other platforms and genres become tags; star rating
  and notes become rating and review; RAWG art is requested resized. The same game
  on two platforms is one item ×2. Wishlist priority high / medium / low maps to
  Must have / Really want / Interested and wishlist notes become the gift-giver note.
  The "Video Game Wishlist" list is only created once the Playshelf wishlist has
  games in it.

## 5. Security model

* **Sessions**: 256-bit random tokens in an `HttpOnly; SameSite=Lax; Secure` cookie;
  only their SHA-256 is stored. 30-day sliding expiry. Changing/resetting a password
  invalidates all other sessions.
* **Passwords**: scrypt (N=16384) with per-user salt; constant-time comparison; a dummy
  hash is verified for unknown emails to avoid user enumeration by timing.
* **Recovery codes** (password reset without email): a 20-character code (~99 bits,
  no look-alike characters) is returned once by `POST /api/auth/register` and shown
  in a "save your code" dialog; only its SHA-256 is stored (`recoveryCodeHash`).
  `POST /api/auth/recover { email, code, password }` sets a new password, signs out
  every session and extension, and issues a replacement code (the check is repeated
  inside the conditional write, so a code works once). Wrong codes and unknown emails
  get the same answer, rate-limited per IP and per account. Signed-in users can
  replace their code with `POST /api/account/recovery-code { password }`; accounts
  created before codes existed get a reminder on Home.
* **CSRF**: all mutating requests must carry `X-Requested-With: wishful` (cannot be
  sent cross-site without a CORS preflight, which the API never approves) in addition
  to SameSite cookies.
* **Authorization** is server-side on every route: wishlist access is computed from
  the stored owner/collaborator lists (`requireWishlistAccess`), never from client
  input. Unknown or forbidden resources return 404 where existence would leak.
* **Public pages** are capability URLs: an unguessable share token grants read access
  to one non-private, non-archived list. Tokens can be regenerated or revoked.
  `/s/*` is served with `noindex` and `no-referrer`.
* **Friends**: friendship is read from the stored pair record, never from client
  input. Friends-only lists need the share token *and* a signed-in owner,
  collaborator or accepted friend (`assertCanOpen`) to view or start a reservation;
  release/purchase stay authorized by the claim token. A friend's profile endpoint
  returns only their Friends/Public, non-archived lists and 404s for non-friends.
* **Visitor claims**: reservations return a one-time bearer token (hash stored) needed
  to release/purchase. Visitors keep it on their device and can copy a private
  "manage" link to use it elsewhere.
* **Surprise Mode** is enforced in the API: owner/editor responses contain `claims: null`
  and the owner-side public view omits status entirely. No notification is ever sent
  to an owner about a claim or purchase.
* **Private notes** on items are stripped from public views and from viewer-collaborator
  responses. **Price paid** for owned items is likewise stripped from public views and
  nulled for viewer collaborators; only the owner and editors receive it.
* **SSRF protection** for link previews (`server/services/safeFetch.ts`): http/https
  only, ports 80/443, no credentials, blocked internal hostnames, every DNS answer
  checked against private/reserved IPv4/IPv6 ranges, socket pinned to the validated
  address, redirects re-validated (max 4), 8 s timeout, 1.5 MB cap (3 MB for
  previews). Brickfolio sheet, `sets.csv` and Brickset-proxy fetches go through the
  same guard, and the connect form only accepts `https://` links. Playshelf
  requests only ever go to the configured `PLAYSHELF_SUPABASE_URL` (users choose a
  username, never an address), through the same guard; the anon key stays on the
  server and the service-role key is never used.
* **Integrations** are limited to the accounts in `INTEGRATION_ALLOWED_EMAILS`,
  checked on the server for every integration route and on each scheduled sync;
  everyone else gets 404 and never sees the Settings tab. Syncs are rate-limited
  (30 an hour per user).
* **Uploads**: 5 MB cap, magic-byte sniffing (JPEG, PNG, GIF, WebP only — SVG and
  anything else rejected), served with `nosniff` and a sandboxed CSP. The browser
  downsizes large photos before upload.
* **Extension tokens**: `wfx_{userId}.{secret}` bearer tokens, accepted only by the
  `/api/extension/*` routes (`requireExtensionUser`) — every other route ignores the
  `Authorization` header. They can read the user's list names and add items to lists
  the user owns, nothing more. Issued only to a signed-in session after an explicit
  approval page; revoked from Settings, from the extension, by a password change
  (`sessionsValidAfter`) or by account deletion. Mutations still need the CSRF header.
* **Gift search** (`server/services/giftSearch.ts`) only calls the fixed Shopify
  catalog, eBay, Best Buy and Etsy API hosts; users send search words, never addresses.
  Store keys stay on the server, links and photos that aren't http(s) are dropped before
  they reach the page, and each store's pages are cached in the `gift-cache` store
  (6 hours; 15 minutes for Shopify, whose catalog terms cap price caching there).
  Shopify links keep their attribution parameters, as its terms require.
* **Rate limiting** on login, register, forgot-password, claims, metadata fetches,
  uploads, invites, friend requests, extension connects, extension saves and gift searches.
* **Headers**: CSP, `X-Frame-Options: DENY`, `nosniff`, strict referrer policy
  (see `netlify.toml`).

## 6. Environment variables

See `.env.example`. None are exposed to the browser.

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_URL` | Recommended | Public site URL used in email links (falls back to Netlify's `URL`) |
| `RESEND_API_KEY` | No | Resend API key — emailed reset links, invitations, reminders |
| `EMAIL_FROM` | With `RESEND_API_KEY` | Verified sender, e.g. `Wishful <hello@yourdomain.com>` |
| `STORAGE_DRIVER` | No | Force `netlify`, `fs` or `memory` |
| `DATA_DIR` | No | Folder for the local `fs` driver (default `.data`) |
| `BRAND_NAME` | No | Product name used in emails (default `Wishful`) |
| `RATE_LIMIT_DISABLED` | No | `1` disables rate limiting (local testing only) |
| `INTEGRATION_ALLOWED_EMAILS` | No | Comma-separated account emails allowed to connect Brickfolio and Playshelf. Empty = nobody |
| `PLAYSHELF_SUPABASE_URL` | For Playshelf | Playshelf's Supabase project URL (`https://<ref>.supabase.co`) |
| `PLAYSHELF_SUPABASE_ANON_KEY` | For Playshelf | Playshelf's public anon key (same as its `NEXT_PUBLIC_SUPABASE_ANON_KEY`) |
| `PLAYSHELF_SITE_URL` | No | Playshelf site address, for profile links in Settings |
| `SHOPIFY_CATALOG_CLIENT_ID`, `SHOPIFY_CATALOG_CLIENT_SECRET` | No | Shopify Dev Dashboard catalog key; raises the keyless Shopify search rate limit |
| `SHOPIFY_CATALOG` | No | `off` stops gift search from using Shopify's catalog |
| `SHOPIFY_UCP_PROFILE_URL` | No | Your own UCP agent profile URL for Shopify catalog calls |
| `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET` | For eBay gift search | Production keyset from developer.ebay.com (App ID and Cert ID) |
| `EBAY_CAMPAIGN_ID` | No | eBay Partner Network campaign ID, so eBay links earn commission |
| `BESTBUY_API_KEY` | For Best Buy gift search | Free key from developer.bestbuy.com |
| `ETSY_API_KEY`, `ETSY_SHARED_SECRET` | For Etsy gift search | Keystring and shared secret of an approved app at etsy.com/developers |
| `AMAZON_ASSOCIATE_TAG` | No | Associates tag added to the Gift ideas "Search Amazon" link |

Email is optional. Password resets work without it through recovery codes; the
Forgot password page only offers an emailed link when `RESEND_API_KEY` and
`EMAIL_FROM` are both set (`GET /api/auth/options`). Without them, other emails
(invitations, reminders, notifications) are skipped — in local development they're
printed to the terminal instead.

## 7. Local setup

```bash
npm install
cp .env.example .env      # optional
npm run dev               # http://localhost:5173 — SPA + API, data in ./.data
```

Other scripts:

```bash
npm test          # API integration tests (in-memory storage)
npm run typecheck # strict TypeScript across client, server and tests
npm run build     # production build into dist/
npm run check     # all of the above
npm run extension:dev   # browser extension pointed at localhost (see section 9)
```

To reset local data, delete the `.data/` folder.

## 8. Deploying to Netlify

1. Push the repository to GitHub.
2. In Netlify: **Add new site → Import an existing project →** pick the repo.
   Build settings are read from `netlify.toml` (build `npm run build`, publish `dist`,
   functions in `netlify/functions`).
3. (Optional) Under **Site configuration → Environment variables** add
   `RESEND_API_KEY` and `EMAIL_FROM` to turn on email, and `APP_URL` if you use a
   custom domain. The site works without them; passwords are reset with recovery codes.
4. Deploy. Netlify Blobs is enabled automatically for the site — no setup needed.
   The `daily` and hourly `sync` scheduled functions are picked up automatically.
   To mirror a Brickfolio LEGO sheet, add `INTEGRATION_ALLOWED_EMAILS` with your
   account email, then connect in **Settings → Brickfolio** with the Brickfolio site
   URL and the published CSV links of the `full_sets` and `wishlist` tabs.
   To mirror a Playshelf game library, also add `PLAYSHELF_SUPABASE_URL` and
   `PLAYSHELF_SUPABASE_ANON_KEY` (optionally `PLAYSHELF_SITE_URL`), make sure Library
   Visibility is public on your Playshelf profile, then connect in
   **Settings → Playshelf** with your Playshelf username.
   Playshelf's database, as set up in its repo, has no rule letting the anon key read
   wishlists, so the Playshelf wishlist only comes across once Playshelf's Supabase
   has this policy (run it in the Supabase SQL editor):

   ```sql
   create policy "Public wishlists are viewable by everyone" on wishlist
     for select using (exists (
       select 1 from profiles
       where profiles.id = wishlist.user_id and profiles.library_public = true
     ));
   ```
5. (Optional) Verify your sending domain in Resend so emails are delivered.

Every push to the main branch redeploys; pull requests get preview deploys (they
use the same Blobs stores as production — use a separate site if you need isolated
preview data).

## 9. Browser extension

`extension/` is a Manifest V3 extension for Chrome, Edge, Brave and Arc. Clicking it
reads the current tab, shows the product's name, price and photos, and saves the item
to any of the user's lists.

```
extension/
  build.mjs          Builds dist/ (live site) or dist-dev/ (localhost) and writes manifest.json
  popup.html         Popup page (React, reuses src/styles/tokens.css and the cover art)
  src/popup/         Popup UI
  src/scrape.ts      snapshotPage() — injected into the tab with chrome.scripting; must stay self-contained
  src/listScrape.ts  scanList() — reads a whole wishlist/registry page (same rule), plus popup-side cleanup
  src/connect.ts     Content script for /extension/connect only (receives the token)
  src/api.ts         fetch wrapper (Bearer token + CSRF header)
  src/storage.ts     chrome.storage.local: token, pending connect state, last-used lists
  public/icons/      Toolbar icons (source: icon.svg)
shared/extension.ts  Message protocol shared by the connect page and the content script
shared/metadata.ts   The page parser, shared with the server's link previews
```

**Permissions**: `activeTab` + `scripting` (read the current tab only when the user
clicks the button), `storage`, and host access to the Wishful site only. Extension
pages with host access aren't subject to CORS, so the API needs no CORS headers.

**Connecting**: the popup stores a random `state` and opens
`/extension/connect?state=…`. That page (signed-in only) checks the extension is
installed, asks for approval, calls `POST /api/extension/connect`, and hands the token
to the content script with `window.postMessage`. The content script saves it only if
the `state` matches; if the page gets no confirmation within 6 s it revokes the token.

**API** (all under `/api/extension`):

| Route | Auth | Purpose |
| --- | --- | --- |
| `POST /connect` | Session | Issue a token (label like "Chrome on macOS") |
| `GET /connections` | Session | Connected browsers for Settings |
| `DELETE /connections/:id` | Session | Disconnect a browser |
| `GET /session` | Token | Name, currency and owned lists (id, title, kind, cover) |
| `POST /items` | Token | Create an item on owned lists, or only in Saved Items |
| `POST /items/bulk` | Token | Up to 25 items at once (whole-list import), one priority per batch; 120 requests/hour |
| `POST /lists` | Token | Create a wishlist or collection to import into |
| `POST /disconnect` | Token | Revoke the calling token |

**Whole-list import**: on a wishlist, registry or any page with several products, the
popup offers "Whole list". `scanList()` uses a dedicated reader for Amazon lists
(name, ASIN link, photo, price, priority, comment and "wants N"; follows the list's
own "show more" pages to the end) and a generic reader elsewhere: JSON-LD item lists,
then product links grouped into cards with photo, price (skipping crossed-out ones)
and name, outside headers, footers, carousels and "recommended" blocks. The deep scan
scrolls, presses real "Load more" buttons (never links) and follows up to 10
same-origin `rel=next` pages, within 25 s and 500 items. The user unticks anything
they don't want, picks a new list (named after the site's list) and/or existing ones,
and the popup posts batches of 25. Lists behind a login work because the extension
reads the page the user already has open; bot checks (Walmart sometimes) are never
bypassed.

**Building and loading**

```bash
npm run extension:build   # extension/dist, talks to https://wishful-lists.netlify.app
npm run extension:dev     # extension/dist-dev, talks to http://localhost:5173
WISHFUL_URL=https://wishful.example npm run extension:build   # another domain
```

In Chrome open `chrome://extensions`, turn on **Developer mode**, choose **Load
unpacked** and pick `extension/dist` (or `dist-dev`). After rebuilding, press the
reload icon on the extension's card. The site address is baked into the manifest's
host permission: production builds use `WISHFUL_URL`, then Netlify's `URL` (the site's
main address during a Netlify build), then `https://wishful-lists.netlify.app`.

**Download from the site**

`npm run build` (what Netlify runs) builds the extension first. Production extension
builds also write `public/downloads/wishful-extension.zip` (the `extension/dist`
folder as `wishful-extension/`, zipped by `extension/zip.mjs` with no dependencies)
and `public/downloads/extension.json` (`{ version, size, builtAt }`). Vite copies
them into `dist/`, so every deploy serves a zip that matches the site. The folder is
gitignored. The popup bundles Latin font subsets only (`extension/src/popup/fonts.css`)
to keep the zip small (~290 KB).

The download is offered on the public `/extension` page (what it does, install steps,
privacy notes), in a section on the landing page, and in Settings → Browser extension.
All three use `src/components/ExtensionInstall.tsx`.

To publish, upload the zip to the Chrome Web Store developer dashboard, then put the
store link in `extensionUrl` in `src/config/brand.ts`. Every download button becomes
"Add to Chrome" and the manual install steps are hidden.

## 10. Branding

* `src/config/brand.ts` — name, tagline, description, privacy contact email, accent
  colours, fonts. Colours are applied at startup as `--brand-*` CSS variables, which
  `src/styles/tokens.css` turns into the light and dark palettes.
* Dark mode: `:root[data-theme='dark']` in `tokens.css` overrides the palette. The
  theme is set before first paint by `public/theme-init.js` (an external file so the
  CSP can keep `script-src 'self'`) and managed by `src/lib/theme.ts`; it starts in
  light mode and stays there until the user picks dark with the sun / moon toggle.
* `public/favicon.svg` — the logo mark.
* `BRAND_NAME` env var — name used in server-sent emails.

### Link previews (share images)

Crawlers for iMessage, Slack, WhatsApp, social sites and so on don't run JavaScript,
so preview tags are written into the HTML on the way out:

* `netlify/edge-functions/share-meta.ts` runs on every page (not `/api`, `/og` or
  static assets) and uses `shared/shareMeta.ts` to set the title, description and
  Open Graph / Twitter tags. Shared lists (`/s/:token`) and public profiles
  (`/u/:username`) are looked up through the public API **without cookies**, so a
  preview never shows more than a logged-out visitor could see; friends-only,
  private and revoked lists get a generic preview. `npm run dev` does the same via
  the Vite plugin in `vite.config.ts`.
* `netlify/functions/og.ts` → `server/og/` draws 1200×630 PNGs with satori + resvg:
  `/og/site.png` (brand card), `/og/list/:token.png` (cover backdrop, list icon,
  owner, title, date and up to three item photos — top priorities first) and
  `/og/profile/:username.png`. They reuse the brand colours, the cover illustrations
  and the fonts in `server/og/fonts` (static Inter and Fraunces `.woff`, since satori
  can't read the app's variable `woff2` files).
* Item and avatar photos load through the SSRF-safe fetcher (`safeFetchBytes`) or
  straight from Blobs for uploads, with a 3-second budget; WebP/AVIF photos are
  skipped because resvg can't decode them. Image URLs carry a `?v=` fingerprint of
  the list, so editing a list gets a fresh image instead of a stale cached one.
* Emoji and scripts the bundled fonts don't cover are dropped from image text.

## 11. Feature status

### Completed

* Accounts: register, login, logout, password reset with a recovery code (or an
  emailed link when email is configured), change password,
  profile (name, username, bio, avatar), public profile toggle, preferences
  (default visibility, Surprise Mode, gift settings, currency), notification
  preferences, account deletion.
* App shell: desktop sidebar with lists and Add Item action; mobile top bar and
  bottom navigation with a central add button; global search (⌘K) across wishlists,
  shared lists and items (names, descriptions, categories, tags, retailers, locations).
* Dashboard: greeting, quick actions, onboarding for new users, wishlist cards,
  recently added items, upcoming occasions with countdowns, recent activity.
* Wishlists: create, edit, delete, duplicate, archive/restore, drag-and-drop reorder,
  cover image, accent colour, occasion and date, private/friends/unlisted/public visibility.
* Collections: lists of things you already have, alongside wishlists on the My Lists
  page (All / Wishlists / Collections filter). Per-item ownership details (date, bought
  or gift, price paid, condition, quantity), a stats strip (count, value, new this
  year, gifts), "Got it!" from any wishlist or Saved Items to move an item into a
  collection, and a browse-only shared page with no reservation UI. 1–5 star ratings
  and written reviews on owned items, a "Top rated" sort, and a per-list setting to
  show or hide them on shared pages (hidden ones are stripped by the API).
* CSV import: "Add several → Import a CSV file" reads up to 500 rows, guesses which
  column is which (editable), previews the result and creates the items in batches
  of 25 on the chosen lists. Exports from Goodreads, The StoryGraph, Discogs
  (collection and wantlist), Letterboxd, IMDb, BoardGameGeek and Amazon order history
  are recognised by their headers (`src/lib/csvPresets.ts`): columns are matched for
  the user, rows can be narrowed (Goodreads shelf, BGG owned/wishlist…) before the
  500-row limit, books get Open Library covers by ISBN, and "Match the columns myself"
  falls back to the normal mapping.
* Whole-list import from the browser extension (see section 9).
* Brickfolio (allow-listed accounts): mirrors a LEGO collection and wishlist from the
  Brickfolio Google Sheet into two read-only lists, with the same photo rules as the
  Brickfolio site, ratings and reviews from the sheet, hourly and on-open syncs, and a
  Brickset lookup for sets missing from `sets.csv`.
* Playshelf (allow-listed accounts): mirrors a public Playshelf game library into a
  read-only "Video Game Collection" (cover art, platform, play status, genres, star
  ratings and reviews) and its wishlist into a "Video Game Wishlist", hourly and on
  open.
* Spoiler warning: when an owner opens their own share link with Surprise Mode off
  and gifts have been reserved or bought, reservation status is hidden behind a
  warning until they choose to see it.
* Items: products, experiences, ideas, gift cards and custom items; one item on many
  lists with per-list priority, note for gift-givers and order; drag-and-drop reorder;
  move between lists; add to several lists; categories, tags, private notes,
  type-specific details.
* Priorities: Must have and Really want get badges and tinted cards. Each wishlist picks
  an arrangement (toolbar "Arrange items" select, Gift settings, or the default in
  Settings), stored as two settings: `showPriorities` and `itemOrder`
  (`priority` | `custom`; missing on older lists means `priority`). "Group by priority"
  shows Must have and Really want sections ahead of everything else, and dragging
  within a section only moves items among that section's slots in the list order;
  "My order" keeps the drag order with badges; "Hide priorities" strips them from the
  public API response too. Collections always use their own order.
* Add Item flow: paste a link (SSRF-safe metadata extraction with graceful fallback),
  write an idea, or upload a photo; choose multiple destinations or create a list inline.
* Saved Items: grid/list views, search, filters (type, list, category, priority),
  sorting, item detail, edit, delete, list membership.
* Sharing: copy link, native share sheet, email, SMS, WhatsApp; regenerate or turn
  off links; public pages need no login.
* Reservations: atomic reserve, mark purchased, release, automatic expiry, owner can
  clear when Surprise Mode is off; owner controls (allow claims, allow purchase
  tracking, show reserved/purchased, allow messages, show priorities, expiry).
* Surprise Mode enforced in the API, including for editors and on the public page.
* Group gifts (no payments): join with a name and message, optional coordinator,
  coordinator marks purchased, contributors can leave.
* Collaborators: invite by username or email (pending invites applied at sign-up),
  viewer/editor roles, remove, leave; Shared With Me page.
* Friends: requests by username (send, accept, decline, cancel, unfriend), Friends
  page with a request badge in the nav, friend profiles listing their Friends/Public
  lists, friends-only share links with a sign-in / send-request prompt.
* Notifications: in-app (shared with you, collaborator edits, occasion reminders,
  friend requests and acceptances) with optional email; never about surprise claims.
* Public profiles listing public lists.
* Dark mode with a starry night sky, toggled from the top right of every header.
* Privacy policy at `/privacy`.
* Browser extension: save the product on the current tab to any lists, with photo
  picker, price and note; connected browsers listed and revocable in Settings;
  downloadable from `/extension`, the landing page and Settings.
* Accessibility: semantic landmarks, skip link, labelled controls, focus-trapped modals,
  keyboard drag-and-drop, visible focus, reduced-motion support.

### Remaining / future

* Price tracking and price-drop alerts (preference stored; feature not built).
* Monetary contributions for group gifts (pledge `amount` reserved in the schema).
* Email change flow with re-verification; email verification on sign-up.
* Chrome Web Store listing; Firefox and Safari builds of the extension.
* Mobile share target for saving from other apps.
* Image cleanup when an uploaded image is replaced (orphans are removed on account
  deletion only).

## 12. Known limitations

* **Owner bypass of Surprise Mode**: an owner who opens their own share link in a
  private window is treated as a visitor and sees reservation status (like any other
  link-based registry). The app never shows it to them while signed in.
* Visitor claim tokens live in the browser's localStorage; clearing site data loses the
  ability to release a reservation unless the visitor saved the manage link (the
  reservation still expires automatically).
* **Link previews and blocked stores.** `server/services/metadata.ts` fetches the page
  and `shared/metadata.ts` reads it: JSON-LD (including ProductGroup variants), Open
  Graph and meta tags, microdata, then the page's `<h1>`, Amazon-style photo
  attributes and the price shown next to the name. Shopify pages missing a price or
  photo get them from the store's `/products/<handle>.js`. If the first request is
  blocked, fails or takes over 2.5 s, a second one with Chrome-like headers races it,
  and the whole preview stays under 9 s. Even so, many large retailers (REI, Home
  Depot, Etsy, LEGO, Best Buy, Nordstrom, Zara and others) run bot protection that
  rejects any request from a server, and Netlify's data-center IPs make this worse.
  Those pages are recognised (status codes, challenge titles and markers) and come
  back as `blocked: true`, so the form says the store blocks previews and points to
  the browser extension, which reads the page in the user's own browser. Prices that
  load with JavaScript after the page (Target, Uniqlo) can't be seen by the server
  either. The item can always be saved manually.
* Remote product images are hot-linked; if the retailer removes them, a placeholder
  is shown.
* Netlify Blobs has no secondary indexes; per-user indexes are maintained manually. This
  scales comfortably for personal/family use (hundreds of lists per user, 1,000 items
  per list) but isn't designed for analytics-style queries.
* Preview deploys share the production Blobs stores.
