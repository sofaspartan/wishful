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

**Relationships**

* User 1─* Wishlist (owner); Wishlist *─* User via `collaborators` (viewer/editor).
* User *─* User via `friendships` (one record per pair, pending or accepted).
* Item belongs to one owner; Item *─* Wishlist through **entries**
  (`WishlistEntry { id, itemId, priority, customNotes, groupGift, groupGiftNote }`) —
  so priority, notes and ordering are per list, while item details are shared.
* **Collections** are lists with `kind: 'collection'` (fixed at creation; records
  without `kind` are wishlists). They chronicle things the owner already has: the
  API forces Surprise Mode, occasion, date, claims and group gifts off, and refuses
  reservations and pledges with `403 collection`. Items carry optional
  `owned { acquiredOn, acquiredVia, pricePaid, condition, quantity }`, set
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

## 5. Security model

* **Sessions**: 256-bit random tokens in an `HttpOnly; SameSite=Lax; Secure` cookie;
  only their SHA-256 is stored. 30-day sliding expiry. Changing/resetting a password
  invalidates all other sessions.
* **Passwords**: scrypt (N=16384) with per-user salt; constant-time comparison; a dummy
  hash is verified for unknown emails to avoid user enumeration by timing.
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
  address, redirects re-validated (max 4), 8 s timeout, 1.5 MB cap.
* **Uploads**: 5 MB cap, magic-byte sniffing (JPEG, PNG, GIF, WebP only — SVG and
  anything else rejected), served with `nosniff` and a sandboxed CSP. The browser
  downsizes large photos before upload.
* **Rate limiting** on login, register, forgot-password, claims, metadata fetches,
  uploads, invites and friend requests.
* **Headers**: CSP, `X-Frame-Options: DENY`, `nosniff`, strict referrer policy
  (see `netlify.toml`).

## 6. Environment variables

See `.env.example`. None are exposed to the browser.

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_URL` | Recommended | Public site URL used in email links (falls back to Netlify's `URL`) |
| `RESEND_API_KEY` | For email | Resend API key — password reset, invitations, reminders |
| `EMAIL_FROM` | For email | Verified sender, e.g. `Wishful <hello@yourdomain.com>` |
| `STORAGE_DRIVER` | No | Force `netlify`, `fs` or `memory` |
| `DATA_DIR` | No | Folder for the local `fs` driver (default `.data`) |
| `BRAND_NAME` | No | Product name used in emails (default `Wishful`) |
| `RATE_LIMIT_DISABLED` | No | `1` disables rate limiting (local testing only) |

Without `RESEND_API_KEY`, emails are skipped. In local development they're printed
to the terminal and the forgot-password screen shows the reset link directly.

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
```

To reset local data, delete the `.data/` folder.

## 8. Deploying to Netlify

1. Push the repository to GitHub.
2. In Netlify: **Add new site → Import an existing project →** pick the repo.
   Build settings are read from `netlify.toml` (build `npm run build`, publish `dist`,
   functions in `netlify/functions`).
3. Under **Site configuration → Environment variables** add `RESEND_API_KEY`,
   `EMAIL_FROM` and (if using a custom domain) `APP_URL`.
4. Deploy. Netlify Blobs is enabled automatically for the site — no setup needed.
   The `daily` scheduled function is picked up automatically.
5. (Optional) Verify your sending domain in Resend so emails are delivered.

Every push to the main branch redeploys; pull requests get preview deploys (they
use the same Blobs stores as production — use a separate site if you need isolated
preview data).

## 9. Branding

* `src/config/brand.ts` — name, tagline, description, privacy contact email, accent
  colours, fonts. Colours are applied at startup as `--brand-*` CSS variables, which
  `src/styles/tokens.css` turns into the light and dark palettes.
* Dark mode: `:root[data-theme='dark']` in `tokens.css` overrides the palette. The
  theme is set before first paint by `public/theme-init.js` (an external file so the
  CSP can keep `script-src 'self'`) and managed by `src/lib/theme.ts`; it follows the
  system setting until the user picks one with the sun / moon toggle.
* `public/favicon.svg` — the logo mark.
* `BRAND_NAME` env var — name used in server-sent emails.

## 10. Feature status

### Completed

* Accounts: register, login, logout, forgot/reset password (email), change password,
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
  collection, and a browse-only shared page with no reservation UI.
* Items: products, experiences, ideas, gift cards and custom items; one item on many
  lists with per-list priority, note for gift-givers and order; drag-and-drop reorder;
  move between lists; add to several lists; categories, tags, private notes,
  type-specific details.
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
* Accessibility: semantic landmarks, skip link, labelled controls, focus-trapped modals,
  keyboard drag-and-drop, visible focus, reduced-motion support.

### Remaining / future

* Price tracking and price-drop alerts (preference stored; feature not built).
* Monetary contributions for group gifts (pledge `amount` reserved in the schema).
* Email change flow with re-verification; email verification on sign-up.
* Browser extension / share-target for saving from other apps.
* Image cleanup when an uploaded image is replaced (orphans are removed on account
  deletion only).

## 11. Known limitations

* **Owner bypass of Surprise Mode**: an owner who opens their own share link in a
  private window is treated as a visitor and sees reservation status (like any other
  link-based registry). The app never shows it to them while signed in.
* Visitor claim tokens live in the browser's localStorage; clearing site data loses the
  ability to release a reservation unless the visitor saved the manage link (the
  reservation still expires automatically).
* Some retailers block automated page fetches; the item can always be saved manually.
* Remote product images are hot-linked; if the retailer removes them, a placeholder
  is shown.
* Netlify Blobs has no secondary indexes; per-user indexes are maintained manually. This
  scales comfortably for personal/family use (hundreds of lists per user, 1,000 items
  per list) but isn't designed for analytics-style queries.
* Preview deploys share the production Blobs stores.
