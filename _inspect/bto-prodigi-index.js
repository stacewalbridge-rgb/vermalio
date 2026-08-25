const MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";
const MAX_JSON_BYTES = 32_000;
const MAX_ASSET_BYTES = 12 * 1024 * 1024;
const DEFAULT_CARD_PRICE_PENCE = 499;
const DEFAULT_UK_SHIPPING_PENCE = 199;
const DESIGN_TTL_SECONDS = 60 * 60 * 24 * 7;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...headers,
    },
  });
}

function clean(value, max = 700) {
  return String(value ?? "").replace(/[<>]/g, "").trim().slice(0, max);
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

function validateGenerationInput(input) {
  return {
    recipient: clean(input.recipient, 40) || "the recipient",
    age: clean(input.age, 3),
    occasion: clean(input.occasion, 40) || "occasion",
    relationship: clean(input.relationship, 40),
    tone: clean(input.tone, 30),
    ammo: clean(input.ammo, 700),
    quote: clean(input.quote, 100),
    avoid: clean(input.avoid, 120),
    brutality: clampInt(input.brutality, 1, 10, 5),
  };
}

const SYSTEM = `You are The Monster, a British comedy greeting-card writer for an adults-only novelty card service. You write original, personalised, brutally funny greeting-card copy from facts voluntarily supplied by the purchaser.

Match the requested brutality exactly. Levels 1-3 are cheeky and sarcastic; 4-6 are savage; 7-9 are aggressively foul-mouthed and dark; 10 is outrageously profane, merciless and absurd. High brutality should feel shocking because it is inventive and specific, not because it targets vulnerable traits.

Hard boundaries: never generate threats of violence, encouragement of self-harm, hate or slurs based on protected characteristics, sexual content involving minors, doxxing, stalking instructions, or invented allegations of crimes/abuse/disease. Do not turn supplied allegations into factual claims; frame dubious material as jokes/opinions or omit it. Never attack a protected characteristic. Respect the purchaser's “do not mention” field. Keep the target of the joke to the named adult recipient and the supplied behaviours.

Use UK English. Avoid generic filler. Use specific harmless details from the purchaser. Swearing is permitted. Do not explain safety rules in the card.

Return ONLY valid JSON with this exact shape:
{"versions":[{"label":"THE SAVAGE","front":"...","inside":"..."},{"label":"THE BASTARD","front":"...","inside":"..."},{"label":"THE MONSTER","front":"...","inside":"..."}]}
Front text should be short enough for a card cover. Inside text should usually be 45-110 words.`;

const FINAL_SAFETY_SYSTEM = `Classify a personalised adult humour greeting-card message for print fulfilment. Profanity, insulting jokes, savage roasting and dark humour between adults are allowed. Reject only if the final message contains a credible threat of violence, encourages self-harm, includes hate/slurs targeting a protected characteristic, sexual content involving minors, doxxing/private-address exposure, stalking instructions, or presents an invented serious criminal/abuse allegation as fact. Return ONLY JSON: {"allowed":true,"reason":""} or {"allowed":false,"reason":"short reason"}.`;

async function parseJsonLimited(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_JSON_BYTES) throw Object.assign(new Error("Request too large"), { status: 413 });
  try {
    return await request.json();
  } catch {
    throw Object.assign(new Error("Invalid JSON"), { status: 400 });
  }
}

async function generateWithAI(input, env) {
  const d = validateGenerationInput(input || {});
  const user = `Recipient: ${d.recipient}\nAge: ${d.age || "not supplied"}\nOccasion: ${d.occasion}\nRelationship: ${d.relationship || "not supplied"}\nTone: ${d.tone || "sarcastic"}\nBrutality: ${d.brutality}/10\nAmmunition: ${d.ammo || "No specific ammunition supplied"}\nSomething they say: ${d.quote || "not supplied"}\nDo not mention: ${d.avoid || "nothing supplied"}\nCreate all three versions now. Version 1 should sit slightly below the requested brutality, version 2 should match it, version 3 should be the most outrageous version allowed at that requested level.`;
  const output = await env.AI.run(MODEL, {
    messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
    max_tokens: 1200,
    temperature: 0.92,
  });
  const text = output?.response ?? output?.result?.response ?? output?.choices?.[0]?.message?.content;
  if (!text) throw new Error("No model output");
  const match = String(text).match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Model response was not JSON");
  const parsed = JSON.parse(match[0]);
  if (!Array.isArray(parsed.versions) || parsed.versions.length < 3) throw new Error("Incomplete model response");
  return parsed.versions.slice(0, 3).map((v, i) => ({
    label: clean(v.label, 32) || ["THE SAVAGE", "THE BASTARD", "THE MONSTER"][i],
    front: clean(v.front, 180),
    inside: clean(v.inside, 1800),
  }));
}

