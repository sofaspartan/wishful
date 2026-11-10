# Wishful

**Everything you want, all in one place.**

Wishful is a wishlist, collection and gift-registry app. Save things from any store, add
experiences and ideas, organise them into wishlists, and share a link. Friends and family
can reserve gifts without an account, and Surprise Mode keeps who's getting what a secret.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173 (app + API; data stored in ./.data)
npm test           # API test suite
```

## Deploy

Push to GitHub and import the repo in Netlify — `netlify.toml` contains everything.
Data is stored in Netlify Blobs automatically. No other setup is needed: forgotten
passwords are reset with the recovery code each account gets at sign-up. Optionally add
`RESEND_API_KEY` and `EMAIL_FROM` to send emails (reset links, invitations, reminders).

## Browser extension

```bash
npm run extension:build   # → extension/dist
```

Load `extension/dist` from `chrome://extensions` (Developer mode → Load unpacked), click
the Wishful button on any product page and connect your account. On an Amazon (or other
store's) wishlist or registry, it can import the whole list. On the live site,
people download it as a zip from `/extension`, which `npm run build` creates.

See [DEVELOPMENT.md](./DEVELOPMENT.md) for architecture, data model, security,
environment variables and deployment details, and [TASKS.md](./TASKS.md) for progress.
