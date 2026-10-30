// POST /api/enquiry — WhyDrive driver/operator enquiry.
// Validates input, applies spam and rate limits, then emails the enquiry to
// driver@whydrive.co.uk through Resend. Secrets stay server-side:
//   RESEND_API_KEY  (required, Pages secret)
//   ENQUIRY_TO      (optional, default driver@whydrive.co.uk)
//   ENQUIRY_FROM    (optional, default "WhyDrive Website <website@whydrive.co.uk>")
//   ACK_FROM        (optional, default "WhyDrive <driver@whydrive.co.uk>")
//   RATE_LIMIT      (optional KV namespace binding for cross-isolate rate limiting)
//   RESEND_API_URL  (optional, test override for the Resend endpoint)
//   FALLBACK_EMAIL  (optional, address shown when sending fails; default driver@whydrive.co.uk)

const MAX_BODY = 64 * 1024;
const MAX_VEHICLES = 50;
const MIN_FILL_MS = 3000;
const RATE_WINDOW_S = 3600;
const RATE_MAX = 5;

const LICENCE_TYPES = { hackney: 'Hackney Carriage', private_hire: 'Private Hire', both: 'Both' };
const VEHICLE_TYPES = ['Saloon', 'Estate', 'MPV', 'Minibus', 'Executive', 'Other'];
const LUGGAGE = ['1-2 cases', '3-4 cases', '5-6 cases', '7+ cases'];
const CATEGORIES = ['Hackney Carriage', 'Private Hire'];
const INTEREST = { yes: 'Yes', maybe: 'Possibly', no: 'No' };

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const POSTCODE_RE = /^(GIR ?0AA|[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2})$/i;
const REG_RE = /^[A-Z0-9 ]{2,10}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const memoryHits = new Map();

