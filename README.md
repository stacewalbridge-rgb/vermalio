# Built to Offend — production-ready web build

Primary domain: **https://builttooffend.com**

Redirect/protection domains handled by the same Worker:
- https://www.builttooffend.com → https://builttooffend.com
- https://builttooffend.co.uk → https://builttooffend.com
- https://www.builttooffend.co.uk → https://builttooffend.com

## What is built
- Responsive Monster generator with 1–10 brutality scale.
- Workers AI generation plus local fallback for preview/development.
- Photo upload and editable card wording.
- Three generated variants.
- Launch pricing UI: £4.99 standard / £5.99 photo + £1.99 UK delivery (server-controlled, not trusted from browser).
- Private order workflow: create order → render print artwork in browser → upload privately → Stripe Checkout.
- Stripe webhook workflow: paid order → fulfilment adapter.
- R2 private print asset storage with expiring signed URLs for printers.
- D1 order database schema/migration.
- Prodigi API adapter with Sandbox/Live switch and idempotent order references.
- Printer is deliberately set to `hold` until written content approval is received.
- Order success/status page.
- .co.uk and www redirects.
- Privacy/terms launch drafts, robots.txt and sitemap.

## Before public paid checkout
1. Add the final legal operator/correspondence details to `public/privacy.html` and `public/terms.html`.
2. Create Cloudflare D1 database `built-to-offend-orders` and R2 bucket `built-to-offend-private-assets`.
3. Add their bindings to `wrangler.jsonc`.
4. Apply `migrations/0001_orders.sql`.
5. Create Stripe account and add secret keys as Worker secrets.
6. Configure Stripe webhook endpoint: `https://builttooffend.com/api/stripe-webhook` for `checkout.session.completed`.
7. Finish printer onboarding. Keep `PRINT_PROVIDER=hold` until the printer confirms the content model in writing.
8. Run printer sandbox/sample orders and confirm exact print-area names/template before setting live fulfilment.

## Secrets
Set these using Cloudflare Worker secrets, never in source control:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `ORDER_TOKEN_SECRET` (random 32+ byte value)
- `PRINT_ASSET_SECRET` (random 32+ byte value)
- `PRODIGI_API_KEY` (only if Prodigi is approved/selected)

## Non-secret settings
Current `wrangler.jsonc` defaults:
- `CARD_PRICE_PENCE=499`
- `PHOTO_ADDON_PENCE=100`
- `UK_SHIPPING_PENCE=199`
- `PRINT_PROVIDER=hold`
- `PRODIGI_ENV=sandbox`
- `PRODIGI_SKU=GLOBAL-GRE-MOH-7X5-DIR`

## Fulfilment design
The site is printer-agnostic. Payment and customer UX do not depend on one fulfilment company. `PRINT_PROVIDER` controls the adapter. Prodigi direct API support is included. You Said It Connect is the preferred UK cultural/operational fit if they provide a suitable custom integration for one-off personalised artwork; their currently advertised store integrations are WooCommerce/eBay, with Shopify shown as returning soon.

## Deployment
Once account bindings/secrets are ready:

```bash
npm install
npx wrangler d1 migrations apply built-to-offend-orders --remote
npm run check
npm run deploy
```

Cloudflare Custom Domains in `wrangler.jsonc` attach all four hostnames and the Worker performs the redirects.
