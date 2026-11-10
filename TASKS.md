# Wishful — Task Checklist

## Phase 1 — Foundation
- [x] Project scaffold (Vite + React + TypeScript, Netlify config, env example)
- [x] Storage abstraction: Netlify Blobs / local file / in-memory drivers
- [x] Atomic (ETag) updates and create-only uniqueness indexes
- [x] HTTP router, JSON validation (Zod), error handling, CSRF header check
- [x] Auth: register, login, logout, sessions (hashed, HttpOnly cookie, sliding expiry)
- [x] Forgot / reset password (Resend email; dev fallback link), change password
- [x] Profile, avatar upload, preferences, delete account
- [x] Rate limiting on sensitive endpoints
- [x] Design tokens, base components, responsive app shell (sidebar / bottom nav)
- [x] Landing page and auth pages
- [x] Protected routes and guest-only routes

## Phase 2 — Wishlists & items
- [x] Wishlist CRUD, duplicate, archive/restore, reorder (drag & drop)
- [x] Cover image, accent colour, occasion, date, visibility
- [x] Universal items (product, experience, idea, gift card, custom) with type-specific fields
- [x] Many-to-many items ↔ wishlists via entries (per-list priority, note, order)
- [x] Add Item flow: link with SSRF-safe metadata extraction, idea, photo upload
- [x] Multiple destinations, inline wishlist creation, save to collection only
- [x] Edit / delete items, move between lists, add to several lists
- [x] Item reorder within a list (drag & drop, keyboard accessible)
- [x] Priority badges; per-list arrangement: group by priority (Must have / Really want sections first), own order, or hide priorities
- [x] Saved Items page: grid/list, search, filters, sort
- [x] Dashboard: greeting, quick actions, onboarding, lists, recent items, occasions, activity
- [x] Global search palette (⌘K)

## Phase 3 — Sharing & gifting
- [x] Share tokens; regenerate and revoke; private lists never resolve
- [x] Share dialog: copy, native share, email, SMS, WhatsApp, preview
- [x] Public wishlist page (no login): hero, filters, sort, item details
- [x] Link previews: per-page Open Graph tags (edge function) and generated share images for the site, lists/collections and public profiles
- [x] Atomic reservations (single winner), mark purchased, release, expiry
- [x] Owner controls: allow claims, purchase tracking, show reserved/purchased, messages, priorities, expiry days
- [x] Surprise Mode enforced in the API (owner, editors, owner-side public view)
- [x] Claims made during Surprise Mode stay hidden after it's turned off
- [x] Visitor claim tokens + private manage link for other devices
- [x] Group gifts: join, coordinator, withdraw, coordinator marks purchased
- [x] Owner can clear a visible reservation
- [x] Public profiles (public lists only)

## Phase 4 — Collaboration & notifications
- [x] Invite collaborators by username or email (pending invites applied at sign-up)
- [x] Viewer / editor roles, change role, remove, leave
- [x] Editors can add/edit/reorder/move items; items they add belong to the list owner
- [x] Shared With Me page (+ links opened on this device)
- [x] In-app notifications (shared with you, collaborator edits, occasion reminders)
- [x] Optional email notifications per preference
- [x] Daily scheduled job: reminders + cleanup of expired sessions/tokens/rate limits
- [x] No notifications ever reveal surprise claims

## Friends
- [x] Friend requests by username: send, accept, decline, cancel, unfriend (mutual requests auto-accept)
- [x] One pair record per friendship is the single source of truth for every check; per-user index for listing
- [x] New "Friends" visibility: friends browse your Friends + Public lists; Unlisted stays link-only
- [x] Friends-only share links require a signed-in friend (or collaborator) to view or reserve, enforced in the API
- [x] Friends page (add by username, requests with badge in the nav, friends grid) and a friend profile page with their lists
- [x] Friends-only share page offers sign-in or a one-click friend request
- [x] Notifications (+ optional email) for requests and acceptances; friendships removed on account deletion
- [x] Tests: request lifecycle, outsiders blocked, visibility filtering, friends-only links, Surprise Mode, account deletion

