const EXPECTED_PROXY_TOKEN_HASH = "__BTO_PROXY_TOKEN_HASH__";
const PRODIGI_BASES = {
  live: "https://api.prodigi.com",
  sandbox: "https://api.sandbox.prodigi.com",
};
const DEFAULT_SKU = "GLOBAL-GRE-MOH-7X5-DIR";
const CALLBACK_URL = "https://vermalio.stace-walbridge.workers.dev/api/prodigi/webhook";
const SHIPPING_METHODS = new Map([
  ["budget", "Budget"],
  ["standard", "Standard"],
  ["standardplus", "StandardPlus"],
  ["standard plus", "StandardPlus"],
  ["express", "Express"],
  ["overnight", "Overnight"],
]);

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

function normalizeEnvironment(value) {
  return String(value || "live").toLowerCase() === "sandbox" ? "sandbox" : "live";
}

function prodigiApiKey(env, environment) {
  if (environment === "sandbox") {
    return env.PRODIGI_SANDBOX_API_KEY || env.PRODIGI_TEST_API_KEY || null;
  }
  return env.PRODIGI_LIVE_API_KEY || env.PRODIGI_API_KEY || env.PRODIGI_KEY || null;
}

function prodigiBase(environment) {
  return PRODIGI_BASES[normalizeEnvironment(environment)];
}

function shippingMethod(value) {
  const normalized = String(value || "Budget").trim().toLowerCase();
  const method = SHIPPING_METHODS.get(normalized);
  if (!method) throw new Error(`Unsupported Prodigi shipping method: ${value}`);
  return method;
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

async function productDetails(apiKey, sku, environment) {
  const base = prodigiBase(environment);
  const response = await fetch(`${base}/v4.0/products/${encodeURIComponent(sku)}`, {
    headers: { "X-API-Key": apiKey },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || String(payload?.outcome || "").toLowerCase() !== "ok") {
    throw new Error(`Prodigi ${environment} product lookup failed (${response.status})`);
  }
  return payload;
}

function extractPrintAreas(productPayload) {
  const candidates = [];
  const seen = new Set();
  const add = (name) => {
    const value = String(name || "").trim();
    if (value && !seen.has(value)) {
      seen.add(value);
      candidates.push(value);
    }
  };
  const walk = (value) => {
    if (!value || typeof value !== "object") return;
    if (value.printAreas && typeof value.printAreas === "object" && !Array.isArray(value.printAreas)) {
      Object.keys(value.printAreas).forEach(add);
    }
    if (value.printAreaSizes && typeof value.printAreaSizes === "object" && !Array.isArray(value.printAreaSizes)) {
      Object.keys(value.printAreaSizes).forEach(add);
    }
    if (typeof value.printArea === "string") add(value.printArea);
    if (Array.isArray(value)) value.forEach(walk);
    else Object.values(value).forEach(walk);
  };
  walk(productPayload);
  return candidates;
}

function printAreas(productPayload) {
  const areas = extractPrintAreas(productPayload);
  const outsideArea = areas.find((x) => /^(front|cover|outside)$/i.test(x)) ||
    areas.find((x) => /front|cover|outside|default/i.test(x)) || areas[0];
  const insideArea = areas.find((x) => /inside|inner|interior/i.test(x));
  if (!outsideArea || !insideArea || outsideArea === insideArea) {
    throw new Error(`Configured greeting-card SKU does not expose distinct outside and inside print areas (${areas.join(", ") || "none"})`);
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

function verifyCreatedOrder(result, responseStatus, environment) {
  const outcome = String(result?.outcome || "").toLowerCase();
  const allowed = new Set(["created", "onhold", "alreadyexists"]);
  const providerOrderId = result?.order?.id || result?.id || null;
  const issues = Array.isArray(result?.order?.status?.issues) ? result.order.status.issues : [];
  if (!allowed.has(outcome) || !providerOrderId || issues.length) {
    const issueText = issues.length ? `; ${issues.map((x) => x?.description || x?.code || JSON.stringify(x)).join(" | ")}` : "";
    throw new Error(`Prodigi ${environment} order rejected (${responseStatus}): ${result?.outcome || result?.error || "unknown error"}${issueText}`);
  }
  return { providerOrderId, outcome: result.outcome };
}

export async function handleBtoProdigiProxy(request, env, url) {
  if (!(await authorized(request))) return json({ error: "forbidden" }, 403);

  if (request.method === "GET" && url.pathname.endsWith("/health")) {
    const environment = normalizeEnvironment(url.searchParams.get("environment") || "live");
    const apiKey = prodigiApiKey(env, environment);
    if (!apiKey) return json({ ok: false, environment, error: `Prodigi ${environment} key is not configured on Vermalio` }, 503);
    try {
      const sku = url.searchParams.get("sku") || DEFAULT_SKU;
      const product = await productDetails(apiKey, sku, environment);
      const { areas, outsideArea, insideArea } = printAreas(product);
      return json({ ok: true, environment, sku, areas, outsideArea, insideArea });
    } catch (error) {
      return json({ ok: false, environment, error: String(error?.message || error) }, 503);
    }
  }

  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await readJson(request);
    const environment = normalizeEnvironment(body?.prodigiEnv || "live");
    const apiKey = prodigiApiKey(env, environment);
    if (!apiKey) throw new Error(`Prodigi ${environment} key is not configured on Vermalio`);

    const sku = String(body?.sku || DEFAULT_SKU).trim();
    const order = body?.order || {};
    if (!order.id) throw new Error("Missing merchant order reference");
    if (!validAssetUrl(body?.outsideUrl) || !validAssetUrl(body?.insideUrl)) {
      throw new Error("Invalid Built To Offend print artwork URL");
    }

    const product = await productDetails(apiKey, sku, environment);
    const { outsideArea, insideArea } = printAreas(product);
    const recipient = recipientFrom(order);
    const totalPence = Number(order.pricePence || 0) + Number(order.shippingPence || 0);

    const payload = {
      merchantReference: String(order.id),
      idempotencyKey: String(order.id),
      callbackUrl: CALLBACK_URL,
      shippingMethod: shippingMethod(body?.shippingMethod || "Budget"),
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
        environment,
        brutality: String(order.brutality || ""),
      },
    };

    const response = await fetch(`${prodigiBase(environment)}/v4.0/orders`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Prodigi ${environment} order failed (${response.status}): ${result?.outcome || result?.error || "unknown error"}`);
    }
    const verified = verifyCreatedOrder(result, response.status, environment);

    return json({
      ok: true,
      provider: "prodigi",
      environment,
      providerOrderId: verified.providerOrderId,
      outcome: verified.outcome,
    });
  } catch (error) {
    console.error("Built To Offend Prodigi proxy error", String(error?.message || error));
    return json({ ok: false, error: String(error?.message || error) }, 502);
  }
}
