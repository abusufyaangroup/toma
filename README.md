# TOMA — Streaming Platform Starter

A branded starter project for a movies and TV streaming platform.

## Included
- Modern purple-and-black TOMA frontend
- Movie and TV catalogue interface
- Free and Premium plan presentation (₦1,500/month)
- Search, category filters, watchlist and responsive layout
- Admin dashboard UI for adding titles
- Cloudflare Worker API starter
- Cloudflare D1 schema
- Paystack subscription checkout starter
- Cloudflare deployment notes

## Important production notes
This is a **starter project**, not a finished commercial streaming service. Before accepting real customers:
1. Implement and test a proper user authentication provider (for example, Cloudflare Access for a private admin area plus a dedicated customer auth system).
2. Set `ADMIN_API_TOKEN` as a strong secret and rotate it; do not expose it in frontend code.
3. Configure a Paystack recurring Plan in your Paystack dashboard for ₦1,500 monthly, then set `PAYSTACK_PLAN_CODE`.
4. Configure Paystack webhooks to point to `https://YOUR-WORKER-DOMAIN/paystack/webhook`.
5. Confirm Paystack webhook signatures and subscription lifecycle events in a test account before going live.
6. Use Cloudflare Stream (or another licensed video host) for video delivery. Do not store large video files in the D1 database or GitHub.
7. Implement signed playback URLs / tokenized playback and enforce subscription access on the server.
8. Upload only content for which you own or have distribution rights.
9. Add privacy policy, terms, refund policy, age/content ratings, customer support and backups.

The included browser-side account and watchlist interactions are a demonstration only. They are not secure authentication or durable customer storage.

## Project structure
- `public/` — static frontend
- `worker/index.js` — Cloudflare Worker API starter
- `migrations/0001_init.sql` — D1 database schema
- `wrangler.toml` — Cloudflare configuration template

## Run locally
You need Node.js and Wrangler:

```bash
npm install -g wrangler
wrangler dev
```

The Worker serves the API. For a quick frontend preview, open `public/index.html` in a browser or use a local static server.

## Deploy
1. Create a Cloudflare D1 database named `toma-db`.
2. Copy its database ID into `wrangler.toml`.
3. Apply the schema:
   ```bash
   wrangler d1 execute toma-db --file=./migrations/0001_init.sql
   ```
4. Create a Cloudflare Worker:
   ```bash
   wrangler deploy
   ```
5. Set secrets:
   ```bash
   wrangler secret put ADMIN_API_TOKEN
   wrangler secret put PAYSTACK_SECRET_KEY
   wrangler secret put PAYSTACK_PLAN_CODE
   ```
   `PAYSTACK_PLAN_CODE` is the recurring monthly plan code created in Paystack.
6. For video, create a Cloudflare Stream account and implement the Stream direct-upload + signed playback flow. The Worker currently returns a clear not-configured response for video upload until Stream credentials and authorization are wired in.
7. Deploy `public/` to Cloudflare Pages, or configure Pages to use the same Worker API domain. Set `TOMA_API_BASE` in `public/app.js` if the API is hosted separately.

## API endpoints
- `GET /api/health`
- `GET /api/titles`
- `POST /api/admin/titles` — requires `Authorization: Bearer ADMIN_API_TOKEN`
- `POST /api/paystack/initialize` — initializes a recurring plan checkout for an email
- `POST /paystack/webhook` — verifies Paystack's HMAC signature and handles subscription lifecycle events

## Environment bindings
See `wrangler.toml`. Never put secret keys in `public/app.js`.