function clean(value, max) {
  return String(value ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}

function oneLine(value, max) {
  return clean(value, max).replace(/\s+/g, ' ');
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function normalisePhone(raw) {
  const compact = String(raw || '').replace(/[\s().-]/g, '');
  let digits = compact;
  if (digits.startsWith('+44')) digits = '0' + digits.slice(3);
  else if (digits.startsWith('0044')) digits = '0' + digits.slice(4);
  if (!/^0\d{9,10}$/.test(digits)) return null;
  return digits;
}

function validDate(s) {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// Accepts a plain object from JSON or from form fields (vehicles[0][make] style keys).
export function validate(input) {
  const errors = {};
  const v = {};
  const req = (key, label, max) => {
    const val = oneLine(input[key], max);
    if (!val) errors[key] = `Please enter ${label}.`;
    v[key] = val;
    return val;
  };

  req('companyName', 'your taxi company or trading name', 120);
  req('contactName', 'the main contact name', 100);

  const email = oneLine(input.email, 160);
  if (!email) errors.email = 'Please enter a contact email address.';
  else if (!EMAIL_RE.test(email)) errors.email = 'Please enter a valid email address, like name@example.co.uk.';
  v.email = email;

  const phoneRaw = oneLine(input.phone, 20);
  const phone = normalisePhone(phoneRaw);
  if (!phoneRaw) errors.phone = 'Please enter a contact telephone number.';
  else if (!phone) errors.phone = 'Please enter a valid UK phone number, like 07700 900123.';
  v.phone = phoneRaw;

  const postcode = oneLine(input.postcode, 10).toUpperCase();
  if (!postcode) errors.postcode = 'Please enter your business postcode.';
  else if (!POSTCODE_RE.test(postcode)) errors.postcode = 'Please enter a valid UK postcode, like EX23 8LG.';
  v.postcode = postcode;

  req('area', 'your main operating town or area', 120);
  req('licensingAuthority', 'your licensing authority', 120);

  v.licenceType = oneLine(input.licenceType, 20);
  if (!LICENCE_TYPES[v.licenceType]) errors.licenceType = 'Please choose Hackney Carriage, Private Hire or Both.';

  const total = Number(oneLine(input.totalVehicles, 5));
  if (!Number.isInteger(total) || total < 1 || total > 500) errors.totalVehicles = 'Please enter the total number of vehicles (1–500).';
  v.totalVehicles = total;

  const vehicles = Array.isArray(input.vehicles) ? input.vehicles.slice(0, MAX_VEHICLES + 1) : [];
  if (vehicles.length === 0) errors.vehicles = 'Please add at least one vehicle.';
  if (vehicles.length > MAX_VEHICLES) errors.vehicles = `Please add no more than ${MAX_VEHICLES} vehicles in one enquiry.`;
  v.vehicles = vehicles.slice(0, MAX_VEHICLES).map((raw, i) => {
    const r = raw && typeof raw === 'object' ? raw : {};
    const out = {
      make: oneLine(r.make, 40),
      model: oneLine(r.model, 40),
      registration: oneLine(r.registration, 10).toUpperCase(),
      type: oneLine(r.type, 20),
      seats: Number(oneLine(r.seats, 3)),
      luggage: oneLine(r.luggage, 20),
      licenceCategory: oneLine(r.licenceCategory, 30),
      licenceExpiry: oneLine(r.licenceExpiry, 10),
    };
    const p = `vehicles.${i}.`;
    if (!out.make) errors[p + 'make'] = 'Please enter the vehicle make.';
    if (!out.model) errors[p + 'model'] = 'Please enter the vehicle model.';
    if (out.registration && !REG_RE.test(out.registration)) errors[p + 'registration'] = 'Registration can only contain letters, numbers and spaces.';
    if (!VEHICLE_TYPES.includes(out.type)) errors[p + 'type'] = 'Please choose a vehicle type.';
    if (!Number.isInteger(out.seats) || out.seats < 1 || out.seats > 16) errors[p + 'seats'] = 'Please enter passenger seats (1–16).';
    if (!LUGGAGE.includes(out.luggage)) errors[p + 'luggage'] = 'Please choose a luggage capacity.';
    if (!CATEGORIES.includes(out.licenceCategory)) errors[p + 'licenceCategory'] = 'Please choose a licensing category.';
    if (out.licenceExpiry && !validDate(out.licenceExpiry)) errors[p + 'licenceExpiry'] = 'Please enter a valid date.';
    return out;
  });
  if (Number.isInteger(total) && total >= 1 && v.vehicles.length > total) {
    errors.totalVehicles = `You've added ${v.vehicles.length} vehicles — please check the fleet total.`;
  }

  v.preferredStart = oneLine(input.preferredStart, 10);
  if (v.preferredStart && !validDate(v.preferredStart)) errors.preferredStart = 'Please enter a valid date.';

  v.currentBooking = clean(input.currentBooking, 1500);
  if (!v.currentBooking) errors.currentBooking = 'Please tell us how you currently take bookings.';
  v.operatingAreas = clean(input.operatingAreas, 1500);
  if (!v.operatingAreas) errors.operatingAreas = 'Please tell us the areas you usually cover.';

  v.interestLocal = oneLine(input.interestLocal, 10);
  if (!INTEREST[v.interestLocal]) errors.interestLocal = 'Please choose an option.';
  v.interestLong = oneLine(input.interestLong, 10);
  if (!INTEREST[v.interestLong]) errors.interestLong = 'Please choose an option.';

  v.comments = clean(input.comments, 3000);

  if (oneLine(input.privacyAck, 5) !== 'yes') errors.privacyAck = 'Please confirm you have read the Privacy Policy.';
  if (oneLine(input.contactConsent, 5) !== 'yes') errors.contactConsent = 'Please agree to us contacting you about this enquiry.';

  return { errors, value: v };
}

// Turns flat form keys such as vehicles[2][make] into a nested object.
export function fromForm(entries) {
  const out = { vehicles: [] };
  for (const [key, value] of entries) {
    const m = key.match(/^vehicles\[(\d{1,2})\]\[([a-zA-Z]+)\]$/);
    if (m) {
      const i = Number(m[1]);
      if (i > MAX_VEHICLES) continue;
      out.vehicles[i] = out.vehicles[i] || {};
      out.vehicles[i][m[2]] = value;
    } else if (!(key in out)) {
      out[key] = value;
    }
  }
  out.vehicles = out.vehicles.filter(Boolean);
  return out;
}

function reference(now) {
  const d = new Date(now).toISOString().slice(0, 10).replace(/-/g, '');
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return `WD-${d}-${s}`;
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function rateLimited(env, ip) {
  const key = 'enq:' + (await sha256('whydrive:' + ip)).slice(0, 32);
  const now = Math.floor(Date.now() / 1000);
  if (env.RATE_LIMIT) {
    const raw = await env.RATE_LIMIT.get(key);
    const hits = (raw ? JSON.parse(raw) : []).filter(t => t > now - RATE_WINDOW_S);
    if (hits.length >= RATE_MAX) return true;
    hits.push(now);
    await env.RATE_LIMIT.put(key, JSON.stringify(hits), { expirationTtl: RATE_WINDOW_S + 60 });
    return false;
  }
  const hits = (memoryHits.get(key) || []).filter(t => t > now - RATE_WINDOW_S);
  if (hits.length >= RATE_MAX) return true;
  hits.push(now);
  memoryHits.set(key, hits);
  return false;
}

function ukDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function buildEmail(v, ref, receivedAt) {
  const rows = [
    ['Reference', ref],
    ['Received', receivedAt],
    ['Taxi company / trading name', v.companyName],
    ['Main contact', v.contactName],
    ['Email', v.email],
    ['Telephone', v.phone],
    ['Business postcode', v.postcode],
    ['Main operating town / area', v.area],
    ['Licensing authority', v.licensingAuthority],
    ['Licence type', LICENCE_TYPES[v.licenceType]],
    ['Total vehicles in fleet', String(v.totalVehicles)],
    ['Preferred date to join', ukDate(v.preferredStart)],
    ['Interested in local journeys', INTEREST[v.interestLocal]],
    ['Interested in airport / long-distance', INTEREST[v.interestLong]],
  ];
  const blocks = [
    ['Current booking arrangements', v.currentBooking],
    ['Primary operating areas', v.operatingAreas],
    ['Additional comments', v.comments || '—'],
  ];
  const vehicleRows = v.vehicles.map((x, i) => [
    String(i + 1), x.make, x.model, x.registration || '—', x.type, String(x.seats), x.luggage, x.licenceCategory, ukDate(x.licenceExpiry),
  ]);
  const vehicleHead = ['#', 'Make', 'Model', 'Registration', 'Type', 'Seats', 'Luggage', 'Licensing', 'Licence expiry'];

  const td = 'padding:8px 10px;border:1px solid #d9e1ec;vertical-align:top;font-size:14px';
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#0b1830">
<div style="max-width:760px;margin:0 auto;padding:24px">
${emailHeader()}
<div style="background:#0a1834;color:#fff;padding:18px 22px"><div style="font-size:12px;letter-spacing:.12em;color:#ffd889;text-transform:uppercase">WhyDrive website</div><div style="font-size:22px;font-weight:bold;margin-top:4px">New driver / operator enquiry</div></div>
<div style="background:#fff;border:1px solid #d9e1ec;border-top:0;border-bottom:0;padding:20px 22px">
<table style="border-collapse:collapse;width:100%">${rows.map(([k, val]) => `<tr><th style="${td};text-align:left;background:#f3f6fb;width:42%">${esc(k)}</th><td style="${td}">${esc(val)}</td></tr>`).join('')}</table>
<h3 style="margin:22px 0 8px">Vehicles (${v.vehicles.length})</h3>
<div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%"><tr>${vehicleHead.map(h => `<th style="${td};background:#f3f6fb;text-align:left">${esc(h)}</th>`).join('')}</tr>${vehicleRows.map(r => `<tr>${r.map(c => `<td style="${td}">${esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>
${blocks.map(([k, val]) => `<h3 style="margin:22px 0 6px">${esc(k)}</h3><div style="white-space:pre-wrap;font-size:14px;line-height:1.5;background:#f8fafc;border:1px solid #e3e9f2;border-radius:10px;padding:12px">${esc(val)}</div>`).join('')}
<p style="font-size:13px;color:#56657f;margin-top:22px">Consent: the applicant confirmed they read the Privacy Policy and agreed to be contacted about this enquiry. Reply to this email to respond directly to ${esc(v.contactName)}.</p>
</div>${emailFooter()}</div></body></html>`;

  const text = [
    'New WhyDrive driver / operator enquiry',
    '',
    ...rows.map(([k, val]) => `${k}: ${val}`),
    '',
    `Vehicles (${v.vehicles.length}):`,
    ...v.vehicles.map((x, i) => `  ${i + 1}. ${x.make} ${x.model} | Reg: ${x.registration || '—'} | ${x.type} | ${x.seats} seats | Luggage: ${x.luggage} | ${x.licenceCategory} | Licence expiry: ${ukDate(x.licenceExpiry)}`),
    '',
    ...blocks.flatMap(([k, val]) => [`${k}:`, val, '']),
    'Consent: the applicant confirmed they read the Privacy Policy and agreed to be contacted about this enquiry.',
  ].join('\n');

  const subject = `WhyDrive enquiry ${ref}: ${v.companyName} (${v.vehicles.length} vehicle${v.vehicles.length === 1 ? '' : 's'})`;
  return { subject, html, text };
}

const EMAIL_ASSETS = 'https://whydrive.co.uk/assets/img/email';

// Branded email header (WhyDrive logo) and footer (Vamalio logo). Hosted PNGs: Gmail/Outlook don't render SVG or WebP.
function emailHeader() {
  return `<div style="background:#fff;border:1px solid #d9e1ec;border-bottom:0;border-radius:14px 14px 0 0;padding:22px 22px 8px;text-align:center"><a href="https://whydrive.co.uk" style="text-decoration:none"><img src="${EMAIL_ASSETS}/whydrive-logo-email.png" width="240" height="158" alt="WhyDrive — Your Ride Your Way" style="display:inline-block;border:0;width:240px;height:auto;max-width:100%"></a></div>`;
}

function emailFooter() {
  return `<div style="background:#0a1834;border-radius:0 0 14px 14px;padding:20px 22px;text-align:center;color:#c9d4e6;font-size:12px;line-height:1.6"><div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#ffd889;margin-bottom:8px">Powered by</div><a href="https://vamalio.com" style="text-decoration:none"><img src="${EMAIL_ASSETS}/vamalio-logo-email.png" width="300" height="71" alt="Vamalio Technologies Ltd" style="display:inline-block;border:0;width:300px;height:auto;max-width:100%"></a><div style="margin-top:10px">Vamalio Technologies Ltd &middot; Intelligent Technology. Smarter Journeys.<br>Registered in England and Wales, company number 17460666.<br><a href="https://whydrive.co.uk" style="color:#ffd889">whydrive.co.uk</a> &middot; <a href="mailto:driver@whydrive.co.uk" style="color:#ffd889">driver@whydrive.co.uk</a></div></div>`;
}

function buildAck(v, ref) {
  // Drivers finish on the WhyDrive driver form, which checks their documents automatically.
  const veh = v.vehicles[0] || {};
  const link = 'https://book.whydrive.co.uk/whydrive/join/?' + new URLSearchParams({ ref, name: v.contactName || '', email: v.email || '', phone: v.phone || '', town: v.area || '', company: v.companyName || '', registration: veh.registration || '' }).toString();
  const need = ['Your driving licence', 'Your insurance certificate (hire and reward)', 'Your hackney carriage or private hire badge', 'School contract (blue) badge: yes or no? If yes, a photo of it and its expiry date', 'Your MOT certificate and MOT expiry date', 'Your interim test due date (if your council needs one)', 'A head-and-shoulders photo of you, taken on your phone', 'The date you would like to start'];
  const subject = `WhyDrive: next step for your application (${ref})`;
  const text = `Hello ${v.contactName},

Thank you for applying to drive with WhyDrive. Your reference is ${ref}.

To set you up, please send us:
${need.map(n => '- ' + n).join('\n')}

Add them here (photos taken on your phone are fine): ${link}

Your first month with WhyDrive is free. After that it's £39 a week, fixed for your first 3 months. No contract.

If you have any questions please reply below and we will get back to you as soon as possible.

WhyDrive — Your Ride Your Way
driver@whydrive.co.uk · https://whydrive.co.uk`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#0b1830"><div style="max-width:600px;margin:0 auto;padding:24px">${emailHeader()}<div style="background:#fff;border:1px solid #d9e1ec;border-top:0;border-bottom:0;padding:8px 24px 24px">
<p style="font-size:16px">Hello ${esc(v.contactName)},</p>
<p style="font-size:16px;line-height:1.55">Thank you for applying to drive with <strong>WhyDrive</strong>. Your reference is <strong style="font-family:monospace">${esc(ref)}</strong>.</p>
<p style="font-size:16px;line-height:1.55">To set you up, please send us:</p>
<ul style="font-size:16px;line-height:1.6">${need.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
<p style="margin:24px 0"><a href="${esc(link)}" style="background:#c99412;color:#111;text-decoration:none;font-weight:bold;font-size:17px;padding:15px 30px;border-radius:10px;display:inline-block">Send my documents</a></p>
<p style="color:#5b6579;font-size:13px">If the button does not work, copy this link into your browser:<br><a href="${esc(link)}" style="color:#0b2a6b;word-break:break-all">${esc(link)}</a></p>
<p style="font-size:16px;line-height:1.55">Photos taken on your phone are fine. We check everything automatically and email you your start date as soon as it's all in order.</p>
<p style="font-size:16px;line-height:1.55"><strong>Your first month is free.</strong> After that it's £39 a week, fixed for your first 3 months. No contract.</p>
<p style="font-size:16px;line-height:1.55">If you have any questions please reply below and we will get back to you as soon as possible.</p>
<p style="font-size:15px;margin-top:24px">Kind regards,<br><strong>The WhyDrive team</strong><br><span style="color:#b77a17">Your Ride. Your Way.</span></p>
</div>${emailFooter()}</div></body></html>`;
  return { subject, html, text };
}

async function sendEmail(env, payload, idempotencyKey) {
  const res = await fetch(env.RESEND_API_URL || 'https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  return { ok: res.ok && body && body.id, status: res.status, id: body && body.id, error: body && (body.message || body.name) };
}

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

function htmlPage(status, title, message) {
  const body = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} | WhyDrive</title><style>body{margin:0;font-family:system-ui,sans-serif;background:#071329;color:#eef3fb;display:grid;place-items:center;min-height:100vh;padding:24px}main{max-width:560px;background:#0e2146;border:1px solid rgba(247,194,82,.5);border-radius:20px;padding:32px}h1{margin-top:0}a{color:#ffd889}</style></head><body><main><h1>${esc(title)}</h1><p>${message}</p><p><a href="javascript:history.back()">Go back to your enquiry</a> &middot; <a href="/">WhyDrive home</a></p></main></body></html>`;
  return new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

export async function onRequestPost({ request, env }) {
  const fallback = env.FALLBACK_EMAIL || 'driver@whydrive.co.uk';
  const contentType = request.headers.get('content-type') || '';
  const wantsJson = contentType.includes('application/json');
  const fail = (status, message, extra = {}) => wantsJson
    ? json(status, { ok: false, message, ...extra })
    : htmlPage(status, 'We could not send your enquiry', esc(message) + (extra.errors ? '<br><br>' + Object.values(extra.errors).map(esc).join('<br>') : ''));

  // Same-origin browser submissions only.
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return fail(403, 'This form can only be submitted from the WhyDrive website.');

  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_BODY) return fail(413, 'Your enquiry is too large. Please shorten your comments and try again.');

  let input;
  try {
    if (wantsJson) {
      const raw = await request.text();
      if (raw.length > MAX_BODY) return fail(413, 'Your enquiry is too large. Please shorten your comments and try again.');
      input = JSON.parse(raw);
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('bad');
    } else {
      input = fromForm((await request.formData()).entries());
    }
  } catch {
    return fail(400, 'We could not read your enquiry. Please try again.');
  }

  // Honeypot: real visitors never see this field. Accept quietly so bots learn nothing.
  if (oneLine(input.website, 200)) {
    return wantsJson ? json(200, { ok: true, reference: 'WD-RECEIVED' }) : Response.redirect(new URL('/join/sent/', request.url).toString(), 303);
  }
  const started = Number(input.startedAt);
  if (Number.isFinite(started) && started > 0 && Date.now() - started < MIN_FILL_MS) {
    return fail(400, 'That was very quick! Please take a moment to check your details, then send your enquiry again.');
  }

  const { errors, value } = validate(input);
  if (Object.keys(errors).length) return fail(422, 'Please check the highlighted fields.', { errors });

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (await rateLimited(env, ip)) {
    return fail(429, `We have received several enquiries from your connection recently. Please wait a while and try again, or email ${fallback}.`);
  }

  if (!env.RESEND_API_KEY) {
    return fail(503, `Our enquiry service is temporarily unavailable. Please email ${fallback} and we will reply as soon as we can.`);
  }

  const now = Date.now();
  const ref = reference(now);
  const receivedAt = new Date(now).toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'long', timeStyle: 'short' });
  const mail = buildEmail(value, ref, receivedAt);
  const to = env.ENQUIRY_TO || 'driver@whydrive.co.uk';
  const sent = await sendEmail(env, {
    from: env.ENQUIRY_FROM || 'WhyDrive Website <website@whydrive.co.uk>',
    to: [to],
    reply_to: value.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    tags: [{ name: 'type', value: 'operator_enquiry' }],
  }, ref + '-team');

  if (!sent.ok) {
    console.error('enquiry_send_failed', sent.status, sent.error);
    return fail(502, `Sorry — we could not send your enquiry just now. Your details are still on the form. Please try again in a moment, or email ${fallback}.`);
  }

  let acknowledgement = 'not_sent';
  const ack = buildAck(value, ref);
  const ackSent = await sendEmail(env, {
    from: env.ACK_FROM || 'WhyDrive <driver@whydrive.co.uk>',
    to: [value.email],
    reply_to: to,
    subject: ack.subject,
    html: ack.html,
    text: ack.text,
    tags: [{ name: 'type', value: 'operator_enquiry_ack' }],
  }, ref + '-ack');
  if (ackSent.ok) acknowledgement = 'sent';
  else console.error('enquiry_ack_failed', ackSent.status, ackSent.error);

  if (!wantsJson) return Response.redirect(new URL(`/join/sent/?ref=${encodeURIComponent(ref)}`, request.url).toString(), 303);
  return json(200, { ok: true, reference: ref, acknowledgement });
}

export async function onRequest({ request }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow: 'POST, OPTIONS' } });
  return json(405, { ok: false, message: 'Method not allowed.' });
}