## Phase 5 — Quality
- [x] Automated tests for all required scenarios (87 tests at launch)
  - [x] Registration & login · [x] protected routes · [x] wishlist CRUD
  - [x] item ↔ multiple wishlists · [x] edit/delete propagation · [x] move between lists
  - [x] private lists stay private · [x] unlisted via link only · [x] public access
  - [x] atomic reservations · [x] release & expiry · [x] Surprise Mode hiding
  - [x] cross-user authorization · [x] SSRF protection · [x] metadata extraction
- [x] Strict typecheck, production build
- [x] Security headers, noindex on share links
- [x] Error boundaries, loading skeletons, empty states, toasts
- [x] Accessibility pass (labels, focus traps, keyboard DnD, reduced motion)
- [x] Browser verification (desktop and mobile widths)
- [x] DEVELOPMENT.md and README

## Visual refresh — minimal bento
- [x] Inter for UI text, neutral greys, flat surfaces with hairline borders
- [x] Soft, marshmallowy Fraunces accent serif for the logo wordmark and display headings (modal titles stay in Inter)
- [x] Bento dashboard (greeting, stats, quick actions, lists, upcoming, activity, recent items)
- [x] Bento landing features, light CTA tile, aligned showcase; light bento auth panel
- [x] Simplified logo, covers, placeholders and date tiles
- [x] Landing hero animation: items float in a cloud, a list forms, items spiral in and fill it (static when reduced motion is on)
- [x] Full-width hero band tinted from the brand accent; custom feature illustrations matching the hero art
- [x] Equal-width 3×2 feature grid with tinted stages and gentle per-illustration CSS loops (reduced-motion safe)
- [x] Accent-coloured "Never get a duplicate gift" band with an animated reserved-list illustration
- [x] "Thought cloud" theme: drifting clouds on the hero edges, a cloud-bank hero bottom, and a footer with a rolling cloud bank and items floating in thought clouds
- [x] Cloudy dashboard: sky greeting tile with thought-cloud scene and cloud bank, stat pills, illustrated quick actions, separate Wishlists / Collections tiles
- [x] Illustrated sky empty states (`SkyArt` + `EmptyState art`) for no wishlists, no collections, empty lists and Saved Items
- [x] Sky page headers (`PageSky`) on Friends, Shared With Me and Settings; cloud-topped friend cards; icon section headers; blue-tinted sidebar with a cloud bank

## Collections
- [x] `kind: wishlist | collection` on lists (legacy lists default to wishlist); gifting disabled for collections in the API
- [x] Item ownership details (acquired on, bought/gift, price paid, condition, quantity); price paid private to owner + editors
- [x] "Got it!" moves an item from a wishlist (or Saved Items) into an existing or new collection
- [x] My Lists page with All / Wishlists / Collections filter; Collection badges on cards and profiles
- [x] Collection detail stats strip and ownership facts on cards and item details; browse-only public page
- [x] API tests for collection rules, privacy and got-it (94 tests total)

