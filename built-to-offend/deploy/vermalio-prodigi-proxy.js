const EXPECTED_PROXY_TOKEN_HASH = "__BTO_PROXY_TOKEN_HASH__";
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

function timingSafeStringEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function prodigiApiKey(env) {
  return env.PRODIGI_API_KEY || env.PRODIGI_LIVE_API_KEY || env.PRODIGI_KEY || null;
}

async function authorized(request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return false;
  const actual = await sha256Hex(token);
  return timingSafeStringEqual(actual, EXPECTED_PROXY_TOKEN_HASH);
}

async function readJson(request) {
  const length = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > 128_000) throw new Error("Request too large");
  return request.json();
}

async function productDetails(apiKey, sku) {
  const response = await fetch(`${PRODIGI_BASE}/v4.0/products?skus=${encodeURIComponent(sku)}`, {
    headers: { "X-API-Key": apiKey },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Prodigi live product lookup failed (${response.status})`);
  return payload;
}

function extractPrintAreas(productPayload) {
  const candidates = [];
  const seen = new Set();
  const walk = (value) => {
    if (!value || typeof value !== "object") return;
    if (value.printAreaSizes && typeof value.printAreaSizes === "object") {
      for (const name of Object.keys(value.printAreaSizes)) {
        if (!seen.has(name)) {
          seen.add(name);
          candidates.push(name);
        }
      }
    }
    if (Array.isArray(value)) value.forEach(walk);
    else Object.values(value).forEach(walk);
  };
  walk(productPayload);
  return candidates;
}

function printAreas(productPayload) {
  const areas = extractPrintAreas(productPayload);
  const outsideArea = areas.find((x) => /front|cover|outside|default/i.test(x)) || areas[0];
  const insideArea = areas.find((x) => /inside|inner/i.test(x));
  if (!outsideArea || !insideArea) {
    throw new Error(`Configured greeting-card SKU does not expose both outside and inside print areas (${areas.join(", ") || "none"})`);
  }
  return { areas, outsideArea, insideArea };
}

function validAssetUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" &&
      url.hostname === "builttooffend.com" &&
      url.pathname.startsWith("/api/print-asset/") &&
      Boolean(url.searchParams.get("token"));
  } catch {
    return false;
  }
}

function recipientFrom(order) {
  const shipping = order?.shipping || {};
  const address = shipping.address || {};
  const country = String(address.country || "").toUpperCase();
  if (country !== "GB") throw new Error("Built To Offend is currently accepting UK delivery only");
  if (!shipping.name || !address.line1 || !address.postal_code || !address.city) {
    throw new Error("Paid order is missing a complete delivery address");
  }
  return {
    name: shipping.name,
    email: order.customerEmail || undefined,
    address: {
      line1: address.line1,
      line2: address.line2 || undefined,
      postalOrZipCode: address.postal_code,
      countryCode: country,
      townOrCity: address.city,
      stateOrCounty: address.state || undefined,
    },
  };
}

export async function handleBtoProdigiProxy(request, env, url) {
  if (!(await authorized(request))) return json({ error: "forbidden" }, 403);
  const apiKey = prodigiApiKey(env);
  if (!apiKey) return json({ error: "Prodigi key is not configured on Vermalio" }, 503);

  if (request.method === "GET" && url.pathname.endsWith("/health")) {
    try {
      const sku = url.searchParams.get("sku") || DEFAULT_SKU;
      const product = await productDetails(apiKey, sku);
      const { areas, outsideArea, insideArea } = printAreas(product);
      return json({ ok: true, environment: "live", sku, areas, outsideArea, insideArea });
    } catch (error) {
      return json({ ok: false, error: String(error?.message || error) }, 503);
    }
  }

  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await readJson(request);
    const sku = String(body?.sku || DEFAULT_SKU);
    const order = body?.order || {};
    if (!order.id) throw new Error("Missing merchant order reference");
    if (!validAssetUrl(body?.outsideUrl) || !validAssetUrl(body?.insideUrl)) {
      throw new Error("Invalid Built To Offend print artwork URL");
    }

    const product = await productDetails(apiKey, sku);
    const { outsideArea, insideArea } = printAreas(product);
    const recipient = recipientFrom(order);
    const totalPence = Number(order.pricePence || 0) + Number(order.shippingPence || 0);

    const payload = {
      merchantReference: String(order.id),
      idempotencyKey: String(order.id),
      callbackUrl: CALLBACK_URL,
      shippingMethod: String(body?.shippingMethod || "Budget"),
      recipient,
      items: [{
        merchantReference: `monster-${order.id}`,
        sku,
        copies: 1,
        sizing: "fillPrintArea",
        recipientCost: {
          amount: (Math.max(0, totalPence) / 100).toFixed(2),
          currency: "GBP",
        },
        assets: [
          { printArea: outsideArea, url: body.outsideUrl },
          { printArea: insideArea, url: body.insideUrl },
        ],
      }],
      metadata: {
        source: "builttooffend.com",
        brutality: String(order.brutality || ""),
      },
    };

    const response = await fetch(`${PRODIGI_BASE}/v4.0/orders`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    const providerOrderId = result?.order?.id || result?.id || null;
    if (!response.ok || !providerOrderId) {
      throw new Error(`Prodigi live order failed (${response.status}): ${result?.outcome || result?.error || "unknown error"}`);
    }

    return json({ ok: true, provider: "prodigi", providerOrderId });
  } catch (error) {
    console.error("Built To Offend Prodigi proxy error", String(error?.message || error));
    return json({ ok: false, error: String(error?.message || error) }, 502);
  }
}
