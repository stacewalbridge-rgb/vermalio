// QR scan tracking for whydrive.co.uk. Printed QR codes open /book?qr=<code> or /join?qr=<code>;
// each scan is counted here (one Durable Object, SQLite storage) and reported at /qr-stats.
// Visitors are counted once per code per day using a daily hash of IP + browser, never the raw IP.
import { DurableObject } from 'cloudflare:workers';

const CODE = /^[a-z0-9][a-z0-9-]{0,47}$/;
const KEEP_VISITOR_DAYS = 90;

export function qrCode(url) {
  const code = (url.searchParams.get('qr') || '').toLowerCase();
  return CODE.test(code) ? code : '';
}

export function londonDay(ms = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export class QrStats extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS scans (day TEXT, code TEXT, page TEXT, n INTEGER, PRIMARY KEY (day, code, page));
      CREATE TABLE IF NOT EXISTS visitors (day TEXT, code TEXT, vid TEXT, PRIMARY KEY (day, code, vid));`);
  }

  record(day, code, page, vid) {
    this.sql.exec('INSERT INTO scans VALUES (?, ?, ?, 1) ON CONFLICT (day, code, page) DO UPDATE SET n = n + 1', day, code, page);
    this.sql.exec('INSERT OR IGNORE INTO visitors VALUES (?, ?, ?)', day, code, vid);
    this.sql.exec('DELETE FROM visitors WHERE day < ?', londonDay(Date.now() - KEEP_VISITOR_DAYS * 86400000));
  }

  report(today, since7, since30, since14) {
    const codes = this.sql.exec(`SELECT code, MIN(page) AS page, SUM(n) AS total,
        SUM(CASE WHEN day = ? THEN n ELSE 0 END) AS today,
        SUM(CASE WHEN day >= ? THEN n ELSE 0 END) AS d7,
        SUM(CASE WHEN day >= ? THEN n ELSE 0 END) AS d30,
        MIN(day) AS first, MAX(day) AS last
      FROM scans GROUP BY code ORDER BY total DESC`, today, since7, since30).toArray();
    const people = Object.fromEntries(this.sql.exec(`SELECT code, COUNT(*) AS u FROM visitors WHERE day >= ? GROUP BY code`, since30).toArray().map(r => [r.code, r.u]));
    const daily = this.sql.exec('SELECT day, SUM(n) AS n FROM scans WHERE day >= ? GROUP BY day ORDER BY day', since14).toArray();
    return { codes: codes.map(c => ({ ...c, people30: people[c.code] || 0 })), daily };
  }
}

function stub(env) {
  return env.QR_STATS.get(env.QR_STATS.idFromName('all'));
}

export async function recordScan(env, request, code, page) {
  const day = londonDay();
  const who = `${request.headers.get('cf-connecting-ip') || ''}|${request.headers.get('user-agent') || ''}|${day}`;
  const vid = (await sha256Hex(who)).slice(0, 20);
  await stub(env).record(day, code, page, vid);
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function authorised(request, env) {
  const expected = env.QR_STATS_PASSWORD_SHA256 || '';
  const m = (request.headers.get('authorization') || '').match(/^Basic\s+(.+)$/i);
  if (!expected || !m) return false;
  let decoded = '';
  try { decoded = atob(m[1]); } catch { return false; }
  const password = decoded.slice(decoded.indexOf(':') + 1);
  return (await sha256Hex(password)) === expected;
}

export async function statsPage(request, env) {
  if (!(await authorised(request, env))) {
    return new Response('Password required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="WhyDrive QR stats", charset="UTF-8"', 'Cache-Control': 'no-store' } });
  }
  const now = Date.now();
  const r = await stub(env).report(londonDay(now), londonDay(now - 6 * 86400000), londonDay(now - 29 * 86400000), londonDay(now - 13 * 86400000));
  if (new URL(request.url).searchParams.get('format') === 'json') {
    return new Response(JSON.stringify(r, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
  const max = Math.max(1, ...r.daily.map(d => d.n));
  const rows = r.codes.map(c => `<tr><td><b>${esc(c.code)}</b><small>${c.page === 'join' ? 'operators' : 'customers'}</small></td><td>${c.today}</td><td>${c.d7}</td><td>${c.d30}</td><td>${c.people30}</td><td>${c.total}</td></tr>`).join('');
  const bars = r.daily.map(d => `<div class="bar"><span style="height:${Math.round(d.n / max * 100)}%"></span><b>${d.n}</b><small>${esc(d.day.slice(5))}</small></div>`).join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>WhyDrive QR scans</title>
<style>body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#f6f7fa;color:#111827}main{max-width:820px;margin:0 auto;padding:20px 16px}h1{color:#0a1834;font-size:1.5rem;margin:0 0 4px}p{color:#5b6475;margin:0 0 18px}
.card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:14px;margin-bottom:16px;overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:.95rem}th,td{text-align:right;padding:9px 5px;border-bottom:1px solid #eef0f4;white-space:nowrap}th:first-child,td:first-child{text-align:left;white-space:normal;overflow-wrap:anywhere}th{color:#5b6475;font-weight:600;font-size:.8rem;white-space:normal;vertical-align:bottom}td small{display:block;color:#8a93a3;font-size:.75rem}
.chart{display:flex;align-items:flex-end;gap:6px;height:150px}.bar{flex:1;max-width:44px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;font-size:.7rem;color:#5b6475}.bar span{width:100%;background:#c9a227;border-radius:4px 4px 0 0;min-height:2px}.bar b{color:#0a1834;margin-top:3px}</style></head>
<body><main><h1>QR code scans</h1><p>Each printed code is counted separately. 7d / 30d = last 7 / 30 days. "People" counts each phone once per day. Updated live.</p>
<div class="card"><h2 style="font-size:1rem;margin:0 0 10px">Scans per day (last 14 days)</h2><div class="chart">${bars || '<p>No scans yet.</p>'}</div></div>
<div class="card"><table><thead><tr><th>Code</th><th>Today</th><th>7d</th><th>30d</th><th>People 30d</th><th>Total</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No scans yet. Scan a printed code to test.</td></tr>'}</tbody></table></div>
</main></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
}
