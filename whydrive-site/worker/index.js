// Cloudflare Worker entry for whydrive.co.uk: serves the static site (ASSETS binding)
// and the same API handlers used by the Pages Functions in ../functions.
import * as enquiry from '../functions/api/enquiry.js';
import * as health from '../functions/api/health.js';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

async function route(request, env) {
  const url = new URL(request.url);
  if (url.pathname === '/api/enquiry') {
    return request.method === 'POST' ? enquiry.onRequestPost({ request, env }) : enquiry.onRequest({ request, env });
  }
  if (url.pathname === '/api/health') {
    return request.method === 'GET' ? health.onRequestGet({ request, env }) : new Response('Method not allowed', { status: 405 });
  }
  if (url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isProd = url.hostname === 'whydrive.co.uk' || url.hostname === 'www.whydrive.co.uk';
    if (isProd && (url.hostname === 'www.whydrive.co.uk' || url.protocol === 'http:')) {
      url.hostname = 'whydrive.co.uk';
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }
    const res = await route(request, env);
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) if (!out.headers.has(k)) out.headers.set(k, v);
    if (url.pathname.startsWith('/assets/') && res.status === 200) {
      out.headers.set('Cache-Control', url.pathname.startsWith('/assets/img/qr/') ? 'public, max-age=86400' : 'public, max-age=31536000, immutable');
    }
    if (url.hostname.endsWith('.workers.dev') || url.hostname.endsWith('.pages.dev')) out.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return out;
  },
};
