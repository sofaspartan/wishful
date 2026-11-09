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
Data is stored in Netlify Blobs automatically. Add `RESEND_API_KEY` and `EMAIL_FROM`
for password-reset and invitation emails.

See [DEVELOPMENT.md](./DEVELOPMENT.md) for architecture, data model, security,
environment variables and deployment details, and [TASKS.md](./TASKS.md) for progress.
