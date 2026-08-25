const PRODIGI_BASE = "https://api.prodigi.com";
const DEFAULT_SKU = "GLOBAL-GRE-MOH-7X5-DIR";
const CALLBACK_URL = "https://vermalio.stace-walbridge.workers.dev/api/prodigi/webhook";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text)));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function authorized(request, env) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || !env.BTO_PRODIGI_PROXY_TOKEN_HASH) return false;
  return timingSafeEqual(await sha256Hex(token), String(env.BTO_PRODIGI_PROXY_TOKEN_HASH));
}

function validBtoAssetUrl(value) {
  try {
    const u = new URL(String(value || ""));
    return u.protocol === "https:" && u.hostname === "builttooffend.com" && u.pathname.startsWith("/api/print-asset/") && Boolean(u.searchParams.get("token"));
  } catch {
    return false;
  }
}

async function productDetails(apiKey, sku) {
  const response = await fetch(`${PRODIGI_BASE}/v4.0/products/${encodeURIComponent(sku)}`, {
    headers: { "X-API-Key": apiKey },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || String(payload?.outcome || "").toLowerCase() !== "ok") {
    throw new Error(`Prodigi product lookup failed (${response.status})`);
  }
  return payload.product || payload;
}

function validateTemplate(product) {
  const size = product?.variants?.[0]?.printAreaSizes?.default;
  if (!product?.printAreas?.default || !size) throw new Error("Prodigi default print area is unavailable");
  if (Number(size.horizontalResolution) !== 6118 || Number(size.verticalResolution) !== 2161) {
    throw new Error(`Unexpected Prodigi template size ${size.horizontalResolution}x${size.verticalResolution}`);
  }
  return "default";
}

function recipientFrom(order) {
  const shipping = order?.shipping || {};
  const address = shipping.address || {};
  const country = String(address.country || "").toUpperCase();
  if (country !== "GB") throw new Error("Built To Offend currently accepts UK delivery only");
  if (!shipping.name || !address.line1 || !address.postal_code || !address.city) throw new Error("Paid order is missing a complete UK delivery address");
  return {
    name: String(shipping.name).trim(),
    email: order.customerEmail ? String(order.customerEmail).trim() : undefined,
    address: {
      line1: String(address.line1).trim(),
      line2: address.line2 ? String(address.line2).trim() : undefined,
      postalOrZipCode: String(address.postal_code).trim(),
      countryCode: country,
      townOrCity: String(address.city).trim(),
      stateOrCounty: address.state ? String(address.state).trim() : undefined,
    },
  };
}

function verifyCreated(result, status) {
  const outcome = String(result?.outcome || "").toLowerCase();
  const allowed = new Set(["created", "onhold", "alreadyexists"]);
  const providerOrderId = result?.order?.id || result?.id || null;
  const issues = Array.isArray(result?.order?.status?.issues) ? result.order.status.issues : [];
  if (!allowed.has(outcome) || !providerOrderId || issues.length) {
    const issueText = issues.length ? `; ${issues.map((x) => x?.description || x?.code || JSON.stringify(x)).join(" | ")}` : "";
    throw new Error(`Prodigi order rejected (${status}): ${result?.outcome || result?.error || "unknown"}${issueText}`);
  }
  return providerOrderId;
}

export async function handleBtoProdigiSpreadBridge(request, env, url) {
  if (!(await authorized(request, env))) return json({ ok: false, error: "forbidden" }, 403);
  const apiKey = env.PRODIGI_API_KEY || env.PRODIGI_LIVE_API_KEY || env.PRODIGI_KEY;
  if (!apiKey) return json({ ok: false, error: "Prodigi live runtime secret missing on Vermalio" }, 503);

  try {
    if (request.method === "GET" && url.pathname.endsWith("/health")) {
      const product = await productDetails(apiKey, url.searchParams.get("sku") || DEFAULT_SKU);
      validateTemplate(product);
      return json({ ok: true, provider: "prodigi", environment: "live", sku: url.searchParams.get("sku") || DEFAULT_SKU, printArea: "default", horizontalResolution: 6118, verticalResolution: 2161 });
    }

    if (request.method !== "POST" || !url.pathname.endsWith("/order")) return json({ ok: false, error: "method_not_allowed" }, 405);
    const body = await request.json();
    const order = body?.order || {};
    if (!order.id) throw new Error("Missing merchant order reference");
    if (!validBtoAssetUrl(body?.outsideUrl)) throw new Error("Invalid Built To Offend spread artwork URL");

    const sku = String(body?.sku || DEFAULT_SKU).trim();
    const product = await productDetails(apiKey, sku);
    const printArea = validateTemplate(product);
    const totalPence = Number(order.pricePence || 0) + Number(order.shippingPence || 0);

    const payload = {
      merchantReference: String(order.id),
      idempotencyKey: String(order.id),
      callbackUrl: CALLBACK_URL,
      shippingMethod: String(body?.shippingMethod || "Budget"),
      recipient: recipientFrom(order),
      items: [{
        merchantReference: `monster-${order.id}`,
        sku,
        copies: 1,
        sizing: "fillPrintArea",
        recipientCost: { amount: (Math.max(0, totalPence) / 100).toFixed(2), currency: "GBP" },
        assets: [{ printArea, url: body.outsideUrl }],
      }],
      metadata: { source: "builttooffend.com", brutality: String(order.brutality || "") },
    };

    const response = await fetch(`${PRODIGI_BASE}/v4.0/orders`, {
      method: "POST",
      headers: { "X-API-Key": apiKey, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Prodigi order failed (${response.status}): ${result?.outcome || result?.error || "unknown"}`);
    const providerOrderId = verifyCreated(result, response.status);
    return json({ ok: true, provider: "prodigi", environment: "live", providerOrderId, outcome: result.outcome });
  } catch (error) {
    console.error("BTO Prodigi spread bridge", String(error?.message || error));
    return json({ ok: false, error: String(error?.message || error) }, 502);
  }
}
