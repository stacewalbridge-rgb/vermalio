const fs = require('fs');

const indexPath = process.argv[2] || 'src/index.js';
let source = fs.readFileSync(indexPath, 'utf8');

if (!source.includes('async function retryPendingFulfilment')) {
  const marker = '\nasync function stripeWebhook(request, env, ctx, url) {';
  const retry = `
async function retryPendingFulfilment(env, limit = 12) {
  if (!env.DB) return { checked: 0, submitted: 0, failed: 0 };
  const query = await env.DB.prepare("SELECT id FROM orders WHERE status IN ('paid','fulfilment_retry') ORDER BY updated_at ASC LIMIT ?")
    .bind(limit)
    .all();
  const rows = Array.isArray(query?.results) ? query.results : [];
  let submitted = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await fulfillOrder(row.id, env);
      submitted += 1;
    } catch {
      failed += 1;
    }
  }
  return { checked: rows.length, submitted, failed };
}
`;
  if (!source.includes(marker)) throw new Error('Stripe webhook marker missing');
  source = source.replace(marker, retry + marker);
}

source = source.replace('async function orderStatus(url, env) {', 'async function orderStatus(url, env, ctx) {');
const statusMarker = '  if (!order) return json({ status: "processing" });\n';
const retryLine = '  if (["paid", "fulfilment_retry"].includes(order.status) && ctx) ctx.waitUntil(fulfillOrder(order.id, env).catch(() => {}));\n';
if (!source.includes(retryLine)) {
  if (!source.includes(statusMarker)) throw new Error('Order status marker missing');
  source = source.replace(statusMarker, statusMarker + retryLine);
}
source = source.replace('return orderStatus(url, env);', 'return orderStatus(url, env, ctx);');

if (!source.includes('async scheduled(controller, env, ctx)')) {
  const exportMarker = 'export default {\n  async fetch(request, env, ctx) {';
  const replacement = `export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(retryPendingFulfilment(env).catch((error) => {
      console.error(JSON.stringify({ event: "scheduled_fulfilment_retry_failed", message: String(error?.message || error) }));
    }));
  },
  async fetch(request, env, ctx) {`;
  if (!source.includes(exportMarker)) throw new Error('Default export marker missing');
  source = source.replace(exportMarker, replacement);
}

fs.writeFileSync(indexPath, source);

const wranglerPath = process.argv[3] || 'wrangler.jsonc';
const cfg = JSON.parse(fs.readFileSync(wranglerPath, 'utf8'));
cfg.triggers = { crons: ['*/5 * * * *'] };
fs.writeFileSync(wranglerPath, JSON.stringify(cfg, null, 2) + '\n');

console.log('Added automatic paid-order fulfilment retry and five-minute scheduled recovery.');
