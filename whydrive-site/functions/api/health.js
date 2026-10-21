// GET /api/health — reports whether the enquiry service is configured (never reveals secrets).
export function onRequestGet({ env }) {
  return new Response(JSON.stringify({ ok: true, enquiryEmail: Boolean(env.RESEND_API_KEY), rateLimitStore: Boolean(env.RATE_LIMIT) }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