## Cover graphics
- [x] `coverArt { icon, backdrop }` on lists as an alternative to a cover photo, validated against fixed enums
- [x] 39 illustrated icons (generic wishlist & collection icons — gift, checklist, sparkles, star, bag, records-and-books, treasure chest — plus winter holidays, seasons, celebrations, everyday things) and 12 backdrops (four cloudy pastels, sunset, spring blossoms, summer beach, autumn leaves, winter snow, starry night, confetti, hearts)
- [x] Background picker shows labeled mini previews of each backdrop
- [x] Holiday and everyday icon sets, 117 icons in all: Halloween, St. Patrick's, Valentine's, Thanksgiving, Hanukkah, Easter, New Year's & Fourth of July, Diwali / Eid / Lunar New Year, Mother's & Father's Day, baby, toys, school, hobbies, sports, pets, home, beauty and tech
- [x] Four holiday backdrops: shamrocks, spooky night (moon and flapping bats), harvest (wheat and leaves) and festival of lights (gold stars). All have night-theme versions and appear in share images
- [x] Icon search in the picker matches names, sections and extra keywords. It ignores case, apostrophes, plurals and filler words, and matches as you type. Category chips filter to one section, and the search bar stays pinned while the grid scrolls
- [x] None / Graphic / Photo switch in the list form with a live preview; the starting graphic is suggested from the occasion until you pick your own
- [x] New lists start with a graphic: wishlists get a gift on blue sky, collections get records-and-books on blush, both in a frosted white rounded tile (also applied server-side for lists created from shortcuts)
- [x] Shown on list cards, the list header, the public page, profiles, dashboard rows, the sidebar and search results
- [x] Icon frame for the list header and cover (cards, public page): floating, rounded square, circle or a puffy cloud; solid or see-through; 12 frame colours. The picker preview mirrors the header with the list's name
- [x] API tests for storing, changing, clearing and rejecting cover graphics and frames

## Bulk add
- [x] "Add several" in the Add Item modal and on list pages: paste up to 25 links or item names, one per line
- [x] Link details fetched three at a time; unreadable pages fall back to a name built from the link
- [x] Review step to rename, price or drop items, then file them on any lists (wishlists, collections) or just Saved Items
- [x] `POST /api/items/bulk` creates the batch in one request, validated as a whole (nothing is created if any item is invalid)
- [x] API and parsing tests (100 tests total)

## Dark mode
- [x] Starry night palette: navy surfaces, night-sky heroes and empty states with stars, moonlit clouds, a moon in the sidebar
- [x] List covers switch to night versions (pastel skies at night, a dusk veil over bright backdrops)
- [x] Sun / moon toggle in the top right of every header (app, landing, auth, public pages)
- [x] Follows the system setting until you choose; the choice is kept in localStorage as an interface preference
- [x] `public/theme-init.js` applies the theme before the first paint (no flash), allowed by the strict CSP

## Launch prep
- [x] Privacy policy page at `/privacy`, linked from the landing footer and the sign-in pages
- [x] Netlify builds on Node 22

## Browser extension
- [x] Manifest V3 extension (`extension/`) for Chrome, Edge, Brave and Arc; reads the current tab only when clicked
- [x] Popup fills in the name, price and photos (structured data first, then the visible page), with a photo picker, currency, note and list picker that remembers your last lists
- [x] Connect flow: approve on the site, revocable per-browser token handed to the extension; tokens work only on `/api/extension/*`
- [x] Settings → Browser extension lists connected browsers with last-used times and Disconnect; a password change disconnects all
- [x] Privacy policy section for the extension
- [x] Download from the site: `npm run build` zips the extension into `/downloads`; public `/extension` page with install steps, a landing page section and footer link, and download + install steps in Settings
- [x] API and page-reader tests (112 tests total)
- [ ] Publish to the Chrome Web Store and set `extensionUrl` in `src/config/brand.ts`

## Recovery codes (no email needed)
- [x] Every new account gets a one-time recovery code, shown in a "save your code" dialog with copy and download
- [x] Forgot password uses email + recovery code + new password; signs out everywhere and issues a fresh code
- [x] Emailed reset link still offered, but only when Resend is configured
- [x] Settings → Account shows when the code was made and can replace it (password required)
- [x] Home reminds accounts made before recovery codes to create one
- [x] Codes stored as SHA-256 only; same error for wrong code or unknown email; rate-limited per IP and per account
- [x] API tests (119 tests total)

