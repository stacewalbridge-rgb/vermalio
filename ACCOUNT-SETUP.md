# Account setup — what to choose

## Stripe (UK)
Use Built to Offend as the customer-facing trading name.

- Country: United Kingdom
- Business type: Individual / sole trader (wording may vary)
- Website: https://builttooffend.com
- Business description: Personalised humorous greeting cards. Customers provide an occasion and personalisation details; our software creates editable humorous card wording/artwork and we print and fulfil the finished physical card.
- Product category: choose the closest greeting cards / gifts / novelty retail category offered.
- Statement descriptor: BUILTTOOFFEND (or the closest Stripe accepts)
- Customer support email: hello@builttooffend.com once email routing is active
- Bank account: use the account you want Stripe payouts paid into; provide personal identity information where Stripe asks because the business is being registered as a sole trader.
- Do not choose Stripe Connect/platform/marketplace. This is a normal merchant selling its own product.

After verification:
1. Switch to Test mode first.
2. Copy the test secret key into Cloudflare as `STRIPE_SECRET_KEY`.
3. Add webhook endpoint `https://builttooffend.com/api/stripe-webhook`.
4. Subscribe to `checkout.session.completed`.
5. Copy the webhook signing secret to Cloudflare as `STRIPE_WEBHOOK_SECRET`.
6. Test a £4.99 + £1.99 order before switching to live keys.

## You Said It Connect
- Business/store name: Built to Offend
- Website: https://builttooffend.com
- Preferred product while testing: A5, because the longer personalised inside copy benefits from the space.
- Do not pay for another ecommerce platform yet purely for this integration.
- Wait for their written answer on brutal/sweary personalised content and the custom/API workflow. The public site currently says WooCommerce and eBay are supported; Shopify is marked "Back Soon" and international shipping is not currently offered.

## Prodigi
Create the free account so Sandbox and Live credentials exist, but keep fulfilment in Sandbox/hold until they confirm the content model.

For direct-to-recipient cards, the likely starting product is the 7x5 Mohawk direct-delivery card (`GLOBAL-GRE-MOH-7X5-DIR`). The Worker queries Product Details at fulfilment time so we can confirm the actual print areas before production.

## Cloudflare
The domains are already chosen:
- builttooffend.com = primary
- builttooffend.co.uk = redirect to .com

Still needed in Cloudflare:
- D1 database: `built-to-offend-orders`
- R2 bucket: `built-to-offend-private-assets`
- Worker secrets listed in README.md
- Deploy Worker `built-to-offend`

## Email
Set up `hello@builttooffend.com` (Cloudflare Email Routing is fine for receiving initially). Use it for Stripe support, printer accounts and customer support.
