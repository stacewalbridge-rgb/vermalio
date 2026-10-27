// Cloudflare Worker entry for whydrive.co.uk: serves the static site (ASSETS binding),
// the same API handlers used by the Pages Functions in ../functions, the customer booking
// web app at /book/ (proxied from the booking site), QR scan tracking (?qr=<code>, report at /qr-stats)
// and the older /go/<code> QR short links.
import * as enquiry from '../functions/api/enquiry.js';
import * as health from '../functions/api/health.js';
import { QrStats, qrCode, recordScan, statsPage } from './qr-stats.js';

export { QrStats };

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

// The booking web app lives at <BOOKING_ORIGIN>/whydrive/ and is served here under /book/.
// It also loads /config.js and calls /api/* from its own origin, so those are proxied too.
const DEFAULT_BOOKING_ORIGIN = 'https://book.robs-travel.co.uk';
const BOOK_PREFIX = '/book/';
const UPSTREAM_PREFIX = '/whydrive/';
const APP_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(), microphone=(self), geolocation=(self), payment=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

// /book/ is only served from this site once sign-in and address search accept whydrive.co.uk:
// Firebase must list it as an authorised domain and the booking APIs must allow this origin.
// Until both are true, /book/ forwards to the booking site so the link always works.
// BOOKING_MODE = "proxy" or "redirect" overrides the automatic check.
const FIREBASE_WEB_KEY = 'AIzaSyB0atDrYNvxaKlhQqDDdGWsIox7-T7jKB4';
const READY_TTL_MS = 5 * 60 * 1000;
let readyCache = { ok: false, at: 0 };

async function bookingReady(env) {
  const mode = env.BOOKING_MODE || 'auto';
  if (mode === 'proxy') return true;
  if (mode === 'redirect') return false;
  if (Date.now() - readyCache.at < READY_TTL_MS) return readyCache.ok;
  let ok = false;
  try {
    const origin = env.BOOKING_ORIGIN || DEFAULT_BOOKING_ORIGIN;
    const [cfg, cors] = await Promise.all([
      fetch(`https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig?key=${FIREBASE_WEB_KEY}`).then(r => r.json()),
      fetch(`${origin}/api/places`, { method: 'OPTIONS', headers: { Origin: 'https://whydrive.co.uk', 'Access-Control-Request-Method': 'POST' } }),
    ]);
    ok = (cfg.authorizedDomains || []).includes('whydrive.co.uk') && cors.status < 400;
  } catch {
    ok = false;
  }
  readyCache = { ok, at: Date.now() };
  return ok;
}

// /go/<code>: older short links. Codes ending in -operator open the join form, everything else
// opens the booking app, tagged with ?qr=<code> so the scan is counted there.
function goRedirect(url) {
  const code = url.pathname.slice('/go/'.length).replace(/\/+$/, '').toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(code)) return null;
  const dest = code.endsWith('-operator') ? '/join/' : BOOK_PREFIX;
  return new Response(null, { status: 302, headers: { Location: `${url.origin}${dest}?qr=${code}`, 'Cache-Control': 'no-store' } });
}

// Count a QR scan once, on the request that finally answers it (not on the redirects before it).
function track(request, env, ctx, url, page) {
  const code = qrCode(url);
  if (!code || request.method !== 'GET' || !env.QR_STATS) return;
  ctx.waitUntil(recordScan(env, request, code, page).catch(err => console.error('QR_TRACK_FAILED', err?.message || err)));
}

function isBookingPath(pathname) {
  return pathname.startsWith(BOOK_PREFIX) || pathname === '/config.js' ||
    (pathname.startsWith('/api/') && pathname !== '/api/enquiry' && pathname !== '/api/health');
}

class RewriteBookLinks {
  constructor(attr) { this.attr = attr; }
  element(el) {
    const v = el.getAttribute(this.attr);
    if (v && v.startsWith(UPSTREAM_PREFIX)) el.setAttribute(this.attr, BOOK_PREFIX + v.slice(UPSTREAM_PREFIX.length));
  }
}