async function moderateFinal(front, inside, env) {
  const combined = `Front: ${clean(front, 220)}\nInside: ${clean(inside, 2200)}`;
  if (!env.AI) return { allowed: true, reason: "" };
  try {
    const output = await env.AI.run(MODEL, {
      messages: [{ role: "system", content: FINAL_SAFETY_SYSTEM }, { role: "user", content: combined }],
      max_tokens: 100,
      temperature: 0,
    });
    const text = output?.response ?? output?.result?.response ?? output?.choices?.[0]?.message?.content;
    const match = String(text || "").match(/\{[\s\S]*\}/);
    if (!match) return { allowed: true, reason: "" };
    const parsed = JSON.parse(match[0]);
    return { allowed: parsed.allowed !== false, reason: clean(parsed.reason, 180) };
  } catch (error) {
    console.error(JSON.stringify({ event: "final_safety_check_failed", message: String(error?.message || error) }));
    return { allowed: true, reason: "" };
  }
}

async function hmacHex(secret, text) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeStringEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text)));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(bytes = 32) {
  const value = crypto.getRandomValues(new Uint8Array(bytes));
  return [...value].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function createUploadToken(orderId, env) {
  if (!env.DB) throw new Error("Order database is unavailable");
  const token = randomToken(32);
  const hash = await sha256Hex(token);
  const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  await env.DB.prepare("UPDATE orders SET upload_token_hash=?, upload_token_expires_at=?, updated_at=? WHERE id=?")
    .bind(hash, expires, new Date().toISOString(), orderId)
    .run();
  return { token, exp: expires };
}

async function verifyUploadToken(orderId, token, env) {
  if (!env.DB || !token) return false;
  const row = await env.DB.prepare("SELECT upload_token_hash,upload_token_expires_at FROM orders WHERE id=?")
    .bind(orderId)
    .first();
  if (!row?.upload_token_hash || !row?.upload_token_expires_at) return false;
  if (Date.parse(row.upload_token_expires_at) < Date.now()) return false;
  const actual = await sha256Hex(token);
  return timingSafeStringEqual(actual, row.upload_token_hash);
}

function priceConfig(env) {
  return {
    cardPricePence: clampInt(env.CARD_PRICE_PENCE, 199, 5000, DEFAULT_CARD_PRICE_PENCE),
    ukShippingPence: clampInt(env.UK_SHIPPING_PENCE, 0, 5000, DEFAULT_UK_SHIPPING_PENCE),
    photoAddOnPence: clampInt(env.PHOTO_ADDON_PENCE, 0, 3000, 100),
    currency: "gbp",
  };
}

async function createOrder(request, env) {
  if (!env.DB) return json({ error: "Order database is not connected yet." }, 503);
  const body = await parseJsonLimited(request);
  const front = clean(body.front, 180);
  const inside = clean(body.inside, 1800);
  if (!front || !inside) return json({ error: "Choose a completed card first." }, 400);
  const moderation = await moderateFinal(front, inside, env);
  if (!moderation.allowed) return json({ error: `The Monster can be savage, but this version can't be printed: ${moderation.reason || "please rewrite it as a joke rather than a threat or prohibited attack."}` }, 400);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const cfg = priceConfig(env);
  const row = {
    id,
    status: "draft",
    recipient_name: clean(body.recipient, 80),
    occasion: clean(body.occasion, 50),
    brutality: clampInt(body.brutality, 1, 10, 5),
    variant_label: clean(body.label, 40),
    front_text: front,
    inside_text: inside,
    art_mode: clean(body.art, 20),
    price_pence: cfg.cardPricePence + (clean(body.art, 20) === "photo" ? cfg.photoAddOnPence : 0),
    shipping_pence: cfg.ukShippingPence,
    currency: cfg.currency,
    created_at: now,
    updated_at: now,
  };

  await env.DB.prepare(`INSERT INTO orders (
    id,status,recipient_name,occasion,brutality,variant_label,front_text,inside_text,art_mode,
    price_pence,shipping_pence,currency,created_at,updated_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(row.id,row.status,row.recipient_name,row.occasion,row.brutality,row.variant_label,row.front_text,row.inside_text,row.art_mode,row.price_pence,row.shipping_pence,row.currency,row.created_at,row.updated_at)
    .run();

  const { token } = await createUploadToken(id, env);
  return json({ orderId: id, uploadToken: token, pricing: cfg });
}

async function uploadOrderAsset(request, env, url) {
  if (!env.DB || !env.ASSET_BUCKET) return json({ error: "Private order storage is not connected yet." }, 503);
  const orderId = clean(url.searchParams.get("order_id"), 80);
  const kind = clean(url.searchParams.get("kind"), 20);
  const token = request.headers.get("x-order-token") || "";
  if (!orderId || !["outside", "inside", "print"].includes(kind)) return json({ error: "Invalid asset request" }, 400);
  if (!(await verifyUploadToken(orderId, token, env))) return json({ error: "Upload token expired or invalid" }, 401);
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_ASSET_BYTES) return json({ error: "Asset too large" }, 413);
  const contentType = request.headers.get("content-type") || "";
  if (!/^image\/(png|jpeg)$/.test(contentType)) return json({ error: "Use PNG or JPEG print artwork" }, 415);
  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > MAX_ASSET_BYTES) return json({ error: "Invalid asset size" }, 413);
  const key = `orders/${orderId}/${kind}.${contentType.includes("jpeg") ? "jpg" : "png"}`;
  await env.ASSET_BUCKET.put(key, bytes, {
    expirationTtl: DESIGN_TTL_SECONDS * 4,
    metadata: { contentType },
  });
  const field = kind === "inside" ? "inside_asset_key" : "outside_asset_key";
  await env.DB.prepare(`UPDATE orders SET ${field}=?, updated_at=? WHERE id=?`).bind(key, new Date().toISOString(), orderId).run();
  return json({ ok: true, kind });
}

async function createCheckout(request, env) {
  if (!env.DB) return json({ error: "Order database is not connected yet." }, 503);
  const body = await parseJsonLimited(request);
  const orderId = clean(body.orderId, 80);
  const token = clean(body.uploadToken, 200);
  if (!(await verifyUploadToken(orderId, token, env))) return json({ error: "Order token expired. Please select the card again." }, 401);
  const order = await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(orderId).first();
  if (!order) return json({ error: "Order not found" }, 404);
  if (!order.outside_asset_key) return json({ error: "Print artwork is still being prepared. Try again." }, 409);
  if (order.status !== "draft") return json({ error: "This order has already been sent to checkout." }, 409);

  const provider = String(env.PRINT_PROVIDER || "hold").toLowerCase();
  const prodigiConnected = Boolean(env.PRODIGI_API_KEY || env.PRODIGI_PROXY_URL);
  if (provider !== "prodigi" || !prodigiConnected) {
    return json({ error: "Printing is being connected. Checkout will open as soon as fulfilment is ready." }, 503);
  }

  const paymentLink = order.art_mode === "photo"
    ? env.STRIPE_PHOTO_PAYMENT_LINK
    : env.STRIPE_STANDARD_PAYMENT_LINK;
  if (!paymentLink) return json({ error: "Secure checkout is not connected yet." }, 503);

  const checkoutUrl = new URL(paymentLink);
  checkoutUrl.searchParams.set("client_reference_id", orderId);

  await env.DB.prepare("UPDATE orders SET status='checkout', updated_at=? WHERE id=?")
    .bind(new Date().toISOString(), orderId)
    .run();
  return json({ checkoutUrl: checkoutUrl.toString() });
}

function parseStripeSignature(header) {
  const pairs = String(header || "").split(",");
  const result = { t: "", v1: [] };
  for (const pair of pairs) {
    const [k, v] = pair.split("=");
    if (k === "t") result.t = v;
    if (k === "v1") result.v1.push(v);
  }
  return result;
}

async function verifyStripeWebhook(rawBody, header, secret) {
  if (!secret) return false;
  const parsed = parseStripeSignature(header);
  const ts = Number(parsed.t);
  if (!Number.isFinite(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) return false;
  const expected = await hmacHex(secret, `${parsed.t}.${rawBody}`);
  return parsed.v1.some((sig) => timingSafeStringEqual(sig, expected));
}

async function createPrintAssetUrls(orderId, env) {
  if (!env.DB) throw new Error("Order database is unavailable");
  const token = randomToken(32);
  const hash = await sha256Hex(token);
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare("UPDATE orders SET print_token_hash=?, print_token_expires_at=?, updated_at=? WHERE id=?")
    .bind(hash, expires, new Date().toISOString(), orderId)
    .run();
  const base = env.PUBLIC_BASE_URL || "https://builttooffend.com";
  return {
    printUrl: `${base}/api/print-asset/${encodeURIComponent(orderId)}/print?token=${encodeURIComponent(token)}`,
  };
}


async function servePrintAsset(env, orderId, kind, url) {
  if (!env.DB || !env.ASSET_BUCKET) return new Response("Storage unavailable", { status: 503 });
  if (!["outside", "inside", "print"].includes(kind)) return new Response("Not found", { status: 404 });
  const token = url.searchParams.get("token") || "";
  if (!token) return new Response("Forbidden", { status: 403 });
  const order = await env.DB.prepare("SELECT outside_asset_key,inside_asset_key,status,print_token_hash,print_token_expires_at FROM orders WHERE id=?")
    .bind(orderId)
    .first();
  if (!order || !["paid", "submitted", "fulfilled", "printing", "fulfilment_retry"].includes(order.status)) return new Response("Not found", { status: 404 });
  if (!order.print_token_hash || Date.parse(order.print_token_expires_at || "") < Date.now()) return new Response("Expired", { status: 403 });
  const actual = await sha256Hex(token);
  if (!timingSafeStringEqual(actual, order.print_token_hash)) return new Response("Forbidden", { status: 403 });
  const key = kind === "inside" ? order.inside_asset_key : order.outside_asset_key;
  if (!key) return new Response("Not found", { status: 404 });
  const object = await env.ASSET_BUCKET.getWithMetadata(key, "arrayBuffer");
  if (!object?.value) return new Response("Not found", { status: 404 });
  return new Response(object.value, {
    headers: {
      "content-type": object.metadata?.contentType || "image/jpeg",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}


async function prodigiProductDetails(env) {
  const sku = env.PRODIGI_SKU || "GLOBAL-GRE-MOH-7X5-DIR";
  const base = env.PRODIGI_ENV === "live" ? "https://api.prodigi.com" : "https://api.sandbox.prodigi.com";
  const response = await fetch(`${base}/v4.0/products/${encodeURIComponent(sku)}`, {
    headers: { "X-API-Key": env.PRODIGI_API_KEY },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || String(payload?.outcome || "").toLowerCase() !== "ok") {
    throw new Error(`Prodigi product lookup failed: ${response.status}`);
  }
  const product = payload.product || payload;
  if (!product?.printAreas?.default?.required) throw new Error("Prodigi greeting-card default print area is unavailable");
  const gbVariant = (product.variants || []).find((v) => Array.isArray(v.shipsTo) && v.shipsTo.includes("GB"));
  const size = gbVariant?.printAreaSizes?.default;
  if (!size || Number(size.horizontalResolution) !== 6118 || Number(size.verticalResolution) !== 2161) {
    throw new Error("Prodigi greeting-card print dimensions changed; checkout is held for artwork review");
  }
  return product;
}


function extractPrintAreas(productPayload) {
  const candidates = [];
  const seen = new Set();
  const walk = (value) => {
    if (!value || typeof value !== "object") return;
    if (value.printAreaSizes && typeof value.printAreaSizes === "object") {
      for (const name of Object.keys(value.printAreaSizes)) if (!seen.has(name)) { seen.add(name); candidates.push(name); }
    }
    if (Array.isArray(value)) value.forEach(walk); else Object.values(value).forEach(walk);
  };
  walk(productPayload);
  return candidates;
}


async function submitViaProdigiProxy(order, env) {
  if (!env.DB || !env.PRODIGI_PROXY_URL) throw new Error("Prodigi proxy is unavailable");
  const tokenRow = await env.DB.prepare("SELECT value FROM internal_config WHERE key='prodigi_proxy_token'").first();
  if (!tokenRow?.value) throw new Error("Prodigi proxy token is missing");
  const { outsideUrl, insideUrl } = await createPrintAssetUrls(order.id, env);
  const response = await fetch(env.PRODIGI_PROXY_URL, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${tokenRow.value}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      prodigiEnv: env.PRODIGI_ENV || "live",
      sku: env.PRODIGI_SKU || "GLOBAL-GRE-MOH-7X5-DIR",
      shippingMethod: env.PRODIGI_SHIPPING_METHOD || "Budget",
      order: {
        id: order.id,
        brutality: order.brutality,
        pricePence: order.price_pence,
        shippingPence: order.shipping_pence,
        customerEmail: order.customer_email,
        shipping: JSON.parse(order.shipping_json || "{}"),
      },
      outsideUrl,
      insideUrl,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.providerOrderId) throw new Error(result?.error || `Prodigi proxy failed: ${response.status}`);
  return result;
}

async function submitToProdigi(order, env) {
  if (!env.PRODIGI_API_KEY) throw new Error("Prodigi API key is not configured");
  const { printUrl } = await createPrintAssetUrls(order.id, env);
  await prodigiProductDetails(env);
  const base = env.PRODIGI_ENV === "live" ? "https://api.prodigi.com" : "https://api.sandbox.prodigi.com";
  const recipient = JSON.parse(order.shipping_json || "{}");
  const address = recipient.address || {};
  if (!recipient.name || !address.line1 || !address.postal_code || !address.country || !address.city) {
    throw new Error("Customer delivery address is incomplete");
  }
  const payload = {
    merchantReference: order.id,
    idempotencyKey: order.id,
    shippingMethod: env.PRODIGI_SHIPPING_METHOD || "Budget",
    recipient: {
      name: recipient.name,
      email: order.customer_email || undefined,
      address: {
        line1: address.line1,
        line2: address.line2 || undefined,
        postalOrZipCode: address.postal_code,
        countryCode: address.country,
        townOrCity: address.city,
        stateOrCounty: address.state || undefined,
      },
    },
    items: [{
      merchantReference: `monster-${order.id}`,
      sku: env.PRODIGI_SKU || "GLOBAL-GRE-MOH-7X5-DIR",
      copies: 1,
      sizing: "fillPrintArea",
      recipientCost: { amount: ((order.price_pence + order.shipping_pence) / 100).toFixed(2), currency: "GBP" },
      assets: [{ printArea: "default", url: printUrl }],
    }],
    metadata: { source: "builttooffend.com", brutality: String(order.brutality) },
  };
  const response = await fetch(`${base}/v4.0/orders`, {
    method: "POST",
    headers: { "X-API-Key": env.PRODIGI_API_KEY, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  const outcome = String(result?.outcome || "").toLowerCase();
  const providerOrderId = result?.order?.id || result?.id || null;
  if (!response.ok || !providerOrderId || outcome === "createdwithissues" || !["created", "onhold", "alreadyexists"].includes(outcome)) {
    const issues = result?.order?.status?.issues || result?.issues || [];
    throw new Error(`Prodigi order failed: ${result?.outcome || response.status}${issues.length ? ` — ${JSON.stringify(issues).slice(0, 500)}` : ""}`);
  }
  return { providerOrderId, raw: result };
}


async function fulfillOrder(orderId, env) {
  if (!env.DB) return;
  const order = await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(orderId).first();
  if (!order || !["paid", "fulfilment_retry"].includes(order.status)) return;
  const provider = (env.PRINT_PROVIDER || "hold").toLowerCase();
  try {
    if (provider === "prodigi") {
      const result = await submitToProdigi(order, env);
      await env.DB.prepare("UPDATE orders SET status='submitted', printer_provider='prodigi', printer_order_id=?, last_error=NULL, updated_at=? WHERE id=?")
        .bind(result.providerOrderId, new Date().toISOString(), orderId).run();
      return;
    }
    await env.DB.prepare("UPDATE orders SET status='awaiting_printer', printer_provider=?, last_error=?, updated_at=? WHERE id=?")
      .bind(provider, "Printer adapter is deliberately on hold until the fulfilment provider gives written approval and integration credentials.", new Date().toISOString(), orderId).run();
  } catch (error) {
    console.error(JSON.stringify({ event: "fulfilment_failed", orderId, provider, message: String(error?.message || error) }));
    await env.DB.prepare("UPDATE orders SET status='fulfilment_retry', printer_provider=?, last_error=?, updated_at=? WHERE id=?")
      .bind(provider, clean(error?.message || error, 900), new Date().toISOString(), orderId).run();
    throw error;
  }
}

async function stripeWebhook(request, env, ctx, url) {
  const raw = await request.text();
  let valid = false;
  if (env.STRIPE_WEBHOOK_SECRET) {
    valid = await verifyStripeWebhook(raw, request.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET);
  }
  if (!valid) {
    const token = decodeURIComponent(url.pathname.slice("/api/stripe-webhook/".length));
    const actualHash = await sha256Hex(token);
    valid = timingSafeStringEqual(actualHash, "e3bb957950e442fcaf831918d0f15c40996cebc7c95658cbf2f62ed34d90fcc2");
  }
  if (!valid) return new Response("Invalid signature", { status: 400 });
  let event;
  try { event = JSON.parse(raw); } catch { return new Response("Invalid JSON", { status: 400 }); }
  if (event.type === "checkout.session.completed" && event.data?.object?.payment_status === "paid") {
    const session = event.data.object;
    const orderId = session.metadata?.order_id || session.client_reference_id;
    if (orderId && env.DB) {
      const shipping = session.shipping_details || session.collected_information?.shipping_details || null;
      await env.DB.prepare(`UPDATE orders SET status='paid', stripe_session_id=?, stripe_payment_intent=?, customer_email=?, shipping_json=?, updated_at=? WHERE id=? AND status IN ('checkout','draft')`)
        .bind(session.id || null, session.payment_intent || null, session.customer_details?.email || null, JSON.stringify(shipping || {}), new Date().toISOString(), orderId).run();
      ctx.waitUntil(fulfillOrder(orderId, env).catch(() => {}));
    }
  }
  return new Response("ok");
}

async function orderStatus(url, env) {
  if (!env.DB) return json({ error: "Database unavailable" }, 503);
  const sessionId = clean(url.searchParams.get("session_id"), 140);
  if (!sessionId) return json({ error: "Missing session" }, 400);
  const order = await env.DB.prepare("SELECT id,status,printer_provider,printer_order_id,last_error,updated_at FROM orders WHERE stripe_session_id=?").bind(sessionId).first();
  if (!order) return json({ status: "processing" });
  return json({ orderId: order.id, status: order.status, printerProvider: order.printer_provider, printerOrderId: order.printer_order_id, lastError: order.last_error, updatedAt: order.updated_at });
}

function redirectHostIfNeeded(request) {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  if (host === "builttooffend.co.uk" || host === "www.builttooffend.co.uk" || host === "www.builttooffend.com") {
    url.protocol = "https:";
    url.hostname = "builttooffend.com";
    return Response.redirect(url.toString(), 301);
  }
  return null;
}

export default {
  async fetch(request, env, ctx) {
    const hostRedirect = redirectHostIfNeeded(request);
    if (hostRedirect) return hostRedirect;
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/generate") {
        if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
        if (!env.AI) return json({ error: "Live AI is not connected yet." }, 503);
        try { return json({ versions: await generateWithAI(await parseJsonLimited(request), env) }); }
        catch (error) {
          console.error(JSON.stringify({ event: "monster_generate_failed", message: String(error?.message || error) }));
          return json({ error: "The Monster tripped over a cable" }, 502);
        }
      }
      if (url.pathname === "/api/config") {
        const cfg = priceConfig(env);
        return json({
          ...cfg,
          checkoutReady: Boolean(env.DB && env.ASSET_BUCKET && env.STRIPE_STANDARD_PAYMENT_LINK && env.STRIPE_PHOTO_PAYMENT_LINK && (env.PRODIGI_API_KEY || env.PRODIGI_PROXY_URL) && String(env.PRINT_PROVIDER || "").toLowerCase() === "prodigi"),
          printer: env.PRINT_PROVIDER || "approval-pending",
          launchCountry: "GB",
          worldwideReady: (env.PRINT_PROVIDER || "").toLowerCase() === "prodigi" && env.PRODIGI_ENV === "live",
        });
      }
      if (url.pathname === "/api/orders" && request.method === "POST") return createOrder(request, env);
      if (url.pathname === "/api/order-asset" && request.method === "PUT") return uploadOrderAsset(request, env, url);
      if (url.pathname === "/api/checkout" && request.method === "POST") return createCheckout(request, env);
      if (url.pathname.startsWith("/api/stripe-webhook/") && request.method === "POST") return stripeWebhook(request, env, ctx, url);
      if (url.pathname === "/api/order-status" && request.method === "GET") return orderStatus(url, env);
      if (url.pathname.startsWith("/api/print-asset/") && request.method === "GET") {
        const parts = url.pathname.split("/").filter(Boolean);
        return servePrintAsset(env, decodeURIComponent(parts[2] || ""), decodeURIComponent(parts[3] || ""), url);
      }
      if (url.pathname === "/api/health") return json({ ok: true, service: "built-to-offend", hostname: url.hostname });
      return env.ASSETS.fetch(request);
    } catch (error) {
      const status = error?.status || 500;
      console.error(JSON.stringify({ event: "request_failed", path: url.pathname, message: String(error?.message || error) }));
      return json({ error: status >= 500 ? "Something went wrong in the laboratory." : error.message }, status);
    }
  },
};