## More reliable link previews
- [x] Parser reads ProductGroup variants, comment-wrapped JSON-LD, microdata text prices, `<h1>` titles, Amazon photos and the visible price next to the name (skipping crossed-out and per-unit prices)
- [x] Shopify fallback via `/products/<handle>.js` when the page leaves out the price or photo
- [x] Second attempt with Chrome-like headers when the first is blocked or slow, within a 9 s budget
- [x] Bot-protection, challenge, "not found" and bounced-to-search pages detected instead of filling the form with junk
- [x] Add Item explains what's missing, how to copy a photo link, and suggests the extension for blocked stores
- [x] Parser and detection tests (127 tests total)

## Spoiler warning
- [x] Owner viewing their own public page with Surprise Mode off: reserved and bought status hidden behind a spoiler warning until they choose to show it (remembered for the browser session)

## Ratings & reviews
- [x] 1–5 stars and a written review on owned items (edit modal, cards, item detail)
- [x] "Top rated" sort; per-list "Show ratings and reviews" setting, enforced in the public API

## CSV import
- [x] "Import a CSV file" in Add several: comma, semicolon or tab separated, up to 500 rows
- [x] Column mapping guessed from the headers (name, link, price, photo, brand, store, category, tags, notes, set number, priority, quantity, date, price paid, condition, rating, review), changeable per column, with sample values and a preview
- [x] Imported in batches of 25 through `POST /api/items/bulk`, onto any lists or just Saved Items; partial failures report how far it got
- [x] Recognised exports: Goodreads, The StoryGraph, Discogs collection and wantlist, Letterboxd, IMDb, BoardGameGeek, Amazon order history; shelf/status filters, book covers from Open Library, ratings/reviews/dates carried over, manual mapping still available

## Import a whole wishlist (extension)
- [x] "Whole list" mode in the popup on wishlist/registry pages (or "All items here" on any page with several products)
- [x] Amazon list reader with priority, comments and "wants N", following its "show more" pages; generic reader for Target, Etsy, Best Buy, registries and most stores (JSON-LD, product cards, load-more buttons, `rel=next` pages)
- [x] Checklist to untick items, new list named after the source (wishlist or collection) and/or existing lists, progress while importing
- [x] `POST /api/extension/items/bulk` and `POST /api/extension/lists` (own lists only, rate-limited) with tests

## Brickfolio integration
- [x] Allow-listed by `INTEGRATION_ALLOWED_EMAILS`; Settings → Brickfolio to connect, sync now, change links or disconnect
- [x] Reads the `full_sets` and `wishlist` sheet CSVs plus the site's `sets.csv`; set photos picked like the Brickfolio site; Brickset lookup through the site's proxy for sets missing from the catalog
- [x] Mirrors into a "LEGO Collection" collection and a "LEGO Wishlist" wishlist; adds, updates, moves and removes sets on each sync; leaves other lists alone
- [x] Hourly scheduled sync plus a sync when the owner opens a linked list and it's stale
- [x] Synced items are read-only except notes and ownership details; API returns 409 for the rest
- [x] Tests (161 tests total)

## Playshelf integration
- [x] Shared sync engine (`server/integrations/mirror.ts`) used by Brickfolio and Playshelf
- [x] Settings → Playshelf (allow-listed): connect by username, sync now, change account, disconnect; notice when the server isn't configured
- [x] Reads public `profiles`, `game_library` and `wishlist` rows from Playshelf's Supabase with its anon key
- [x] "Video Game Collection" (platform, status, favorites, genres, ratings, reviews, RAWG art and screenshots) and a "Video Game Wishlist" created once it has games, with priorities and notes
- [x] Games bought on Playshelf move to the collection; removed games disappear; empty or failed downloads change nothing
- [x] New "Game controller" cover icon
- [x] Tests (185 tests total)

## Future
- [ ] Price tracking & price-drop alerts
- [ ] Monetary contributions for group gifts
- [ ] Email verification & email change flow
- [ ] Mobile share target; Firefox and Safari versions of the extension
- [ ] Orphaned image cleanup when images are replaced