async function proxyBooking(request, env, url) {
  const origin = env.BOOKING_ORIGIN || DEFAULT_BOOKING_ORIGIN;
  const path = url.pathname.startsWith(BOOK_PREFIX) ? UPSTREAM_PREFIX + url.pathname.slice(BOOK_PREFIX.length) : url.pathname;
  const headers = new Headers(request.headers);
  headers.delete('host');
  const res = await fetch(origin + path + url.search, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    redirect: 'manual',
  });
  const out = new Response(res.body, res);
  const loc = out.headers.get('Location');
  if (loc) {
    const target = new URL(loc, origin + path);
    if (target.origin === origin && target.pathname.startsWith(UPSTREAM_PREFIX)) {
      out.headers.set('Location', BOOK_PREFIX + target.pathname.slice(UPSTREAM_PREFIX.length) + target.search);
    }
  }
  if (!(out.headers.get('Content-Type') || '').includes('text/html')) return out;
  return new HTMLRewriter()
    .on('a[href]', new RewriteBookLinks('href'))
    .on('link[href]', new RewriteBookLinks('href'))
    .on('script[src]', new RewriteBookLinks('src'))
    .on('img[src]', new RewriteBookLinks('src'))
    .on('form[action]', new RewriteBookLinks('action'))
    .transform(out);
}

async function route(request, env, ctx) {
  const url = new URL(request.url);
  if (url.pathname === '/qr-stats' || url.pathname === '/qr-stats/') return statsPage(request, env);
  if (url.pathname === '/join/') track(request, env, ctx, url, 'join');
  if (url.pathname === '/book' || url.pathname.startsWith(BOOK_PREFIX)) {
    if (!(await bookingReady(env))) {
      track(request, env, ctx, url, 'book');
      const rest = url.pathname.slice(BOOK_PREFIX.length);
      const upstream = `${env.BOOKING_ORIGIN || DEFAULT_BOOKING_ORIGIN}${UPSTREAM_PREFIX}${rest}${url.search}`;
      return new Response(null, { status: 302, headers: { Location: upstream, 'Cache-Control': 'no-store' } });
    }
    if (url.pathname === '/book') return Response.redirect(`${url.origin}${BOOK_PREFIX}${url.search}`, 301);
    if (url.pathname === BOOK_PREFIX) track(request, env, ctx, url, 'book');
  }
  if (url.pathname.startsWith(UPSTREAM_PREFIX)) {
    return Response.redirect(`${url.origin}${BOOK_PREFIX}${url.pathname.slice(UPSTREAM_PREFIX.length)}${url.search}`, 301);
  }
  if (url.pathname.startsWith('/go/')) {
    const go = goRedirect(url);
    if (go) return go;
  }
  if (isBookingPath(url.pathname)) return proxyBooking(request, env, url);
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
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const isProd = url.hostname === 'whydrive.co.uk' || url.hostname === 'www.whydrive.co.uk';
    if (isProd && (url.hostname === 'www.whydrive.co.uk' || url.protocol === 'http:')) {
      url.hostname = 'whydrive.co.uk';
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }
    const res = await route(request, env, ctx);
    const out = new Response(res.body, res);
    const headers = isBookingPath(url.pathname) ? APP_HEADERS : SECURITY_HEADERS;
    for (const [k, v] of Object.entries(headers)) if (!out.headers.has(k)) out.headers.set(k, v);
    if (url.pathname.startsWith('/assets/') && res.status === 200) {
      out.headers.set('Cache-Control', url.pathname.startsWith('/assets/img/qr/') ? 'public, max-age=86400' : 'public, max-age=31536000, immutable');
    }
    if (url.hostname.endsWith('.workers.dev') || url.hostname.endsWith('.pages.dev')) out.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return out;
  },
};
